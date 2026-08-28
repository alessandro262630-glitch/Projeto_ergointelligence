import { supabase } from '../config/supabase.js';
import { buscarAvaliacaoPorId } from './avaliacaoService.js';
import { listarResultadosRiscoDaAvaliacao } from './riscoService.js';

// REC-01/REC-02 - Recomendacoes da avaliacao ergonomica.
// Fluxo permitido: risco_ergonomico -> risco_recomendacao -> recomendacao.
// NAO inventa recomendacao a partir de texto livre e NAO usa LLM para
// decidir o que sugerir - so relacoes ja cadastradas no banco. O snapshot
// em avaliacao_recomendacao preserva o que foi sugerido no momento em que a
// avaliacao foi processada, mesmo que o catalogo mude depois.

const COLUNAS_AVALIACAO_RECOMENDACAO = 'id_avaliacao_recomendacao, id_avaliacao, id_avaliacao_risco, id_recomendacao, '
    + 'descricao_personalizada, prioridade, origem, status, validada_por, validada_em, gerada_em, '
    + 'recomendacao(codigo, titulo, descricao, tipo, requer_validacao, fonte_tecnica)';

// Excecao explicita do MVP (secao 11 do prompt REC-01/REC-02): o seed nao
// tem nenhuma coluna que expresse "so sugerir quando o risco for ALTO/
// CRITICO" - isso esta descrito apenas no texto de
// recomendacao.descricao da REC-PROF-01. Em vez de criar uma engine nova
// de regras para um unico caso, o criterio fica documentado aqui, checado
// pelo codigo da recomendacao. Se o projeto vier a modelar isso no banco
// (ex.: uma coluna de classificacao minima em risco_recomendacao), esta
// funcao deve ser atualizada/removida em favor da coluna real.
const CODIGO_RECOMENDACAO_SOMENTE_ALTO_CRITICO = 'REC-PROF-01';
const CLASSIFICACOES_QUE_LIBERAM_REC_PROF_01 = ['ALTO', 'CRITICO'];

function erroRecomendacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

function mapearAvaliacaoRecomendacao(linha) {
    return {
        id_avaliacao_recomendacao: linha.id_avaliacao_recomendacao,
        id_avaliacao: linha.id_avaliacao,
        id_avaliacao_risco: linha.id_avaliacao_risco,
        id_recomendacao: linha.id_recomendacao,
        descricao_personalizada: linha.descricao_personalizada,
        prioridade: linha.prioridade,
        origem: linha.origem,
        status: linha.status,
        validada_por: linha.validada_por,
        validada_em: linha.validada_em,
        gerada_em: linha.gerada_em,
        // Texto exibido vem sempre do catalogo atual (secao 16): o
        // snapshot preserva QUAL recomendacao e com que prioridade/status,
        // nao uma copia congelada do texto.
        codigo: linha.recomendacao?.codigo ?? null,
        titulo: linha.recomendacao?.titulo ?? null,
        descricao: linha.recomendacao?.descricao ?? null,
        tipo: linha.recomendacao?.tipo ?? null,
        requer_validacao: linha.recomendacao?.requer_validacao ?? null,
        fonte_tecnica: linha.recomendacao?.fonte_tecnica ?? null,
    };
}

function recomendacaoAplicavelAoRisco(recomendacao, risco) {
    if (recomendacao.codigo !== CODIGO_RECOMENDACAO_SOMENTE_ALTO_CRITICO) {
        return true;
    }
    // A classificacao considerada e a do RISCO especifico (avaliacao_risco.
    // id_classificacao), nunca a classificacao geral da avaliacao (secao 10).
    return CLASSIFICACOES_QUE_LIBERAM_REC_PROF_01.includes(risco.classificacao?.codigo);
}

// --- Leitura ------------------------------------------------------------------

export async function listarRecomendacoesDaAvaliacao(idAvaliacao) {
    const { data, error } = await supabase
        .from('avaliacao_recomendacao')
        .select(COLUNAS_AVALIACAO_RECOMENDACAO)
        .eq('id_avaliacao', idAvaliacao)
        .order('gerada_em', { ascending: true });

    if (error) {
        throw error;
    }

    return (data || []).map(mapearAvaliacaoRecomendacao);
}

export async function listarRecomendacoesPorRisco(idAvaliacaoRisco) {
    const { data, error } = await supabase
        .from('avaliacao_recomendacao')
        .select(COLUNAS_AVALIACAO_RECOMENDACAO)
        .eq('id_avaliacao_risco', idAvaliacaoRisco)
        .order('gerada_em', { ascending: true });

    if (error) {
        throw error;
    }

    return (data || []).map(mapearAvaliacaoRecomendacao);
}

// Determina, para os riscos ja calculados de uma avaliacao, quais
// recomendacoes se aplicam - sem persistir nada. So considera:
// - riscos com pontuacao > 0 (secao 9: pontuacao 0 nao gera recomendacao,
//   mesmo que exista para rastreabilidade);
// - relacoes risco_recomendacao.ativo = true;
// - recomendacao.ativo = true;
// - a excecao explicita da REC-PROF-01 (secao 11).
//
// `resultadosRisco` e o array retornado por
// riscoService.listarResultadosRiscoDaAvaliacao (ja traz
// id_avaliacao_risco, id_risco e a classificacao do proprio risco).
export async function buscarRecomendacoesParaRiscos(resultadosRisco) {
    const riscosElegiveis = (resultadosRisco || []).filter((risco) => Number(risco.pontuacao) > 0);
    if (riscosElegiveis.length === 0) {
        return [];
    }

    const idsRiscos = riscosElegiveis.map((risco) => risco.id_risco);
    const { data: relacoes, error: erroRelacoes } = await supabase
        .from('risco_recomendacao')
        .select('id_risco, id_recomendacao, prioridade_sugerida')
        .in('id_risco', idsRiscos)
        .eq('ativo', true);

    if (erroRelacoes) {
        throw erroRelacoes;
    }
    if (!relacoes || relacoes.length === 0) {
        return [];
    }

    const idsRecomendacoes = [...new Set(relacoes.map((relacao) => relacao.id_recomendacao))];
    const { data: recomendacoes, error: erroRecomendacoes } = await supabase
        .from('recomendacao')
        .select('id_recomendacao, codigo, titulo, tipo, requer_validacao')
        .in('id_recomendacao', idsRecomendacoes)
        .eq('ativo', true);

    if (erroRecomendacoes) {
        throw erroRecomendacoes;
    }

    const recomendacaoPorId = new Map(recomendacoes.map((recomendacao) => [recomendacao.id_recomendacao, recomendacao]));
    const riscoPorId = new Map(riscosElegiveis.map((risco) => [risco.id_risco, risco]));

    const candidatos = [];
    relacoes.forEach((relacao) => {
        const risco = riscoPorId.get(relacao.id_risco);
        const recomendacao = recomendacaoPorId.get(relacao.id_recomendacao);
        // risco ausente = risco nao elegivel (pontuacao 0); recomendacao
        // ausente = inativa/inexistente. Ambos sao ignorados, nunca um erro.
        if (!risco || !recomendacao) {
            return;
        }
        if (!recomendacaoAplicavelAoRisco(recomendacao, risco)) {
            return;
        }
        candidatos.push({ risco, recomendacao, prioridade_sugerida: relacao.prioridade_sugerida });
    });

    return candidatos;
}

// --- Escrita --------------------------------------------------------------------

// Gera e persiste os snapshots para uma avaliacao que AINDA NAO possui
// nenhum (a checagem de idempotencia e responsabilidade de quem chama -
// processarOuObterRecomendacoes). origem = REGRA e status = SUGERIDA
// sempre (secoes 14/15/18/19) - nunca ACEITA/REJEITADA automaticamente, e
// validada_por/validada_em permanecem NULL.
export async function gerarRecomendacoesDaAvaliacao(idAvaliacao) {
    const resultadosRisco = await listarResultadosRiscoDaAvaliacao(idAvaliacao);
    const candidatos = await buscarRecomendacoesParaRiscos(resultadosRisco);

    if (candidatos.length === 0) {
        return [];
    }

    const linhas = candidatos.map((candidato) => ({
        id_avaliacao: idAvaliacao,
        id_avaliacao_risco: candidato.risco.id_avaliacao_risco,
        id_recomendacao: candidato.recomendacao.id_recomendacao,
        descricao_personalizada: null,
        prioridade: candidato.prioridade_sugerida,
        origem: 'REGRA',
        status: 'SUGERIDA',
        // Explicito de proposito (secao 18): uma recomendacao gerada
        // automaticamente nunca nasce validada - isso exige uma acao futura
        // e explicita do profissional/gestor.
        validada_por: null,
        validada_em: null,
    }));

    const { data, error } = await supabase
        .from('avaliacao_recomendacao')
        .insert(linhas)
        .select(COLUNAS_AVALIACAO_RECOMENDACAO);

    if (error) {
        console.error('Erro ao persistir avaliacao_recomendacao:', error);
        if (error.code === '23505') {
            // uq_avaliacao_recomendacao (id_avaliacao_risco, id_recomendacao):
            // outra chamada concorrente ja inseriu o mesmo snapshot.
            throw erroRecomendacao(
                'Estas recomendações já haviam sido geradas para esta avaliação.',
                'RECOMENDACAO_DUPLICADA',
            );
        }
        throw erroRecomendacao('Não foi possível salvar as recomendações da avaliação.', 'PERSISTENCIA_RECOMENDACAO_FALHOU');
    }

    return (data || []).map(mapearAvaliacaoRecomendacao);
}

// Porta de entrada para a integracao com o fluxo (resultado.js). Nunca
// reprocessa/regenera silenciosamente uma avaliacao que ja possui
// snapshots (secoes 23/24/25) - o catalogo pode mudar depois, o historico
// nao acompanha.
export async function processarOuObterRecomendacoes(idAvaliacao) {
    const avaliacao = await buscarAvaliacaoPorId(idAvaliacao);

    if (avaliacao.status !== 'FINALIZADA') {
        throw erroRecomendacao(
            'A avaliação precisa estar finalizada antes de gerar recomendações.',
            'AVALIACAO_NAO_FINALIZADA',
        );
    }

    // Nunca aciona o Motor de Risco a partir daqui (secao 12 do prompt
    // INT-RSK-01 / secao 12 deste prompt): so consome resultado ja
    // persistido.
    const resultadosRisco = await listarResultadosRiscoDaAvaliacao(idAvaliacao);
    if (resultadosRisco.length === 0) {
        throw erroRecomendacao(
            'Esta avaliação ainda não possui resultado de risco calculado.',
            'SEM_RESULTADO_DE_RISCO',
        );
    }

    const existentes = await listarRecomendacoesDaAvaliacao(idAvaliacao);
    if (existentes.length > 0) {
        return { processadoAgora: false, jaExistia: true, recomendacoes: existentes };
    }

    try {
        const geradas = await gerarRecomendacoesDaAvaliacao(idAvaliacao);
        return { processadoAgora: true, jaExistia: false, recomendacoes: geradas };
    } catch (error) {
        if (error?.code === 'RECOMENDACAO_DUPLICADA') {
            const recomendacoes = await listarRecomendacoesDaAvaliacao(idAvaliacao);
            return { processadoAgora: false, jaExistia: true, recomendacoes };
        }
        throw error;
    }
}
