import { supabase } from '../config/supabase.js';

// FEIRA-03 - Dashboard Executivo: camada de leitura gerencial.
// Responsabilidade: consultar o Supabase, consolidar/agregar em memoria e
// devolver estruturas prontas para o dashboard.js desenhar. NUNCA manipula
// DOM, NUNCA chama echarts, NUNCA executa o Motor de Risco (motorRisco.js/
// classificadorRisco.js/riscoService.js.processarRiscosDaAvaliacao) - so
// LE resultados ja persistidos. Se uma avaliacao ainda nao tem resultado,
// ela simplesmente nao aparece nos indicadores de risco.

function erroDashboard(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// --- Bloco 1: avaliacoes finalizadas + resolucao de setor -----------------
// Consulta em bloco (nunca uma consulta por avaliacao/setor - secao 38):
// avaliacao_ergonomica -> colaborador_vinculo -> setor, resolvidos em 3
// idas ao banco no total, reaproveitadas por varios indicadores abaixo.
async function carregarAvaliacoesFinalizadasComSetor() {
    const { data: avaliacoes, error: erroAvaliacoes } = await supabase
        .from('avaliacao_ergonomica')
        .select('id_avaliacao, id_vinculo, data_avaliacao, data_finalizacao, id_classificacao_geral')
        .eq('status', 'FINALIZADA');

    if (erroAvaliacoes) throw erroAvaliacoes;

    const idsVinculo = [...new Set((avaliacoes || []).map((avaliacao) => avaliacao.id_vinculo))];
    const { data: vinculos, error: erroVinculos } = idsVinculo.length > 0
        ? await supabase.from('colaborador_vinculo').select('id_vinculo, id_setor').in('id_vinculo', idsVinculo)
        : { data: [], error: null };
    if (erroVinculos) throw erroVinculos;

    const idsSetor = [...new Set((vinculos || []).map((vinculo) => vinculo.id_setor))];
    const { data: setores, error: erroSetores } = idsSetor.length > 0
        ? await supabase.from('setor').select('id_setor, nome').in('id_setor', idsSetor)
        : { data: [], error: null };
    if (erroSetores) throw erroSetores;

    const setorPorIdVinculo = new Map();
    const nomeSetorPorId = new Map((setores || []).map((setor) => [setor.id_setor, setor.nome]));
    (vinculos || []).forEach((vinculo) => {
        setorPorIdVinculo.set(vinculo.id_vinculo, nomeSetorPorId.get(vinculo.id_setor) || null);
    });

    return (avaliacoes || []).map((avaliacao) => ({
        ...avaliacao,
        nome_setor: setorPorIdVinculo.get(avaliacao.id_vinculo) || 'Sem setor',
    }));
}

// Riscos calculados (avaliacao_risco), restritos as avaliacoes FINALIZADA
// carregadas acima - garante que KPIs e graficos usem exatamente o mesmo
// conjunto de avaliacoes (secao 50: numeros precisam bater entre si).
async function carregarRiscosDasAvaliacoes(avaliacoes) {
    const idsAvaliacao = avaliacoes.map((avaliacao) => avaliacao.id_avaliacao);
    if (idsAvaliacao.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from('avaliacao_risco')
        .select(
            'id_avaliacao_risco, id_avaliacao, id_risco, pontuacao, '
            + 'risco_ergonomico(codigo, nome), '
            + 'classificacao_risco(id_classificacao, codigo, nome, cor_hex, prioridade)',
        )
        .in('id_avaliacao', idsAvaliacao);

    if (error) throw error;

    const setorPorAvaliacao = new Map(avaliacoes.map((avaliacao) => [avaliacao.id_avaliacao, avaliacao.nome_setor]));

    return (data || []).map((linha) => ({
        id_avaliacao_risco: linha.id_avaliacao_risco,
        id_avaliacao: linha.id_avaliacao,
        pontuacao: Number(linha.pontuacao),
        nome_risco: linha.risco_ergonomico?.nome ?? 'Risco não identificado',
        classificacao_codigo: linha.classificacao_risco?.codigo ?? null,
        classificacao_nome: linha.classificacao_risco?.nome ?? 'Sem classificação',
        classificacao_cor: linha.classificacao_risco?.cor_hex ?? null,
        classificacao_prioridade: linha.classificacao_risco?.prioridade ?? 0,
        nome_setor: setorPorAvaliacao.get(linha.id_avaliacao) || 'Sem setor',
    }));
}

async function carregarAcoesPlano() {
    const { data, error } = await supabase.from('acao_plano').select('id_acao, status, prazo');
    if (error) throw error;
    return data || [];
}

// --- KPIs -------------------------------------------------------------------
// Niveis considerados prioritarios (secao 14): resolvidos pelo CODIGO real
// de classificacao_risco, nunca por cor ou por posicao na lista.
const CODIGOS_CLASSIFICACAO_PRIORITARIA = ['ALTO', 'CRITICO'];
// "Aberta" = qualquer status que nao representa a acao encerrada (secao 15).
const STATUS_ACAO_CONCLUIDOS = ['CONCLUIDA', 'CANCELADA'];

export async function buscarIndicadoresDashboard() {
    const avaliacoes = await carregarAvaliacoesFinalizadasComSetor();
    const riscos = await carregarRiscosDasAvaliacoes(avaliacoes);
    const acoes = await carregarAcoesPlano();

    const riscosIdentificados = riscos.filter((risco) => risco.pontuacao > 0);
    const riscosAltoCritico = riscos.filter((risco) => CODIGOS_CLASSIFICACAO_PRIORITARIA.includes(risco.classificacao_codigo));
    const acoesAbertas = acoes.filter((acao) => !STATUS_ACAO_CONCLUIDOS.includes(acao.status));

    const hojeIso = new Date().toISOString().slice(0, 10);
    const acoesAtrasadas = acoes.filter(
        (acao) => acao.prazo && acao.prazo < hojeIso && !STATUS_ACAO_CONCLUIDOS.includes(acao.status),
    );

    return {
        kpis: {
            totalAvaliacoes: avaliacoes.length,
            totalRiscosIdentificados: riscosIdentificados.length,
            totalRiscosAltoCritico: riscosAltoCritico.length,
            totalAcoesAbertas: acoesAbertas.length,
            totalAcoesAtrasadas: acoesAtrasadas.length,
        },
        avaliacoes,
        riscos,
        riscosIdentificados,
        acoes,
    };
}

// --- Grafico 1: riscos por classificacao (donut) -----------------------------
// So conta riscos com pontuacao > 0 (secao 13/16) - risco com pontuacao 0
// existe para rastreabilidade, nao representa um fator efetivamente
// identificado.
export function agruparRiscosPorClassificacao(riscosIdentificados) {
    const porCodigo = new Map();

    riscosIdentificados.forEach((risco) => {
        const chave = risco.classificacao_codigo || 'SEM_CLASSIFICACAO';
        const atual = porCodigo.get(chave) || {
            codigo: chave,
            nome: risco.classificacao_nome,
            cor: risco.classificacao_cor,
            prioridade: risco.classificacao_prioridade,
            quantidade: 0,
        };
        atual.quantidade += 1;
        porCodigo.set(chave, atual);
    });

    return [...porCodigo.values()].sort((a, b) => b.prioridade - a.prioridade);
}

// --- Grafico 2: riscos por setor (barra horizontal) ---------------------------
export function agruparRiscosPorSetor(riscosIdentificados) {
    const porSetor = new Map();
    riscosIdentificados.forEach((risco) => {
        porSetor.set(risco.nome_setor, (porSetor.get(risco.nome_setor) || 0) + 1);
    });

    return [...porSetor.entries()]
        .map(([setor, quantidade]) => ({ setor, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);
}

// --- Grafico 3: evolucao das avaliacoes (linha, por mes) ----------------------
// Agrupado por data_avaliacao (data em que a avaliacao foi realizada/
// respondida) em vez de data_finalizacao: representa quando o trabalho de
// campo aconteceu, que e o que um gestor normalmente quer enxergar numa
// linha do tempo de avaliacoes. Ambas as datas so existem em avaliacoes
// FINALIZADA neste indicador.
export function agruparAvaliacoesPorMes(avaliacoes) {
    const porMes = new Map();
    avaliacoes.forEach((avaliacao) => {
        const chave = String(avaliacao.data_avaliacao).slice(0, 7); // YYYY-MM
        porMes.set(chave, (porMes.get(chave) || 0) + 1);
    });

    return [...porMes.entries()]
        .map(([mes, quantidade]) => ({ mes, quantidade }))
        .sort((a, b) => a.mes.localeCompare(b.mes));
}

// --- Grafico 4: plano de acao por status (barra) -------------------------------
export function agruparAcoesPorStatus(acoes) {
    const porStatus = new Map();
    acoes.forEach((acao) => {
        porStatus.set(acao.status, (porStatus.get(acao.status) || 0) + 1);
    });
    return [...porStatus.entries()].map(([status, quantidade]) => ({ status, quantidade }));
}

// --- Riscos que exigem atencao (lista HTML, secao 25/26) ----------------------
export function listarRiscosPrioritarios(riscosIdentificados, limite = 5) {
    return [...riscosIdentificados]
        .sort((a, b) => {
            if (b.classificacao_prioridade !== a.classificacao_prioridade) {
                return b.classificacao_prioridade - a.classificacao_prioridade;
            }
            return b.pontuacao - a.pontuacao;
        })
        .slice(0, limite);
}
