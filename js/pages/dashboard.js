import {
    buscarIndicadoresDashboard,
    agruparRiscosPorClassificacao,
    agruparRiscosPorSetor,
    agruparAvaliacoesPorMes,
    agruparAcoesPorStatus,
    listarRiscosPrioritarios,
    buscarIndicadoresGhe,
    agruparRiscosGhePorClassificacao,
    listarPrincipaisRiscosGhe,
} from '../services/dashboardService.js';

// FEIRA-03 - Dashboard Executivo.
// Responsabilidade: DOM + ECharts. NUNCA consulta o Supabase diretamente
// (isso e do dashboardService.js) e NUNCA executa o Motor de Risco - so
// desenha o que o service ja consolidou a partir de dados persistidos.
//
// Cross-filter: clicar numa fatia do donut (classificacao) ou numa barra
// de setor filtra os demais elementos do bloco de riscos (o outro grafico,
// a tabela "Riscos que Exigem Atencao" e os KPIs de risco), no mesmo
// espirito de um dashboard de BI profissional. Tudo acontece em memoria
// sobre os dados ja carregados - nenhuma nova consulta ao Supabase e feita
// ao filtrar. "Evolucao das Avaliacoes" e "Status do Plano de Acao" ficam
// fora do cross-filter: sao dominios diferentes (avaliacao/acao, nao
// risco) e nao tem o join setor/classificacao ja carregado.

const CODIGOS_CLASSIFICACAO_PRIORITARIA = ['ALTO', 'CRITICO'];

// --- Referencias de DOM ------------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const areaDashboard = document.getElementById('area-dashboard');
const textoAtualizadoEm = document.getElementById('texto-atualizado-em');
const botaoAtualizar = document.getElementById('botao-atualizar');

const kpiAvaliacoes = document.getElementById('kpi-avaliacoes');
const kpiRiscos = document.getElementById('kpi-riscos');
const kpiRiscosFiltroNota = document.getElementById('kpi-riscos-filtro-nota');
const kpiAltoCritico = document.getElementById('kpi-alto-critico');
const kpiAltoCriticoFiltroNota = document.getElementById('kpi-alto-critico-filtro-nota');
const kpiAcoesAbertas = document.getElementById('kpi-acoes-abertas');
const kpiAcoesAtrasadas = document.getElementById('kpi-acoes-atrasadas');

const corpoTabelaPrioritarios = document.getElementById('corpo-tabela-prioritarios');

// --- Referencias de DOM: bloco GHE (DASH-01) -----------------------------------
const areaEstadoGhe = document.getElementById('area-estado-ghe');
const areaDashboardGhe = document.getElementById('area-dashboard-ghe');
const badgeMetodologiaDemonstrativa = document.getElementById('badge-metodologia-demonstrativa');

const kpiGheTrabalhadores = document.getElementById('kpi-ghe-trabalhadores');
const kpiGheTrabalhadoresContexto = document.getElementById('kpi-ghe-trabalhadores-contexto');
const kpiGheTotal = document.getElementById('kpi-ghe-total');
const kpiGheAvaliacoes = document.getElementById('kpi-ghe-avaliacoes');
const kpiGheRiscos = document.getElementById('kpi-ghe-riscos');

const areaGhesMonitorados = document.getElementById('area-ghes-monitorados');
const areaCoberturaConteudo = document.getElementById('area-cobertura-conteudo');
const corpoTabelaCobertura = document.getElementById('corpo-tabela-cobertura');
const corpoTabelaGhePrincipais = document.getElementById('corpo-tabela-ghe-principais');

const areaFiltros = document.getElementById('area-filtros');
const chipFiltroClassificacao = document.getElementById('chip-filtro-classificacao');
const chipFiltroSetor = document.getElementById('chip-filtro-setor');
const botaoLimparFiltroClassificacao = document.getElementById('botao-limpar-filtro-classificacao');
const botaoLimparFiltroSetor = document.getElementById('botao-limpar-filtro-setor');
const botaoLimparFiltros = document.getElementById('botao-limpar-filtros');

// --- Estado de dados e de filtro (cross-filter) -------------------------------
let dadosAtuais = null;
let filtroClassificacao = null; // codigo de classificacao_risco (ex.: "CRITICO") ou null
let filtroSetor = null; // nome do setor ou null

function filtrarRiscos(riscos, { ignorarClassificacao = false, ignorarSetor = false } = {}) {
    return riscos.filter((risco) => {
        const passaClassificacao = ignorarClassificacao || !filtroClassificacao || risco.classificacao_codigo === filtroClassificacao;
        const passaSetor = ignorarSetor || !filtroSetor || risco.nome_setor === filtroSetor;
        return passaClassificacao && passaSetor;
    });
}

// --- Estado geral da pagina (carregando/vazio/erro/pronto) -------------------
function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        areaDashboard.hidden = false;
        return;
    }
    areaDashboard.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    areaEstado.textContent = mensagem;
}

// Estado "sem dados" de um bloco individual (grafico ou lista) - o restante
// do dashboard continua funcionando mesmo que um bloco especifico esteja
// vazio (secao 35: os graficos nao podem quebrar).
function definirEstadoBloco(idEstado, idConteudo, mensagem) {
    const estado = document.getElementById(idEstado);
    const conteudo = document.getElementById(idConteudo);
    if (mensagem) {
        estado.hidden = false;
        estado.textContent = mensagem;
        conteudo.hidden = true;
    } else {
        estado.hidden = true;
        conteudo.hidden = false;
    }
}

function formatarDataHora(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function formatarMes(mesIso) {
    const [ano, mes] = mesIso.split('-').map(Number);
    return `${NOMES_MES[mes - 1]}/${ano}`;
}

// --- Instancias ECharts (uma por grafico - secao 39) --------------------------
// Criadas uma unica vez; atualizacoes seguintes usam setOption() na mesma
// instancia, nunca um novo echarts.init() sobre o mesmo elemento. O
// listener de clique (aoClicar) tambem so e registrado na criacao, para
// nao empilhar handlers duplicados a cada renderizacao.
let chartClassificacao = null;
let chartSetor = null;
let chartEvolucao = null;
let chartPlano = null;
let chartGheClassificacao = null;
let chartGhePorGhe = null;

function obterOuCriarChart(instanciaAtual, idElemento, aoClicar) {
    if (instanciaAtual && !instanciaAtual.isDisposed()) {
        return instanciaAtual;
    }
    const instancia = echarts.init(document.getElementById(idElemento));
    if (aoClicar) {
        instancia.on('click', aoClicar);
    }
    return instancia;
}

// --- KPIs ----------------------------------------------------------------------
// "Avaliacoes realizadas" e "Acoes em acompanhamento" sao globais (dominio
// diferente de risco). "Riscos identificados" e "Alto/Critico" refletem o
// cross-filter ativo, recalculados sobre o subconjunto filtrado.
function preencherKpis(kpisGlobais, riscosFiltrados) {
    kpiAvaliacoes.textContent = kpisGlobais.totalAvaliacoes;
    kpiAcoesAbertas.textContent = kpisGlobais.totalAcoesAbertas;

    if (kpisGlobais.totalAcoesAtrasadas > 0) {
        kpiAcoesAtrasadas.hidden = false;
        kpiAcoesAtrasadas.textContent = `${kpisGlobais.totalAcoesAtrasadas} atrasada(s)`;
    } else {
        kpiAcoesAtrasadas.hidden = true;
    }

    const totalAltoCritico = riscosFiltrados.filter((risco) => CODIGOS_CLASSIFICACAO_PRIORITARIA.includes(risco.classificacao_codigo)).length;
    kpiRiscos.textContent = riscosFiltrados.length;
    kpiAltoCritico.textContent = totalAltoCritico;

    const algumFiltro = Boolean(filtroClassificacao || filtroSetor);
    kpiRiscosFiltroNota.hidden = !algumFiltro;
    kpiAltoCriticoFiltroNota.hidden = !algumFiltro;
}

// --- Chips de filtro ativo (cross-filter) --------------------------------------
function renderizarChipsFiltro() {
    const algumFiltro = Boolean(filtroClassificacao || filtroSetor);
    areaFiltros.hidden = !algumFiltro;

    if (filtroClassificacao && dadosAtuais) {
        const item = agruparRiscosPorClassificacao(dadosAtuais.riscosIdentificados)
            .find((classificacao) => classificacao.codigo === filtroClassificacao);
        chipFiltroClassificacao.hidden = false;
        chipFiltroClassificacao.querySelector('[data-chip-texto]').textContent = `Classificação: ${item ? item.nome : filtroClassificacao}`;
    } else {
        chipFiltroClassificacao.hidden = true;
    }

    chipFiltroSetor.hidden = !filtroSetor;
    if (filtroSetor) {
        chipFiltroSetor.querySelector('[data-chip-texto]').textContent = `Setor: ${filtroSetor}`;
    }
}

// --- Grafico 1: Riscos por Classificacao (donut) ------------------------------
function aoClicarClassificacao(parametro) {
    if (parametro.componentType !== 'series' || !parametro.data) return;
    const codigo = parametro.data.codigo;
    if (!codigo) return;
    filtroClassificacao = (filtroClassificacao === codigo) ? null : codigo;
    renderizarBlocoRiscos();
}

function renderizarGraficoClassificacao(dados, mensagemVazio) {
    if (dados.length === 0) {
        definirEstadoBloco('area-estado-classificacao', 'grafico-classificacao', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-classificacao', 'grafico-classificacao', null);

    const total = dados.reduce((soma, item) => soma + item.quantidade, 0);
    chartClassificacao = obterOuCriarChart(chartClassificacao, 'grafico-classificacao', aoClicarClassificacao);
    chartClassificacao.setOption({
        tooltip: {
            trigger: 'item',
            formatter: (parametro) => `${parametro.name}<br/>${parametro.value} riscos (${parametro.percent}%)`,
        },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
            type: 'pie',
            radius: ['55%', '75%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            label: {
                show: true,
                position: 'center',
                formatter: `{a|${total}}\n{b|riscos}`,
                rich: {
                    a: { fontSize: 22, fontWeight: 700, color: '#10263B' },
                    b: { fontSize: 11, color: '#6c757d' },
                },
            },
            emphasis: { label: { show: true } },
            data: dados.map((item) => ({
                name: item.nome,
                value: item.quantidade,
                codigo: item.codigo,
                // Cor vem de classificacao_risco.cor_hex (secao 17) - nunca
                // hardcodada por nivel de severidade. Fatias fora do filtro
                // de classificacao ativo ficam esmaecidas (selecao visual).
                itemStyle: {
                    color: item.cor || '#6c757d',
                    opacity: (!filtroClassificacao || filtroClassificacao === item.codigo) ? 1 : 0.35,
                },
            })),
        }],
    });
}

// --- Grafico 2: Riscos por Setor (barra horizontal) ----------------------------
function aoClicarSetor(parametro) {
    if (parametro.componentType !== 'series' || !parametro.name) return;
    filtroSetor = (filtroSetor === parametro.name) ? null : parametro.name;
    renderizarBlocoRiscos();
}

function renderizarGraficoSetor(dados, mensagemVazio) {
    if (dados.length === 0) {
        definirEstadoBloco('area-estado-setor', 'grafico-setor', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-setor', 'grafico-setor', null);

    const ordenadoParaExibicao = [...dados].reverse(); // maior valor no topo da barra horizontal
    chartSetor = obterOuCriarChart(chartSetor, 'grafico-setor', aoClicarSetor);
    chartSetor.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: ordenadoParaExibicao.map((item) => item.setor) },
        series: [{
            type: 'bar',
            data: ordenadoParaExibicao.map((item) => ({
                value: item.quantidade,
                itemStyle: {
                    color: '#0EA394',
                    borderRadius: [0, 4, 4, 0],
                    // Barra fora do filtro de setor ativo fica esmaecida
                    // (mesma logica de selecao visual do donut).
                    opacity: (!filtroSetor || filtroSetor === item.setor) ? 1 : 0.35,
                },
            })),
            label: { show: true, position: 'right' },
            barMaxWidth: 28,
        }],
    });
}

// --- Grafico 3: Evolucao das Avaliacoes (linha) --------------------------------
function renderizarGraficoEvolucao(dados) {
    if (dados.length === 0) {
        definirEstadoBloco('area-estado-evolucao', 'grafico-evolucao', 'Não há avaliações finalizadas suficientes para exibir evolução.');
        return;
    }
    definirEstadoBloco('area-estado-evolucao', 'grafico-evolucao', null);

    chartEvolucao = obterOuCriarChart(chartEvolucao, 'grafico-evolucao');
    chartEvolucao.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: dados.map((item) => formatarMes(item.mes)) },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
            type: 'line',
            data: dados.map((item) => item.quantidade),
            smooth: true,
            symbolSize: 8,
            itemStyle: { color: '#0EA394' },
            areaStyle: { color: 'rgba(14, 163, 148, 0.12)' },
        }],
    });
}

// --- Grafico 4: Status do Plano de Acao (barra) --------------------------------
const ROTULOS_STATUS_ACAO = {
    ABERTA: 'Aberta',
    EM_ANDAMENTO: 'Em andamento',
    BLOQUEADA: 'Bloqueada',
    CONCLUIDA: 'Concluída',
    CANCELADA: 'Cancelada',
};
const CORES_STATUS_ACAO = {
    ABERTA: '#64748B',
    EM_ANDAMENTO: '#0EA394',
    BLOQUEADA: '#DC2626',
    CONCLUIDA: '#16A34A',
    CANCELADA: '#94A3B8',
};

function renderizarGraficoPlano(dados) {
    if (dados.length === 0) {
        definirEstadoBloco('area-estado-plano', 'grafico-plano', 'Não há ações de plano de ação cadastradas.');
        return;
    }
    definirEstadoBloco('area-estado-plano', 'grafico-plano', null);

    chartPlano = obterOuCriarChart(chartPlano, 'grafico-plano');
    chartPlano.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        // top:34 (em vez de 16) da espaco pro rotulo acima da barra mais
        // alta; sem isso ele fica colado/cortado na borda do card quando a
        // barra chega perto do topo do grid.
        grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: dados.map((item) => ROTULOS_STATUS_ACAO[item.status] || item.status) },
        // +1 de folga no maximo do eixo, para a barra mais alta nao
        // encostar exatamente no topo do grid.
        yAxis: { type: 'value', minInterval: 1, max: (valor) => valor.max + 1 },
        series: [{
            type: 'bar',
            data: dados.map((item) => ({
                value: item.quantidade,
                itemStyle: { color: CORES_STATUS_ACAO[item.status] || '#64748B' },
            })),
            barMaxWidth: 48,
            label: { show: true, position: 'top' },
        }],
    });
}

// --- Riscos que exigem atencao (HTML puro, sem ECharts - secao 25) ------------
function criarBadgeClassificacao(risco) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    // Mesmo padrao de resultado.js: cor sempre de cor_hex, nome sempre
    // visivel (nunca depende so de cor - secao 42).
    badge.style.backgroundColor = risco.classificacao_cor || '#6c757d';
    badge.style.color = '#fff';
    badge.textContent = risco.classificacao_nome;
    return badge;
}

function renderizarRiscosPrioritarios(lista, mensagemVazio) {
    if (lista.length === 0) {
        definirEstadoBloco('area-estado-prioritarios', 'area-tabela-prioritarios', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-prioritarios', 'area-tabela-prioritarios', null);

    corpoTabelaPrioritarios.innerHTML = '';
    lista.forEach((risco) => {
        const linha = document.createElement('tr');

        const celulaSetor = document.createElement('td');
        celulaSetor.textContent = risco.nome_setor;

        const celulaRisco = document.createElement('td');
        celulaRisco.textContent = risco.nome_risco;

        const celulaClassificacao = document.createElement('td');
        celulaClassificacao.appendChild(criarBadgeClassificacao(risco));

        const celulaPontuacao = document.createElement('td');
        celulaPontuacao.className = 'text-end fw-semibold';
        celulaPontuacao.textContent = risco.pontuacao;

        linha.append(celulaSetor, celulaRisco, celulaClassificacao, celulaPontuacao);
        corpoTabelaPrioritarios.appendChild(linha);
    });
}

// --- Renderizacao do bloco de riscos (afetado pelo cross-filter) --------------
// Chamada tanto na carga inicial quanto a cada clique de filtro. Nao refaz
// nenhuma consulta ao Supabase - so reagrupa o array ja carregado em
// dadosAtuais.riscosIdentificados de acordo com filtroClassificacao/filtroSetor.
function renderizarBlocoRiscos() {
    if (!dadosAtuais) return;

    const algumFiltro = Boolean(filtroClassificacao || filtroSetor);
    const mensagemSemRiscos = algumFiltro
        ? 'Nenhum risco encontrado para o filtro selecionado.'
        : 'Nenhum risco identificado até o momento.';

    // Cada grafico ignora o proprio filtro (ele mostra a selecao esmaecida,
    // nao reduzida a uma unica fatia/barra) e aplica o filtro do outro eixo.
    const riscosParaClassificacao = filtrarRiscos(dadosAtuais.riscosIdentificados, { ignorarClassificacao: true });
    const riscosParaSetor = filtrarRiscos(dadosAtuais.riscosIdentificados, { ignorarSetor: true });
    const riscosCombinados = filtrarRiscos(dadosAtuais.riscosIdentificados);

    preencherKpis(dadosAtuais.kpis, riscosCombinados);
    renderizarGraficoClassificacao(agruparRiscosPorClassificacao(riscosParaClassificacao), mensagemSemRiscos);
    renderizarGraficoSetor(agruparRiscosPorSetor(riscosParaSetor), mensagemSemRiscos);
    renderizarRiscosPrioritarios(listarRiscosPrioritarios(riscosCombinados, 5), mensagemSemRiscos);
    renderizarChipsFiltro();
}

botaoLimparFiltroClassificacao.addEventListener('click', () => {
    filtroClassificacao = null;
    renderizarBlocoRiscos();
});
botaoLimparFiltroSetor.addEventListener('click', () => {
    filtroSetor = null;
    renderizarBlocoRiscos();
});
botaoLimparFiltros.addEventListener('click', () => {
    filtroClassificacao = null;
    filtroSetor = null;
    renderizarBlocoRiscos();
});

// =====================================================================
// DASH-01 - Bloco GHE + Motor de Risco
// =====================================================================
// Dominio independente do bloco de Avaliacao Individual acima - carrega e
// falha de forma isolada (secao 42: um erro aqui nunca derruba o resto da
// pagina) porque le tabelas completamente diferentes
// (ghe/avaliacao_ghe/avaliacao_ghe_risco, nunca avaliacao_ergonomica).

function formatarPercentual(valor) {
    if (valor === null || valor === undefined) return 'N/A';
    return `${Number(valor).toFixed(1).replace(/\.0$/, '')}%`;
}

function criarBadgeClassificacaoGhe(risco) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.backgroundColor = risco.classificacao_cor || '#6c757d';
    badge.style.color = '#fff';
    badge.textContent = risco.classificacao_nome;
    return badge;
}

// --- Grafico: Riscos GHE por Classificacao (donut) -----------------------------
function renderizarGraficoGheClassificacao(dados, mensagemVazio) {
    if (dados.length === 0) {
        definirEstadoBloco('area-estado-ghe-classificacao', 'grafico-ghe-classificacao', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-ghe-classificacao', 'grafico-ghe-classificacao', null);

    const total = dados.reduce((soma, item) => soma + item.quantidade, 0);
    chartGheClassificacao = obterOuCriarChart(chartGheClassificacao, 'grafico-ghe-classificacao');
    chartGheClassificacao.setOption({
        tooltip: {
            trigger: 'item',
            formatter: (parametro) => `${parametro.name}<br/>${parametro.value} riscos (${parametro.percent}%)`,
        },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
            type: 'pie',
            radius: ['55%', '75%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            label: {
                show: true,
                position: 'center',
                formatter: `{a|${total}}\n{b|riscos}`,
                rich: {
                    a: { fontSize: 22, fontWeight: 700, color: '#10263B' },
                    b: { fontSize: 11, color: '#6c757d' },
                },
            },
            emphasis: { label: { show: true } },
            // Cor sempre de classificacao_risco_ghe.cor_hex (secao 18) -
            // nunca inferida por posicao/indice.
            data: dados.map((item) => ({ name: item.nome, value: item.quantidade, itemStyle: { color: item.cor || '#6c757d' } })),
        }],
    });
}

// --- Grafico: Riscos por GHE (barras) -------------------------------------------
// Tooltip mostra nome do GHE, universo, quantidade de riscos e a avaliacao
// utilizada (secao 21), guardados por item via o proprio array resumoPorGhe.
function renderizarGraficoGhePorGhe(resumoPorGhe, mensagemVazio) {
    const comRiscos = [...resumoPorGhe].sort((a, b) => b.quantidade_riscos - a.quantidade_riscos);
    if (comRiscos.length === 0) {
        definirEstadoBloco('area-estado-ghe-por-ghe', 'grafico-ghe-por-ghe', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-ghe-por-ghe', 'grafico-ghe-por-ghe', null);

    const ordenadoParaExibicao = [...comRiscos].reverse(); // maior valor no topo da barra horizontal
    chartGhePorGhe = obterOuCriarChart(chartGhePorGhe, 'grafico-ghe-por-ghe');
    chartGhePorGhe.setOption({
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (parametros) => {
                const item = ordenadoParaExibicao[parametros[0].dataIndex];
                const avaliacaoTexto = item.id_avaliacao_ghe ? `Avaliação #${item.id_avaliacao_ghe}` : 'Sem avaliação registrada';
                return `<strong>${item.nome_ghe}</strong><br/>Universo: ${item.universo}<br/>Riscos: ${item.quantidade_riscos}<br/>${avaliacaoTexto}`;
            },
        },
        grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: ordenadoParaExibicao.map((item) => item.nome_ghe) },
        series: [{
            type: 'bar',
            data: ordenadoParaExibicao.map((item) => ({ value: item.quantidade_riscos, itemStyle: { color: '#0EA394', borderRadius: [0, 4, 4, 0] } })),
            label: { show: true, position: 'right' },
            barMaxWidth: 28,
        }],
    });
}

// --- Cobertura das Avaliacoes GHE (cards + tabela, secao 22-27/33) --------------
function renderizarGhesMonitorados(resumoPorGhe) {
    areaGhesMonitorados.innerHTML = '';
    resumoPorGhe.forEach((item) => {
        const coluna = document.createElement('div');
        coluna.className = 'col-6 col-md-3';
        coluna.innerHTML = `
            <div class="ghe-resumo-card">
                <div class="ghe-resumo-card__cabecalho">
                    <span class="ghe-resumo-card__icone"><i class="bi bi-diagram-3" aria-hidden="true"></i></span>
                    <div class="ghe-resumo-card__titulo">
                        <div class="ghe-resumo-card__nome" title="${item.nome_ghe}">${item.nome_ghe}</div>
                        <span class="ghe-resumo-card__selo">${formatarPercentual(item.cobertura_percentual)} cobertura</span>
                    </div>
                </div>
                <div class="ghe-resumo-card__grade">
                    <div class="ghe-resumo-card__stat">
                        <span class="ghe-resumo-card__stat-valor">${item.universo}</span>
                        <span class="ghe-resumo-card__stat-rotulo">Trabalhadores</span>
                    </div>
                    <div class="ghe-resumo-card__stat">
                        <span class="ghe-resumo-card__stat-valor">${item.amostra_planejada ?? '—'}</span>
                        <span class="ghe-resumo-card__stat-rotulo">Planejado</span>
                    </div>
                    <div class="ghe-resumo-card__stat">
                        <span class="ghe-resumo-card__stat-valor">${item.coletas_concluidas}</span>
                        <span class="ghe-resumo-card__stat-rotulo">Coletas</span>
                    </div>
                    <div class="ghe-resumo-card__stat">
                        <span class="ghe-resumo-card__stat-valor">${item.quantidade_riscos}</span>
                        <span class="ghe-resumo-card__stat-rotulo">Riscos</span>
                    </div>
                </div>
            </div>
        `;
        areaGhesMonitorados.appendChild(coluna);
    });
}

function renderizarTabelaCobertura(resumoPorGhe) {
    corpoTabelaCobertura.innerHTML = '';
    resumoPorGhe.forEach((item) => {
        const linha = document.createElement('tr');

        const celulaGhe = document.createElement('td');
        celulaGhe.textContent = item.nome_ghe;

        const celulaUniverso = document.createElement('td');
        celulaUniverso.className = 'text-end';
        celulaUniverso.textContent = item.universo;

        const celulaAmostra = document.createElement('td');
        celulaAmostra.className = 'text-end';
        celulaAmostra.textContent = item.amostra_planejada ?? '—';

        const celulaColetas = document.createElement('td');
        celulaColetas.className = 'text-end';
        celulaColetas.textContent = item.coletas_concluidas;

        // Cobertura DESCRITIVA (secao 24) - nunca chamada de
        // "representatividade estatística" na interface. Barra representa
        // so quantidade coletada, sem cor de "bom/ruim" (secao 27).
        const celulaCobertura = document.createElement('td');
        const percentual = item.cobertura_percentual;
        celulaCobertura.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <div class="cobertura-barra flex-grow-1">
                    <div class="cobertura-barra__preenchimento" style="width: ${percentual === null ? 0 : Math.min(percentual, 100)}%;"></div>
                </div>
                <span class="small fw-semibold" style="min-width: 2.5rem;">${formatarPercentual(percentual)}</span>
            </div>
        `;

        linha.append(celulaGhe, celulaUniverso, celulaAmostra, celulaColetas, celulaCobertura);
        corpoTabelaCobertura.appendChild(linha);
    });
}

function renderizarCoberturaGhe(resumoPorGhe) {
    if (resumoPorGhe.length === 0) {
        definirEstadoBloco('area-estado-cobertura', 'area-cobertura-conteudo', 'Nenhum GHE ativo para exibir cobertura.');
        return;
    }
    definirEstadoBloco('area-estado-cobertura', 'area-cobertura-conteudo', null);
    renderizarGhesMonitorados(resumoPorGhe);
    renderizarTabelaCobertura(resumoPorGhe);
}

// --- Principais Riscos Identificados (secao 28-32) ------------------------------
function renderizarPrincipaisRiscosGhe(lista, mensagemVazio) {
    if (lista.length === 0) {
        definirEstadoBloco('area-estado-ghe-principais', 'area-tabela-ghe-principais', mensagemVazio);
        return;
    }
    definirEstadoBloco('area-estado-ghe-principais', 'area-tabela-ghe-principais', null);

    corpoTabelaGhePrincipais.innerHTML = '';
    lista.forEach((risco) => {
        const linha = document.createElement('tr');

        const celulaRisco = document.createElement('td');
        celulaRisco.textContent = risco.nome_risco;

        const celulaGhe = document.createElement('td');
        celulaGhe.textContent = risco.nome_ghe;

        const celulaPontuacao = document.createElement('td');
        celulaPontuacao.className = 'text-end fw-semibold';
        celulaPontuacao.textContent = risco.pontuacao;

        const celulaClassificacao = document.createElement('td');
        celulaClassificacao.appendChild(criarBadgeClassificacaoGhe(risco));

        const celulaMetodologia = document.createElement('td');
        celulaMetodologia.className = 'small text-muted';
        celulaMetodologia.textContent = `${risco.metodologia_codigo || '-'} v${risco.metodologia_versao || '-'}`;

        const celulaProcessado = document.createElement('td');
        celulaProcessado.className = 'small text-muted';
        celulaProcessado.textContent = risco.processado_em ? new Date(risco.processado_em).toLocaleDateString('pt-BR') : '-';

        // Nunca reprocessa (secao 31): abre resultado-ghe.html no
        // processamento ja persistido, so leitura.
        const celulaAcao = document.createElement('td');
        const link = document.createElement('a');
        link.className = 'btn btn-sm btn-outline-primary';
        link.href = `resultado-ghe.html?id_processamento=${risco.id_processamento_risco_ghe}`;
        link.textContent = 'Ver Resultado';
        celulaAcao.appendChild(link);

        linha.append(celulaRisco, celulaGhe, celulaPontuacao, celulaClassificacao, celulaMetodologia, celulaProcessado, celulaAcao);
        corpoTabelaGhePrincipais.appendChild(linha);
    });
}

// --- Carga do bloco GHE ----------------------------------------------------------
async function carregarDashboardGhe() {
    areaEstadoGhe.hidden = true;
    areaDashboardGhe.hidden = false;
    areaEstadoGhe.textContent = 'Carregando indicadores do GHE...';
    areaEstadoGhe.hidden = false;
    areaDashboardGhe.hidden = true;

    try {
        const dados = await buscarIndicadoresGhe();

        if (dados.kpis.totalAvaliacoesGhe === 0) {
            areaDashboardGhe.hidden = true;
            areaEstadoGhe.hidden = false;
            areaEstadoGhe.classList.remove('text-danger');
            areaEstadoGhe.textContent = 'Nenhuma avaliação GHE disponível.';
            return;
        }

        areaEstadoGhe.hidden = true;
        areaDashboardGhe.hidden = false;

        kpiGheTrabalhadores.textContent = dados.kpis.totalTrabalhadoresAbrangidos;
        kpiGheTrabalhadoresContexto.textContent = `Distribuídos em ${dados.kpis.totalGhesAtivos} GHE${dados.kpis.totalGhesAtivos === 1 ? '' : 's'}`;
        kpiGheTotal.textContent = dados.kpis.totalGhesAtivos;
        kpiGheAvaliacoes.textContent = dados.kpis.totalAvaliacoesGhe;
        kpiGheRiscos.textContent = dados.kpis.totalRiscosIdentificados;

        badgeMetodologiaDemonstrativa.hidden = !dados.algumaMetodologiaDemonstrativa;

        const mensagemSemRiscos = 'Nenhum resultado de risco processado ainda.';
        renderizarGraficoGheClassificacao(agruparRiscosGhePorClassificacao(dados.riscos), mensagemSemRiscos);
        renderizarGraficoGhePorGhe(dados.resumoPorGhe, mensagemSemRiscos);
        renderizarCoberturaGhe(dados.resumoPorGhe);
        renderizarPrincipaisRiscosGhe(listarPrincipaisRiscosGhe(dados.riscos, 5), mensagemSemRiscos);
    } catch (error) {
        console.error('Erro ao carregar indicadores do GHE:', error);
        areaDashboardGhe.hidden = true;
        areaEstadoGhe.hidden = false;
        areaEstadoGhe.classList.add('text-danger');
        areaEstadoGhe.textContent = 'Não foi possível carregar os indicadores do GHE.';
    }
}

// --- Carga principal -----------------------------------------------------------
async function carregarDashboard() {
    definirEstado('carregando', 'Carregando indicadores...');
    botaoAtualizar.disabled = true;

    try {
        const dados = await buscarIndicadoresDashboard();

        if (dados.avaliacoes.length === 0) {
            dadosAtuais = null;
            definirEstado('vazio', 'Não há dados de avaliação disponíveis.');
            return;
        }

        // Filtros sao preservados entre atualizacoes manuais (o usuario
        // continua analisando o mesmo recorte com numeros atualizados);
        // "Atualizar dados" nao reseta a selecao.
        dadosAtuais = dados;
        renderizarBlocoRiscos();
        renderizarGraficoEvolucao(agruparAvaliacoesPorMes(dados.avaliacoes));
        renderizarGraficoPlano(agruparAcoesPorStatus(dados.acoes));

        textoAtualizadoEm.textContent = `Atualizado em: ${formatarDataHora(new Date())}`;
        definirEstado('pronto');
        // area-dashboard estava "hidden" (display:none) quando os graficos
        // foram inicializados acima, entao o ECharts mediu largura 0 para
        // os containers e caiu no fallback de 100px. So depois de exibir a
        // area e que os containers tem o tamanho real - forcar um resize().
        redimensionarGraficos();
    } catch (error) {
        console.error('Erro ao carregar indicadores do dashboard:', error);
        definirEstado('erro', 'Não foi possível carregar os indicadores.');
    } finally {
        botaoAtualizar.disabled = false;
    }
}

// --- Resize responsivo dos graficos (secao 37) ---------------------------------
function redimensionarGraficos() {
    [chartClassificacao, chartSetor, chartEvolucao, chartPlano, chartGheClassificacao, chartGhePorGhe].forEach((instancia) => {
        if (instancia && !instancia.isDisposed()) {
            instancia.resize();
        }
    });
}

window.addEventListener('resize', redimensionarGraficos);

// A sidebar (offcanvas Bootstrap) tambem muda a largura da area de
// conteudo ao abrir/fechar em telas menores - redimensiona os graficos
// no mesmo momento para nao ficarem cortados.
document.getElementById('sidebar')?.addEventListener('shown.bs.offcanvas', () => window.dispatchEvent(new Event('resize')));
document.getElementById('sidebar')?.addEventListener('hidden.bs.offcanvas', () => window.dispatchEvent(new Event('resize')));

// Popover do selo "Resultados demonstrativos" (secao 19) - mesmo padrao ja
// usado nas demais paginas do app (trigger "focus", inicializado uma unica
// vez por elemento).
document.querySelectorAll('[data-bs-toggle="popover"]').forEach((elemento) => new bootstrap.Popover(elemento));

botaoAtualizar.addEventListener('click', () => {
    carregarDashboard();
    carregarDashboardGhe();
});

carregarDashboard();
carregarDashboardGhe();
