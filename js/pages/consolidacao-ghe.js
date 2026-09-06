import { gerarConsolidacaoDaAvaliacao } from '../services/consolidacaoGheService.js';
import { formatarCategoria } from '../utils/formatadores.js';

// MVP-07 - Consolidacao descritiva da Avaliacao do GHE: so leitura, so
// interface/eventos - toda a matematica descritiva fica em
// js/services/consolidacaoGheService.js. NUNCA exibe uma classificacao de
// risco do GHE (isso e o MVP-08, ainda nao implementado) - o aviso fixo no
// topo da pagina existe exatamente para deixar isso explicito ao usuario.

const idAvaliacaoGhe = Number(new URLSearchParams(window.location.search).get('id_avaliacao_ghe')) || null;

const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');
const linkVoltarAvaliacao = document.getElementById('link-voltar-avaliacao');

const alertaAmostraIncompleta = document.getElementById('alerta-amostra-incompleta');
const textoGheNome = document.getElementById('texto-ghe-nome');
const numeroUniverso = document.getElementById('numero-universo');
const numeroAmostraPlanejada = document.getElementById('numero-amostra-planejada');
const numeroParticipantes = document.getElementById('numero-participantes');
const numeroColetasConcluidas = document.getElementById('numero-coletas-concluidas');
const textoCobertura = document.getElementById('texto-cobertura');

const areaSemColetas = document.getElementById('area-sem-coletas');
const areaPerguntas = document.getElementById('area-perguntas');

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

function formatarPercentual(valor) {
    return `${String(valor).replace('.', ',')}%`;
}

function criarBarraDistribuicao(rotulo, quantidade, percentual) {
    const linha = document.createElement('div');
    linha.className = 'mb-2';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'd-flex justify-content-between small mb-1';
    const spanRotulo = document.createElement('span');
    spanRotulo.textContent = rotulo;
    const spanValor = document.createElement('span');
    spanValor.className = 'text-muted';
    spanValor.textContent = `${quantidade} (${formatarPercentual(percentual)})`;
    cabecalho.append(spanRotulo, spanValor);

    const barraFundo = document.createElement('div');
    barraFundo.className = 'progress';
    barraFundo.style.height = '8px';
    const barra = document.createElement('div');
    barra.className = 'progress-bar';
    barra.style.width = `${Math.min(percentual, 100)}%`;
    barraFundo.appendChild(barra);

    linha.append(cabecalho, barraFundo);
    return linha;
}

function renderizarCorpoBooleano(pergunta) {
    const corpo = document.createElement('div');
    if (pergunta.total_respondidas === 0) {
        corpo.innerHTML = '<p class="text-muted small mb-0">Nenhuma coleta concluída respondeu esta pergunta.</p>';
        return corpo;
    }
    corpo.appendChild(criarBarraDistribuicao('Sim', pergunta.sim.quantidade, pergunta.sim.percentual));
    corpo.appendChild(criarBarraDistribuicao('Não', pergunta.nao.quantidade, pergunta.nao.percentual));
    return corpo;
}

function renderizarCorpoNumerico(pergunta, unidade) {
    const corpo = document.createElement('div');
    if (pergunta.total_respondidas === 0) {
        corpo.innerHTML = '<p class="text-muted small mb-0">Nenhuma coleta concluída respondeu esta pergunta.</p>';
        return corpo;
    }
    const sufixo = unidade ? ` ${unidade}` : '';
    corpo.innerHTML = `
        <div class="row g-2 small">
            <div class="col-4"><span class="text-muted">Mínimo</span><br><strong>${pergunta.minimo}${sufixo}</strong></div>
            <div class="col-4"><span class="text-muted">Máximo</span><br><strong>${pergunta.maximo}${sufixo}</strong></div>
            <div class="col-4"><span class="text-muted">Média</span><br><strong>${pergunta.media}${sufixo}</strong></div>
        </div>
        <p class="text-muted small mt-2 mb-0">${pergunta.total_respondidas} coleta(s) responderam esta pergunta.</p>
    `;
    return corpo;
}

function renderizarCorpoOpcaoUnica(pergunta) {
    const corpo = document.createElement('div');
    if (pergunta.total_respondidas === 0) {
        corpo.innerHTML = '<p class="text-muted small mb-0">Nenhuma coleta concluída respondeu esta pergunta.</p>';
        return corpo;
    }
    pergunta.distribuicao.forEach((item) => {
        corpo.appendChild(criarBarraDistribuicao(item.rotulo, item.quantidade, item.percentual));
    });
    if (pergunta.media_descritiva !== null && pergunta.media_descritiva !== undefined) {
        const media = document.createElement('p');
        media.className = 'text-muted small mt-2 mb-0';
        media.textContent = `Média descritiva (não classificatória): ${pergunta.media_descritiva}`;
        corpo.appendChild(media);
    }
    return corpo;
}

function renderizarCorpoMultipla(pergunta) {
    const corpo = document.createElement('div');
    if (pergunta.total_respondidas === 0) {
        corpo.innerHTML = '<p class="text-muted small mb-0">Nenhuma coleta concluída respondeu esta pergunta.</p>';
        return corpo;
    }
    pergunta.distribuicao.forEach((item) => {
        corpo.appendChild(criarBarraDistribuicao(item.rotulo, item.quantidade, item.percentual));
    });
    const aviso = document.createElement('p');
    aviso.className = 'text-muted small mt-2 mb-0';
    aviso.textContent = 'Pergunta de múltipla escolha: a soma dos percentuais pode ultrapassar 100%.';
    corpo.appendChild(aviso);
    return corpo;
}

function renderizarCorpoTexto(pergunta) {
    const corpo = document.createElement('div');
    if (pergunta.total_respondidas === 0) {
        corpo.innerHTML = '<p class="text-muted small mb-0">Nenhuma coleta concluída respondeu esta pergunta.</p>';
        return corpo;
    }
    const contagem = document.createElement('p');
    contagem.className = 'small text-muted mb-2';
    contagem.textContent = `${pergunta.total_respondidas} resposta(s) registrada(s):`;
    corpo.appendChild(contagem);

    const lista = document.createElement('ul');
    lista.className = 'small mb-0';
    pergunta.respostas.forEach((texto) => {
        const item = document.createElement('li');
        item.textContent = texto;
        lista.appendChild(item);
    });
    corpo.appendChild(lista);
    return corpo;
}

function renderizarCorpoPergunta(pergunta) {
    switch (pergunta.tipo_resposta) {
        case 'BOOLEANO':
            return renderizarCorpoBooleano(pergunta);
        case 'NUMERICO':
            return renderizarCorpoNumerico(pergunta, pergunta.unidade);
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return renderizarCorpoOpcaoUnica(pergunta);
        case 'ESCOLHA_MULTIPLA':
            return renderizarCorpoMultipla(pergunta);
        case 'TEXTO':
            return renderizarCorpoTexto(pergunta);
        default: {
            const corpo = document.createElement('div');
            corpo.textContent = 'Tipo de pergunta não suportado.';
            return corpo;
        }
    }
}

function agruparPorCategoria(perguntas) {
    const mapa = new Map();
    perguntas.forEach((pergunta) => {
        const lista = mapa.get(pergunta.categoria) || [];
        lista.push(pergunta);
        mapa.set(pergunta.categoria, lista);
    });
    return mapa;
}

function renderizarPerguntas(consolidacao) {
    areaPerguntas.innerHTML = '';

    const totalRespondidas = consolidacao.perguntas.reduce((acc, p) => acc + p.total_respondidas, 0);
    if (totalRespondidas === 0) {
        areaSemColetas.hidden = false;
        return;
    }
    areaSemColetas.hidden = true;

    const perguntasPorCategoria = agruparPorCategoria(consolidacao.perguntas);

    perguntasPorCategoria.forEach((perguntas, categoria) => {
        const secao = document.createElement('div');
        secao.className = 'mb-4';

        const titulo = document.createElement('h2');
        titulo.className = 'fs-6 fw-semibold mb-3';
        titulo.textContent = formatarCategoria(categoria);
        secao.appendChild(titulo);

        perguntas.forEach((pergunta) => {
            const card = document.createElement('div');
            card.className = 'card mb-2';
            const corpoCard = document.createElement('div');
            corpoCard.className = 'card-body';

            const legenda = document.createElement('p');
            legenda.className = 'fw-semibold mb-2';
            legenda.textContent = pergunta.texto_pergunta;
            corpoCard.appendChild(legenda);
            corpoCard.appendChild(renderizarCorpoPergunta(pergunta));

            card.appendChild(corpoCard);
            secao.appendChild(card);
        });

        areaPerguntas.appendChild(secao);
    });
}

async function carregarPagina() {
    if (!idAvaliacaoGhe) {
        definirEstado('erro', 'Avaliação do GHE não encontrada.');
        return;
    }
    definirEstado('carregando', 'Carregando consolidação...');
    linkVoltarAvaliacao.href = `avaliacao-ghe.html?id_avaliacao_ghe=${idAvaliacaoGhe}`;

    try {
        const consolidacao = await gerarConsolidacaoDaAvaliacao(idAvaliacaoGhe);

        textoGheNome.textContent = consolidacao.ghe.nome;
        numeroUniverso.textContent = consolidacao.universo;
        numeroAmostraPlanejada.textContent = consolidacao.amostra_planejada;
        numeroParticipantes.textContent = consolidacao.participantes_registrados;
        numeroColetasConcluidas.textContent = consolidacao.coletas_concluidas;
        textoCobertura.textContent =
            `Cobertura descritiva: ${consolidacao.coletas_concluidas} de ${consolidacao.amostra_planejada} coleta(s) planejada(s) concluída(s) `
            + `(${formatarPercentual(consolidacao.cobertura_percentual)}). Percentual descritivo — não representa validade estatística garantida.`;

        if (!consolidacao.amostra_atingida) {
            alertaAmostraIncompleta.hidden = false;
            alertaAmostraIncompleta.textContent =
                'A amostra planejada ainda não foi totalmente coletada. Os resultados abaixo refletem apenas as coletas concluídas até o momento.';
        } else {
            alertaAmostraIncompleta.hidden = true;
        }

        renderizarPerguntas(consolidacao);
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar consolidação da avaliação do GHE:', error);
        definirEstado('erro', 'Não foi possível carregar a consolidação.');
    }
}

// --- Popovers de ajuda ("Saiba mais") -------------------------------------------
document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => new bootstrap.Popover(el));

carregarPagina();
