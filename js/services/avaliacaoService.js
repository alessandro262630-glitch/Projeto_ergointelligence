import { supabase } from '../config/supabase.js';
import { buscarVinculoPorId, listarFuncoesPorVinculo } from './vinculoService.js';
import { buscarColaboradorPorId } from './colaboradorService.js';
import { buscarAmbientePorId, buscarPostoPorId, listarAmbientesPorSetor, listarPostosPorAmbiente as listarPostosDoAmbiente } from './ambienteService.js';
import { buscarPerfilPorId, listarPerfisPorColaborador } from './perfilAntropometricoService.js';

// AVA-01 - Criar nova avaliacao ergonomica.
// AVA-02 - Selecionar e completar o contexto (funcao/ambiente/posto/perfil +
// atividades) de uma avaliacao ja existente.
// Escopo combinado: registro inicial + contexto + atividades executadas.
// Questionario, calculo de risco, classificacao, recomendacoes e
// finalizacao pertencem a features futuras e nao sao implementados aqui.

const COLUNAS_AVALIACAO = 'id_avaliacao, id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente, id_posto, id_perfil_antropometrico, id_avaliador, tipo_avaliacao, status, data_avaliacao, data_finalizacao, pontuacao_total, id_classificacao_geral, versao_motor_regras, observacoes, criado_em, atualizado_em';
const COLUNAS_ATIVIDADE_AVALIACAO = 'id_avaliacao_atividade, id_avaliacao, id_atividade, principal, tempo_exposicao_minutos, frequencia_diaria, observacao, criado_em, atividade(nome, descricao, postura_predominante)';

// Unicos valores aceitos pelo schema (chk_avaliacao_ergonomica_tipo).
const TIPOS_AVALIACAO_VALIDOS = ['INICIAL', 'ACOMPANHAMENTO', 'POS_INTERVENCAO', 'AEP'];

// Nesta feature a avaliacao so pode nascer em um destes dois status
// (FINALIZADA e CANCELADA pertencem a etapas futuras do ciclo de vida).
const STATUS_VALIDOS_CRIACAO = ['RASCUNHO', 'EM_ANDAMENTO'];

// Contexto e atividades so podem ser alterados enquanto a avaliacao estiver
// em elaboracao (ver AVA-02, secoes 6 e 21).
const STATUS_EDITAVEIS = ['RASCUNHO', 'EM_ANDAMENTO'];

function erroValidacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Regras de integridade de negocio que uma constraint de FK simples nao
// cobre (pertencimento entre entidades, tenant, inatividade). Compartilhada
// entre a criacao (AVA-01) e a atualizacao de contexto (AVA-02) para nunca
// persistir uma combinacao inconsistente, mesmo que a interface (que ja
// filtra em cascata) seja contornada.
async function validarContextoOrganizacional({ id_empresa, id_vinculo, id_ambiente, id_posto, id_vinculo_funcao, id_perfil_antropometrico }) {
    const vinculo = await buscarVinculoPorId(id_vinculo);
    const colaborador = await buscarColaboradorPorId(vinculo.id_colaborador);

    if (colaborador.id_empresa !== id_empresa) {
        throw erroValidacao('O vínculo selecionado pertence a outra empresa.', 'EMPRESA_INCOMPATIVEL');
    }

    const ambiente = await buscarAmbientePorId(id_ambiente);
    if (!ambiente.ativo) {
        throw erroValidacao('O ambiente selecionado está inativo.', 'AMBIENTE_INATIVO');
    }
    if (ambiente.id_setor !== vinculo.id_setor) {
        throw erroValidacao('O ambiente selecionado não pertence ao setor do vínculo.', 'AMBIENTE_INCOMPATIVEL');
    }

    if (id_posto) {
        const posto = await buscarPostoPorId(id_posto);
        if (posto.id_ambiente !== id_ambiente) {
            throw erroValidacao('O posto selecionado não pertence ao ambiente selecionado.', 'POSTO_INCOMPATIVEL');
        }
    }

    if (id_vinculo_funcao) {
        const { data: funcaoVinculo, error: erroFuncao } = await supabase
            .from('vinculo_funcao')
            .select('id_vinculo_funcao, id_vinculo')
            .eq('id_vinculo_funcao', id_vinculo_funcao)
            .single();

        if (erroFuncao) {
            throw erroFuncao;
        }
        if (funcaoVinculo.id_vinculo !== id_vinculo) {
            throw erroValidacao('A função selecionada não pertence ao vínculo selecionado.', 'FUNCAO_INCOMPATIVEL');
        }
    }

    if (id_perfil_antropometrico) {
        const perfil = await buscarPerfilPorId(id_perfil_antropometrico);
        if (perfil.id_colaborador !== vinculo.id_colaborador) {
            throw erroValidacao('O perfil antropométrico selecionado não pertence a este colaborador.', 'PERFIL_INCOMPATIVEL');
        }
    }

    return { vinculo, colaborador };
}

// dados: { id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente, id_posto,
//          id_perfil_antropometrico, id_avaliador, tipo_avaliacao, status,
//          data_avaliacao, observacoes }
// Campos opcionais (id_vinculo_funcao, id_posto, id_perfil_antropometrico,
// observacoes) devem ser null quando nao informados.
export async function criarAvaliacao(dados) {
    if (!dados.id_vinculo) {
        throw erroValidacao('Selecione o vínculo do colaborador.', 'VINCULO_OBRIGATORIO');
    }
    if (!dados.id_empresa) {
        throw erroValidacao('Não foi possível identificar a empresa deste vínculo.', 'EMPRESA_OBRIGATORIA');
    }
    if (!dados.id_ambiente) {
        throw erroValidacao('Selecione o ambiente de trabalho.', 'AMBIENTE_OBRIGATORIO');
    }
    if (!dados.id_avaliador) {
        throw erroValidacao('Não foi possível identificar o avaliador.', 'AVALIADOR_OBRIGATORIO');
    }
    if (!TIPOS_AVALIACAO_VALIDOS.includes(dados.tipo_avaliacao)) {
        throw erroValidacao('Selecione um tipo de avaliação válido.', 'TIPO_INVALIDO');
    }
    if (!STATUS_VALIDOS_CRIACAO.includes(dados.status)) {
        throw erroValidacao('Status inválido para a criação da avaliação.', 'STATUS_INVALIDO');
    }
    if (!dados.data_avaliacao) {
        throw erroValidacao('Informe a data da avaliação.', 'DATA_OBRIGATORIA');
    }

    await validarContextoOrganizacional(dados);

    const { data: avaliador, error: erroAvaliador } = await supabase
        .from('usuario')
        .select('id_usuario, id_empresa, ativo')
        .eq('id_usuario', dados.id_avaliador)
        .single();

    if (erroAvaliador) {
        throw erroAvaliador;
    }
    if (!avaliador.ativo || avaliador.id_empresa !== dados.id_empresa) {
        throw erroValidacao('O avaliador informado não é válido para esta empresa.', 'AVALIADOR_INVALIDO');
    }

    const { data, error } = await supabase
        .from('avaliacao_ergonomica')
        .insert({
            id_empresa: dados.id_empresa,
            id_vinculo: dados.id_vinculo,
            id_vinculo_funcao: dados.id_vinculo_funcao ?? null,
            id_ambiente: dados.id_ambiente,
            id_posto: dados.id_posto ?? null,
            id_perfil_antropometrico: dados.id_perfil_antropometrico ?? null,
            id_avaliador: dados.id_avaliador,
            tipo_avaliacao: dados.tipo_avaliacao,
            status: dados.status,
            data_avaliacao: dados.data_avaliacao,
            data_finalizacao: null,
            id_classificacao_geral: null,
            versao_motor_regras: null,
            observacoes: dados.observacoes ?? null,
        })
        .select(COLUNAS_AVALIACAO)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function buscarAvaliacaoPorId(idAvaliacao) {
    const { data, error } = await supabase
        .from('avaliacao_ergonomica')
        .select(COLUNAS_AVALIACAO)
        .eq('id_avaliacao', idAvaliacao)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// Usuario avaliador do MVP: sem autenticacao definitiva ainda, usa-se o
// usuario ativo mais antigo da empresa do colaborador (o seed cadastra um
// unico "Avaliador SST Demo" por empresa). Retorna null quando a empresa
// nao possui nenhum usuario ativo - estado valido que a tela deve tratar
// como bloqueio, nao como excecao.
export async function obterAvaliadorPadrao(idEmpresa) {
    const { data, error } = await supabase
        .from('usuario')
        .select('id_usuario, id_empresa, nome')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('id_usuario', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

// =====================================================================
// AVA-02 - Contexto (funcao/ambiente/posto/perfil) e atividades da
// avaliacao ja existente.
// =====================================================================

// Busca a avaliacao e garante que seu status ainda permite edicao de
// contexto/atividades (RASCUNHO ou EM_ANDAMENTO). Usada por toda operacao
// de escrita da AVA-02 para nunca alterar uma avaliacao ja fechada, mesmo
// que a interface (que ja bloqueia os controles) seja contornada.
async function garantirAvaliacaoEditavel(idAvaliacao) {
    const avaliacao = await buscarAvaliacaoPorId(idAvaliacao);

    if (avaliacao.status === 'FINALIZADA') {
        throw erroValidacao('Esta avaliação já foi finalizada e não pode ser alterada.', 'AVALIACAO_FINALIZADA');
    }
    if (avaliacao.status === 'CANCELADA') {
        throw erroValidacao('Esta avaliação foi cancelada e não pode ser alterada.', 'AVALIACAO_CANCELADA');
    }
    if (!STATUS_EDITAVEIS.includes(avaliacao.status)) {
        throw erroValidacao('Esta avaliação não permite alterações no momento.', 'STATUS_NAO_EDITAVEL');
    }

    return avaliacao;
}

// Reexportadas com os nomes desta feature (ver secao 20 do prompt AVA-02)
// para nao duplicar consultas ja existentes nos services de vinculo,
// ambiente e perfil antropometrico.
export { listarFuncoesPorVinculo as listarFuncoesDoVinculo };
export { listarAmbientesPorSetor as listarAmbientesDoContexto };
export { listarPerfisPorColaborador as listarPerfisDoColaborador };
export async function listarPostosPorAmbiente(idAmbiente) {
    return listarPostosDoAmbiente(idAmbiente);
}

// dados: { id_vinculo_funcao, id_ambiente, id_posto, id_perfil_antropometrico,
//          observacoes }. O vinculo (e portanto colaborador/empresa) nao e
// alterado nesta feature - a avaliacao continua presa ao vinculo definido
// na criacao (AVA-01).
export async function atualizarContextoAvaliacao(idAvaliacao, dados) {
    const avaliacaoAtual = await garantirAvaliacaoEditavel(idAvaliacao);

    if (!dados.id_ambiente) {
        throw erroValidacao('Selecione o ambiente de trabalho.', 'AMBIENTE_OBRIGATORIO');
    }

    await validarContextoOrganizacional({
        id_empresa: avaliacaoAtual.id_empresa,
        id_vinculo: avaliacaoAtual.id_vinculo,
        id_ambiente: dados.id_ambiente,
        id_posto: dados.id_posto ?? null,
        id_vinculo_funcao: dados.id_vinculo_funcao ?? null,
        id_perfil_antropometrico: dados.id_perfil_antropometrico ?? null,
    });

    const { data, error } = await supabase
        .from('avaliacao_ergonomica')
        .update({
            id_vinculo_funcao: dados.id_vinculo_funcao ?? null,
            id_ambiente: dados.id_ambiente,
            id_posto: dados.id_posto ?? null,
            id_perfil_antropometrico: dados.id_perfil_antropometrico ?? null,
            observacoes: dados.observacoes ?? null,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_avaliacao', idAvaliacao)
        .select(COLUNAS_AVALIACAO)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

function validarTempoExposicao(valor) {
    if (valor === null || valor === undefined) {
        return;
    }
    if (!Number.isInteger(valor) || valor <= 0) {
        throw erroValidacao('O tempo de exposição deve ser um número inteiro maior que zero.', 'TEMPO_EXPOSICAO_INVALIDO');
    }
}

function validarFrequenciaDiaria(valor) {
    if (valor === null || valor === undefined) {
        return;
    }
    if (!Number.isInteger(valor) || valor < 0) {
        throw erroValidacao('A frequência diária deve ser um número inteiro maior ou igual a zero.', 'FREQUENCIA_INVALIDA');
    }
}

function mapearAtividadeAvaliacao(linha) {
    return {
        id_avaliacao_atividade: linha.id_avaliacao_atividade,
        id_avaliacao: linha.id_avaliacao,
        id_atividade: linha.id_atividade,
        principal: linha.principal,
        tempo_exposicao_minutos: linha.tempo_exposicao_minutos,
        frequencia_diaria: linha.frequencia_diaria,
        observacao: linha.observacao,
        criado_em: linha.criado_em,
        nome: linha.atividade?.nome ?? null,
        descricao: linha.atividade?.descricao ?? null,
        postura_predominante: linha.atividade?.postura_predominante ?? null,
    };
}

// Catalogo de atividades ativas da empresa. Quando idFuncao e informado, as
// atividades ja relacionadas a essa funcao (funcao_atividade) aparecem
// primeiro - apenas uma sugestao de ordenacao (secao 28): nenhuma atividade
// valida da empresa fica de fora da lista.
export async function listarAtividades({ idEmpresa, idFuncao = null }) {
    const { data, error } = await supabase
        .from('atividade')
        .select('id_atividade, id_empresa, codigo, nome, descricao, postura_predominante, ativo')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    if (!idFuncao) {
        return data;
    }

    const { data: relacionadas, error: erroRelacionadas } = await supabase
        .from('funcao_atividade')
        .select('id_atividade')
        .eq('id_funcao', idFuncao)
        .eq('ativo', true);

    if (erroRelacionadas) {
        throw erroRelacionadas;
    }

    const idsSugeridos = new Set((relacionadas || []).map((item) => item.id_atividade));

    // Sort estavel: mantem a ordem alfabetica dentro de cada grupo
    // (sugeridas pela funcao primeiro, demais depois).
    return [...data].sort((a, b) => {
        const aSugerida = idsSugeridos.has(a.id_atividade);
        const bSugerida = idsSugeridos.has(b.id_atividade);
        if (aSugerida === bSugerida) {
            return 0;
        }
        return aSugerida ? -1 : 1;
    });
}

export async function listarAtividadesDaAvaliacao(idAvaliacao) {
    const { data, error } = await supabase
        .from('avaliacao_atividade')
        .select(COLUNAS_ATIVIDADE_AVALIACAO)
        .eq('id_avaliacao', idAvaliacao)
        .order('principal', { ascending: false })
        .order('criado_em', { ascending: true });

    if (error) {
        throw error;
    }

    return data.map(mapearAtividadeAvaliacao);
}

// Antes de marcar uma atividade como principal, desmarca as demais da
// mesma avaliacao (secao 16: no MVP, no maximo uma atividade principal por
// avaliacao). A confirmacao com o usuario, quando ja existe outra
// principal, e responsabilidade da pagina - o service so garante a regra.
async function demoverAtividadesPrincipais(idAvaliacao, idExcecao = null) {
    let query = supabase
        .from('avaliacao_atividade')
        .update({ principal: false })
        .eq('id_avaliacao', idAvaliacao)
        .eq('principal', true);

    if (idExcecao) {
        query = query.neq('id_avaliacao_atividade', idExcecao);
    }

    const { error } = await query;
    if (error) {
        throw error;
    }
}

// dados: { id_atividade, principal, tempo_exposicao_minutos,
//          frequencia_diaria, observacao }
export async function adicionarAtividadeAvaliacao(idAvaliacao, dados) {
    await garantirAvaliacaoEditavel(idAvaliacao);

    if (!dados.id_atividade) {
        throw erroValidacao('Selecione a atividade.', 'ATIVIDADE_OBRIGATORIA');
    }
    validarTempoExposicao(dados.tempo_exposicao_minutos);
    validarFrequenciaDiaria(dados.frequencia_diaria);

    const { data: existente, error: erroExistente } = await supabase
        .from('avaliacao_atividade')
        .select('id_avaliacao_atividade')
        .eq('id_avaliacao', idAvaliacao)
        .eq('id_atividade', dados.id_atividade)
        .maybeSingle();

    if (erroExistente) {
        throw erroExistente;
    }
    if (existente) {
        throw erroValidacao('Esta atividade já foi associada a esta avaliação.', 'ATIVIDADE_DUPLICADA');
    }

    if (dados.principal) {
        await demoverAtividadesPrincipais(idAvaliacao);
    }

    const { data, error } = await supabase
        .from('avaliacao_atividade')
        .insert({
            id_avaliacao: idAvaliacao,
            id_atividade: dados.id_atividade,
            principal: Boolean(dados.principal),
            tempo_exposicao_minutos: dados.tempo_exposicao_minutos ?? null,
            frequencia_diaria: dados.frequencia_diaria ?? null,
            observacao: dados.observacao ?? null,
        })
        .select(COLUNAS_ATIVIDADE_AVALIACAO)
        .single();

    if (error) {
        throw error;
    }

    return mapearAtividadeAvaliacao(data);
}

// dados: { principal, tempo_exposicao_minutos, frequencia_diaria,
//          observacao }. A atividade associada (id_atividade) nao muda em
// uma edicao - para trocar de atividade, remove-se e adiciona-se outra.
export async function atualizarAtividadeAvaliacao(idAvaliacaoAtividade, dados) {
    const { data: linhaAtual, error: erroAtual } = await supabase
        .from('avaliacao_atividade')
        .select('id_avaliacao_atividade, id_avaliacao')
        .eq('id_avaliacao_atividade', idAvaliacaoAtividade)
        .single();

    if (erroAtual) {
        throw erroAtual;
    }

    await garantirAvaliacaoEditavel(linhaAtual.id_avaliacao);
    validarTempoExposicao(dados.tempo_exposicao_minutos);
    validarFrequenciaDiaria(dados.frequencia_diaria);

    if (dados.principal) {
        await demoverAtividadesPrincipais(linhaAtual.id_avaliacao, idAvaliacaoAtividade);
    }

    const { data, error } = await supabase
        .from('avaliacao_atividade')
        .update({
            principal: Boolean(dados.principal),
            tempo_exposicao_minutos: dados.tempo_exposicao_minutos ?? null,
            frequencia_diaria: dados.frequencia_diaria ?? null,
            observacao: dados.observacao ?? null,
        })
        .eq('id_avaliacao_atividade', idAvaliacaoAtividade)
        .select(COLUNAS_ATIVIDADE_AVALIACAO)
        .single();

    if (error) {
        throw error;
    }

    return mapearAtividadeAvaliacao(data);
}

// Remocao fisica (nao ha soft delete previsto para esta associativa no
// schema): permitida apenas enquanto a avaliacao ainda esta em elaboracao
// (secao 21).
export async function removerAtividadeAvaliacao(idAvaliacaoAtividade) {
    const { data: linhaAtual, error: erroAtual } = await supabase
        .from('avaliacao_atividade')
        .select('id_avaliacao_atividade, id_avaliacao')
        .eq('id_avaliacao_atividade', idAvaliacaoAtividade)
        .single();

    if (erroAtual) {
        throw erroAtual;
    }

    await garantirAvaliacaoEditavel(linhaAtual.id_avaliacao);

    const { error } = await supabase
        .from('avaliacao_atividade')
        .delete()
        .eq('id_avaliacao_atividade', idAvaliacaoAtividade);

    if (error) {
        throw error;
    }
}
