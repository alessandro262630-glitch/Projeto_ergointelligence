import { supabase } from '../config/supabase.js';
import { obterIdEmpresaAtiva } from './colaboradorService.js';
import { campoPreenchido } from '../utils/validacoes.js';

// MVP-06 - GHE (Grupo Homogeneo de Exposicao) e Amostragem Demonstrativa.
// Le/escreve GHE, GHE_CARGO, PLANO_AMOSTRAGEM e AMOSTRA_PARTICIPANTE
// (database/migrations/002_add_ghe_amostragem.sql). NUNCA calcula
// representatividade estatistica, NUNCA consolida coletas/risco do GHE
// (isso e o MVP-07) e NUNCA manipula DOM. Todo isolamento por empresa e
// feito explicitamente via id_empresa - nenhuma consulta global sem filtro.

const STATUS_PLANO_AMOSTRAGEM_VALIDOS = ['PLANEJADO', 'EM_COLETA', 'CONCLUIDO', 'CANCELADO'];

const COLUNAS_GHE = 'id_ghe, id_empresa, id_setor, codigo, nome, descricao, universo, ativo, criado_em, atualizado_em, setor(nome)';
const COLUNAS_PLANO_AMOSTRAGEM = 'id_plano_amostragem, id_ghe, universo_snapshot, amostra_planejada, criterio, observacao, '
    + 'status, id_responsavel, data_plano, criado_em, atualizado_em, usuario(nome)';
const COLUNAS_PARTICIPANTE = 'id_amostra_participante, id_plano_amostragem, id_vinculo, criado_em, '
    + 'colaborador_vinculo(id_colaborador, colaborador(nome, matricula), setor(nome), cargo(nome))';

function erroGhe(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

function mapearGhe(linha) {
    if (!linha) return null;
    return {
        ...linha,
        setor: linha.setor?.nome ?? null,
    };
}

function mapearPlanoAmostragem(linha) {
    if (!linha) return null;
    return {
        ...linha,
        responsavel_nome: linha.usuario?.nome ?? null,
    };
}

function mapearParticipante(linha) {
    const vinculo = linha.colaborador_vinculo;
    return {
        id_amostra_participante: linha.id_amostra_participante,
        id_plano_amostragem: linha.id_plano_amostragem,
        id_vinculo: linha.id_vinculo,
        criado_em: linha.criado_em,
        colaborador_nome: vinculo?.colaborador?.nome ?? null,
        colaborador_matricula: vinculo?.colaborador?.matricula ?? null,
        setor_nome: vinculo?.setor?.nome ?? null,
        cargo_nome: vinculo?.cargo?.nome ?? null,
    };
}

// =====================================================================
// GHE
// =====================================================================

// Lista os GHEs da empresa ativa, com o plano de amostragem mais recente
// de cada um ja anexado (bulk query - secao 38 do prompt FEIRA-03 aplica
// aqui tambem: nunca uma consulta por item). Cada item ganha um campo
// `planoAtual` (ou null, se o GHE ainda nao tiver nenhum plano).
export async function listarGhes() {
    const idEmpresa = await obterIdEmpresaAtiva();

    const { data: ghes, error } = await supabase
        .from('ghe')
        .select(COLUNAS_GHE)
        .eq('id_empresa', idEmpresa)
        .order('nome', { ascending: true });

    if (error) throw error;

    const idsGhe = (ghes || []).map((g) => g.id_ghe);
    let planosPorGhe = new Map();

    if (idsGhe.length > 0) {
        const { data: planos, error: erroPlanos } = await supabase
            .from('plano_amostragem')
            .select(COLUNAS_PLANO_AMOSTRAGEM)
            .in('id_ghe', idsGhe)
            .order('criado_em', { ascending: false });

        if (erroPlanos) throw erroPlanos;

        // So mantem o mais recente por GHE (primeira ocorrencia, ja que a
        // consulta veio ordenada por criado_em DESC).
        (planos || []).forEach((linha) => {
            if (!planosPorGhe.has(linha.id_ghe)) {
                planosPorGhe.set(linha.id_ghe, mapearPlanoAmostragem(linha));
            }
        });
    }

    return (ghes || []).map((linha) => ({
        ...mapearGhe(linha),
        planoAtual: planosPorGhe.get(linha.id_ghe) || null,
    }));
}

export async function buscarGhePorId(idGhe) {
    const { data, error } = await supabase
        .from('ghe')
        .select(COLUNAS_GHE)
        .eq('id_ghe', idGhe)
        .single();

    if (error) throw error;
    return mapearGhe(data);
}

function validarCamposGhe(dados) {
    if (!campoPreenchido(dados.nome)) {
        throw erroGhe('Informe o nome do GHE.', 'NOME_OBRIGATORIO');
    }
    const universo = Number(dados.universo);
    if (!Number.isInteger(universo) || universo <= 0) {
        throw erroGhe('O universo deve ser um número inteiro maior que zero.', 'UNIVERSO_INVALIDO');
    }
}

// Isolamento por empresa (secao 23/38 do prompt MVP-06): a FK sozinha nao
// impede um id_setor de outra empresa de ser gravado, entao a checagem e
// feita explicitamente aqui, na aplicacao, antes de qualquer INSERT/UPDATE.
async function validarSetorDaEmpresa(idSetor, idEmpresa) {
    if (!idSetor) return; // setor e opcional (secao 10/24)

    const { data, error } = await supabase
        .from('setor')
        .select('id_empresa')
        .eq('id_setor', idSetor)
        .single();

    if (error) throw error;
    if (data.id_empresa !== idEmpresa) {
        throw erroGhe('O setor selecionado não pertence a esta empresa.', 'SETOR_INCOMPATIVEL');
    }
}

// dados: { id_setor, codigo, nome, descricao, universo }
export async function criarGhe(dados) {
    validarCamposGhe(dados);
    const idEmpresa = await obterIdEmpresaAtiva();
    await validarSetorDaEmpresa(dados.id_setor, idEmpresa);

    const { data, error } = await supabase
        .from('ghe')
        .insert({
            id_empresa: idEmpresa,
            id_setor: dados.id_setor || null,
            codigo: campoPreenchido(dados.codigo) ? dados.codigo.trim() : null,
            nome: dados.nome.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            universo: Number(dados.universo),
        })
        .select(COLUNAS_GHE)
        .single();

    if (error) {
        console.error('Erro ao criar GHE:', error);
        if (error.code === '23505') {
            throw erroGhe('Já existe um GHE com este código ou nome nesta empresa.', 'GHE_DUPLICADO');
        }
        throw erroGhe('Não foi possível criar o GHE.', 'PERSISTENCIA_GHE_FALHOU');
    }
    return mapearGhe(data);
}

// dados: { id_setor, codigo, nome, descricao, universo }
export async function atualizarGhe(idGhe, dados) {
    validarCamposGhe(dados);
    const gheAtual = await buscarGhePorId(idGhe);
    await validarSetorDaEmpresa(dados.id_setor, gheAtual.id_empresa);

    const { data, error } = await supabase
        .from('ghe')
        .update({
            id_setor: dados.id_setor || null,
            codigo: campoPreenchido(dados.codigo) ? dados.codigo.trim() : null,
            nome: dados.nome.trim(),
            descricao: campoPreenchido(dados.descricao) ? dados.descricao.trim() : null,
            universo: Number(dados.universo),
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_ghe', idGhe)
        .select(COLUNAS_GHE)
        .single();

    if (error) {
        console.error('Erro ao atualizar GHE:', error);
        if (error.code === '23505') {
            throw erroGhe('Já existe um GHE com este código ou nome nesta empresa.', 'GHE_DUPLICADO');
        }
        throw erroGhe('Não foi possível salvar as alterações do GHE.', 'PERSISTENCIA_GHE_FALHOU');
    }
    return mapearGhe(data);
}

// Nunca DELETE (secao 25) - GHE pode ja estar referenciado por planos de
// amostragem historicos. Soft toggle, mesmo padrao de colaboradorService.
export async function alternarStatusGhe(idGhe, ativo) {
    const { data, error } = await supabase
        .from('ghe')
        .update({ ativo, atualizado_em: new Date().toISOString() })
        .eq('id_ghe', idGhe)
        .select(COLUNAS_GHE)
        .single();

    if (error) throw error;
    return mapearGhe(data);
}

// Nome de exibicao da empresa (contexto do cabecalho de detalhe - secao
// 27). razao_social e sempre preenchido no schema; nome_fantasia e
// opcional e, quando existir, e mais amigavel para exibicao.
export async function buscarNomeEmpresa(idEmpresa) {
    const { data, error } = await supabase
        .from('empresa')
        .select('razao_social, nome_fantasia')
        .eq('id_empresa', idEmpresa)
        .single();

    if (error) throw error;
    return data.nome_fantasia || data.razao_social;
}

// =====================================================================
// GHE_CARGO
// =====================================================================

// Catalogo de cargos da empresa ativa (isolamento explicito - secao 38),
// diferente de vinculoService.listarCargos() que hoje nao filtra por
// empresa (o MVP so tem uma empresa demo; aqui a filtragem correta e
// exigida explicitamente pela feature).
export async function listarCargosDaEmpresa() {
    const idEmpresa = await obterIdEmpresaAtiva();
    const { data, error } = await supabase
        .from('cargo')
        .select('id_cargo, nome')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
}

// Setores da empresa ativa (isolamento explicito - secao 23/38), usada no
// select de setor do formulario de GHE em vez de
// vinculoService.listarSetores() (que hoje nao filtra por empresa).
export async function listarSetoresDaEmpresa() {
    const idEmpresa = await obterIdEmpresaAtiva();
    const { data, error } = await supabase
        .from('setor')
        .select('id_setor, nome')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function listarCargosDoGhe(idGhe) {
    const { data, error } = await supabase
        .from('ghe_cargo')
        .select('id_ghe_cargo, id_ghe, id_cargo, ativo, cargo(nome)')
        .eq('id_ghe', idGhe)
        .eq('ativo', true)
        .order('id_ghe_cargo', { ascending: true });

    if (error) throw error;
    return (data || []).map((linha) => ({
        id_ghe_cargo: linha.id_ghe_cargo,
        id_ghe: linha.id_ghe,
        id_cargo: linha.id_cargo,
        cargo_nome: linha.cargo?.nome ?? null,
    }));
}

// Reativa a associacao se ela ja existiu e foi desassociada antes (evita
// violar uq_ghe_cargo ao readicionar um cargo removido - secao 21/22).
export async function associarCargoAoGhe(idGhe, idCargo) {
    if (!idCargo) {
        throw erroGhe('Selecione o cargo.', 'CARGO_OBRIGATORIO');
    }

    // Isolamento por empresa (secao 23/38) - a FK ghe_cargo->cargo sozinha
    // nao impede associar um cargo de outra empresa.
    const [ghe, cargo] = await Promise.all([
        buscarGhePorId(idGhe),
        supabase.from('cargo').select('id_empresa').eq('id_cargo', idCargo).single(),
    ]);
    if (cargo.error) throw cargo.error;
    if (cargo.data.id_empresa !== ghe.id_empresa) {
        throw erroGhe('O cargo selecionado não pertence a esta empresa.', 'CARGO_INCOMPATIVEL');
    }

    const { data: existente, error: erroExistente } = await supabase
        .from('ghe_cargo')
        .select('id_ghe_cargo, ativo')
        .eq('id_ghe', idGhe)
        .eq('id_cargo', idCargo)
        .maybeSingle();

    if (erroExistente) throw erroExistente;

    if (existente) {
        if (existente.ativo) {
            throw erroGhe('Este cargo já está associado a este GHE.', 'CARGO_JA_ASSOCIADO');
        }
        const { error } = await supabase
            .from('ghe_cargo')
            .update({ ativo: true })
            .eq('id_ghe_cargo', existente.id_ghe_cargo);
        if (error) throw error;
        return;
    }

    const { error } = await supabase
        .from('ghe_cargo')
        .insert({ id_ghe: idGhe, id_cargo: idCargo, ativo: true });

    if (error) {
        console.error('Erro ao associar cargo ao GHE:', error);
        if (error.code === '23505') {
            throw erroGhe('Este cargo já está associado a este GHE.', 'CARGO_JA_ASSOCIADO');
        }
        throw erroGhe('Não foi possível associar o cargo.', 'PERSISTENCIA_GHE_CARGO_FALHOU');
    }
}

export async function desassociarCargoDoGhe(idGheCargo) {
    const { error } = await supabase
        .from('ghe_cargo')
        .update({ ativo: false })
        .eq('id_ghe_cargo', idGheCargo);

    if (error) throw error;
}

// =====================================================================
// PLANO_AMOSTRAGEM
// =====================================================================

// O modelo (secao 7 do prompt) permite mais de um plano por GHE ao longo
// do tempo - retorna o mais recente (criado_em DESC), igual ao padrao ja
// usado em planoAcaoService.buscarPlanoPorAvaliacao.
export async function buscarPlanoAmostragemAtual(idGhe) {
    const { data, error } = await supabase
        .from('plano_amostragem')
        .select(COLUNAS_PLANO_AMOSTRAGEM)
        .eq('id_ghe', idGhe)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return mapearPlanoAmostragem(data);
}

export async function buscarPlanoAmostragemPorId(idPlano) {
    const { data, error } = await supabase
        .from('plano_amostragem')
        .select(COLUNAS_PLANO_AMOSTRAGEM)
        .eq('id_plano_amostragem', idPlano)
        .single();

    if (error) throw error;
    return mapearPlanoAmostragem(data);
}

function validarCamposPlanoAmostragem(dados) {
    const universo = Number(dados.universo_snapshot);
    const amostra = Number(dados.amostra_planejada);

    if (!Number.isInteger(universo) || universo <= 0) {
        throw erroGhe('Informe um universo válido (maior que zero).', 'UNIVERSO_INVALIDO');
    }
    if (!Number.isInteger(amostra) || amostra <= 0) {
        throw erroGhe('Informe uma amostra planejada válida (maior que zero).', 'AMOSTRA_INVALIDA');
    }
    // Espelha chk_plano_amostragem_amostra_universo (secao 5/16/22 do
    // prompt MVP-06) - nunca afirma representatividade estatistica, so
    // impede amostra > universo.
    if (amostra > universo) {
        throw erroGhe('A amostra planejada não pode ser maior que o universo.', 'AMOSTRA_MAIOR_QUE_UNIVERSO');
    }
    if (!STATUS_PLANO_AMOSTRAGEM_VALIDOS.includes(dados.status)) {
        throw erroGhe('Selecione um status válido para o plano.', 'STATUS_INVALIDO');
    }
    if (!dados.id_responsavel) {
        throw erroGhe('Selecione o responsável pelo plano.', 'RESPONSAVEL_OBRIGATORIO');
    }
    if (!dados.data_plano) {
        throw erroGhe('Informe a data do plano.', 'DATA_PLANO_OBRIGATORIA');
    }
}

// dados: { id_ghe, universo_snapshot, amostra_planejada, criterio,
//          observacao, status, id_responsavel, data_plano }
// universo_snapshot e informado explicitamente por quem chama (a pagina),
// normalmente copiado do ghe.universo NO MOMENTO da criacao - o service
// nao busca isso sozinho para deixar claro, no ponto de chamada, que e um
// snapshot deliberado (secao 15 do prompt).
export async function criarPlanoAmostragem(dados) {
    if (!dados.id_ghe) {
        throw erroGhe('GHE não informado.', 'GHE_OBRIGATORIO');
    }
    validarCamposPlanoAmostragem(dados);

    const { data, error } = await supabase
        .from('plano_amostragem')
        .insert({
            id_ghe: dados.id_ghe,
            universo_snapshot: Number(dados.universo_snapshot),
            amostra_planejada: Number(dados.amostra_planejada),
            criterio: campoPreenchido(dados.criterio) ? dados.criterio.trim() : null,
            observacao: campoPreenchido(dados.observacao) ? dados.observacao.trim() : null,
            status: dados.status,
            id_responsavel: dados.id_responsavel,
            data_plano: dados.data_plano,
        })
        .select(COLUNAS_PLANO_AMOSTRAGEM)
        .single();

    if (error) {
        console.error('Erro ao criar plano de amostragem:', error);
        throw erroGhe('Não foi possível criar o plano de amostragem.', 'PERSISTENCIA_PLANO_FALHOU');
    }
    return mapearPlanoAmostragem(data);
}

// dados: { amostra_planejada, criterio, observacao, status, data_plano }.
// universo_snapshot e id_responsavel nao sao alteraveis por aqui (secao 15
// - preserva o contexto historico do planejamento; trocar de responsavel
// teria o mesmo efeito colateral indesejado de "reescrever o passado").
export async function atualizarPlanoAmostragem(idPlano, dados) {
    const planoAtual = await buscarPlanoAmostragemPorId(idPlano);
    validarCamposPlanoAmostragem({
        ...dados,
        universo_snapshot: planoAtual.universo_snapshot,
        id_responsavel: planoAtual.id_responsavel,
    });

    const { data, error } = await supabase
        .from('plano_amostragem')
        .update({
            amostra_planejada: Number(dados.amostra_planejada),
            criterio: campoPreenchido(dados.criterio) ? dados.criterio.trim() : null,
            observacao: campoPreenchido(dados.observacao) ? dados.observacao.trim() : null,
            status: dados.status,
            data_plano: dados.data_plano,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_plano_amostragem', idPlano)
        .select(COLUNAS_PLANO_AMOSTRAGEM)
        .single();

    if (error) {
        console.error('Erro ao atualizar plano de amostragem:', error);
        throw erroGhe('Não foi possível salvar as alterações do plano.', 'PERSISTENCIA_PLANO_FALHOU');
    }
    return mapearPlanoAmostragem(data);
}

// =====================================================================
// AMOSTRA_PARTICIPANTE
// =====================================================================

// Usado pela coleta do GHE (MVP-07) para exibir o cabecalho "Colaborador /
// Setor / Cargo" sem duplicar a consulta de listarParticipantes.
export async function buscarParticipantePorId(idAmostraParticipante) {
    const { data, error } = await supabase
        .from('amostra_participante')
        .select(COLUNAS_PARTICIPANTE)
        .eq('id_amostra_participante', idAmostraParticipante)
        .single();

    if (error) throw error;
    return mapearParticipante(data);
}

export async function listarParticipantes(idPlano) {
    const { data, error } = await supabase
        .from('amostra_participante')
        .select(COLUNAS_PARTICIPANTE)
        .eq('id_plano_amostragem', idPlano)
        .order('criado_em', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapearParticipante);
}

// Nunca duplica o mesmo vinculo no mesmo plano (uq_amostra_participante -
// secao 21/45); a mensagem amigavel para o codigo 23505 fica a cargo da
// pagina, no mesmo padrao ja usado em plano-acao.js.
export async function adicionarParticipante(idPlano, idVinculo) {
    if (!idVinculo) {
        throw erroGhe('Selecione o colaborador.', 'VINCULO_OBRIGATORIO');
    }

    // Isolamento por empresa (secao 23/38) - colaborador_vinculo nao tem
    // id_empresa direto, entao a checagem sobe ate colaborador.id_empresa
    // e compara com a empresa do GHE dono do plano.
    const [plano, vinculo] = await Promise.all([
        buscarPlanoAmostragemPorId(idPlano),
        supabase.from('colaborador_vinculo').select('colaborador(id_empresa)').eq('id_vinculo', idVinculo).single(),
    ]);
    if (vinculo.error) throw vinculo.error;
    const ghe = await buscarGhePorId(plano.id_ghe);
    if (vinculo.data.colaborador?.id_empresa !== ghe.id_empresa) {
        throw erroGhe('O colaborador selecionado não pertence a esta empresa.', 'VINCULO_INCOMPATIVEL');
    }

    const { data, error } = await supabase
        .from('amostra_participante')
        .insert({ id_plano_amostragem: idPlano, id_vinculo: idVinculo })
        .select(COLUNAS_PARTICIPANTE)
        .single();

    if (error) {
        if (error.code === '23505') {
            throw erroGhe('Este colaborador já está registrado como participante deste plano.', 'PARTICIPANTE_DUPLICADO');
        }
        console.error('Erro ao adicionar participante:', error);
        throw erroGhe('Não foi possível adicionar o participante.', 'PERSISTENCIA_PARTICIPANTE_FALHOU');
    }
    return mapearParticipante(data);
}

export async function removerParticipante(idAmostraParticipante) {
    const { error } = await supabase
        .from('amostra_participante')
        .delete()
        .eq('id_amostra_participante', idAmostraParticipante);

    if (error) throw error;
}

// Vinculos vigentes (ativos, sem data_fim) da empresa ativa, para a
// selecao de participantes - isolamento explicito por empresa via join
// com colaborador (secao 38), ja que colaborador_vinculo nao tem
// id_empresa direto.
export async function listarVinculosDaEmpresaParaAmostra() {
    const idEmpresa = await obterIdEmpresaAtiva();

    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .select('id_vinculo, id_colaborador, colaborador!inner(id_empresa, nome, matricula, ativo), setor(nome), cargo(nome)')
        .eq('ativo', true)
        .is('data_fim', null)
        .eq('colaborador.id_empresa', idEmpresa)
        .eq('colaborador.ativo', true)
        .order('id_vinculo', { ascending: true });

    if (error) throw error;

    return (data || []).map((linha) => ({
        id_vinculo: linha.id_vinculo,
        colaborador_nome: linha.colaborador?.nome ?? null,
        colaborador_matricula: linha.colaborador?.matricula ?? null,
        setor_nome: linha.setor?.nome ?? null,
        cargo_nome: linha.cargo?.nome ?? null,
    }));
}
