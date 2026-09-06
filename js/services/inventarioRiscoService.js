import { supabase } from '../config/supabase.js';
import { obterIdEmpresaAtiva } from './colaboradorService.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { avaliarCompletudeItem } from '../domain/inventario-risco/completudeInventario.js';

// MVP-09B - Fundacao fisica do Inventario de Riscos Ocupacionais.
// Le/escreve perigo_ocupacional, risco_ergonomico_perigo, inventario_risco,
// inventario_risco_item e inventario_risco_item_atividade (migration 005).
// NUNCA calcula risco, NUNCA altera o Motor individual ou o Motor GHE, e
// NUNCA manipula DOM. Todo isolamento por empresa e feito explicitamente
// (nenhuma consulta global sem filtro por id_empresa/GHE compativel).
//
// Importacao automatica de resultados do Motor GHE para o Inventario e
// MVP-09C - esta feature so cria itens com origem_tipo='MANUAL'. O CHECK
// chk_inventario_risco_item_origem_consistente do banco ja impede
// qualquer item MANUAL de carregar snapshot de classificacao (nunca
// confiar so na aplicacao - secao 21 do prompt MVP-09B).

const COLUNAS_INVENTARIO = `
    id_inventario, id_empresa, numero_versao, id_inventario_anterior, titulo, descricao, status,
    data_referencia, criado_por, publicado_por, criado_em, atualizado_em, publicado_em,
    usuario_criador:usuario!fk_inventario_risco_criado_por(nome),
    usuario_publicador:usuario!fk_inventario_risco_publicado_por(nome)
`;

const COLUNAS_ITEM = `
    id_inventario_risco_item, id_inventario, id_ghe, id_perigo, id_ambiente, id_posto, processo_descricao,
    fonte_circunstancia, possiveis_lesoes_agravos, trabalhadores_expostos_snapshot,
    caracterizacao_exposicao, caracterizacao_exposicao_descricao, medidas_existentes, medida_existente_categoria,
    origem_tipo, id_avaliacao_ghe_risco, pontuacao_snapshot, classificacao_codigo_snapshot,
    classificacao_nome_snapshot, metodologia_codigo_snapshot, metodologia_versao_snapshot,
    criado_em, atualizado_em,
    ghe(nome, codigo),
    perigo_ocupacional(codigo, categoria, nome)
`;

function erroInventario(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

function mapearInventario(linha) {
    if (!linha) return null;
    return {
        ...linha,
        usuario_criador: undefined,
        usuario_publicador: undefined,
        criado_por_nome: linha.usuario_criador?.nome ?? null,
        publicado_por_nome: linha.usuario_publicador?.nome ?? null,
    };
}

function mapearItem(linha) {
    if (!linha) return null;
    return {
        ...linha,
        ghe: undefined,
        perigo_ocupacional: undefined,
        ghe_nome: linha.ghe?.nome ?? null,
        ghe_codigo: linha.ghe?.codigo ?? null,
        perigo_codigo: linha.perigo_ocupacional?.codigo ?? null,
        perigo_categoria: linha.perigo_ocupacional?.categoria ?? null,
        perigo_nome: linha.perigo_ocupacional?.nome ?? null,
    };
}

// =====================================================================
// PERIGO_OCUPACIONAL (catalogo, somente leitura nesta feature)
// =====================================================================

export async function listarPerigosOcupacionais() {
    const { data, error } = await supabase
        .from('perigo_ocupacional')
        .select('id_perigo, codigo, categoria, nome, descricao, ativo')
        .eq('ativo', true)
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
}

// =====================================================================
// INVENTARIO_RISCO
// =====================================================================

async function proximoNumeroVersao(idEmpresa) {
    const { data, error } = await supabase
        .from('inventario_risco')
        .select('numero_versao')
        .eq('id_empresa', idEmpresa)
        .order('numero_versao', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return (data?.numero_versao || 0) + 1;
}

function validarCamposInventario(dados) {
    if (!campoPreenchido(dados.titulo)) {
        throw erroInventario('Informe o título do inventário.', 'TITULO_OBRIGATORIO');
    }
    if (!dados.data_referencia) {
        throw erroInventario('Informe a data de referência.', 'DATA_REFERENCIA_OBRIGATORIA');
    }
    if (!dados.id_usuario_criador) {
        throw erroInventario('Selecione o responsável pela criação.', 'CRIADOR_OBRIGATORIO');
    }
}

// Nunca confiar apenas na UI (secao 21 do prompt MVP-09B): usada por toda
// operacao que muda cabecalho/itens/atividades de um inventario, mesmo
// que a chamada venha direto do service (nao so de um clique bloqueado
// na tela).
function validarInventarioEditavel(inventario) {
    if (inventario.status !== 'RASCUNHO') {
        throw erroInventario('Este inventário não está em rascunho e não pode ser alterado. Crie uma nova versão para editar.', 'INVENTARIO_NAO_EDITAVEL');
    }
}

// GHE/inventario precisam pertencer a mesma empresa (secao 25/53/78) - a
// FK sozinha nao impede um id_ghe de outra empresa de ser gravado.
async function validarGheDaEmpresaDoInventario(idGhe, idEmpresaInventario) {
    const { data, error } = await supabase
        .from('ghe')
        .select('id_empresa, universo')
        .eq('id_ghe', idGhe)
        .single();

    if (error) throw error;
    if (data.id_empresa !== idEmpresaInventario) {
        throw erroInventario('O GHE selecionado não pertence à empresa deste inventário.', 'GHE_INCOMPATIVEL');
    }
    return data;
}

// Lista todas as versoes do Inventario da empresa ativa, com contagem de
// itens e de GHEs abrangidos ja anexada (bulk query - nunca uma consulta
// por linha, mesmo criterio de gheService.listarGhes).
export async function listarInventarios() {
    const idEmpresa = await obterIdEmpresaAtiva();

    const { data: inventarios, error } = await supabase
        .from('inventario_risco')
        .select(COLUNAS_INVENTARIO)
        .eq('id_empresa', idEmpresa)
        .order('numero_versao', { ascending: false });

    if (error) throw error;

    const ids = (inventarios || []).map((i) => i.id_inventario);
    const agregadoPorInventario = new Map();

    if (ids.length > 0) {
        const { data: itens, error: erroItens } = await supabase
            .from('inventario_risco_item')
            .select('id_inventario, id_ghe')
            .in('id_inventario', ids);

        if (erroItens) throw erroItens;

        (itens || []).forEach((linha) => {
            if (!agregadoPorInventario.has(linha.id_inventario)) {
                agregadoPorInventario.set(linha.id_inventario, { totalItens: 0, ghes: new Set() });
            }
            const agregado = agregadoPorInventario.get(linha.id_inventario);
            agregado.totalItens += 1;
            agregado.ghes.add(linha.id_ghe);
        });
    }

    return (inventarios || []).map((linha) => {
        const agregado = agregadoPorInventario.get(linha.id_inventario) || { totalItens: 0, ghes: new Set() };
        return {
            ...mapearInventario(linha),
            totalItens: agregado.totalItens,
            totalGhes: agregado.ghes.size,
        };
    });
}

export async function buscarInventario(idInventario) {
    const { data, error } = await supabase
        .from('inventario_risco')
        .select(COLUNAS_INVENTARIO)
        .eq('id_inventario', idInventario)
        .single();

    if (error) throw error;
    return mapearInventario(data);
}

// dados: { titulo, descricao, data_referencia, id_usuario_criador }
// numero_versao e resolvido automaticamente (secao 57) - sempre a proxima
// sequencia inteira da empresa (1, 2, 3...). id_inventario_anterior fica
// nulo aqui - so criarNovaVersao() o preenche.
export async function criarInventario(dados) {
    validarCamposInventario(dados);
    const idEmpresa = await obterIdEmpresaAtiva();
    const numeroVersao = await proximoNumeroVersao(idEmpresa);

    const { data, error } = await supabase
        .from('inventario_risco')
        .insert({
            id_empresa: idEmpresa,
            numero_versao: numeroVersao,
            id_inventario_anterior: null,
            titulo: dados.titulo.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            status: 'RASCUNHO',
            data_referencia: dados.data_referencia,
            criado_por: dados.id_usuario_criador,
        })
        .select(COLUNAS_INVENTARIO)
        .single();

    if (error) {
        console.error('Erro ao criar inventário:', error);
        if (error.code === '23505') {
            throw erroInventario('Já existe uma versão com este número para esta empresa.', 'VERSAO_DUPLICADA');
        }
        throw erroInventario('Não foi possível criar o inventário.', 'PERSISTENCIA_INVENTARIO_FALHOU');
    }
    return mapearInventario(data);
}

// dados: { titulo, descricao, data_referencia } - numero_versao,
// id_empresa, criado_por e id_inventario_anterior nunca sao alteraveis
// por aqui (preservam o contexto historico da versao).
export async function atualizarInventarioRascunho(idInventario, dados) {
    const atual = await buscarInventario(idInventario);
    validarInventarioEditavel(atual);

    if (!campoPreenchido(dados.titulo)) {
        throw erroInventario('Informe o título do inventário.', 'TITULO_OBRIGATORIO');
    }
    if (!dados.data_referencia) {
        throw erroInventario('Informe a data de referência.', 'DATA_REFERENCIA_OBRIGATORIA');
    }

    const { data, error } = await supabase
        .from('inventario_risco')
        .update({
            titulo: dados.titulo.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            data_referencia: dados.data_referencia,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_inventario', idInventario)
        .select(COLUNAS_INVENTARIO)
        .single();

    if (error) {
        console.error('Erro ao atualizar inventário:', error);
        throw erroInventario('Não foi possível salvar as alterações.', 'PERSISTENCIA_INVENTARIO_FALHOU');
    }
    return mapearInventario(data);
}

// Preferir CANCELADO a DELETE fisico (secao 49/50) - especialmente
// relevante se o rascunho ja possuir itens.
export async function cancelarRascunho(idInventario) {
    const atual = await buscarInventario(idInventario);
    validarInventarioEditavel(atual);

    const { data, error } = await supabase
        .from('inventario_risco')
        .update({ status: 'CANCELADO', atualizado_em: new Date().toISOString() })
        .eq('id_inventario', idInventario)
        .select(COLUNAS_INVENTARIO)
        .single();

    if (error) throw error;
    return mapearInventario(data);
}

// =====================================================================
// INVENTARIO_RISCO_ITEM
// =====================================================================

async function buscarAtividadesPorItens(idsItem) {
    const mapa = new Map();
    if (!idsItem || idsItem.length === 0) return mapa;

    const { data, error } = await supabase
        .from('inventario_risco_item_atividade')
        .select('id_inventario_risco_item_atividade, id_inventario_risco_item, id_atividade, atividade(nome)')
        .in('id_inventario_risco_item', idsItem);

    if (error) throw error;

    (data || []).forEach((linha) => {
        if (!mapa.has(linha.id_inventario_risco_item)) {
            mapa.set(linha.id_inventario_risco_item, []);
        }
        mapa.get(linha.id_inventario_risco_item).push({
            id_inventario_risco_item_atividade: linha.id_inventario_risco_item_atividade,
            id_atividade: linha.id_atividade,
            atividade_nome: linha.atividade?.nome ?? null,
        });
    });
    return mapa;
}

// Lista os itens de uma versao, cada um ja com suas atividades e sua
// completude calculada (bulk query para atividades - nunca uma consulta
// por item).
export async function listarItens(idInventario) {
    const { data: itens, error } = await supabase
        .from('inventario_risco_item')
        .select(COLUNAS_ITEM)
        .eq('id_inventario', idInventario)
        .order('id_inventario_risco_item', { ascending: true });

    if (error) throw error;

    const ids = (itens || []).map((i) => i.id_inventario_risco_item);
    const atividadesPorItem = await buscarAtividadesPorItens(ids);

    return (itens || []).map((linha) => {
        const item = mapearItem(linha);
        const atividades = atividadesPorItem.get(item.id_inventario_risco_item) || [];
        return { ...item, atividades, completude: avaliarCompletudeItem(item, atividades) };
    });
}

export async function buscarItem(idItem) {
    const { data, error } = await supabase
        .from('inventario_risco_item')
        .select(COLUNAS_ITEM)
        .eq('id_inventario_risco_item', idItem)
        .single();

    if (error) throw error;

    const item = mapearItem(data);
    const atividadesPorItem = await buscarAtividadesPorItens([idItem]);
    const atividades = atividadesPorItem.get(idItem) || [];
    return { ...item, atividades, completude: avaliarCompletudeItem(item, atividades) };
}

function validarCamposItem(dados) {
    if (!dados.id_ghe) {
        throw erroInventario('Selecione o GHE.', 'GHE_OBRIGATORIO');
    }
    if (!dados.id_perigo) {
        throw erroInventario('Selecione o perigo.', 'PERIGO_OBRIGATORIO');
    }
}

function camposDeConteudoItem(dados) {
    return {
        id_ambiente: dados.id_ambiente || null,
        id_posto: dados.id_posto || null,
        processo_descricao: campoPreenchido(dados.processo_descricao) ? dados.processo_descricao.trim() : null,
        fonte_circunstancia: campoPreenchido(dados.fonte_circunstancia) ? dados.fonte_circunstancia.trim() : null,
        possiveis_lesoes_agravos: campoPreenchido(dados.possiveis_lesoes_agravos) ? dados.possiveis_lesoes_agravos.trim() : null,
        caracterizacao_exposicao: dados.caracterizacao_exposicao || null,
        caracterizacao_exposicao_descricao: campoPreenchido(dados.caracterizacao_exposicao_descricao) ? dados.caracterizacao_exposicao_descricao.trim() : null,
        medidas_existentes: campoPreenchido(dados.medidas_existentes) ? dados.medidas_existentes.trim() : null,
        medida_existente_categoria: dados.medida_existente_categoria || null,
    };
}

// dados: { id_ghe, id_perigo, id_ambiente, id_posto, processo_descricao,
//          fonte_circunstancia, possiveis_lesoes_agravos,
//          trabalhadores_expostos, caracterizacao_exposicao,
//          caracterizacao_exposicao_descricao, medidas_existentes,
//          medida_existente_categoria }
//
// Todo item criado por aqui e origem_tipo='MANUAL' - a importacao do
// Motor GHE (origem_tipo='MOTOR_GHE') e MVP-09C. trabalhadores_expostos,
// quando omitido, e preenchido com ghe.universo NO MOMENTO da criacao -
// um snapshot deliberado que nunca muda depois, mesmo que o universo do
// GHE seja atualizado (secao 26/71).
export async function criarItem(idInventario, dados) {
    const inventario = await buscarInventario(idInventario);
    validarInventarioEditavel(inventario);
    validarCamposItem(dados);
    const ghe = await validarGheDaEmpresaDoInventario(dados.id_ghe, inventario.id_empresa);

    const trabalhadoresExpostos = campoPreenchido(String(dados.trabalhadores_expostos ?? ''))
        ? Number(dados.trabalhadores_expostos)
        : ghe.universo;

    const { data, error } = await supabase
        .from('inventario_risco_item')
        .insert({
            id_inventario: idInventario,
            id_ghe: dados.id_ghe,
            id_perigo: dados.id_perigo,
            trabalhadores_expostos_snapshot: trabalhadoresExpostos,
            origem_tipo: 'MANUAL',
            id_avaliacao_ghe_risco: null,
            ...camposDeConteudoItem(dados),
        })
        .select(COLUNAS_ITEM)
        .single();

    if (error) {
        console.error('Erro ao criar item do inventário:', error);
        throw erroInventario('Não foi possível criar o item.', 'PERSISTENCIA_ITEM_FALHOU');
    }
    const item = mapearItem(data);
    return { ...item, atividades: [], completude: avaliarCompletudeItem(item, []) };
}

// dados: mesmos campos de criarItem, exceto trabalhadores_expostos (ver
// abaixo). Nunca altera id_inventario, origem_tipo, id_avaliacao_ghe_risco
// ou os snapshots de classificacao - a proveniencia de um item nunca e
// reescrita por uma edicao de conteudo (secao 36 do MVP-09A).
export async function atualizarItem(idItem, dados) {
    const itemAtual = await buscarItem(idItem);
    const inventario = await buscarInventario(itemAtual.id_inventario);
    validarInventarioEditavel(inventario);
    validarCamposItem(dados);

    if (dados.id_ghe !== itemAtual.id_ghe) {
        await validarGheDaEmpresaDoInventario(dados.id_ghe, inventario.id_empresa);
    }

    // trabalhadores_expostos_snapshot so muda se o usuario informar
    // explicitamente um novo valor - do contrario preserva o snapshot
    // atual (nunca recalcula sozinho a partir do universo do GHE).
    const trabalhadoresExpostos = campoPreenchido(String(dados.trabalhadores_expostos ?? ''))
        ? Number(dados.trabalhadores_expostos)
        : itemAtual.trabalhadores_expostos_snapshot;

    const { data, error } = await supabase
        .from('inventario_risco_item')
        .update({
            id_ghe: dados.id_ghe,
            id_perigo: dados.id_perigo,
            trabalhadores_expostos_snapshot: trabalhadoresExpostos,
            atualizado_em: new Date().toISOString(),
            ...camposDeConteudoItem(dados),
        })
        .eq('id_inventario_risco_item', idItem)
        .select(COLUNAS_ITEM)
        .single();

    if (error) {
        console.error('Erro ao atualizar item do inventário:', error);
        throw erroInventario('Não foi possível salvar as alterações do item.', 'PERSISTENCIA_ITEM_FALHOU');
    }

    const item = mapearItem(data);
    const atividadesPorItem = await buscarAtividadesPorItens([idItem]);
    const atividades = atividadesPorItem.get(idItem) || [];
    return { ...item, atividades, completude: avaliarCompletudeItem(item, atividades) };
}

export async function validarItemCompleto(idItem) {
    const item = await buscarItem(idItem);
    return item.completude;
}

// =====================================================================
// INVENTARIO_RISCO_ITEM_ATIVIDADE
// =====================================================================

export async function listarAtividadesDoItem(idItem) {
    const atividadesPorItem = await buscarAtividadesPorItens([idItem]);
    return atividadesPorItem.get(idItem) || [];
}

// Bloqueia duplicidade (uq_inventario_risco_item_atividade) e atividade
// de outra empresa (secao 27/28/53). So permite quando o inventario do
// item ainda esta em RASCUNHO.
export async function associarAtividade(idItem, idAtividade) {
    if (!idAtividade) {
        throw erroInventario('Selecione a atividade.', 'ATIVIDADE_OBRIGATORIA');
    }

    const item = await buscarItem(idItem);
    const inventario = await buscarInventario(item.id_inventario);
    validarInventarioEditavel(inventario);

    const { data: atividade, error: erroAtividade } = await supabase
        .from('atividade')
        .select('id_empresa')
        .eq('id_atividade', idAtividade)
        .single();
    if (erroAtividade) throw erroAtividade;
    if (atividade.id_empresa !== inventario.id_empresa) {
        throw erroInventario('A atividade selecionada não pertence a esta empresa.', 'ATIVIDADE_INCOMPATIVEL');
    }

    const { error } = await supabase
        .from('inventario_risco_item_atividade')
        .insert({ id_inventario_risco_item: idItem, id_atividade: idAtividade });

    if (error) {
        if (error.code === '23505') {
            throw erroInventario('Esta atividade já está associada a este item.', 'ATIVIDADE_JA_ASSOCIADA');
        }
        console.error('Erro ao associar atividade ao item:', error);
        throw erroInventario('Não foi possível associar a atividade.', 'PERSISTENCIA_ATIVIDADE_FALHOU');
    }
}

export async function removerAtividade(idInventarioRiscoItemAtividade) {
    const { data: associacao, error: erroBusca } = await supabase
        .from('inventario_risco_item_atividade')
        .select('id_inventario_risco_item')
        .eq('id_inventario_risco_item_atividade', idInventarioRiscoItemAtividade)
        .single();
    if (erroBusca) throw erroBusca;

    const item = await buscarItem(associacao.id_inventario_risco_item);
    const inventario = await buscarInventario(item.id_inventario);
    validarInventarioEditavel(inventario);

    const { error } = await supabase
        .from('inventario_risco_item_atividade')
        .delete()
        .eq('id_inventario_risco_item_atividade', idInventarioRiscoItemAtividade);
    if (error) throw error;
}

// =====================================================================
// ORIGEM (preparado para MVP-09C - nenhum item MOTOR_GHE e criado aqui)
// =====================================================================

// Retorna null para itens MANUAL (nao ha origem a exibir). Para um
// futuro item MOTOR_GHE, resolve toda a cadeia a partir do UNICO
// ponteiro de origem armazenado (id_avaliacao_ghe_risco) - nunca
// duplica FKs de processamento/avaliacao diretamente no item (MVP-09A,
// secao 11).
export async function buscarOrigemItem(idItem) {
    const item = await buscarItem(idItem);
    if (item.origem_tipo !== 'MOTOR_GHE' || !item.id_avaliacao_ghe_risco) {
        return null;
    }

    const { data, error } = await supabase
        .from('avaliacao_ghe_risco')
        .select(`
            id_avaliacao_ghe_risco,
            processamento_risco_ghe(id_processamento_risco_ghe, id_avaliacao_ghe, processado_em,
                metodologia_risco(codigo, versao))
        `)
        .eq('id_avaliacao_ghe_risco', item.id_avaliacao_ghe_risco)
        .single();

    if (error) throw error;

    return {
        id_avaliacao_ghe_risco: data.id_avaliacao_ghe_risco,
        id_processamento_risco_ghe: data.processamento_risco_ghe?.id_processamento_risco_ghe ?? null,
        id_avaliacao_ghe: data.processamento_risco_ghe?.id_avaliacao_ghe ?? null,
        processado_em: data.processamento_risco_ghe?.processado_em ?? null,
        metodologia_codigo: data.processamento_risco_ghe?.metodologia_risco?.codigo ?? null,
        metodologia_versao: data.processamento_risco_ghe?.metodologia_risco?.versao ?? null,
    };
}

// =====================================================================
// PUBLICACAO
// =====================================================================

// Nunca so avisa - bloqueia. Reavalia tudo a partir do banco (nunca
// confia em estado calculado anteriormente na tela) - secao 41 do MVP-09B.
export async function validarInventarioPublicavel(idInventario) {
    const inventario = await buscarInventario(idInventario);
    const problemas = [];

    if (inventario.status !== 'RASCUNHO') {
        problemas.push({ codigo: 'STATUS_INVALIDO', mensagem: 'Somente inventários em rascunho podem ser publicados.' });
        return { publicavel: false, problemas, itensIncompletos: [] };
    }

    const itens = await listarItens(idInventario);
    if (itens.length === 0) {
        problemas.push({ codigo: 'SEM_ITENS', mensagem: 'O inventário precisa de ao menos um item para ser publicado.' });
    }

    const itensIncompletos = itens
        .filter((item) => !item.completude.completo)
        .map((item) => ({
            id_inventario_risco_item: item.id_inventario_risco_item,
            perigo_nome: item.perigo_nome,
            ghe_nome: item.ghe_nome,
            camposPendentes: item.completude.camposPendentes,
        }));

    if (itensIncompletos.length > 0) {
        problemas.push({ codigo: 'ITENS_INCOMPLETOS', mensagem: `${itensIncompletos.length} item(ns) incompleto(s).` });
    }

    // Reconfirma isolamento por empresa antes de congelar a versao -
    // defensivo mesmo criarItem/atualizarItem ja bloquearem isso na
    // origem (secao 25/53/57/78).
    if (itens.length > 0) {
        const idsGhe = [...new Set(itens.map((i) => i.id_ghe))];
        const { data: ghes, error } = await supabase
            .from('ghe')
            .select('id_ghe, id_empresa')
            .in('id_ghe', idsGhe);
        if (error) throw error;

        const idsForaDaEmpresa = (ghes || [])
            .filter((g) => g.id_empresa !== inventario.id_empresa)
            .map((g) => g.id_ghe);

        if (idsForaDaEmpresa.length > 0) {
            problemas.push({ codigo: 'GHE_CROSS_TENANT', mensagem: 'Existem itens com GHE de outra empresa.' });
        }
    }

    return {
        publicavel: problemas.length === 0,
        problemas,
        itensIncompletos,
    };
}

// Publicacao e sempre explicita (secao 43) - nunca automatica apos salvar
// o ultimo item. status='RASCUNHO' no WHERE e uma defesa extra contra
// corrida/duplo clique (secao 21) - se outra chamada ja publicou este
// inventario entre a validacao e este UPDATE, nenhuma linha e afetada e
// o erro do Supabase (sem linha) e reportado como falha, nunca como
// sucesso silencioso.
export async function publicarInventario(idInventario, idUsuario) {
    if (!idUsuario) {
        throw erroInventario('Selecione quem está publicando o inventário.', 'PUBLICADOR_OBRIGATORIO');
    }

    const validacao = await validarInventarioPublicavel(idInventario);
    if (!validacao.publicavel) {
        const erro = erroInventario('O inventário não pode ser publicado enquanto houver pendências.', 'INVENTARIO_NAO_PUBLICAVEL');
        erro.detalhes = validacao;
        throw erro;
    }

    const { data, error } = await supabase
        .from('inventario_risco')
        .update({
            status: 'PUBLICADO',
            publicado_por: idUsuario,
            publicado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_inventario', idInventario)
        .eq('status', 'RASCUNHO')
        .select(COLUNAS_INVENTARIO)
        .single();

    if (error) {
        console.error('Erro ao publicar inventário:', error);
        throw erroInventario('Não foi possível publicar o inventário.', 'PERSISTENCIA_INVENTARIO_FALHOU');
    }
    return mapearInventario(data);
}

// =====================================================================
// NOVA VERSAO
// =====================================================================

// Somente a partir de um Inventario PUBLICADO (secao 45). Clona os itens
// (e suas atividades) da versao anterior para NOVAS linhas - nunca
// compartilha a linha fisica com a v1 (secao 46/47/48). Cada item
// clonado recomeca sua propria checagem de completude do zero, mesmo que
// ja viesse completo. Insercao item a item (nao em lote) para garantir a
// correspondencia exata entre cada item antigo e seu clone, necessaria
// para clonar as atividades certas de cada um.
export async function criarNovaVersao(idInventarioPublicado, dados) {
    const anterior = await buscarInventario(idInventarioPublicado);
    if (anterior.status !== 'PUBLICADO') {
        throw erroInventario('Só é possível criar uma nova versão a partir de um inventário publicado.', 'INVENTARIO_NAO_PUBLICADO');
    }
    validarCamposInventario(dados);

    const numeroVersao = await proximoNumeroVersao(anterior.id_empresa);

    const { data: novo, error } = await supabase
        .from('inventario_risco')
        .insert({
            id_empresa: anterior.id_empresa,
            numero_versao: numeroVersao,
            id_inventario_anterior: anterior.id_inventario,
            titulo: dados.titulo.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            status: 'RASCUNHO',
            data_referencia: dados.data_referencia,
            criado_por: dados.id_usuario_criador,
        })
        .select(COLUNAS_INVENTARIO)
        .single();

    if (error) {
        console.error('Erro ao criar nova versão do inventário:', error);
        throw erroInventario('Não foi possível criar a nova versão.', 'PERSISTENCIA_INVENTARIO_FALHOU');
    }

    const itensAnteriores = await listarItens(anterior.id_inventario);

    for (const itemAntigo of itensAnteriores) {
        const { data: novoItem, error: erroItem } = await supabase
            .from('inventario_risco_item')
            .insert({
                id_inventario: novo.id_inventario,
                id_ghe: itemAntigo.id_ghe,
                id_perigo: itemAntigo.id_perigo,
                id_ambiente: itemAntigo.id_ambiente,
                id_posto: itemAntigo.id_posto,
                processo_descricao: itemAntigo.processo_descricao,
                fonte_circunstancia: itemAntigo.fonte_circunstancia,
                possiveis_lesoes_agravos: itemAntigo.possiveis_lesoes_agravos,
                trabalhadores_expostos_snapshot: itemAntigo.trabalhadores_expostos_snapshot,
                caracterizacao_exposicao: itemAntigo.caracterizacao_exposicao,
                caracterizacao_exposicao_descricao: itemAntigo.caracterizacao_exposicao_descricao,
                medidas_existentes: itemAntigo.medidas_existentes,
                medida_existente_categoria: itemAntigo.medida_existente_categoria,
                origem_tipo: itemAntigo.origem_tipo,
                id_avaliacao_ghe_risco: itemAntigo.id_avaliacao_ghe_risco,
                pontuacao_snapshot: itemAntigo.pontuacao_snapshot,
                classificacao_codigo_snapshot: itemAntigo.classificacao_codigo_snapshot,
                classificacao_nome_snapshot: itemAntigo.classificacao_nome_snapshot,
                metodologia_codigo_snapshot: itemAntigo.metodologia_codigo_snapshot,
                metodologia_versao_snapshot: itemAntigo.metodologia_versao_snapshot,
            })
            .select('id_inventario_risco_item')
            .single();

        if (erroItem) {
            console.error('Erro ao clonar item na nova versão:', erroItem);
            throw erroInventario('A nova versão foi criada, mas um item não pôde ser clonado.', 'CLONAGEM_ITEM_FALHOU');
        }

        for (const atividade of itemAntigo.atividades || []) {
            const { error: erroAtividade } = await supabase
                .from('inventario_risco_item_atividade')
                .insert({ id_inventario_risco_item: novoItem.id_inventario_risco_item, id_atividade: atividade.id_atividade });

            if (erroAtividade) {
                console.error('Erro ao clonar atividade do item:', erroAtividade);
                throw erroInventario('A nova versão foi criada, mas uma atividade não pôde ser clonada.', 'CLONAGEM_ATIVIDADE_FALHOU');
            }
        }
    }

    return mapearInventario(novo);
}
