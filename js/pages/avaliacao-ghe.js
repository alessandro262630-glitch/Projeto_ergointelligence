import { buscarGhePorId, buscarPlanoAmostragemPorId } from '../services/gheService.js';
import {
    buscarAvaliacaoGhePorId,
    listarProgressoColetas,
    criarOuObterColeta,
    consolidarAvaliacaoGhe,
} from '../services/avaliacaoGheService.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// MVP-07 - Avaliacao do GHE: visao de progresso das coletas de TODOS os
// participantes registrados no plano de amostragem (mesmo os que ainda nao
// iniciaram nenhuma coleta - secao 3/53 do prompt). So interface/eventos -
// toda regra de dominio fica em js/services/avaliacaoGheService.js. NUNCA
// calcula/atribui risco do GHE (MVP-08, fora de escopo aqui).

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

let avaliacaoAtual = null;

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
    areaEstado.textContent = mensagem;
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
    numeroParticipantesRegistrados.textContent = progresso.length;
    numeroColetasConcluidas.textContent = progresso.filter((item) => item.coleta?.status === 'CONCLUIDA').length;

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

carregarPagina();
