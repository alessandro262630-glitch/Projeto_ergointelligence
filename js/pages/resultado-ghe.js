import { buscarGhePorId, buscarPlanoAmostragemPorId } from '../services/gheService.js';
import { buscarAvaliacaoGhePorId } from '../services/avaliacaoGheService.js';
import {
    buscarProcessamento,
    listarResultadosGhe,
    buscarRastreabilidadeResultado,
} from '../services/motorRiscoGheService.js';
import {
    listarInventariosRascunhoDaEmpresa,
    listarResultadosProcessamento,
    prepararImportacaoResultado,
    importarResultadosGhe,
} from '../services/inventarioIntegracaoService.js';
import { formatarCategoria } from '../utils/formatadores.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

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

const areaNotificacoes = document.getElementById('area-notificacoes');
const botaoAdicionarInventario = document.getElementById('botao-adicionar-inventario');

// --- Modal "Adicionar ao Inventario" (MVP-09C) ------------------------------
const modalImportarEl = document.getElementById('modal-importar-inventario');
const instanciaModalImportar = new bootstrap.Modal(modalImportarEl);
const passoInventario = document.getElementById('passo-inventario');
const passoRiscos = document.getElementById('passo-riscos');
const passoPreview = document.getElementById('passo-preview');
const passoResultado = document.getElementById('passo-resultado');
const areaSemInventarios = document.getElementById('area-sem-inventarios');
const listaInventariosDestino = document.getElementById('lista-inventarios-destino');
const listaRiscosImportar = document.getElementById('lista-riscos-importar');
const botaoSelecionarTodosRiscos = document.getElementById('botao-selecionar-todos-riscos');
const avisoDemonstrativaPreview = document.getElementById('aviso-demonstrativa-preview');
const corpoTabelaPreview = document.getElementById('corpo-tabela-preview');
const listaResultadoImportacao = document.getElementById('lista-resultado-importacao');
const botaoVoltarImportar = document.getElementById('botao-voltar-importar');
const botaoCancelarImportar = document.getElementById('botao-cancelar-importar');
const botaoAvancarImportar = document.getElementById('botao-avancar-importar');
const botaoConfirmarImportar = document.getElementById('botao-confirmar-importar');
const botaoFecharResultado = document.getElementById('botao-fechar-resultado');
const linkIrInventario = document.getElementById('link-ir-inventario');

const PASSOS_IMPORTACAO = ['inventario', 'riscos', 'preview', 'resultado'];
let passoAtual = 'inventario';
let inventarioSelecionado = null;
let resultadosDoProcessamento = [];
let idsRiscoSelecionados = new Set();

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

function formatarNumero(valor, casas = 1) {
    if (valor === null || valor === undefined) return '-';
    return Number(valor).toFixed(casas).replace('.', ',');
}

// Preenchidos por carregarPagina() - reaproveitados pelo wizard "Adicionar
// ao Inventario" (secao 8/9 do prompt MVP-09C) para nao refazer as mesmas
// consultas ja feitas ao abrir a pagina.
let processamentoAtual = null;

async function carregarPagina() {
    if (!idProcessamento) {
        definirEstado('erro', 'Processamento não encontrado.');
        return;
    }
    definirEstado('carregando', 'Carregando resultado...');

    try {
        const processamento = await buscarProcessamento(idProcessamento);
        processamentoAtual = processamento;
        const [avaliacaoGhe, resultados] = await Promise.all([
            buscarAvaliacaoGhePorId(processamento.id_avaliacao_ghe),
            listarResultadosGhe(idProcessamento),
        ]);
        const [ghe, plano] = await Promise.all([
            buscarGhePorId(avaliacaoGhe.id_ghe),
            buscarPlanoAmostragemPorId(avaliacaoGhe.id_plano_amostragem),
        ]);

        linkVoltarAvaliacao.href = `avaliacao-ghe.html?id_avaliacao_ghe=${avaliacaoGhe.id_avaliacao_ghe}`;

        // So processamento CONCLUIDO pode virar item do Inventario (secao 4
        // do prompt MVP-09C) - PROCESSANDO/ERRO/CANCELADO nunca oferecem o
        // botao, mesmo que a URL seja aberta diretamente.
        botaoAdicionarInventario.hidden = processamento.status !== 'CONCLUIDO';

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

// =====================================================================
// "Adicionar ao Inventario" (MVP-09C) - wizard de 4 passos dentro de um
// unico modal: selecionar inventario (RASCUNHO) -> selecionar riscos ->
// pre-visualizar -> importar. So orquestra chamadas a
// inventarioIntegracaoService.js (nenhum calculo/regra e refeito aqui,
// secao 17 do prompt).
// =====================================================================

function mostrarPasso(passo) {
    passoAtual = passo;
    passoInventario.hidden = passo !== 'inventario';
    passoRiscos.hidden = passo !== 'riscos';
    passoPreview.hidden = passo !== 'preview';
    passoResultado.hidden = passo !== 'resultado';

    botaoVoltarImportar.hidden = passo === 'inventario' || passo === 'resultado';
    botaoCancelarImportar.hidden = passo === 'resultado';
    botaoAvancarImportar.hidden = passo === 'preview' || passo === 'resultado';
    botaoConfirmarImportar.hidden = passo !== 'preview';
    botaoFecharResultado.hidden = passo !== 'resultado';
    linkIrInventario.hidden = passo !== 'resultado';

    atualizarBotaoAvancar();
}

function atualizarBotaoAvancar() {
    if (passoAtual === 'inventario') {
        botaoAvancarImportar.disabled = !inventarioSelecionado;
    } else if (passoAtual === 'riscos') {
        botaoAvancarImportar.disabled = idsRiscoSelecionados.size === 0;
    }
}

async function abrirWizardImportacao() {
    idsRiscoSelecionados = new Set();
    inventarioSelecionado = null;

    listaInventariosDestino.innerHTML = '<p class="text-muted small mb-0">Carregando...</p>';
    mostrarPasso('inventario');
    instanciaModalImportar.show();

    try {
        const inventarios = await listarInventariosRascunhoDaEmpresa();
        renderizarListaInventarios(inventarios);
    } catch (error) {
        console.error('Erro ao carregar inventários em rascunho:', error);
        listaInventariosDestino.innerHTML = '';
        mostrarNotificacao('Não foi possível carregar os inventários disponíveis.', 'erro');
    }
}

function renderizarListaInventarios(inventarios) {
    listaInventariosDestino.innerHTML = '';
    if (inventarios.length === 0) {
        areaSemInventarios.hidden = false;
        return;
    }
    areaSemInventarios.hidden = true;

    inventarios.forEach((inventario) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <span><strong>${inventario.titulo}</strong> — versão ${inventario.numero_versao}</span>
            <span class="badge text-bg-secondary">Rascunho</span>
        `;
        item.addEventListener('click', () => {
            inventarioSelecionado = inventario;
            Array.from(listaInventariosDestino.children).forEach((el) => el.classList.remove('active'));
            item.classList.add('active');
            atualizarBotaoAvancar();
        });
        listaInventariosDestino.appendChild(item);
    });
}

async function carregarPassoRiscos() {
    listaRiscosImportar.innerHTML = '<p class="text-muted small mb-0">Carregando resultados do processamento...</p>';
    mostrarPasso('riscos');

    try {
        resultadosDoProcessamento = await listarResultadosProcessamento(idProcessamento, inventarioSelecionado.id_inventario);
        renderizarListaRiscos();
    } catch (error) {
        console.error('Erro ao carregar resultados do processamento:', error);
        listaRiscosImportar.innerHTML = '';
        mostrarNotificacao('Não foi possível carregar os riscos deste processamento.', 'erro');
    }
}

function renderizarListaRiscos() {
    listaRiscosImportar.innerHTML = '';

    resultadosDoProcessamento.forEach((resultado) => {
        const item = document.createElement('label');
        item.className = 'list-group-item d-flex align-items-start gap-2';

        const desabilitado = resultado.jaImportado || !resultado.perigo;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input mt-1';
        checkbox.disabled = desabilitado;
        checkbox.checked = idsRiscoSelecionados.has(resultado.id_avaliacao_ghe_risco);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                idsRiscoSelecionados.add(resultado.id_avaliacao_ghe_risco);
            } else {
                idsRiscoSelecionados.delete(resultado.id_avaliacao_ghe_risco);
            }
            atualizarBotaoAvancar();
        });

        const info = document.createElement('div');
        info.className = 'flex-grow-1';

        const linhaTitulo = document.createElement('div');
        linhaTitulo.className = 'd-flex align-items-center gap-2';
        const nome = document.createElement('span');
        nome.className = 'fw-semibold';
        nome.textContent = resultado.risco_nome;
        const badgeClassificacao = document.createElement('span');
        badgeClassificacao.className = 'badge';
        badgeClassificacao.style.backgroundColor = resultado.classificacao_cor_hex || '#6c757d';
        badgeClassificacao.style.color = '#fff';
        badgeClassificacao.textContent = `${resultado.classificacao_nome || '-'} — DEMONSTRATIVO`;
        linhaTitulo.append(nome, badgeClassificacao);
        info.appendChild(linhaTitulo);

        const detalhe = document.createElement('div');
        detalhe.className = 'small text-muted';
        if (resultado.jaImportado) {
            detalhe.textContent = 'Já importado para este inventário.';
        } else if (!resultado.perigo) {
            detalhe.textContent = 'Este risco ainda não possui um perigo ocupacional associado.';
        } else {
            detalhe.textContent = `Perigo: ${resultado.perigo.nome} · Pontuação: ${formatarNumero(resultado.pontuacao, 2)}`;
        }
        info.appendChild(detalhe);

        item.append(checkbox, info);
        listaRiscosImportar.appendChild(item);
    });
}

botaoSelecionarTodosRiscos.addEventListener('click', () => {
    resultadosDoProcessamento
        .filter((resultado) => !resultado.jaImportado && resultado.perigo)
        .forEach((resultado) => idsRiscoSelecionados.add(resultado.id_avaliacao_ghe_risco));
    renderizarListaRiscos();
    atualizarBotaoAvancar();
});

async function carregarPassoPreview() {
    corpoTabelaPreview.innerHTML = '<tr><td colspan="7" class="text-muted small">Carregando pré-visualização...</td></tr>';
    mostrarPasso('preview');

    try {
        const previews = await Promise.all(
            [...idsRiscoSelecionados].map((id) => prepararImportacaoResultado(id, inventarioSelecionado.id_inventario)),
        );
        corpoTabelaPreview.innerHTML = '';
        const algumaDemonstrativa = previews.some((p) => p.metodologia_status_validacao === 'DEMONSTRATIVA');
        avisoDemonstrativaPreview.hidden = !algumaDemonstrativa;

        previews.forEach((preview) => {
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td>${preview.inventario.titulo} (v${preview.inventario.numero_versao})</td>
                <td>${preview.ghe_nome}</td>
                <td>${preview.risco_nome}</td>
                <td>${preview.perigo?.nome ?? '-'}</td>
                <td>${formatarNumero(preview.pontuacao, 2)}</td>
                <td>${preview.classificacao_nome}</td>
                <td>${preview.metodologia_codigo} v${preview.metodologia_versao}</td>
            `;
            corpoTabelaPreview.appendChild(linha);
        });
    } catch (error) {
        console.error('Erro ao preparar pré-visualização da importação:', error);
        corpoTabelaPreview.innerHTML = '';
        mostrarNotificacao('Não foi possível preparar a pré-visualização.', 'erro');
    }
}

const ROTULOS_STATUS_IMPORTACAO = {
    IMPORTADO: { texto: 'Importado com sucesso', classe: 'text-bg-success' },
    JA_IMPORTADO: { texto: 'Já importado anteriormente', classe: 'text-bg-secondary' },
    SEM_MAPEAMENTO: { texto: 'Sem perigo mapeado', classe: 'text-bg-warning' },
    ERRO: { texto: 'Erro ao importar', classe: 'text-bg-danger' },
};

async function confirmarImportacao() {
    const textoOriginal = botaoConfirmarImportar.textContent;
    botaoConfirmarImportar.disabled = true;
    botaoConfirmarImportar.textContent = 'Importando...';

    try {
        const resultados = await importarResultadosGhe([...idsRiscoSelecionados], inventarioSelecionado.id_inventario);
        listaResultadoImportacao.innerHTML = '';
        resultados.forEach((resultado) => {
            const rotulo = ROTULOS_STATUS_IMPORTACAO[resultado.status] || { texto: resultado.status, classe: 'text-bg-secondary' };
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <span>${resultado.risco_nome || `#${resultado.id_avaliacao_ghe_risco}`}</span>
                <span class="badge ${rotulo.classe}">${rotulo.texto}</span>
            `;
            listaResultadoImportacao.appendChild(item);
        });
        linkIrInventario.href = `inventario-detalhe.html?id_inventario=${inventarioSelecionado.id_inventario}`;
        mostrarPasso('resultado');
    } catch (error) {
        console.error('Erro ao importar resultados para o inventário:', error);
        mostrarNotificacao('Não foi possível concluir a importação.', 'erro');
    } finally {
        botaoConfirmarImportar.disabled = false;
        botaoConfirmarImportar.textContent = textoOriginal;
    }
}

botaoAdicionarInventario.addEventListener('click', abrirWizardImportacao);

botaoAvancarImportar.addEventListener('click', () => {
    if (passoAtual === 'inventario' && inventarioSelecionado) {
        carregarPassoRiscos();
    } else if (passoAtual === 'riscos' && idsRiscoSelecionados.size > 0) {
        carregarPassoPreview();
    }
});

botaoVoltarImportar.addEventListener('click', () => {
    const indiceAtual = PASSOS_IMPORTACAO.indexOf(passoAtual);
    if (indiceAtual > 0) {
        mostrarPasso(PASSOS_IMPORTACAO[indiceAtual - 1]);
    }
});

botaoConfirmarImportar.addEventListener('click', confirmarImportacao);

// --- Popovers de ajuda ("Saiba mais") -------------------------------------------
document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => new bootstrap.Popover(el));

carregarPagina();
