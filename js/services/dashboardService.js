import { supabase } from '../config/supabase.js';
import { obterIdEmpresaAtiva } from './colaboradorService.js';

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

// =====================================================================
// DASH-01 - Bloco GHE + Motor de Risco do GHE
// =====================================================================
// Consumidor puro de dados ja persistidos pelo Motor GHE
// (avaliacao_ghe_risco / processamento_risco_ghe) - NUNCA recalcula
// metrica/regra/classificacao (js/domain/ghe-risk/*.js e
// js/services/motorRiscoGheService.js nunca sao importados nem alterados
// aqui). Inventario de Riscos fica fora desta etapa (integracao e DASH-02).
//
// "Processamento atual" de uma avaliacao_ghe = o processamento CONCLUIDO
// mais recente (mesma regra ja usada por
// motorRiscoGheService.buscarProcessamentoOficial, replicada aqui em LOTE
// para as N avaliacoes do dashboard de uma so vez, em vez de 1 consulta
// por avaliacao - secao 13/14/38 do prompt DASH-01). Reprocessar uma
// avaliacao GHE nunca duplica a visao atual: so a linha mais recente por
// avaliacao entra nos indicadores.
//
// "Avaliacao atual" de um GHE (quando ha mais de uma ao longo do tempo) =
// a mais recente que nao esteja CANCELADA - usada para resolver cobertura
// (plano de amostragem + coletas) de forma consistente com os riscos
// exibidos (secao 26).

async function carregarGhesAtivosDaEmpresa() {
    const idEmpresa = await obterIdEmpresaAtiva();
    const { data, error } = await supabase
        .from('ghe')
        .select('id_ghe, nome, universo, id_setor, setor(nome)')
        .eq('id_empresa', idEmpresa)
        .eq('ativo', true)
        .order('nome', { ascending: true });
    if (error) throw error;
    return (data || []).map((linha) => ({
        id_ghe: linha.id_ghe,
        nome: linha.nome,
        universo: linha.universo,
        nome_setor: linha.setor?.nome ?? null,
    }));
}

// KPI 03 (secao 11): avaliacoes GHE "relevantes" = todo avaliacao_ghe que
// nao foi cancelado. Nunca inclui avaliacao_ergonomica (Motor individual).
async function carregarAvaliacoesGheRelevantes(idsGhe) {
    if (idsGhe.length === 0) return [];
    const { data, error } = await supabase
        .from('avaliacao_ghe')
        .select('id_avaliacao_ghe, id_ghe, id_plano_amostragem, status, data_avaliacao')
        .in('id_ghe', idsGhe)
        .neq('status', 'CANCELADA')
        .order('data_avaliacao', { ascending: false });
    if (error) throw error;
    return data || [];
}

// Primeira ocorrencia por id_ghe = a mais recente, pois a consulta acima
// ja veio ordenada por data_avaliacao DESC.
function resolverAvaliacaoAtualPorGhe(avaliacoes) {
    const mapa = new Map();
    avaliacoes.forEach((avaliacao) => {
        if (!mapa.has(avaliacao.id_ghe)) {
            mapa.set(avaliacao.id_ghe, avaliacao);
        }
    });
    return mapa;
}

async function carregarPlanosAmostragemPorId(idsPlano) {
    const mapa = new Map();
    if (idsPlano.length === 0) return mapa;
    const { data, error } = await supabase
        .from('plano_amostragem')
        .select('id_plano_amostragem, amostra_planejada, status')
        .in('id_plano_amostragem', idsPlano);
    if (error) throw error;
    // Plano CANCELADO nunca conta para cobertura (secao 26) - mantido fora
    // do mapa, entao a avaliacao correspondente cai no caminho "sem
    // amostra planejada" (N/A), nunca 0/0.
    (data || []).forEach((plano) => {
        if (plano.status !== 'CANCELADO') {
            mapa.set(plano.id_plano_amostragem, plano);
        }
    });
    return mapa;
}

async function contarColetasConcluidasPorAvaliacao(idsAvaliacaoGhe) {
    const mapa = new Map();
    if (idsAvaliacaoGhe.length === 0) return mapa;
    const { data, error } = await supabase
        .from('coleta_ghe')
        .select('id_avaliacao_ghe')
        .in('id_avaliacao_ghe', idsAvaliacaoGhe)
        .eq('status', 'CONCLUIDA');
    if (error) throw error;
    (data || []).forEach((coleta) => {
        mapa.set(coleta.id_avaliacao_ghe, (mapa.get(coleta.id_avaliacao_ghe) || 0) + 1);
    });
    return mapa;
}

// Processamento CONCLUIDO mais recente de cada avaliacao, em uma unica
// consulta (nunca 1 consulta por avaliacao). embed de metodologia_risco
// evita uma segunda rodada de consultas so para status_validacao/codigo/
// versao (secao 19/38).
async function carregarProcessamentosAtuaisPorAvaliacao(idsAvaliacaoGhe) {
    const mapa = new Map();
    if (idsAvaliacaoGhe.length === 0) return mapa;

    const { data, error } = await supabase
        .from('processamento_risco_ghe')
        .select('id_processamento_risco_ghe, id_avaliacao_ghe, processado_em, metodologia_risco(codigo, versao, status_validacao)')
        .in('id_avaliacao_ghe', idsAvaliacaoGhe)
        .eq('status', 'CONCLUIDO')
        .order('processado_em', { ascending: false });
    if (error) throw error;

    (data || []).forEach((linha) => {
        if (mapa.has(linha.id_avaliacao_ghe)) return; // ja tem o mais recente (ordenado DESC)
        mapa.set(linha.id_avaliacao_ghe, {
            id_processamento_risco_ghe: linha.id_processamento_risco_ghe,
            id_avaliacao_ghe: linha.id_avaliacao_ghe,
            processado_em: linha.processado_em,
            metodologia_codigo: linha.metodologia_risco?.codigo ?? null,
            metodologia_versao: linha.metodologia_risco?.versao ?? null,
            metodologia_status_validacao: linha.metodologia_risco?.status_validacao ?? null,
        });
    });
    return mapa;
}

// Exposta isoladamente (secao 14 do prompt) para reuso pontual fora do
// agregado principal, sem duplicar a regra de selecao em outro lugar.
export async function buscarProcessamentoAtualPorAvaliacao(idAvaliacaoGhe) {
    const mapa = await carregarProcessamentosAtuaisPorAvaliacao([idAvaliacaoGhe]);
    return mapa.get(idAvaliacaoGhe) ?? null;
}

async function carregarResultadosDosProcessamentos(idsProcessamento) {
    if (idsProcessamento.length === 0) return [];
    const { data, error } = await supabase
        .from('avaliacao_ghe_risco')
        .select(
            'id_avaliacao_ghe_risco, id_processamento_risco_ghe, id_risco, pontuacao, '
            + 'risco_ergonomico(nome), '
            + 'classificacao_risco_ghe(codigo, nome, cor_hex, prioridade)',
        )
        .in('id_processamento_risco_ghe', idsProcessamento);
    if (error) throw error;

    return (data || []).map((linha) => ({
        id_avaliacao_ghe_risco: linha.id_avaliacao_ghe_risco,
        id_processamento_risco_ghe: linha.id_processamento_risco_ghe,
        nome_risco: linha.risco_ergonomico?.nome ?? 'Risco não identificado',
        pontuacao: Number(linha.pontuacao),
        classificacao_codigo: linha.classificacao_risco_ghe?.codigo ?? null,
        classificacao_nome: linha.classificacao_risco_ghe?.nome ?? 'Sem classificação',
        classificacao_cor: linha.classificacao_risco_ghe?.cor_hex ?? null,
        classificacao_prioridade: linha.classificacao_risco_ghe?.prioridade ?? 0,
    }));
}

// KPI 04 (secao 12): conta RESULTADOS DE RISCO (linhas de
// avaliacao_ghe_risco) dos processamentos atuais - nao riscos distintos.
// Um mesmo risco (ex.: "Postura inadequada") aparece uma vez por GHE
// processado, entao pode contar mais de uma vez no total caso mais de um
// GHE tenha esse risco no seu processamento atual. Regra documentada em
// docs/dash01-dashboard-ghe-motor.md.
export async function buscarIndicadoresGhe() {
    const ghes = await carregarGhesAtivosDaEmpresa();
    const idsGhe = ghes.map((ghe) => ghe.id_ghe);
    const ghePorId = new Map(ghes.map((ghe) => [ghe.id_ghe, ghe]));

    const avaliacoes = await carregarAvaliacoesGheRelevantes(idsGhe);
    const idsAvaliacao = avaliacoes.map((avaliacao) => avaliacao.id_avaliacao_ghe);
    const avaliacaoAtualPorGhe = resolverAvaliacaoAtualPorGhe(avaliacoes);
    const ghePorAvaliacao = new Map(avaliacoes.map((avaliacao) => [avaliacao.id_avaliacao_ghe, avaliacao.id_ghe]));

    const idsPlano = [...new Set(avaliacoes.map((avaliacao) => avaliacao.id_plano_amostragem).filter(Boolean))];
    const [planosPorId, coletasPorAvaliacao, processamentosPorAvaliacao] = await Promise.all([
        carregarPlanosAmostragemPorId(idsPlano),
        contarColetasConcluidasPorAvaliacao(idsAvaliacao),
        carregarProcessamentosAtuaisPorAvaliacao(idsAvaliacao),
    ]);

    const processamentoPorId = new Map(
        [...processamentosPorAvaliacao.values()].map((processamento) => [processamento.id_processamento_risco_ghe, processamento]),
    );
    const idsProcessamentoAtual = [...processamentoPorId.keys()];
    const riscosBrutos = await carregarResultadosDosProcessamentos(idsProcessamentoAtual);

    // Anexa GHE/avaliacao/metodologia a cada risco, resolvido em memoria a
    // partir dos mapas ja carregados (secao 38 - nunca uma consulta por risco).
    const riscos = riscosBrutos.map((risco) => {
        const processamento = processamentoPorId.get(risco.id_processamento_risco_ghe);
        const idAvaliacao = processamento?.id_avaliacao_ghe ?? null;
        const idGhe = idAvaliacao ? ghePorAvaliacao.get(idAvaliacao) : null;
        const ghe = idGhe ? ghePorId.get(idGhe) : null;
        return {
            ...risco,
            id_ghe: idGhe ?? null,
            nome_ghe: ghe?.nome ?? 'GHE não identificado',
            id_avaliacao_ghe: idAvaliacao,
            processado_em: processamento?.processado_em ?? null,
            metodologia_codigo: processamento?.metodologia_codigo ?? null,
            metodologia_versao: processamento?.metodologia_versao ?? null,
            metodologia_status_validacao: processamento?.metodologia_status_validacao ?? null,
        };
    });

    // Cobertura + resumo por GHE (secao 22-27/33): base unica reaproveitada
    // pelo grafico "Riscos por GHE", pela tabela de cobertura e pelos
    // cards de "GHEs monitorados" - evita calcular a mesma coisa 3 vezes.
    const resumoPorGhe = ghes.map((ghe) => {
        const avaliacao = avaliacaoAtualPorGhe.get(ghe.id_ghe) ?? null;
        const plano = avaliacao ? planosPorId.get(avaliacao.id_plano_amostragem) : null;
        const coletasConcluidas = avaliacao ? (coletasPorAvaliacao.get(avaliacao.id_avaliacao_ghe) || 0) : 0;
        const amostraPlanejada = plano?.amostra_planejada ?? null;
        // Nunca divide por zero/ausente (secao 60) - sem amostra planejada
        // valida, a cobertura fica null (a UI mostra "N/A").
        const coberturaPercentual = (amostraPlanejada && amostraPlanejada > 0)
            ? Math.round((coletasConcluidas / amostraPlanejada) * 1000) / 10
            : null;

        return {
            id_ghe: ghe.id_ghe,
            nome_ghe: ghe.nome,
            nome_setor: ghe.nome_setor,
            universo: ghe.universo,
            amostra_planejada: amostraPlanejada,
            coletas_concluidas: coletasConcluidas,
            cobertura_percentual: coberturaPercentual,
            id_avaliacao_ghe: avaliacao?.id_avaliacao_ghe ?? null,
            status_avaliacao: avaliacao?.status ?? null,
            quantidade_riscos: riscos.filter((risco) => risco.id_ghe === ghe.id_ghe).length,
        };
    });

    const totalTrabalhadoresAbrangidos = ghes.reduce((soma, ghe) => soma + (ghe.universo || 0), 0);
    const algumaMetodologiaDemonstrativa = riscos.some((risco) => risco.metodologia_status_validacao === 'DEMONSTRATIVA');

    return {
        kpis: {
            totalTrabalhadoresAbrangidos,
            totalGhesAtivos: ghes.length,
            totalAvaliacoesGhe: avaliacoes.length,
            totalRiscosIdentificados: riscos.length,
        },
        ghes,
        avaliacoes,
        riscos,
        resumoPorGhe,
        algumaMetodologiaDemonstrativa,
    };
}

// --- Grafico: Riscos GHE por Classificacao (donut/barras) ---------------------
// Mesma regra do bloco individual (agruparRiscosPorClassificacao): cor
// sempre de classificacao_risco_ghe.cor_hex, nunca inventada por posicao
// (secao 18/57).
export function agruparRiscosGhePorClassificacao(riscos) {
    const porCodigo = new Map();
    riscos.forEach((risco) => {
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

// --- Principais riscos GHE (secao 28): prioridade da classificacao,
// desempate por pontuacao - nunca uma prioridade inventada. -------------------
export function listarPrincipaisRiscosGhe(riscos, limite = 5) {
    return [...riscos]
        .sort((a, b) => {
            if (b.classificacao_prioridade !== a.classificacao_prioridade) {
                return b.classificacao_prioridade - a.classificacao_prioridade;
            }
            return b.pontuacao - a.pontuacao;
        })
        .slice(0, limite);
}
