import { buscarGhePorId, buscarPlanoAmostragemPorId } from '../services/gheService.js';
import {
    buscarAvaliacaoGhePorId,
    listarProgressoColetas,
    criarOuObterColeta,
    consolidarAvaliacaoGhe,
} from '../services/avaliacaoGheService.js';
import {
    buscarMetodologiaDemoPadrao,
    validarMetodologiaProcessavel,
    processarRiscosGhe,
    listarProcessamentos,
} from '../services/motorRiscoGheService.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// MVP-07 - Avaliacao do GHE: visao de progresso das coletas de TODOS os
// participantes registrados no plano de amostragem (mesmo os que ainda nao
// iniciaram nenhuma coleta - secao 3/53 do prompt). So interface/eventos -
// toda regra de dominio fica em js/services/avaliacaoGheService.js.
//
// MVP-08C - acrescenta o processamento oficial de riscos do GHE
// (exclusivamente com a metodologia demonstrativa ERGO-GHE-DEMO) e o
// historico de processamentos. So interface/eventos aqui tambem - todo o
// calculo/persistencia fica em js/services/motorRiscoGheService.js.

const idAvaliacaoGhe = Number(new URLSearchParams(window.location.search).get('id_avaliacao_ghe')) || null;

const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');
const areaNotificacoes = document.getElementById('area-notificacoes');

const linkVoltarGhe = document.getElementById('link-voltar-ghe');
const textoGheNome = document.getElementById('texto-ghe-nome');
const badgeAvaliacaoStatus = document.getElementById('badge-avaliacao-status');
const textoAvaliacaoData = document.getElementById('texto-avaliacao-data');

const numeroUniverso = document.getElementById('numero-universo');
const numeroAmostraPlanejada = document.getElementById('numero-amostra-planejada');
const numeroParticipantesRegistrados = document.getElementById('numero-participantes-registrados');
const numeroColetasConcluidas = document.getElementById('numero-coletas-concluidas');

const linkVerConsolidacao = document.getElementById('link-ver-consolidacao');
const botaoConsolidarAvaliacao = document.getElementById('botao-consolidar-avaliacao');
const alertaAvaliacaoConsolidada = document.getElementById('alerta-avaliacao-consolidada');

const corpoTabelaProgresso = document.getElementById('corpo-tabela-progresso');

const cardProcessamentoRiscos = document.getElementById('card-processamento-riscos');
const botaoProcessarRiscos = document.getElementById('botao-processar-riscos');
const textoStatusProcessamentoRiscos = document.getElementById('texto-status-processamento-riscos');
const areaHistoricoProcessamentos = document.getElementById('area-historico-processamentos');
const corpoTabelaProcessamentos = document.getElementById('corpo-tabela-processamentos');
const modalConfirmarProcessamentoEl = document.getElementById('modal-confirmar-processamento');
const botaoConfirmarProcessamento = document.getElementById('botao-confirmar-processamento');
const instanciaModalConfirmarProcessamento = new bootstrap.Modal(modalConfirmarProcessamentoEl);

let avaliacaoAtual = null;
let metodologiaDemoAtual = null;

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        areaConteudo.hidden = false;
        return;
    }
    areaConteudo.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    if (tipo === 'carregando') {
        marcarComoCarregando(areaEstado, mensagem);
    } else {
        areaEstado.textContent = mensagem;
    }
}

function mensagemErroAmigavel(error) {
    if (error?.code) {
        return error.message;
    }
    return 'Não foi possível concluir a operação. Tente novamente.';
}

const ROTULOS_STATUS_AVALIACAO_GHE = {
    RASCUNHO: 'Rascunho',
    EM_COLETA: 'Em coleta',
    CONSOLIDADA: 'Consolidada',
    CANCELADA: 'Cancelada',
};
const CLASSE_BADGE_AVALIACAO_GHE = {
    RASCUNHO: 'text-bg-secondary',
    EM_COLETA: 'text-bg-primary',
    CONSOLIDADA: 'text-bg-success',
    CANCELADA: 'text-bg-danger',
};

const ROTULOS_STATUS_COLETA = {
    NAO_INICIADA: 'Não iniciada',
    EM_ANDAMENTO: 'Em andamento',
    CONCLUIDA: 'Concluída',
    CANCELADA: 'Cancelada',
};
const CLASSE_BADGE_COLETA = {
    NAO_INICIADA: 'text-bg-light border text-muted',
    EM_ANDAMENTO: 'text-bg-warning',
    CONCLUIDA: 'text-bg-success',
    CANCELADA: 'text-bg-danger',
};

async function carregarPagina() {
    if (!idAvaliacaoGhe) {
        definirEstado('erro', 'Avaliação do GHE não encontrada.');
        return;
    }
    definirEstado('carregando', 'Carregando avaliação do GHE...');

    try {
        avaliacaoAtual = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);
        const [ghe, plano] = await Promise.all([
            buscarGhePorId(avaliacaoAtual.id_ghe),
            buscarPlanoAmostragemPorId(avaliacaoAtual.id_plano_amostragem),
        ]);

        linkVoltarGhe.href = `ghe-detalhe.html?id_ghe=${ghe.id_ghe}`;
        textoGheNome.textContent = ghe.nome;
        numeroUniverso.textContent = ghe.universo;
        numeroAmostraPlanejada.textContent = plano.amostra_planejada;
        linkVerConsolidacao.href = `consolidacao-ghe.html?id_avaliacao_ghe=${idAvaliacaoGhe}`;

        renderizarStatusAvaliacao();
        await carregarProgresso();
        await carregarProcessamentoRiscos();
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar avaliação do GHE:', error);
        definirEstado('erro', 'Não foi possível carregar a avaliação do GHE.');
    }
}

function renderizarStatusAvaliacao() {
    const rotulo = ROTULOS_STATUS_AVALIACAO_GHE[avaliacaoAtual.status] || avaliacaoAtual.status;
    badgeAvaliacaoStatus.textContent = rotulo;
    badgeAvaliacaoStatus.className = `badge ${CLASSE_BADGE_AVALIACAO_GHE[avaliacaoAtual.status] || 'text-bg-secondary'}`;
    textoAvaliacaoData.textContent = `Iniciada em ${new Date(avaliacaoAtual.data_avaliacao).toLocaleDateString('pt-BR')}`;

    const editavel = ['RASCUNHO', 'EM_COLETA'].includes(avaliacaoAtual.status);
    botaoConsolidarAvaliacao.hidden = !editavel;
    alertaAvaliacaoConsolidada.hidden = editavel;
}

async function carregarProgresso() {
    const progresso = await listarProgressoColetas(idAvaliacaoGhe);
    const coletasConcluidas = progresso.filter((item) => item.coleta?.status === 'CONCLUIDA').length;
    numeroParticipantesRegistrados.textContent = progresso.length;
    numeroColetasConcluidas.textContent = coletasConcluidas;

    // Nunca permite consolidar sem nenhuma coleta concluida (correcao: o
    // service ja bloqueia isso, mas a interface tambem deve deixar isso
    // visivel antes do clique, nao so depois de um erro).
    const editavel = ['RASCUNHO', 'EM_COLETA'].includes(avaliacaoAtual.status);
    botaoConsolidarAvaliacao.disabled = !editavel || coletasConcluidas === 0;
    botaoConsolidarAvaliacao.title = editavel && coletasConcluidas === 0
        ? 'É necessário concluir ao menos uma coleta antes de consolidar.'
        : '';

    corpoTabelaProgresso.innerHTML = '';

    if (progresso.length === 0) {
        const linha = document.createElement('tr');
        const celula = document.createElement('td');
        celula.colSpan = 5;
        celula.className = 'text-center text-muted py-3';
        celula.textContent = 'Nenhum participante registrado no plano de amostragem deste GHE.';
        linha.appendChild(celula);
        corpoTabelaProgresso.appendChild(linha);
        return;
    }

    const avaliacaoEditavel = ['RASCUNHO', 'EM_COLETA'].includes(avaliacaoAtual.status);

    progresso.forEach(({ participante, coleta }) => {
        const linha = document.createElement('tr');

        const celulaNome = document.createElement('td');
        celulaNome.textContent = participante.colaborador_nome || '-';
        const celulaSetor = document.createElement('td');
        celulaSetor.textContent = participante.setor_nome || '-';
        const celulaCargo = document.createElement('td');
        celulaCargo.textContent = participante.cargo_nome || '-';

        const celulaStatus = document.createElement('td');
        const statusColeta = coleta ? coleta.status : 'NAO_INICIADA';
        const badge = document.createElement('span');
        badge.className = `badge ${CLASSE_BADGE_COLETA[statusColeta]}`;
        badge.textContent = ROTULOS_STATUS_COLETA[statusColeta];
        celulaStatus.appendChild(badge);

        const celulaAcao = document.createElement('td');
        const botaoAcao = document.createElement('button');
        botaoAcao.type = 'button';
        botaoAcao.className = 'btn btn-sm btn-outline-primary';

        if (!coleta) {
            botaoAcao.textContent = 'Iniciar coleta';
            botaoAcao.disabled = !avaliacaoEditavel;
            botaoAcao.addEventListener('click', async () => {
                botaoAcao.disabled = true;
                botaoAcao.textContent = 'Iniciando...';
                try {
                    const novaColeta = await criarOuObterColeta(idAvaliacaoGhe, participante.id_amostra_participante);
                    window.location.href = `coleta-ghe.html?id_coleta=${novaColeta.id_coleta}`;
                } catch (error) {
                    console.error('Erro ao iniciar coleta:', error);
                    mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
                    botaoAcao.disabled = false;
                    botaoAcao.textContent = 'Iniciar coleta';
                }
            });
        } else if (statusColeta === 'EM_ANDAMENTO') {
            botaoAcao.textContent = 'Continuar coleta';
            botaoAcao.addEventListener('click', () => {
                window.location.href = `coleta-ghe.html?id_coleta=${coleta.id_coleta}`;
            });
        } else {
            botaoAcao.textContent = 'Ver coleta';
            botaoAcao.classList.replace('btn-outline-primary', 'btn-outline-secondary');
            botaoAcao.addEventListener('click', () => {
                window.location.href = `coleta-ghe.html?id_coleta=${coleta.id_coleta}`;
            });
        }

        celulaAcao.appendChild(botaoAcao);
        linha.append(celulaNome, celulaSetor, celulaCargo, celulaStatus, celulaAcao);
        corpoTabelaProgresso.appendChild(linha);
    });
}

botaoConsolidarAvaliacao.addEventListener('click', async () => {
    const textoOriginal = botaoConsolidarAvaliacao.textContent;
    botaoConsolidarAvaliacao.disabled = true;
    botaoConsolidarAvaliacao.textContent = 'Consolidando...';

    try {
        avaliacaoAtual = await consolidarAvaliacaoGhe(idAvaliacaoGhe);
        mostrarNotificacao('Avaliação do GHE consolidada com sucesso.', 'sucesso');
        renderizarStatusAvaliacao();
        await carregarProgresso();
    } catch (error) {
        console.error('Erro ao consolidar avaliação do GHE:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoConsolidarAvaliacao.disabled = false;
        botaoConsolidarAvaliacao.textContent = textoOriginal;
    }
});

// --- MVP-08C: Processamento de Riscos do GHE ---------------------------------
const ROTULOS_STATUS_PROCESSAMENTO = { PROCESSANDO: 'Processando', CONCLUIDO: 'Concluído', ERRO: 'Erro', CANCELADO: 'Cancelado' };
const CLASSE_BADGE_PROCESSAMENTO = {
    PROCESSANDO: 'text-bg-warning',
    CONCLUIDO: 'text-bg-success',
    ERRO: 'text-bg-danger',
    CANCELADO: 'text-bg-secondary',
};

function formatarDataHoraBR(isoString) {
    return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// So mostra/permite processar quando a Avaliacao do GHE ja esta
// CONSOLIDADA (secao 45 do prompt MVP-08C: o botao vive "na avaliacao
// consolidada"). A metodologia demonstrativa e resolvida pelo codigo
// (nunca um id_metodologia hardcoded no frontend - secao 49) e revalidada
// estruturalmente a cada carga da pagina, nunca assumida como sempre
// disponivel/valida.
async function carregarProcessamentoRiscos() {
    if (avaliacaoAtual.status !== 'CONSOLIDADA') {
        cardProcessamentoRiscos.hidden = true;
        return;
    }
    cardProcessamentoRiscos.hidden = false;
    botaoProcessarRiscos.disabled = true;

    try {
        metodologiaDemoAtual = await buscarMetodologiaDemoPadrao();
        if (!metodologiaDemoAtual) {
            textoStatusProcessamentoRiscos.textContent = 'Nenhuma metodologia demonstrativa está disponível no momento.';
        } else {
            const relatorio = await validarMetodologiaProcessavel(metodologiaDemoAtual.id_metodologia);
            if (relatorio.processavel) {
                botaoProcessarRiscos.disabled = false;
                textoStatusProcessamentoRiscos.textContent =
                    `Metodologia disponível: ${metodologiaDemoAtual.codigo} ${metodologiaDemoAtual.versao} (demonstrativa, não validada para uso profissional).`;
            } else {
                textoStatusProcessamentoRiscos.textContent =
                    'A metodologia demonstrativa não está estruturalmente pronta para processamento no momento.';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar metodologia demonstrativa:', error);
        textoStatusProcessamentoRiscos.textContent = 'Não foi possível verificar a metodologia demonstrativa.';
    }

    await carregarHistoricoProcessamentos();
}

async function carregarHistoricoProcessamentos() {
    const processamentos = await listarProcessamentos(idAvaliacaoGhe);
    corpoTabelaProcessamentos.innerHTML = '';

    if (processamentos.length === 0) {
        areaHistoricoProcessamentos.hidden = true;
        return;
    }
    areaHistoricoProcessamentos.hidden = false;

    // O mais recente CONCLUIDO e rotulado so como "Mais recente" - nunca
    // "Oficial" (secao 44 do prompt MVP-08C), a menos que uma decisao de
    // negocio explicita defina isso no futuro.
    const idMaisRecenteConcluido = processamentos.find((p) => p.status === 'CONCLUIDO')?.id_processamento_risco_ghe;

    processamentos.forEach((p) => {
        const linha = document.createElement('tr');

        const celulaData = document.createElement('td');
        celulaData.textContent = formatarDataHoraBR(p.processado_em);

        const celulaMetodologia = document.createElement('td');
        celulaMetodologia.textContent = `${p.codigo_metodologia || '-'} ${p.versao_metodologia_snapshot}`;

        const celulaCobertura = document.createElement('td');
        celulaCobertura.textContent = `${p.coletas_concluidas_snapshot} de ${p.amostra_planejada_snapshot} (${String(p.percentual_cobertura_snapshot).replace('.', ',')}%)`;

        const celulaStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `badge ${CLASSE_BADGE_PROCESSAMENTO[p.status] || 'text-bg-secondary'}`;
        badge.textContent = ROTULOS_STATUS_PROCESSAMENTO[p.status] || p.status;
        celulaStatus.appendChild(badge);
        if (p.id_processamento_risco_ghe === idMaisRecenteConcluido) {
            const badgeRecente = document.createElement('span');
            badgeRecente.className = 'badge text-bg-light border text-muted ms-1';
            badgeRecente.textContent = 'Mais recente';
            celulaStatus.appendChild(badgeRecente);
        }

        const celulaAcao = document.createElement('td');
        if (p.status === 'CONCLUIDO') {
            const link = document.createElement('a');
            link.href = `resultado-ghe.html?id_processamento=${p.id_processamento_risco_ghe}`;
            link.className = 'btn btn-sm btn-outline-primary';
            link.textContent = 'Ver resultado';
            celulaAcao.appendChild(link);
        }

        linha.append(celulaData, celulaMetodologia, celulaCobertura, celulaStatus, celulaAcao);
        corpoTabelaProcessamentos.appendChild(linha);
    });
}

botaoProcessarRiscos.addEventListener('click', async () => {
    if (!metodologiaDemoAtual) {
        mostrarNotificacao('Nenhuma metodologia demonstrativa está disponível.', 'erro');
        return;
    }

    const textoOriginal = botaoProcessarRiscos.textContent;
    botaoProcessarRiscos.disabled = true;
    botaoProcessarRiscos.textContent = 'Verificando...';

    try {
        const relatorio = await validarMetodologiaProcessavel(metodologiaDemoAtual.id_metodologia);
        if (!relatorio.processavel) {
            mostrarNotificacao('A metodologia demonstrativa não está estruturalmente pronta para processamento.', 'erro');
            return;
        }
        instanciaModalConfirmarProcessamento.show();
    } catch (error) {
        console.error('Erro ao validar metodologia antes do processamento:', error);
        mostrarNotificacao('Não foi possível verificar a metodologia antes de processar.', 'erro');
    } finally {
        botaoProcessarRiscos.disabled = false;
        botaoProcessarRiscos.textContent = textoOriginal;
    }
});

botaoConfirmarProcessamento.addEventListener('click', async () => {
    const textoOriginal = botaoConfirmarProcessamento.textContent;
    botaoConfirmarProcessamento.disabled = true;
    botaoConfirmarProcessamento.textContent = 'Processando...';

    try {
        const resultado = await processarRiscosGhe(idAvaliacaoGhe, metodologiaDemoAtual.id_metodologia);
        instanciaModalConfirmarProcessamento.hide();
        mostrarNotificacao('Processamento demonstrativo concluído com sucesso.', 'sucesso');
        window.location.href = `resultado-ghe.html?id_processamento=${resultado.processamento.id_processamento_risco_ghe}`;
    } catch (error) {
        console.error('Erro ao processar riscos do GHE:', error);
        instanciaModalConfirmarProcessamento.hide();
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
        await carregarHistoricoProcessamentos();
    } finally {
        botaoConfirmarProcessamento.disabled = false;
        botaoConfirmarProcessamento.textContent = textoOriginal;
    }
});

carregarPagina();
