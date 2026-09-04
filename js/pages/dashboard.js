import {
    buscarIndicadoresDashboard,
    agruparRiscosPorClassificacao,
    agruparRiscosPorSetor,
    agruparAvaliacoesPorMes,
    agruparAcoesPorStatus,
    listarRiscosPrioritarios,
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
    [chartClassificacao, chartSetor, chartEvolucao, chartPlano].forEach((instancia) => {
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

botaoAtualizar.addEventListener('click', carregarDashboard);

carregarDashboard();
