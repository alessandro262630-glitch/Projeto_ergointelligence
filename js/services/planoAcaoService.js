import { supabase } from '../config/supabase.js';
import { campoPreenchido } from '../utils/validacoes.js';

// FEIRA-04 - Plano de Acao MVP.
// Le/escreve exclusivamente PLANO_ACAO e ACAO_PLANO, tabelas ja existentes
// no schema (database/schema.sql, secoes 30/31) - nenhuma tabela/coluna
// nova. NUNCA chama motorRisco.js/classificadorRisco.js/riscoService.js.
// processarRiscosDaAvaliacao e NUNCA gera novas avaliacao_recomendacao -
// so consome resultados de risco e recomendacoes ja persistidos por outras
// features. So Supabase aqui: nenhum document.*/innerHTML/addEventListener.

// Unicos valores aceitos pelo schema (chk_plano_acao_status /
// chk_acao_plano_status / chk_acao_plano_prioridade).
const STATUS_PLANO_VALIDOS = ['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'];
const STATUS_ACAO_VALIDOS = ['ABERTA', 'EM_ANDAMENTO', 'BLOQUEADA', 'CONCLUIDA', 'CANCELADA'];
const PRIORIDADES_ACAO_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

const COLUNAS_PLANO = 'id_plano, id_avaliacao, titulo, descricao, status, criado_por, '
    + 'data_inicio, data_alvo, data_conclusao, criado_em, atualizado_em';

const COLUNAS_ACAO = 'id_acao, id_plano, id_avaliacao_recomendacao, id_responsavel, descricao, '
    + 'prioridade, prazo, status, data_conclusao, evidencia_texto, criado_em, atualizado_em, '
    + 'usuario(nome), '
    + 'avaliacao_recomendacao(id_avaliacao_recomendacao, id_avaliacao, recomendacao(codigo, titulo))';

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
    return {
        id_acao: linha.id_acao,
        id_plano: linha.id_plano,
        id_avaliacao_recomendacao: linha.id_avaliacao_recomendacao,
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

// dados: { id_avaliacao, titulo, descricao, status, criado_por, data_inicio, data_alvo, data_conclusao }
// A checagem de duplicidade (existe plano para esta avaliacao?) e
// responsabilidade de quem chama (plano-acao.js), pois a modelagem permite
// multiplos planos - aqui so valida os campos da propria linha.
export async function criarPlano(dados) {
    if (!dados.id_avaliacao) {
        throw erroPlanoAcao('Avaliação não informada.', 'AVALIACAO_OBRIGATORIA');
    }
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

    const { data, error } = await supabase
        .from('plano_acao')
        .insert({
            id_avaliacao: dados.id_avaliacao,
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
}

// dados: { id_plano, id_avaliacao_recomendacao, id_responsavel, descricao,
//          prioridade, prazo, status, data_conclusao, evidencia_texto }
// id_avaliacao_recomendacao e opcional (FK nullable) - null quando a acao
// nao tem origem em nenhuma recomendacao especifica (secao 29).
export async function criarAcao(dados) {
    if (!dados.id_plano) {
        throw erroPlanoAcao('Plano de ação não informado.', 'PLANO_OBRIGATORIO');
    }
    validarCamposAcao(dados);

    const { data, error } = await supabase
        .from('acao_plano')
        .insert({
            id_plano: dados.id_plano,
            id_avaliacao_recomendacao: dados.id_avaliacao_recomendacao || null,
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

// dados: subconjunto de { id_avaliacao_recomendacao, id_responsavel,
//          descricao, prioridade, prazo, status, data_conclusao, evidencia_texto }.
// id_plano nao e alteravel por aqui (secao 38 - nao move uma acao entre
// planos arbitrariamente).
export async function atualizarAcao(idAcao, dados) {
    validarCamposAcao(dados);

    const { data, error } = await supabase
        .from('acao_plano')
        .update({
            id_avaliacao_recomendacao: dados.id_avaliacao_recomendacao || null,
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
