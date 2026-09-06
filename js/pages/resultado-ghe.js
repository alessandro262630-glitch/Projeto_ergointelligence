import { buscarGhePorId, buscarPlanoAmostragemPorId } from '../services/gheService.js';
import { buscarAvaliacaoGhePorId } from '../services/avaliacaoGheService.js';
import {
    buscarProcessamento,
    listarResultadosGhe,
    buscarRastreabilidadeResultado,
} from '../services/motorRiscoGheService.js';
import { formatarCategoria } from '../utils/formatadores.js';

// MVP-08C - Resultado de Risco do GHE (exclusivamente metodologia
// demonstrativa). So interface/eventos - todo o calculo/persistencia ja
// aconteceu no processamento (js/services/motorRiscoGheService.js); esta
// pagina so LE o que foi persistido, nunca recalcula nada (secao 59 do
// prompt: refresh nao recalcula).
//
// Nunca exibe um "score geral"/"classificação geral" do GHE (secao 42) -
// o resultado e sempre apresentado POR RISCO.

const idProcessamento = Number(new URLSearchParams(window.location.search).get('id_processamento')) || null;

const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');

const linkVoltarAvaliacao = document.getElementById('link-voltar-avaliacao');
const alertaAmostraIncompleta = document.getElementById('alerta-amostra-incompleta');

const textoGheNome = document.getElementById('texto-ghe-nome');
const textoSetor = document.getElementById('texto-setor');
const textoUniverso = document.getElementById('texto-universo');
const textoAmostraPlanejada = document.getElementById('texto-amostra-planejada');
const textoColetasConcluidas = document.getElementById('texto-coletas-concluidas');
const textoCobertura = document.getElementById('texto-cobertura');
const textoMetodologia = document.getElementById('texto-metodologia');
const textoVersao = document.getElementById('texto-versao');
const textoDataProcessamento = document.getElementById('texto-data-processamento');

const areaCardsRiscos = document.getElementById('area-cards-riscos');

const modalEntendaPorQueEl = document.getElementById('modal-entenda-por-que');
const corpoModalEntendaPorQue = document.getElementById('corpo-modal-entenda-por-que');
const instanciaModalEntendaPorQue = new bootstrap.Modal(modalEntendaPorQueEl);

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

function formatarNumero(valor, casas = 1) {
    if (valor === null || valor === undefined) return '-';
    return Number(valor).toFixed(casas).replace('.', ',');
}

async function carregarPagina() {
    if (!idProcessamento) {
        definirEstado('erro', 'Processamento não encontrado.');
        return;
    }
    definirEstado('carregando', 'Carregando resultado...');

    try {
        const processamento = await buscarProcessamento(idProcessamento);
        const [avaliacaoGhe, resultados] = await Promise.all([
            buscarAvaliacaoGhePorId(processamento.id_avaliacao_ghe),
            listarResultadosGhe(idProcessamento),
        ]);
        const [ghe, plano] = await Promise.all([
            buscarGhePorId(avaliacaoGhe.id_ghe),
            buscarPlanoAmostragemPorId(avaliacaoGhe.id_plano_amostragem),
        ]);

        linkVoltarAvaliacao.href = `avaliacao-ghe.html?id_avaliacao_ghe=${avaliacaoGhe.id_avaliacao_ghe}`;

        textoGheNome.textContent = ghe.nome;
        textoSetor.textContent = ghe.setor || 'Não especificado';
        textoUniverso.textContent = ghe.universo;
        textoAmostraPlanejada.textContent = processamento.amostra_planejada_snapshot;
        textoColetasConcluidas.textContent = processamento.coletas_concluidas_snapshot;
        textoCobertura.textContent = `${formatarNumero(processamento.percentual_cobertura_snapshot)}%`;
        textoMetodologia.textContent = 'ERGO-GHE-DEMO';
        textoVersao.textContent = processamento.versao_metodologia_snapshot;
        textoDataProcessamento.textContent = new Date(processamento.processado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

        if (processamento.coletas_concluidas_snapshot < processamento.amostra_planejada_snapshot) {
            alertaAmostraIncompleta.hidden = false;
            alertaAmostraIncompleta.textContent =
                'A quantidade de coletas concluídas está abaixo da amostra planejada. O resultado abaixo é exclusivamente demonstrativo — não representa representatividade estatística.';
        } else {
            alertaAmostraIncompleta.hidden = true;
        }

        renderizarCardsRiscos(resultados);
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar resultado do GHE:', error);
        definirEstado('erro', 'Não foi possível carregar o resultado.');
    }
}

function renderizarCardsRiscos(resultados) {
    areaCardsRiscos.innerHTML = '';

    if (resultados.length === 0) {
        areaCardsRiscos.innerHTML = '<p class="text-muted text-center py-4">Nenhum risco foi processado nesta execução.</p>';
        return;
    }

    resultados.forEach((resultado) => {
        const coluna = document.createElement('div');
        coluna.className = 'col-md-6 col-lg-4';

        const card = document.createElement('div');
        card.className = 'card h-100';
        const corpo = document.createElement('div');
        corpo.className = 'card-body d-flex flex-column';

        const cabecalho = document.createElement('div');
        cabecalho.className = 'd-flex justify-content-between align-items-start mb-2';
        const nome = document.createElement('h3');
        nome.className = 'fs-6 fw-semibold mb-0';
        nome.textContent = resultado.nome_risco;
        const badgeDemo = document.createElement('span');
        badgeDemo.className = 'badge text-bg-light border text-muted';
        badgeDemo.textContent = 'DEMONSTRATIVO';
        cabecalho.append(nome, badgeDemo);

        const classificacaoBadge = document.createElement('span');
        const corHex = resultado.classificacao?.cor_hex;
        classificacaoBadge.className = 'badge mb-2 align-self-start';
        classificacaoBadge.style.backgroundColor = corHex || '#6c757d';
        classificacaoBadge.style.color = '#fff';
        classificacaoBadge.textContent = resultado.classificacao?.nome || '-';

        const pontuacao = document.createElement('p');
        pontuacao.className = 'text-muted small mb-3';
        pontuacao.textContent = `Pontuação: ${formatarNumero(resultado.pontuacao, 2)}`;

        const botaoEntenda = document.createElement('button');
        botaoEntenda.type = 'button';
        botaoEntenda.className = 'btn btn-outline-primary btn-sm mt-auto';
        botaoEntenda.textContent = 'Entenda por quê';
        botaoEntenda.addEventListener('click', () => abrirEntendaPorQue(resultado));

        corpo.append(cabecalho, classificacaoBadge, pontuacao, botaoEntenda);
        card.appendChild(corpo);
        coluna.appendChild(card);
        areaCardsRiscos.appendChild(coluna);
    });
}

function formatarValorMetrica(condicao) {
    if (condicao.valor_metrica_calculado === null || condicao.valor_metrica_calculado === undefined) {
        return 'sem evidência suficiente';
    }
    const ehPercentual = condicao.tipo_metrica.startsWith('PERCENTUAL');
    return ehPercentual ? `${formatarNumero(condicao.valor_metrica_calculado)}%` : formatarNumero(condicao.valor_metrica_calculado, 2);
}

function formatarOperador(operador) {
    return operador === 'GTE' ? '≥' : '=';
}

async function abrirEntendaPorQue(resultado) {
    corpoModalEntendaPorQue.innerHTML = '<p class="text-muted text-center py-4">Carregando rastreabilidade...</p>';
    instanciaModalEntendaPorQue.show();

    try {
        const regrasAvaliadas = await buscarRastreabilidadeResultado(resultado.id_avaliacao_ghe_risco);
        corpoModalEntendaPorQue.innerHTML = '';

        const resumo = document.createElement('div');
        resumo.className = 'mb-3 pb-3 border-bottom';
        resumo.innerHTML = `
            <p class="mb-1"><strong>Risco:</strong> ${resultado.nome_risco}</p>
            <p class="mb-1"><strong>Classificação:</strong> ${resultado.classificacao?.nome || '-'} — <span class="text-muted small">DEMONSTRATIVO</span></p>
            <p class="mb-0"><strong>Pontuação:</strong> ${formatarNumero(resultado.pontuacao, 2)}</p>
        `;
        corpoModalEntendaPorQue.appendChild(resumo);

        if (regrasAvaliadas.length === 0) {
            const aviso = document.createElement('p');
            aviso.className = 'text-muted';
            aviso.textContent = 'Nenhuma regra registrada para este resultado.';
            corpoModalEntendaPorQue.appendChild(aviso);
            return;
        }

        regrasAvaliadas.forEach((regra) => {
            const bloco = document.createElement('div');
            bloco.className = 'mb-3 p-3 border rounded';

            const cabecalhoRegra = document.createElement('div');
            cabecalhoRegra.className = 'd-flex justify-content-between align-items-center mb-2';
            const codigoRegra = document.createElement('span');
            codigoRegra.className = 'fw-semibold';
            codigoRegra.textContent = `${regra.codigo} — ${regra.nome || ''}`;
            const badgeSatisfeita = document.createElement('span');
            badgeSatisfeita.className = `badge ${regra.satisfeita ? 'text-bg-success' : 'text-bg-secondary'}`;
            badgeSatisfeita.textContent = regra.satisfeita ? `Satisfeita (+${formatarNumero(regra.pontuacao_aplicada, 2)})` : 'Não satisfeita (+0)';
            cabecalhoRegra.append(codigoRegra, badgeSatisfeita);
            bloco.appendChild(cabecalhoRegra);

            const agregador = document.createElement('p');
            agregador.className = 'text-muted small mb-2';
            agregador.textContent = `Agregação: ${regra.operador_agregacao} (${regra.operador_agregacao === 'AND' ? 'todas as condições devem ser verdadeiras' : 'ao menos uma condição deve ser verdadeira'})`;
            bloco.appendChild(agregador);

            const listaCondicoes = document.createElement('ul');
            listaCondicoes.className = 'list-unstyled mb-0 small';
            regra.condicoes.forEach((condicao) => {
                const item = document.createElement('li');
                item.className = 'mb-2 pb-2 border-bottom';
                const opcaoTexto = condicao.opcao_rotulo ? ` (opção "${condicao.opcao_rotulo}")` : '';
                const parametroTexto = condicao.parametro_metrica_utilizado !== null && condicao.parametro_metrica_utilizado !== undefined
                    ? ` | Parâmetro usado para calcular: ${formatarNumero(condicao.parametro_metrica_utilizado, 2)}`
                    : '';
                item.innerHTML = `
                    <div><strong>Pergunta:</strong> ${condicao.pergunta_texto || `#${condicao.id_pergunta}`}</div>
                    <div><strong>Categoria:</strong> ${formatarCategoria(condicao.pergunta_categoria || '')}</div>
                    <div><strong>Métrica:</strong> ${condicao.tipo_metrica}${opcaoTexto}${parametroTexto}</div>
                    <div><strong>Resultado da métrica:</strong> ${formatarValorMetrica(condicao)} <span class="text-muted">(base: ${condicao.base_calculo})</span></div>
                    <div><strong>Condição:</strong> valor ${formatarOperador(condicao.operador_utilizado)} ${formatarNumero(condicao.valor_comparacao_utilizado, 2)}${condicao.tipo_metrica.startsWith('PERCENTUAL') ? '%' : ''}</div>
                    <div><strong>Resultado da condição:</strong> <span class="badge ${condicao.resultado ? 'text-bg-success' : 'text-bg-secondary'}">${condicao.resultado ? 'Atendida' : 'Não atendida'}</span></div>
                `;
                listaCondicoes.appendChild(item);
            });
            bloco.appendChild(listaCondicoes);

            corpoModalEntendaPorQue.appendChild(bloco);
        });
    } catch (error) {
        console.error('Erro ao carregar rastreabilidade:', error);
        corpoModalEntendaPorQue.innerHTML = '<p class="text-danger text-center py-4">Não foi possível carregar a rastreabilidade deste resultado.</p>';
    }
}

carregarPagina();
