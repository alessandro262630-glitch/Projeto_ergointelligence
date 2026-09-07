import { supabase } from '../config/supabase.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { buscarInventario, listarItens } from './inventarioRiscoService.js';
import { verificarAlgumaMetodologiaDemonstrativa } from './inventarioIntegracaoService.js';
import { obterIdEmpresaAtiva } from './colaboradorService.js';

// FEIRA-04 - Plano de Acao MVP.
// FAIR-PA-01 - Plano de Acao 2.0: expande a mesma tabela para tambem
// aceitar Inventario de Riscos como origem (origem_tipo), em vez de criar
// um service separado por origem (secao 30 do prompt - "nao duplicar
// service"). O fluxo individual (origem_tipo=AVALIACAO_INDIVIDUAL)
// continua exatamente como estava - so passou a informar origem_tipo
// explicitamente.
// Le/escreve exclusivamente PLANO_ACAO e ACAO_PLANO (colunas novas:
// migration 007). NUNCA chama motorRisco.js/classificadorRisco.js/
// riscoService.js/motorRiscoGhe.js - so consome resultados/recomendacoes
// ja persistidos por outras features. So Supabase aqui: nenhum
// document.*/innerHTML/addEventListener.

// Unicos valores aceitos pelo schema (chk_plano_acao_status /
// chk_acao_plano_status / chk_acao_plano_prioridade / chk_plano_acao_origem_tipo).
const STATUS_PLANO_VALIDOS = ['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'];
const STATUS_ACAO_VALIDOS = ['ABERTA', 'EM_ANDAMENTO', 'BLOQUEADA', 'CONCLUIDA', 'CANCELADA'];
const PRIORIDADES_ACAO_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

const COLUNAS_PLANO = 'id_plano, id_avaliacao, origem_tipo, id_inventario, titulo, descricao, status, criado_por, '
    + 'data_inicio, data_alvo, data_conclusao, criado_em, atualizado_em';

const COLUNAS_ACAO = 'id_acao, id_plano, id_avaliacao_recomendacao, id_inventario_risco_item, id_responsavel, descricao, '
    + 'prioridade, prazo, status, data_conclusao, evidencia_texto, criado_em, atualizado_em, '
    + 'usuario(nome), '
    + 'avaliacao_recomendacao(id_avaliacao_recomendacao, id_avaliacao, recomendacao(codigo, titulo)), '
    + 'inventario_risco_item(id_inventario_risco_item, id_inventario, trabalhadores_expostos_snapshot, '
    + 'classificacao_nome_snapshot, ghe(nome), perigo_ocupacional(nome))';

function erroPlanoAcao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Achata os relacionamentos embutidos do PostgREST em campos de exibicao
// simples, no mesmo espirito de vinculoService.mapearVinculo /
// recomendacaoService.mapearAvaliacaoRecomendacao.
function mapearAcao(linha) {
    if (!linha) {
        return null;
    }
    const item = linha.inventario_risco_item;
    return {
        id_acao: linha.id_acao,
        id_plano: linha.id_plano,
        id_avaliacao_recomendacao: linha.id_avaliacao_recomendacao,
        id_inventario_risco_item: linha.id_inventario_risco_item,
        id_responsavel: linha.id_responsavel,
        descricao: linha.descricao,
        prioridade: linha.prioridade,
        prazo: linha.prazo,
        status: linha.status,
        data_conclusao: linha.data_conclusao,
        evidencia_texto: linha.evidencia_texto,
        criado_em: linha.criado_em,
        atualizado_em: linha.atualizado_em,
        responsavel_nome: linha.usuario?.nome ?? null,
        recomendacao_codigo: linha.avaliacao_recomendacao?.recomendacao?.codigo ?? null,
        recomendacao_titulo: linha.avaliacao_recomendacao?.recomendacao?.titulo ?? null,
        // Contexto do item do Inventario, somente leitura (secao 41/42 do
        // prompt FAIR-PA-01) - o Plano de Acao NUNCA edita/recalcula isso,
        // so exibe o snapshot ja persistido.
        item_inventario_id_inventario: item?.id_inventario ?? null,
        item_inventario_ghe: item?.ghe?.nome ?? null,
        item_inventario_perigo: item?.perigo_ocupacional?.nome ?? null,
        item_inventario_classificacao: item?.classificacao_nome_snapshot ?? null,
        item_inventario_expostos: item?.trabalhadores_expostos_snapshot ?? null,
    };
}

// =====================================================================
// Plano de Acao
// =====================================================================

// O schema NAO possui UNIQUE(id_avaliacao) em plano_acao - a modelagem
// permite mais de um plano por avaliacao (ver database/schema.sql e o
// relatorio final da FEIRA-04). Esta funcao respeita essa modelagem: nunca
// lanca erro por "duplicidade", apenas retorna o plano mais recente
// (criado_em DESC) quando existir mais de um, e null quando a avaliacao
// ainda nao tem nenhum - o estado "sem plano" e valido, nao um erro.
export async function buscarPlanoPorAvaliacao(idAvaliacao) {
    const { data, error } = await supabase
        .from('plano_acao')
        .select(COLUNAS_PLANO)
        .eq('id_avaliacao', idAvaliacao)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }
    return data;
}

export async function buscarPlanoPorId(idPlano) {
    const { data, error } = await supabase
        .from('plano_acao')
        .select(COLUNAS_PLANO)
        .eq('id_plano', idPlano)
        .single();

    if (error) {
        throw error;
    }
    return data;
}

// Mesmo espirito de buscarPlanoPorAvaliacao (secao 35/36 do prompt
// FAIR-PA-01): o schema tambem nao possui UNIQUE(id_inventario) - a UI
// deve evitar criar planos duplicados oferecendo "Ver Plano de Ação" em
// vez de "Criar" quando ja existir um, mas o banco nao bloqueia
// estruturalmente. Retorna o mais recente, ou null (estado valido).
export async function buscarPlanoPorInventario(idInventario) {
    const { data, error } = await supabase
        .from('plano_acao')
        .select(COLUNAS_PLANO)
        .eq('id_inventario', idInventario)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }
    return data;
}

// Todos os planos ja criados para esta versao do Inventario (normalmente
// zero ou um, mas o schema permite mais - secao 35).
export async function listarPlanosDoInventario(idInventario) {
    const { data, error } = await supabase
        .from('plano_acao')
        .select(COLUNAS_PLANO)
        .eq('id_inventario', idInventario)
        .order('criado_em', { ascending: false });

    if (error) {
        throw error;
    }
    return data || [];
}

function validarCamposComunsPlano(dados) {
    if (!campoPreenchido(dados.titulo)) {
        throw erroPlanoAcao('Informe o título do plano.', 'TITULO_OBRIGATORIO');
    }
    if (!STATUS_PLANO_VALIDOS.includes(dados.status)) {
        throw erroPlanoAcao('Selecione um status válido para o plano.', 'STATUS_INVALIDO');
    }
    if (!dados.criado_por) {
        throw erroPlanoAcao('Não foi possível identificar o responsável pela criação do plano.', 'CRIADO_POR_OBRIGATORIO');
    }
    if (!dados.data_inicio) {
        throw erroPlanoAcao('Informe a data de início do plano.', 'DATA_INICIO_OBRIGATORIA');
    }
    // Espelha chk_plano_acao_data_alvo/chk_plano_acao_data_conclusao (secao
    // 24 do prompt) - validado tambem aqui para dar mensagem amigavel antes
    // do banco rejeitar via CHECK constraint.
    if (dados.data_alvo && dados.data_alvo < dados.data_inicio) {
        throw erroPlanoAcao('A data alvo não pode ser anterior à data de início.', 'DATA_ALVO_INVALIDA');
    }
    if (dados.data_conclusao && dados.data_conclusao < dados.data_inicio) {
        throw erroPlanoAcao('A data de conclusão não pode ser anterior à data de início.', 'DATA_CONCLUSAO_INVALIDA');
    }
}

// Escritor unico e privado - as duas origens (secao 10) sempre passam por
// aqui, nunca duplicando a logica de insert (secao 30). origem_tipo e as
// duas FKs (id_avaliacao/id_inventario) sao decididas pelos wrappers
// publicos abaixo, nunca por quem chama o service diretamente.
async function inserirPlano(dados) {
    validarCamposComunsPlano(dados);

    const { data, error } = await supabase
        .from('plano_acao')
        .insert({
            origem_tipo: dados.origem_tipo,
            id_avaliacao: dados.id_avaliacao,
            id_inventario: dados.id_inventario,
            titulo: dados.titulo.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            status: dados.status,
            criado_por: dados.criado_por,
            data_inicio: dados.data_inicio,
            data_alvo: dados.data_alvo || null,
            data_conclusao: dados.data_conclusao || null,
        })
        .select(COLUNAS_PLANO)
        .single();

    if (error) {
        console.error('Erro ao criar plano de ação:', error);
        throw erroPlanoAcao('Não foi possível criar o plano de ação.', 'PERSISTENCIA_PLANO_FALHOU');
    }
    return data;
}

// dados: { id_avaliacao, titulo, descricao, status, criado_por, data_inicio, data_alvo, data_conclusao }
// Fluxo legado (FEIRA-04) - comportamento identico ao de antes do
// FAIR-PA-01, so passou a gravar origem_tipo explicitamente.
export async function criarPlanoAvaliacaoIndividual(dados) {
    if (!dados.id_avaliacao) {
        throw erroPlanoAcao('Avaliação não informada.', 'AVALIACAO_OBRIGATORIA');
    }
    return inserirPlano({
        ...dados,
        origem_tipo: 'AVALIACAO_INDIVIDUAL',
        id_inventario: null,
    });
}

// dados: { id_inventario, titulo, descricao, status, criado_por, data_inicio, data_alvo, data_conclusao }
// Nova origem (secao 7/11/20 do prompt FAIR-PA-01). So aceita Inventario
// PUBLICADO (decisao documentada em docs/fair-pa01-plano-acao-ghe-inventario.md,
// secao 20/21 do prompt): o Plano deve tratar riscos ja consolidados no
// documento, nunca um rascunho ainda em edicao. Tambem valida que o
// Inventario pertence a empresa ativa (secao 19 - cross-tenant), mesmo
// padrao de gheService.validarSetorDaEmpresa.
export async function criarPlanoInventario(dados) {
    if (!dados.id_inventario) {
        throw erroPlanoAcao('Inventário não informado.', 'INVENTARIO_OBRIGATORIO');
    }

    const inventario = await buscarInventario(dados.id_inventario);
    if (inventario.status !== 'PUBLICADO') {
        throw erroPlanoAcao('Só é possível criar um Plano de Ação a partir de um Inventário publicado.', 'INVENTARIO_NAO_PUBLICADO');
    }

    const idEmpresaAtiva = await obterIdEmpresaAtiva();
    if (inventario.id_empresa !== idEmpresaAtiva) {
        throw erroPlanoAcao('O inventário selecionado não pertence a esta empresa.', 'INVENTARIO_INCOMPATIVEL');
    }

    return inserirPlano({
        ...dados,
        origem_tipo: 'INVENTARIO_RISCOS',
        id_avaliacao: null,
    });
}

// Verifica se algum item MOTOR_GHE desta versao do Inventario usa uma
// metodologia DEMONSTRATIVA (secao 21/22/68) - reaproveita
// inventarioRiscoService.listarItens e
// inventarioIntegracaoService.verificarAlgumaMetodologiaDemonstrativa
// (mesma funcao ja usada em inventario-detalhe.js), sem nenhuma consulta
// nova. Usada pela pagina para mostrar o aviso "resultados demonstrativos"
// tambem no Plano de Ação de origem Inventario.
export async function verificarPlanoInventarioDemonstrativo(idInventario) {
    const itens = await listarItens(idInventario);
    const paresMetodologia = itens
        .filter((item) => item.origem_tipo === 'MOTOR_GHE')
        .map((item) => ({ codigo: item.metodologia_codigo_snapshot, versao: item.metodologia_versao_snapshot }));
    return verificarAlgumaMetodologiaDemonstrativa(paresMetodologia);
}

// dados: subconjunto de { titulo, descricao, status, data_alvo, data_conclusao }.
// id_avaliacao e criado_por nao sao alteraveis por aqui (secao 38: nao
// permitir alterar FK historica da avaliacao arbitrariamente); data_inicio
// tambem permanece fixa por representar o inicio real ja registrado.
export async function atualizarPlano(idPlano, dados) {
    if (!campoPreenchido(dados.titulo)) {
        throw erroPlanoAcao('Informe o título do plano.', 'TITULO_OBRIGATORIO');
    }
    if (!STATUS_PLANO_VALIDOS.includes(dados.status)) {
        throw erroPlanoAcao('Selecione um status válido para o plano.', 'STATUS_INVALIDO');
    }

    const planoAtual = await buscarPlanoPorId(idPlano);
    if (dados.data_alvo && dados.data_alvo < planoAtual.data_inicio) {
        throw erroPlanoAcao('A data alvo não pode ser anterior à data de início.', 'DATA_ALVO_INVALIDA');
    }
    if (dados.data_conclusao && dados.data_conclusao < planoAtual.data_inicio) {
        throw erroPlanoAcao('A data de conclusão não pode ser anterior à data de início.', 'DATA_CONCLUSAO_INVALIDA');
    }

    const { data, error } = await supabase
        .from('plano_acao')
        .update({
            titulo: dados.titulo.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            status: dados.status,
            data_alvo: dados.data_alvo || null,
            data_conclusao: dados.data_conclusao || null,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_plano', idPlano)
        .select(COLUNAS_PLANO)
        .single();

    if (error) {
        console.error('Erro ao atualizar plano de ação:', error);
        throw erroPlanoAcao('Não foi possível salvar as alterações do plano.', 'PERSISTENCIA_PLANO_FALHOU');
    }
    return data;
}

// =====================================================================
// Acoes do plano
// =====================================================================

export async function listarAcoesDoPlano(idPlano) {
    const { data, error } = await supabase
        .from('acao_plano')
        .select(COLUNAS_ACAO)
        .eq('id_plano', idPlano)
        .order('criado_em', { ascending: true });

    if (error) {
        throw error;
    }
    return (data || []).map(mapearAcao);
}

export async function buscarAcaoPorId(idAcao) {
    const { data, error } = await supabase
        .from('acao_plano')
        .select(COLUNAS_ACAO)
        .eq('id_acao', idAcao)
        .single();

    if (error) {
        throw error;
    }
    return mapearAcao(data);
}

function validarCamposAcao(dados) {
    if (!campoPreenchido(dados.descricao)) {
        throw erroPlanoAcao('Descreva a ação a ser realizada.', 'DESCRICAO_OBRIGATORIA');
    }
    if (!dados.id_responsavel) {
        throw erroPlanoAcao('Selecione o responsável pela ação.', 'RESPONSAVEL_OBRIGATORIO');
    }
    if (!PRIORIDADES_ACAO_VALIDAS.includes(dados.prioridade)) {
        throw erroPlanoAcao('Selecione uma prioridade válida.', 'PRIORIDADE_INVALIDA');
    }
    if (!dados.prazo) {
        throw erroPlanoAcao('Informe o prazo da ação.', 'PRAZO_OBRIGATORIO');
    }
    if (!STATUS_ACAO_VALIDOS.includes(dados.status)) {
        throw erroPlanoAcao('Selecione um status válido para a ação.', 'STATUS_INVALIDO');
    }
    // Espelha chk_acao_plano_conclusao (secao 36 do prompt FEIRA-04): status
    // CONCLUIDA exige data_conclusao. Nao inventa a data - exige que quem
    // chama (o formulario) a tenha coletado explicitamente do usuario.
    if (dados.status === 'CONCLUIDA' && !dados.data_conclusao) {
        throw erroPlanoAcao('Informe a data de conclusão da ação.', 'DATA_CONCLUSAO_OBRIGATORIA');
    }
    // Espelha chk_acao_plano_origem_unica (migration 007/secao 17): uma
    // acao tem no maximo UMA origem especifica, nunca as duas.
    if (dados.id_avaliacao_recomendacao && dados.id_inventario_risco_item) {
        throw erroPlanoAcao('Selecione apenas uma origem para a ação: recomendação ou item do Inventário.', 'ORIGEM_ACAO_DUPLICADA');
    }
}

// Garante que o item do Inventario referenciado pela acao pertence a
// MESMA versao do Inventario do plano (secao 18) - nunca uma acao do
// plano do Inventario A apontando para um item do Inventario B. Mesmo
// espirito de gheService.validarParticipanteCompativelComGhe.
async function validarItemCompativelComPlano(idItem, idPlano) {
    const [item, plano] = await Promise.all([
        supabase.from('inventario_risco_item').select('id_inventario').eq('id_inventario_risco_item', idItem).single(),
        buscarPlanoPorId(idPlano),
    ]);
    if (item.error) {
        throw item.error;
    }
    if (plano.origem_tipo !== 'INVENTARIO_RISCOS' || item.data.id_inventario !== plano.id_inventario) {
        throw erroPlanoAcao('Este item pertence a outro Inventário de Riscos.', 'ITEM_INVENTARIO_INCOMPATIVEL');
    }
}

// dados: { id_plano, id_avaliacao_recomendacao, id_inventario_risco_item,
//          id_responsavel, descricao, prioridade, prazo, status,
//          data_conclusao, evidencia_texto }
// id_avaliacao_recomendacao/id_inventario_risco_item sao opcionais (FKs
// nullable, mutuamente exclusivas) - null/null quando a acao nao tem
// origem especifica (acao "manual", secao 29/49).
export async function criarAcao(dados) {
    if (!dados.id_plano) {
        throw erroPlanoAcao('Plano de ação não informado.', 'PLANO_OBRIGATORIO');
    }
    validarCamposAcao(dados);
    if (dados.id_inventario_risco_item) {
        await validarItemCompativelComPlano(dados.id_inventario_risco_item, dados.id_plano);
    }

    const { data, error } = await supabase
        .from('acao_plano')
        .insert({
            id_plano: dados.id_plano,
            id_avaliacao_recomendacao: dados.id_avaliacao_recomendacao || null,
            id_inventario_risco_item: dados.id_inventario_risco_item || null,
            id_responsavel: dados.id_responsavel,
            descricao: dados.descricao.trim(),
            prioridade: dados.prioridade,
            prazo: dados.prazo,
            status: dados.status,
            data_conclusao: dados.data_conclusao || null,
            evidencia_texto: campoPreenchido(dados.evidencia_texto) ? dados.evidencia_texto.trim() : null,
        })
        .select(COLUNAS_ACAO)
        .single();

    if (error) {
        console.error('Erro ao criar ação do plano:', error);
        throw erroPlanoAcao('Não foi possível salvar a ação.', 'PERSISTENCIA_ACAO_FALHOU');
    }
    return mapearAcao(data);
}

// Atalho com o nome pedido pela secao 29/39 do prompt FAIR-PA-01 - mesma
// escrita de criarAcao, so preenchendo id_inventario_risco_item e
// deixando id_avaliacao_recomendacao explicitamente nulo.
export async function criarAcaoParaItemInventario(idPlano, idItem, dadosResto) {
    return criarAcao({
        ...dadosResto,
        id_plano: idPlano,
        id_inventario_risco_item: idItem,
        id_avaliacao_recomendacao: null,
    });
}

// dados: subconjunto de { id_avaliacao_recomendacao, id_inventario_risco_item,
//          id_responsavel, descricao, prioridade, prazo, status, data_conclusao, evidencia_texto }.
// id_plano nao e alteravel por aqui (secao 38 - nao move uma acao entre
// planos arbitrariamente).
export async function atualizarAcao(idAcao, dados) {
    validarCamposAcao(dados);
    if (dados.id_inventario_risco_item) {
        const acaoAtual = await buscarAcaoPorId(idAcao);
        await validarItemCompativelComPlano(dados.id_inventario_risco_item, acaoAtual.id_plano);
    }

    const { data, error } = await supabase
        .from('acao_plano')
        .update({
            id_avaliacao_recomendacao: dados.id_avaliacao_recomendacao || null,
            id_inventario_risco_item: dados.id_inventario_risco_item || null,
            id_responsavel: dados.id_responsavel,
            descricao: dados.descricao.trim(),
            prioridade: dados.prioridade,
            prazo: dados.prazo,
            status: dados.status,
            data_conclusao: dados.data_conclusao || null,
            evidencia_texto: campoPreenchido(dados.evidencia_texto) ? dados.evidencia_texto.trim() : null,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_acao', idAcao)
        .select(COLUNAS_ACAO)
        .single();

    if (error) {
        console.error('Erro ao atualizar ação do plano:', error);
        throw erroPlanoAcao('Não foi possível salvar a ação.', 'PERSISTENCIA_ACAO_FALHOU');
    }
    return mapearAcao(data);
}

// Atalho para a troca rapida de status na tabela de acoes (secao 12/35),
// sem reabrir o formulario completo. dataConclusao so e usada (e exigida)
// quando novoStatus === 'CONCLUIDA' (chk_acao_plano_conclusao).
export async function alterarStatusAcao(idAcao, novoStatus, dataConclusao = null) {
    if (!STATUS_ACAO_VALIDOS.includes(novoStatus)) {
        throw erroPlanoAcao('Selecione um status válido para a ação.', 'STATUS_INVALIDO');
    }
    if (novoStatus === 'CONCLUIDA' && !dataConclusao) {
        throw erroPlanoAcao('Informe a data de conclusão da ação.', 'DATA_CONCLUSAO_OBRIGATORIA');
    }

    const payload = { status: novoStatus, atualizado_em: new Date().toISOString() };
    if (novoStatus === 'CONCLUIDA') {
        payload.data_conclusao = dataConclusao;
    }

    const { data, error } = await supabase
        .from('acao_plano')
        .update(payload)
        .eq('id_acao', idAcao)
        .select(COLUNAS_ACAO)
        .single();

    if (error) {
        console.error('Erro ao alterar status da ação:', error);
        throw erroPlanoAcao('Não foi possível atualizar o status da ação.', 'PERSISTENCIA_ACAO_FALHOU');
    }
    return mapearAcao(data);
}

// Atalho com o nome pedido pela secao 29 do prompt FAIR-PA-01 - mesma
// escrita de alterarStatusAcao(idAcao, 'CONCLUIDA', dataConclusao).
export async function concluirAcao(idAcao, dataConclusao) {
    return alterarStatusAcao(idAcao, 'CONCLUIDA', dataConclusao);
}

// =====================================================================
// Apoio: responsavel/criado_por (FK real para usuario - secao 32) e
// recomendacoes disponiveis da avaliacao (origem da acao - secao 29/30)
// =====================================================================

// Usuarios ativos da mesma empresa da avaliacao, para os selects de
// "responsavel" (acao_plano.id_responsavel) e para resolver "criado_por"
// (plano_acao.criado_por) sem exigir um sistema de autenticacao, que nao
// existe neste MVP - mesmo padrao ja usado por
// avaliacaoService.obterAvaliadorPadrao.
export async function listarUsuariosDaEmpresa(idEmpresa) {
    const { data, error } = await supabase
        .from('usuario')
        .select('id_usuario, nome, perfil')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }
    return data || [];
}

// Reexportada com o nome desta feature (secao 12), no mesmo padrao de
// avaliacaoService.js (secao 20 do prompt AVA-02) - nao duplica a consulta
// que ja existe em recomendacaoService.js, e nao gera recomendacao nova
// (secao 8 do prompt FEIRA-04): so LE os snapshots ja persistidos desta
// avaliacao especifica.
export { listarRecomendacoesDaAvaliacao as listarRecomendacoesDisponiveisDaAvaliacao } from './recomendacaoService.js';
