import { buscarAvaliacaoPorId } from '../services/avaliacaoService.js';
import {
    listarResultadosRiscoDaAvaliacao,
    listarRastreabilidadeDoResultado,
    buscarClassificacaoPorId,
    processarOuObterResultadoRisco,
} from '../services/riscoService.js';
import { processarOuObterRecomendacoes } from '../services/recomendacaoService.js';
import { buscarPlanoPorAvaliacao } from '../services/planoAcaoService.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// INT-RSK-01 - Versao funcional minima da pagina de resultado.
// So LE o que o Motor de Risco ja calculou/persistiu (avaliacao_ergonomica,
// avaliacao_risco, avaliacao_risco_regra) - nunca recalcula regra alguma
// aqui. "Calcular resultado" e "Entenda por quê" delegam para
// js/services/riscoService.js.
// REC-01/REC-02 - Depois de renderizar os riscos, carrega as recomendacoes
// (js/services/recomendacaoService.js) e as agrupa dentro do card de cada
// risco. Falha ao carregar recomendacoes NUNCA invalida o resultado do
// motor ja exibido (secao 36) - e um estado de erro independente, com sua
// propria retentativa. Sem LLM.

// --- Identificacao da avaliacao, sempre via URL ------------------------------
const parametrosUrl = new URLSearchParams(window.location.search);
const idAvaliacao = Number(parametrosUrl.get('id_avaliacao')) || null;

// --- Referencias de DOM ------------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const areaResultado = document.getElementById('area-resultado');
const botaoCalcularResultado = document.getElementById('botao-calcular-resultado');

const textoClassificacaoGeral = document.getElementById('texto-classificacao-geral');
const textoPontuacaoTotal = document.getElementById('texto-pontuacao-total');
const textoVersaoMotor = document.getElementById('texto-versao-motor');
const textoDataFinalizacao = document.getElementById('texto-data-finalizacao');
const listaRiscos = document.getElementById('lista-riscos');
const textoSemRecomendacoes = document.getElementById('texto-sem-recomendacoes');
const areaErroRecomendacoes = document.getElementById('area-erro-recomendacoes');
const textoErroRecomendacoes = document.getElementById('texto-erro-recomendacoes');
const botaoTentarRecomendacoes = document.getElementById('botao-tentar-recomendacoes');
const textoStatusPlanoAcao = document.getElementById('texto-status-plano-acao');
const botaoPlanoAcao = document.getElementById('botao-plano-acao');

let avaliacaoAtual = null;
// Preenchido a cada render de riscos, para a etapa de recomendacoes (que
// carrega depois, de forma independente) saber em qual card injetar cada
// grupo - ver preencherRecomendacoes.
const containerRecomendacoesPorRisco = new Map();

// --- Estados de carregamento / vazio / erro / pronto -------------------------
function definirEstado(tipo, mensagem, opcoes = {}) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        botaoCalcularResultado.hidden = true;
        areaResultado.hidden = false;
        return;
    }

    areaResultado.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    if (tipo === 'carregando') {
        marcarComoCarregando(areaEstado, mensagem);
    } else {
        areaEstado.textContent = mensagem;
    }
    botaoCalcularResultado.hidden = !opcoes.mostrarBotaoCalcular;
}

function mensagemErroResultado(error) {
    if (error?.code === 'VERSAO_MOTOR_INCONSISTENTE') {
        return 'Foi encontrada uma inconsistência no resultado da avaliação.';
    }
    return 'Não foi possível carregar o resultado.';
}

// Data/hora no fuso do navegador - o motor grava TIMESTAMPTZ, entao a
// exibicao natural para o usuario e a hora local, nao UTC bruto.
function formatarDataHora(iso) {
    if (!iso) {
        return '-';
    }
    const data = new Date(iso);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

// --- Carga inicial ------------------------------------------------------------
async function carregarPagina() {
    if (!idAvaliacao) {
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    definirEstado('carregando', 'Carregando resultado...');

    try {
        avaliacaoAtual = await buscarAvaliacaoPorId(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    if (avaliacaoAtual.status === 'CANCELADA') {
        definirEstado('erro', 'Esta avaliação foi cancelada e não possui resultado.');
        return;
    }

    // Nunca aciona o motor para uma avaliacao ainda editavel (secao 38) -
    // resultado.html so LE; quem finaliza e questionario.js (AVA-05).
    if (avaliacaoAtual.status !== 'FINALIZADA') {
        definirEstado('sem-resultado', 'Finalize a avaliação antes de calcular o resultado.');
        return;
    }

    await carregarResultados();
}

async function carregarResultados() {
    definirEstado('carregando', 'Carregando resultado...');
    try {
        const resultados = await listarResultadosRiscoDaAvaliacao(idAvaliacao);

        if (resultados.length === 0) {
            definirEstado(
                'sem-resultado',
                'O resultado desta avaliação ainda não foi calculado.',
                { mostrarBotaoCalcular: true },
            );
            return;
        }

        await renderizarResultado(resultados);
        definirEstado('pronto');

        // Recomendacoes carregam depois, de forma independente: uma falha
        // aqui nunca desfaz ou esconde o resultado do motor ja exibido
        // acima (secao 36 do prompt REC-01/REC-02).
        await carregarRecomendacoes();

        // Idem para o acesso ao Plano de Acao (FEIRA-04, secao 14-16): so
        // LEITURA (buscarPlanoPorAvaliacao nunca cria nada), e uma falha
        // aqui tambem nunca invalida o resultado ja exibido.
        await carregarAreaPlanoAcao();
    } catch (error) {
        console.error('Erro ao carregar resultado da avaliação:', error);
        definirEstado('erro', mensagemErroResultado(error));
    }
}

// --- Cabecalho + lista de riscos ---------------------------------------------
function criarBadgeClassificacao(classificacao) {
    const badge = document.createElement('span');
    badge.className = 'badge';

    if (!classificacao || !classificacao.nome) {
        badge.classList.add('text-bg-secondary');
        badge.textContent = 'Sem classificação';
        return badge;
    }

    // Cor vem de classificacao_risco.cor_hex (secao 27) - nunca hardcoded;
    // o NOME (Baixo/Moderado/Alto/Critico) sempre acompanha a cor, para nao
    // depender so de cor (secao 40).
    badge.style.backgroundColor = classificacao.cor_hex || '#6c757d';
    badge.style.color = '#fff';
    badge.textContent = classificacao.nome;
    return badge;
}

async function renderizarResultado(resultados) {
    textoPontuacaoTotal.textContent = avaliacaoAtual.pontuacao_total ?? '-';
    textoVersaoMotor.textContent = avaliacaoAtual.versao_motor_regras || '-';
    textoDataFinalizacao.textContent = formatarDataHora(avaliacaoAtual.data_finalizacao);

    textoClassificacaoGeral.innerHTML = '';
    if (avaliacaoAtual.id_classificacao_geral) {
        try {
            const classificacaoGeral = await buscarClassificacaoPorId(avaliacaoAtual.id_classificacao_geral);
            textoClassificacaoGeral.appendChild(criarBadgeClassificacao(classificacaoGeral));
        } catch (error) {
            console.error('Erro ao carregar classificação geral:', error);
            textoClassificacaoGeral.textContent = '-';
        }
    } else {
        textoClassificacaoGeral.textContent = '-';
    }

    listaRiscos.innerHTML = '';
    containerRecomendacoesPorRisco.clear();
    resultados.forEach((risco) => {
        listaRiscos.appendChild(criarCardRisco(risco));
    });
}

function criarCardRisco(risco) {
    const card = document.createElement('div');
    card.className = 'card card-risco shadow-sm mb-4';
    // Faixa lateral na mesma cor da classificacao (secao 40 - cor nunca
    // sozinha, o nome do badge continua exibido) - so estetico, nao
    // recalcula nem reinterpreta a classificacao.
    if (risco.classificacao?.cor_hex) {
        card.style.borderLeftColor = risco.classificacao.cor_hex;
    }

    const corpo = document.createElement('div');
    corpo.className = 'card-body p-4';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'd-flex justify-content-between align-items-start flex-wrap gap-2 mb-2';

    const infoNome = document.createElement('div');
    const titulo = document.createElement('h3');
    titulo.className = 'fs-6 fw-semibold mb-1';
    titulo.textContent = risco.nome_risco;
    infoNome.append(titulo, criarBadgeClassificacao(risco.classificacao));

    const infoPontuacao = document.createElement('div');
    infoPontuacao.className = 'text-end';
    const rotuloPontuacao = document.createElement('div');
    rotuloPontuacao.className = 'small text-uppercase text-muted';
    rotuloPontuacao.textContent = 'Pontuação';
    const valorPontuacao = document.createElement('div');
    valorPontuacao.className = 'fw-semibold fs-5';
    valorPontuacao.textContent = risco.pontuacao;
    infoPontuacao.append(rotuloPontuacao, valorPontuacao);

    cabecalho.append(infoNome, infoPontuacao);

    const justificativa = document.createElement('p');
    justificativa.className = 'text-muted small mb-2';
    justificativa.textContent = risco.justificativa;

    const idArea = `rastreabilidade-${risco.id_avaliacao_risco}`;

    const botaoExpandir = document.createElement('button');
    botaoExpandir.type = 'button';
    botaoExpandir.className = 'btn btn-sm btn-outline-secondary';
    botaoExpandir.textContent = 'Entenda por quê';
    botaoExpandir.setAttribute('aria-expanded', 'false');
    botaoExpandir.setAttribute('aria-controls', idArea);

    const areaRastreabilidade = document.createElement('div');
    areaRastreabilidade.className = 'mt-3';
    areaRastreabilidade.id = idArea;
    areaRastreabilidade.hidden = true;

    let carregado = false;
    botaoExpandir.addEventListener('click', async () => {
        const expandido = botaoExpandir.getAttribute('aria-expanded') === 'true';
        if (expandido) {
            botaoExpandir.setAttribute('aria-expanded', 'false');
            areaRastreabilidade.hidden = true;
            return;
        }

        botaoExpandir.setAttribute('aria-expanded', 'true');
        areaRastreabilidade.hidden = false;

        if (carregado) {
            return;
        }
        carregado = true;
        areaRastreabilidade.textContent = 'Carregando...';

        try {
            // So LE avaliacao_risco_regra - nenhum calculo novo (secao 29/11).
            const regras = await listarRastreabilidadeDoResultado(risco.id_avaliacao_risco);
            areaRastreabilidade.innerHTML = '';
            areaRastreabilidade.appendChild(criarListaRegras(regras));
        } catch (error) {
            console.error('Erro ao carregar rastreabilidade do risco:', error);
            areaRastreabilidade.textContent = 'Não foi possível carregar os detalhes deste risco.';
        }
    });

    // Preenchido depois, quando carregarRecomendacoes() resolver (secao 31:
    // recomendacoes agrupadas dentro do card do risco correspondente).
    // Comeca oculto - so aparece se este risco realmente tiver alguma.
    const areaRecomendacoesRisco = document.createElement('div');
    areaRecomendacoesRisco.className = 'mt-3 pt-3 border-top';
    areaRecomendacoesRisco.hidden = true;
    containerRecomendacoesPorRisco.set(risco.id_avaliacao_risco, areaRecomendacoesRisco);

    corpo.append(cabecalho, justificativa, botaoExpandir, areaRastreabilidade, areaRecomendacoesRisco);
    card.appendChild(corpo);
    return card;
}

// Regras satisfeitas E nao satisfeitas aparecem (secao 30) - a rastreabilidade
// so tem valor se mostrar tambem o que NAO pontuou.
function criarListaRegras(regras) {
    const lista = document.createElement('div');
    lista.className = 'list-group';

    regras.forEach((regra) => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-start gap-2';

        const info = document.createElement('div');
        const linhaTitulo = document.createElement('div');
        linhaTitulo.className = 'fw-semibold small';
        const marca = regra.satisfeita ? '✓' : '✕';
        linhaTitulo.textContent = `${marca} ${regra.codigo || ''} — ${regra.nome || ''}`;
        const detalhe = document.createElement('div');
        detalhe.className = 'text-muted small';
        detalhe.textContent = regra.detalhe || '';
        info.append(linhaTitulo, detalhe);

        const pontuacao = document.createElement('span');
        pontuacao.className = `badge ${regra.satisfeita ? 'text-bg-success' : 'text-bg-secondary'}`;
        pontuacao.textContent = `+${regra.pontuacao_aplicada}`;

        item.append(info, pontuacao);
        lista.appendChild(item);
    });

    return lista;
}

// --- Recomendacoes (REC-01/REC-02) --------------------------------------------
// Rotulos amigaveis apenas para exibicao (secao 5/6) - os valores oficiais
// persistidos (tipo/prioridade/status) nunca sao alterados.
const ROTULOS_TIPO_RECOMENDACAO = {
    PAUSA: 'Pausa',
    POSTURA: 'Postura',
    MOBILIARIO: 'Mobiliário',
    ORGANIZACAO: 'Organização',
    AMBIENTE: 'Ambiente',
    MOVIMENTO: 'Movimento',
    ORIENTACAO: 'Orientação',
};
const ROTULOS_PRIORIDADE_RECOMENDACAO = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const ROTULOS_STATUS_RECOMENDACAO = { SUGERIDA: 'Sugerida', ACEITA: 'Aceita', REJEITADA: 'Rejeitada', CONCLUIDA: 'Concluída' };

function formatarRotulo(mapa, valor) {
    return mapa[valor] || valor;
}

function criarItemRecomendacao(recomendacao) {
    const item = document.createElement('div');
    item.className = 'list-group-item';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'd-flex justify-content-between align-items-start flex-wrap gap-2';

    const titulo = document.createElement('div');
    titulo.className = 'fw-semibold small';
    titulo.textContent = recomendacao.titulo;

    const badges = document.createElement('div');
    badges.className = 'd-flex flex-wrap gap-1';

    const badgePrioridade = document.createElement('span');
    badgePrioridade.className = 'badge text-bg-light border text-dark';
    badgePrioridade.textContent = `Prioridade: ${formatarRotulo(ROTULOS_PRIORIDADE_RECOMENDACAO, recomendacao.prioridade)}`;

    const badgeTipo = document.createElement('span');
    badgeTipo.className = 'badge text-bg-light border text-dark';
    badgeTipo.textContent = formatarRotulo(ROTULOS_TIPO_RECOMENDACAO, recomendacao.tipo);

    const badgeStatus = document.createElement('span');
    badgeStatus.className = 'badge text-bg-info';
    badgeStatus.textContent = formatarRotulo(ROTULOS_STATUS_RECOMENDACAO, recomendacao.status);

    badges.append(badgePrioridade, badgeTipo, badgeStatus);
    cabecalho.append(titulo, badges);
    item.appendChild(cabecalho);

    if (recomendacao.descricao) {
        const descricao = document.createElement('p');
        descricao.className = 'text-muted small mb-1 mt-2';
        descricao.textContent = recomendacao.descricao;
        item.appendChild(descricao);
    }

    // requer_validacao=true nao impede a exibicao como SUGERIDA (secao 17) -
    // e so um aviso de que ainda nao e uma orientacao formalmente validada.
    if (recomendacao.requer_validacao) {
        const avisoValidacao = document.createElement('span');
        avisoValidacao.className = 'badge text-bg-warning text-dark me-1';
        avisoValidacao.textContent = 'Requer validação profissional';
        item.appendChild(avisoValidacao);
    }

    if (recomendacao.fonte_tecnica) {
        const fonte = document.createElement('p');
        fonte.className = 'text-muted small mb-0 mt-2';
        fonte.textContent = `Fonte / referência: ${recomendacao.fonte_tecnica}`;
        item.appendChild(fonte);
    }

    return item;
}

function criarBlocoRecomendacoes(recomendacoesDoRisco) {
    const bloco = document.createElement('div');

    const titulo = document.createElement('h4');
    titulo.className = 'fs-6 fw-semibold mb-2';
    titulo.textContent = 'Recomendações';
    bloco.appendChild(titulo);

    const lista = document.createElement('div');
    lista.className = 'list-group';
    recomendacoesDoRisco.forEach((recomendacao) => {
        lista.appendChild(criarItemRecomendacao(recomendacao));
    });
    bloco.appendChild(lista);

    return bloco;
}

// Distribui os snapshots (id_avaliacao_recomendacao) recebidos para dentro
// do card do risco correspondente (secao 31/32) - nunca cria um card de
// risco novo nem duplica visualmente o relacionamento historico.
function preencherRecomendacoes(recomendacoes) {
    const agrupadas = new Map();
    recomendacoes.forEach((recomendacao) => {
        const lista = agrupadas.get(recomendacao.id_avaliacao_risco) || [];
        lista.push(recomendacao);
        agrupadas.set(recomendacao.id_avaliacao_risco, lista);
    });

    agrupadas.forEach((lista, idAvaliacaoRisco) => {
        const container = containerRecomendacoesPorRisco.get(idAvaliacaoRisco);
        if (!container) {
            return;
        }
        container.innerHTML = '';
        container.appendChild(criarBlocoRecomendacoes(lista));
        container.hidden = false;
    });
}

// Carrega (gerando se necessario, reaproveitando se ja existir - nunca
// recalculando o motor) as recomendacoes da avaliacao. Falha aqui e um
// estado de erro proprio, separado do resultado do motor ja exibido acima
// (secao 36) - por isso nunca chama definirEstado('erro', ...).
async function carregarRecomendacoes() {
    areaErroRecomendacoes.hidden = true;
    textoSemRecomendacoes.hidden = true;

    try {
        const resultado = await processarOuObterRecomendacoes(idAvaliacao);
        if (resultado.recomendacoes.length === 0) {
            textoSemRecomendacoes.hidden = false;
            return;
        }
        preencherRecomendacoes(resultado.recomendacoes);
    } catch (error) {
        console.error('Erro ao carregar recomendações da avaliação:', error);
        textoErroRecomendacoes.textContent =
            'O resultado foi calculado, mas não foi possível carregar as recomendações.';
        areaErroRecomendacoes.hidden = false;
    }
}

// --- Acesso ao Plano de Acao (FEIRA-04, secao 14-16) --------------------------
// So LE (buscarPlanoPorAvaliacao nunca cria plano automaticamente so por
// abrir esta pagina - secao 15). O rotulo do botao muda conforme ja existir
// ou nao um plano; o destino e sempre o mesmo, plano-acao.html?id_avaliacao=X
// (secao 14), que trata os dois estados.
async function carregarAreaPlanoAcao() {
    botaoPlanoAcao.href = `plano-acao.html?id_avaliacao=${idAvaliacao}`;
    try {
        const plano = await buscarPlanoPorAvaliacao(idAvaliacao);
        if (plano) {
            textoStatusPlanoAcao.textContent = 'Esta avaliação já possui um plano de ação.';
            botaoPlanoAcao.textContent = 'Ver Plano de Ação';
        } else {
            textoStatusPlanoAcao.textContent = 'Esta avaliação ainda não possui um plano de ação.';
            botaoPlanoAcao.textContent = 'Criar Plano de Ação';
        }
        botaoPlanoAcao.hidden = false;
    } catch (error) {
        console.error('Erro ao verificar plano de ação da avaliação:', error);
        textoStatusPlanoAcao.textContent = 'Não foi possível verificar o plano de ação.';
    }
}

botaoTentarRecomendacoes.addEventListener('click', async () => {
    const textoOriginal = botaoTentarRecomendacoes.textContent;
    botaoTentarRecomendacoes.disabled = true;
    botaoTentarRecomendacoes.textContent = 'Tentando novamente...';
    try {
        await carregarRecomendacoes();
    } finally {
        botaoTentarRecomendacoes.disabled = false;
        botaoTentarRecomendacoes.textContent = textoOriginal;
    }
});

// --- Botao "Calcular resultado" (tambem serve como mecanismo de recuperacao
// - secao 37): usa a mesma porta de entrada idempotente do fluxo normal,
// nunca forca um recalculo de quem ja tem resultado. --------------------------
botaoCalcularResultado.addEventListener('click', async () => {
    const textoOriginal = botaoCalcularResultado.textContent;
    botaoCalcularResultado.disabled = true;
    botaoCalcularResultado.textContent = 'Calculando...';
    definirEstado('carregando', 'Calculando resultado...');

    try {
        await processarOuObterResultadoRisco(idAvaliacao);
        avaliacaoAtual = await buscarAvaliacaoPorId(idAvaliacao);
        await carregarResultados();
    } catch (error) {
        console.error('Erro ao calcular resultado:', error);
        definirEstado('erro', mensagemErroResultado(error));
    } finally {
        botaoCalcularResultado.disabled = false;
        botaoCalcularResultado.textContent = textoOriginal;
    }
});

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
