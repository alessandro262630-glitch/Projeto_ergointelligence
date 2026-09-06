import {
    buscarInventario,
    atualizarInventarioRascunho,
    cancelarRascunho,
    listarItens,
    criarItem,
    atualizarItem,
    listarPerigosOcupacionais,
    listarAtividadesDoItem,
    associarAtividade,
    removerAtividade,
    validarInventarioPublicavel,
    publicarInventario,
    criarNovaVersao,
} from '../services/inventarioRiscoService.js';
import { buscarOrigemItemInventario, verificarAlgumaMetodologiaDemonstrativa } from '../services/inventarioIntegracaoService.js';
import { listarGhes, buscarNomeEmpresa } from '../services/gheService.js';
import { listarAmbientesPorSetor, listarPostosPorAmbiente } from '../services/ambienteService.js';
import { listarAtividades } from '../services/avaliacaoService.js';
import { listarUsuariosDaEmpresa } from '../services/planoAcaoService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// MVP-09B - Detalhe de UMA versao do Inventario de Riscos Ocupacionais:
// cabecalho, itens e suas atividades. So interface/eventos - toda regra
// de dominio (imutabilidade de PUBLICADO, isolamento por empresa,
// completude, publicacao, nova versao) fica em
// js/services/inventarioRiscoService.js, que NUNCA confia so na UI
// desabilitar um botao (secao 21 do prompt MVP-09B) - reforca tudo de
// novo no service.
//
// Todo item criado por esta pagina e origem_tipo='MANUAL'. A importacao
// automatica de resultados do Motor GHE (origem_tipo='MOTOR_GHE') e
// MVP-09C - esta pagina so PREPARA a exibicao de origem (buscarOrigemItem
// ja funciona, mas nenhum item MOTOR_GHE existe ainda).

const idInventario = Number(new URLSearchParams(window.location.search).get('id_inventario')) || null;

const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');
const areaNotificacoes = document.getElementById('area-notificacoes');

const textoTituloInventario = document.getElementById('texto-titulo-inventario');
const textoEmpresaInventario = document.getElementById('texto-empresa-inventario');
const textoVersaoInventario = document.getElementById('texto-versao-inventario');
const badgeStatusInventario = document.getElementById('badge-status-inventario');
const textoDescricaoInventario = document.getElementById('texto-descricao-inventario');
const textoDataReferenciaInventario = document.getElementById('texto-data-referencia-inventario');
const textoTotalItens = document.getElementById('texto-total-itens');
const textoTotalGhes = document.getElementById('texto-total-ghes');
const textoTotalExpostos = document.getElementById('texto-total-expostos');
const textoCriadoPor = document.getElementById('texto-criado-por');
const areaPublicadoPor = document.getElementById('area-publicado-por');
const textoPublicadoPor = document.getElementById('texto-publicado-por');
const areaPublicadoEm = document.getElementById('area-publicado-em');
const textoPublicadoEm = document.getElementById('texto-publicado-em');
const areaVersaoAnterior = document.getElementById('area-versao-anterior');
const linkVersaoAnterior = document.getElementById('link-versao-anterior');
const cardCabecalho = document.getElementById('card-cabecalho');

const botaoEditarCabecalho = document.getElementById('botao-editar-cabecalho');
const botaoCancelarRascunho = document.getElementById('botao-cancelar-rascunho');
const botaoPublicarInventario = document.getElementById('botao-publicar-inventario');
const botaoCriarNovaVersaoDetalhe = document.getElementById('botao-criar-nova-versao');

const areaPendenciasPublicacao = document.getElementById('area-pendencias-publicacao');
const avisoMetodologiaDemonstrativa = document.getElementById('aviso-metodologia-demonstrativa');
const listaPendenciasPublicacao = document.getElementById('lista-pendencias-publicacao');

const areaSemItens = document.getElementById('area-sem-itens');
const areaTabelaItens = document.getElementById('area-tabela-itens');
const corpoTabelaItens = document.getElementById('corpo-tabela-itens');
const botaoNovoItem = document.getElementById('botao-novo-item');

// Modal cabecalho
const modalCabecalho = document.getElementById('modal-cabecalho');
const formularioCabecalho = document.getElementById('formulario-cabecalho');
const campoTituloCabecalho = document.getElementById('campo-titulo-cabecalho');
const campoDataReferenciaCabecalho = document.getElementById('campo-data-referencia-cabecalho');
const campoDescricaoCabecalho = document.getElementById('campo-descricao-cabecalho');
const botaoSalvarCabecalho = document.getElementById('botao-salvar-cabecalho');
const instanciaModalCabecalho = new bootstrap.Modal(modalCabecalho);

// Modal item
const modalItem = document.getElementById('modal-item');
const tituloModalItem = document.getElementById('modal-item-titulo');
const formularioItem = document.getElementById('formulario-item');
const campoIdItem = document.getElementById('campo-id-item');
const campoGheItem = document.getElementById('campo-ghe-item');
const campoPerigoItem = document.getElementById('campo-perigo-item');
const campoAmbienteItem = document.getElementById('campo-ambiente-item');
const campoPostoItem = document.getElementById('campo-posto-item');
const campoProcessoItem = document.getElementById('campo-processo-item');
const campoFonteItem = document.getElementById('campo-fonte-item');
const campoLesoesItem = document.getElementById('campo-lesoes-item');
const campoExpostosItem = document.getElementById('campo-expostos-item');
const campoCaracterizacaoItem = document.getElementById('campo-caracterizacao-item');
const campoCaracterizacaoDescricaoItem = document.getElementById('campo-caracterizacao-descricao-item');
const campoMedidasItem = document.getElementById('campo-medidas-item');
const campoMedidaCategoriaItem = document.getElementById('campo-medida-categoria-item');
const botaoSalvarItem = document.getElementById('botao-salvar-item');
const areaAtividadesItem = document.getElementById('area-atividades-item');
const listaAtividadesItem = document.getElementById('lista-atividades-item');
const campoNovaAtividadeItem = document.getElementById('campo-nova-atividade-item');
const botaoAssociarAtividadeItem = document.getElementById('botao-associar-atividade-item');
const avisoSalvarParaAtividades = document.getElementById('aviso-salvar-para-atividades');
const instanciaModalItem = new bootstrap.Modal(modalItem);

// Modal publicacao
const modalConfirmarPublicacao = document.getElementById('modal-confirmar-publicacao');
const campoPublicador = document.getElementById('campo-publicador');
const botaoConfirmarPublicacao = document.getElementById('botao-confirmar-publicacao');
const instanciaModalConfirmarPublicacao = new bootstrap.Modal(modalConfirmarPublicacao);

// Modal nova versao
const modalNovaVersao = document.getElementById('modal-nova-versao');
const formularioNovaVersao = document.getElementById('formulario-nova-versao');
const campoTituloNovaVersao = document.getElementById('campo-titulo-nova-versao');
const campoDataReferenciaNovaVersao = document.getElementById('campo-data-referencia-nova-versao');
const campoCriadorNovaVersao = document.getElementById('campo-criador-nova-versao');
const campoDescricaoNovaVersao = document.getElementById('campo-descricao-nova-versao');
const botaoSalvarNovaVersao = document.getElementById('botao-salvar-nova-versao');
const instanciaModalNovaVersao = new bootstrap.Modal(modalNovaVersao);

// Modal cancelamento
const modalConfirmarCancelamento = document.getElementById('modal-confirmar-cancelamento');
const botaoConfirmarCancelamento = document.getElementById('botao-confirmar-cancelamento');
const instanciaModalConfirmarCancelamento = new bootstrap.Modal(modalConfirmarCancelamento);

// Modal origem
const modalOrigemItem = document.getElementById('modal-origem-item');
const corpoModalOrigemItem = document.getElementById('corpo-modal-origem-item');
const instanciaModalOrigemItem = new bootstrap.Modal(modalOrigemItem);

let inventarioAtual = null;
let itensAtuais = [];
let ghesCache = [];
let perigosCache = [];
let atividadesCache = [];
let idGheSelecionadoNoItem = null;

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

const ROTULOS_STATUS = { RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado', CANCELADO: 'Cancelado' };
const CLASSE_STATUS = {
    RASCUNHO: 'badge-status-inventario--rascunho',
    PUBLICADO: 'badge-status-inventario--publicado',
    CANCELADO: 'badge-status-inventario--cancelado',
};

function mensagemErroAmigavel(error) {
    if (error?.code && !['23505', '23503'].includes(error.code)) {
        return error.message;
    }
    if (error?.code === '23505') {
        return 'Este registro já existe.';
    }
    if (error?.code === '23503') {
        return 'Não foi possível localizar um dos itens selecionados.';
    }
    return 'Não foi possível salvar. Tente novamente.';
}

// --- Carga inicial -----------------------------------------------------------
async function carregarPagina() {
    if (!idInventario) {
        definirEstado('erro', 'Nenhum inventário informado na URL.');
        return;
    }
    definirEstado('carregando', 'Carregando inventário...');

    try {
        inventarioAtual = await buscarInventario(idInventario);
    } catch (error) {
        console.error('Erro ao carregar inventário:', error);
        definirEstado('erro', 'Inventário não encontrado.');
        return;
    }

    try {
        const [nomeEmpresa] = await Promise.all([
            buscarNomeEmpresa(inventarioAtual.id_empresa),
            carregarItens(),
            carregarCatalogos(),
        ]);
        renderizarCabecalho(nomeEmpresa);
        atualizarBotoesCabecalho();
        if (inventarioAtual.status === 'RASCUNHO') {
            await carregarPendencias();
        }
    } catch (error) {
        console.error('Erro ao carregar detalhe do inventário:', error);
        definirEstado('erro', 'Não foi possível carregar os dados do inventário.');
        return;
    }

    definirEstado('pronto');
}

function renderizarCabecalho(nomeEmpresa) {
    textoTituloInventario.textContent = inventarioAtual.titulo;
    textoEmpresaInventario.textContent = nomeEmpresa;
    textoVersaoInventario.textContent = inventarioAtual.numero_versao;
    badgeStatusInventario.className = `badge badge-status-inventario ${CLASSE_STATUS[inventarioAtual.status] || ''}`;
    badgeStatusInventario.textContent = ROTULOS_STATUS[inventarioAtual.status] || inventarioAtual.status;
    textoDescricaoInventario.textContent = inventarioAtual.descricao || 'Sem descrição.';
    textoDataReferenciaInventario.textContent = formatarDataBR(inventarioAtual.data_referencia);
    textoTotalItens.textContent = itensAtuais.length;
    textoTotalGhes.textContent = new Set(itensAtuais.map((i) => i.id_ghe)).size;
    textoTotalExpostos.textContent = itensAtuais.reduce((soma, i) => soma + (i.trabalhadores_expostos_snapshot || 0), 0);
    textoCriadoPor.textContent = inventarioAtual.criado_por_nome || '-';

    cardCabecalho.classList.remove('cabecalho-inventario--publicado', 'cabecalho-inventario--cancelado');
    if (inventarioAtual.status === 'PUBLICADO') {
        cardCabecalho.classList.add('cabecalho-inventario--publicado');
        areaPublicadoPor.hidden = false;
        areaPublicadoEm.hidden = false;
        textoPublicadoPor.textContent = inventarioAtual.publicado_por_nome || '-';
        textoPublicadoEm.textContent = new Date(inventarioAtual.publicado_em).toLocaleString('pt-BR');
    } else if (inventarioAtual.status === 'CANCELADO') {
        cardCabecalho.classList.add('cabecalho-inventario--cancelado');
        areaPublicadoPor.hidden = true;
        areaPublicadoEm.hidden = true;
    } else {
        areaPublicadoPor.hidden = true;
        areaPublicadoEm.hidden = true;
    }

    if (inventarioAtual.id_inventario_anterior) {
        areaVersaoAnterior.hidden = false;
        linkVersaoAnterior.textContent = 'Ver versão anterior';
        linkVersaoAnterior.href = `inventario-detalhe.html?id_inventario=${inventarioAtual.id_inventario_anterior}`;
    } else {
        areaVersaoAnterior.hidden = true;
    }

    // Fire-and-forget: renderizarCabecalho() nunca foi async para quem a
    // chama (6 pontos de chamada) - o aviso so aparece/desaparece quando a
    // consulta resolver, sem bloquear o restante do cabecalho.
    atualizarAvisoMetodologiaDemonstrativa();
}

// Aviso obrigatorio do cabecalho quando QUALQUER item do inventario vem de
// uma metodologia DEMONSTRATIVA (secao 21/45 do prompt MVP-09C) - nunca
// reinterpreta o rotulo, so verifica o que ja esta gravado em
// metodologia_risco a partir dos snapshots de cada item MOTOR_GHE.
async function atualizarAvisoMetodologiaDemonstrativa() {
    const itensMotorGhe = itensAtuais.filter((item) => item.origem_tipo === 'MOTOR_GHE');
    if (itensMotorGhe.length === 0) {
        avisoMetodologiaDemonstrativa.hidden = true;
        return;
    }

    try {
        const pares = itensMotorGhe.map((item) => ({
            codigo: item.metodologia_codigo_snapshot,
            versao: item.metodologia_versao_snapshot,
        }));
        const temMetodologiaDemonstrativa = await verificarAlgumaMetodologiaDemonstrativa(pares);
        avisoMetodologiaDemonstrativa.hidden = !temMetodologiaDemonstrativa;
    } catch (error) {
        console.error('Erro ao verificar status de validação das metodologias:', error);
    }
}

// Reforca no cliente o que o service ja bloqueia (secao 21 do prompt) -
// nunca confia so na UI, mas evita que o usuario clique em algo
// destinado a falhar sempre.
function atualizarBotoesCabecalho() {
    const status = inventarioAtual.status;
    botaoEditarCabecalho.hidden = status !== 'RASCUNHO';
    botaoCancelarRascunho.hidden = status !== 'RASCUNHO';
    botaoPublicarInventario.hidden = status !== 'RASCUNHO';
    botaoCriarNovaVersaoDetalhe.hidden = status !== 'PUBLICADO';
    botaoNovoItem.hidden = status !== 'RASCUNHO';
}

// --- Pendencias de publicacao --------------------------------------------------
const ROTULOS_PROBLEMA = {
    SEM_ITENS: 'O inventário precisa de ao menos um item.',
    ITENS_INCOMPLETOS: 'Há itens incompletos (veja a lista abaixo de cada item na tabela).',
    GHE_CROSS_TENANT: 'Existem itens com GHE de outra empresa.',
    STATUS_INVALIDO: 'Este inventário não está em rascunho.',
};

async function carregarPendencias() {
    try {
        const validacao = await validarInventarioPublicavel(idInventario);
        botaoPublicarInventario.disabled = !validacao.publicavel;

        if (validacao.publicavel) {
            areaPendenciasPublicacao.hidden = true;
            return;
        }

        areaPendenciasPublicacao.hidden = false;
        listaPendenciasPublicacao.innerHTML = '';
        validacao.problemas.forEach((problema) => {
            const li = document.createElement('li');
            li.textContent = ROTULOS_PROBLEMA[problema.codigo] || problema.mensagem;
            listaPendenciasPublicacao.appendChild(li);
        });
        validacao.itensIncompletos.forEach((item) => {
            const li = document.createElement('li');
            const campos = item.camposPendentes.map((c) => c.mensagem).join(' ');
            li.textContent = `${item.perigo_nome || 'Item'} (${item.ghe_nome || 'GHE não informado'}): ${campos}`;
            listaPendenciasPublicacao.appendChild(li);
        });
    } catch (error) {
        console.error('Erro ao validar publicação:', error);
    }
}

// --- Itens ---------------------------------------------------------------------
function criarBadgeCompletude(completude) {
    const badge = document.createElement('span');
    badge.className = `badge badge-completude-item ${completude.completo ? 'badge-completude-item--completo' : 'badge-completude-item--incompleto'}`;
    badge.textContent = completude.completo ? 'Completo' : `Incompleto (${completude.camposPendentes.length})`;
    if (!completude.completo) {
        badge.title = completude.camposPendentes.map((c) => c.mensagem).join('\n');
    }
    return badge;
}

function criarLinhaItem(item) {
    const linha = document.createElement('tr');

    const celulaGhe = document.createElement('td');
    celulaGhe.textContent = item.ghe_nome || '-';

    const celulaCategoria = document.createElement('td');
    celulaCategoria.textContent = item.perigo_categoria || '-';

    const celulaPerigo = document.createElement('td');
    celulaPerigo.textContent = item.perigo_nome || '-';

    const celulaAtividades = document.createElement('td');
    celulaAtividades.textContent = item.atividades.length > 0
        ? item.atividades.map((a) => a.atividade_nome).join(', ')
        : '-';

    const celulaExpostos = document.createElement('td');
    celulaExpostos.className = 'text-end';
    celulaExpostos.textContent = item.trabalhadores_expostos_snapshot ?? '-';

    const celulaClassificacao = document.createElement('td');
    celulaClassificacao.textContent = item.origem_tipo === 'MOTOR_GHE'
        ? (item.classificacao_nome_snapshot || '-')
        : 'Não avaliado (manual)';

    const celulaOrigem = document.createElement('td');
    if (item.origem_tipo === 'MOTOR_GHE') {
        const botaoOrigem = document.createElement('button');
        botaoOrigem.type = 'button';
        botaoOrigem.className = 'btn btn-sm btn-link p-0';
        botaoOrigem.textContent = 'Motor GHE';
        botaoOrigem.addEventListener('click', () => abrirModalOrigem(item));
        celulaOrigem.appendChild(botaoOrigem);
    } else {
        celulaOrigem.textContent = 'Manual';
    }

    const celulaCompletude = document.createElement('td');
    celulaCompletude.appendChild(criarBadgeCompletude(item.completude));

    const celulaAcoes = document.createElement('td');
    if (inventarioAtual.status === 'RASCUNHO') {
        const botaoEditar = document.createElement('button');
        botaoEditar.type = 'button';
        botaoEditar.className = 'btn btn-sm btn-outline-secondary';
        botaoEditar.title = 'Editar item';
        botaoEditar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
        botaoEditar.addEventListener('click', () => abrirModalEdicaoItem(item));
        celulaAcoes.appendChild(botaoEditar);
    }

    linha.append(celulaGhe, celulaCategoria, celulaPerigo, celulaAtividades, celulaExpostos, celulaClassificacao, celulaOrigem, celulaCompletude, celulaAcoes);
    return linha;
}

async function carregarItens() {
    itensAtuais = await listarItens(idInventario);

    if (itensAtuais.length === 0) {
        areaSemItens.hidden = false;
        areaTabelaItens.hidden = true;
        return;
    }
    areaSemItens.hidden = true;
    areaTabelaItens.hidden = false;
    corpoTabelaItens.innerHTML = '';
    itensAtuais.forEach((item) => corpoTabelaItens.appendChild(criarLinhaItem(item)));
}

async function recarregarItensERenderizar() {
    await carregarItens();
    const nomeEmpresa = await buscarNomeEmpresa(inventarioAtual.id_empresa);
    renderizarCabecalho(nomeEmpresa);
    if (inventarioAtual.status === 'RASCUNHO') {
        await carregarPendencias();
    }
}

// --- Origem do item --------------------------------------------------------------
// Consulta apenas historico ja persistido (buscarOrigemItemInventario) -
// nunca reprocessa o Motor GHE ao abrir esta modal (secao 34 do prompt
// MVP-09C).
async function abrirModalOrigem(item) {
    corpoModalOrigemItem.innerHTML = '<p class="text-muted mb-0">Carregando...</p>';
    instanciaModalOrigemItem.show();
    try {
        const origem = await buscarOrigemItemInventario(item.id_inventario_risco_item);
        if (!origem) {
            corpoModalOrigemItem.innerHTML = '<p class="text-muted mb-0">Este item não possui origem no Motor GHE.</p>';
            return;
        }
        const avisoDemonstrativa = origem.metodologia_status_validacao === 'DEMONSTRATIVA'
            ? `<div class="alert alert-warning small mb-3">
                Resultado proveniente de metodologia demonstrativa. Os critérios utilizados ainda requerem
                validação técnica para uso profissional.
               </div>`
            : '';
        corpoModalOrigemItem.innerHTML = `
            ${avisoDemonstrativa}
            <dl class="row mb-0 small">
                <dt class="col-5">Origem</dt><dd class="col-7">Motor de Risco GHE</dd>
                <dt class="col-5">GHE</dt><dd class="col-7">${origem.ghe_nome || '-'}</dd>
                <dt class="col-5">Processamento</dt><dd class="col-7">#${origem.id_processamento_risco_ghe ?? '-'}</dd>
                <dt class="col-5">Metodologia</dt><dd class="col-7">${origem.metodologia_codigo || '-'}</dd>
                <dt class="col-5">Versão</dt><dd class="col-7">${origem.metodologia_versao || '-'}</dd>
                <dt class="col-5">Processado em</dt><dd class="col-7">${origem.processado_em ? new Date(origem.processado_em).toLocaleString('pt-BR') : '-'}</dd>
                <dt class="col-5">Pontuação</dt><dd class="col-7">${origem.pontuacao ?? '-'}</dd>
                <dt class="col-5">Classificação</dt><dd class="col-7">${origem.classificacao_nome || '-'}</dd>
            </dl>
            <a class="small" href="resultado-ghe.html?id_processamento=${origem.id_processamento_risco_ghe}">Ver resultado completo do processamento &rarr;</a>
        `;
    } catch (error) {
        console.error('Erro ao carregar origem do item:', error);
        corpoModalOrigemItem.innerHTML = '<p class="text-danger mb-0">Não foi possível carregar a origem deste item.</p>';
    }
}

// --- Formulario de item: selects em cascata -------------------------------------
async function popularSelectGhe(valorSelecionado) {
    campoGheItem.innerHTML = '<option value="">Selecione...</option>';
    ghesCache.filter((g) => g.ativo).forEach((ghe) => {
        const opcao = document.createElement('option');
        opcao.value = ghe.id_ghe;
        opcao.textContent = ghe.nome;
        campoGheItem.appendChild(opcao);
    });
    campoGheItem.value = valorSelecionado || '';
}

async function popularSelectPerigo(valorSelecionado) {
    campoPerigoItem.innerHTML = '<option value="">Selecione...</option>';
    perigosCache.forEach((perigo) => {
        const opcao = document.createElement('option');
        opcao.value = perigo.id_perigo;
        opcao.textContent = `[${perigo.categoria}] ${perigo.nome}`;
        campoPerigoItem.appendChild(opcao);
    });
    campoPerigoItem.value = valorSelecionado || '';
}

async function atualizarAmbientesDoGhe(idGhe, valorSelecionado) {
    campoAmbienteItem.innerHTML = '<option value="">Não especificado</option>';
    campoPostoItem.innerHTML = '<option value="">Não especificado</option>';
    const ghe = ghesCache.find((g) => String(g.id_ghe) === String(idGhe));
    if (!ghe || !ghe.id_setor) {
        return;
    }
    try {
        const ambientes = await listarAmbientesPorSetor(ghe.id_setor);
        ambientes.forEach((ambiente) => {
            const opcao = document.createElement('option');
            opcao.value = ambiente.id_ambiente;
            opcao.textContent = ambiente.nome;
            campoAmbienteItem.appendChild(opcao);
        });
        campoAmbienteItem.value = valorSelecionado || '';
        if (valorSelecionado) {
            await atualizarPostosDoAmbiente(valorSelecionado);
        }
    } catch (error) {
        console.error('Erro ao carregar ambientes do GHE:', error);
    }
}

async function atualizarPostosDoAmbiente(idAmbiente, valorSelecionado) {
    campoPostoItem.innerHTML = '<option value="">Não especificado</option>';
    if (!idAmbiente) return;
    try {
        const postos = await listarPostosPorAmbiente(idAmbiente);
        postos.forEach((posto) => {
            const opcao = document.createElement('option');
            opcao.value = posto.id_posto;
            opcao.textContent = posto.nome;
            campoPostoItem.appendChild(opcao);
        });
        campoPostoItem.value = valorSelecionado || '';
    } catch (error) {
        console.error('Erro ao carregar postos do ambiente:', error);
    }
}

campoGheItem.addEventListener('change', () => {
    idGheSelecionadoNoItem = campoGheItem.value;
    atualizarAmbientesDoGhe(campoGheItem.value, null);
    const ghe = ghesCache.find((g) => String(g.id_ghe) === String(campoGheItem.value));
    if (ghe && !campoIdItem.value) {
        campoExpostosItem.placeholder = `Universo atual do GHE: ${ghe.universo}`;
    }
});

campoAmbienteItem.addEventListener('change', () => {
    atualizarPostosDoAmbiente(campoAmbienteItem.value, null);
});

// --- Atividades do item (persistidas imediatamente, sem esperar o submit) ------
function renderizarAtividadesItem(atividades) {
    listaAtividadesItem.innerHTML = '';
    if (atividades.length === 0) {
        const vazio = document.createElement('li');
        vazio.className = 'list-group-item text-muted small';
        vazio.textContent = 'Nenhuma atividade associada ainda.';
        listaAtividadesItem.appendChild(vazio);
        return;
    }
    atividades.forEach((atividade) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center px-2 py-1';
        const nome = document.createElement('span');
        nome.className = 'small';
        nome.textContent = atividade.atividade_nome;
        const botaoRemover = document.createElement('button');
        botaoRemover.type = 'button';
        botaoRemover.className = 'btn btn-sm btn-outline-danger';
        botaoRemover.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        botaoRemover.addEventListener('click', async () => {
            try {
                await removerAtividade(atividade.id_inventario_risco_item_atividade);
                const atualizadas = await listarAtividadesDoItem(Number(campoIdItem.value));
                renderizarAtividadesItem(atualizadas);
                await recarregarItensERenderizar();
            } catch (error) {
                console.error('Erro ao remover atividade:', error);
                mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
            }
        });
        item.append(nome, botaoRemover);
        listaAtividadesItem.appendChild(item);
    });
}

async function popularSelectNovaAtividade() {
    campoNovaAtividadeItem.innerHTML = '<option value="">Selecione uma atividade...</option>';
    atividadesCache.forEach((atividade) => {
        const opcao = document.createElement('option');
        opcao.value = atividade.id_atividade;
        opcao.textContent = atividade.nome;
        campoNovaAtividadeItem.appendChild(opcao);
    });
}

botaoAssociarAtividadeItem.addEventListener('click', async () => {
    if (!campoNovaAtividadeItem.value || !campoIdItem.value) return;
    try {
        await associarAtividade(Number(campoIdItem.value), Number(campoNovaAtividadeItem.value));
        const atualizadas = await listarAtividadesDoItem(Number(campoIdItem.value));
        renderizarAtividadesItem(atualizadas);
        campoNovaAtividadeItem.value = '';
        await recarregarItensERenderizar();
    } catch (error) {
        console.error('Erro ao associar atividade:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    }
});

// --- Abrir modal de item ---------------------------------------------------------
function limparErrosItem() {
    [campoGheItem, campoPerigoItem].forEach((c) => c.classList.remove('is-invalid'));
    ['erro-ghe-item', 'erro-perigo-item'].forEach((id) => { document.getElementById(id).textContent = ''; });
}

async function abrirModalNovoItem() {
    formularioItem.reset();
    limparErrosItem();
    campoIdItem.value = '';
    tituloModalItem.textContent = 'Novo Item';
    areaAtividadesItem.hidden = true;
    avisoSalvarParaAtividades.hidden = false;
    await popularSelectGhe(null);
    await popularSelectPerigo(null);
    campoAmbienteItem.innerHTML = '<option value="">Não especificado</option>';
    campoPostoItem.innerHTML = '<option value="">Não especificado</option>';
    campoExpostosItem.placeholder = 'Sugerido a partir do universo do GHE';
    instanciaModalItem.show();
}

async function abrirModalEdicaoItem(item) {
    formularioItem.reset();
    limparErrosItem();
    campoIdItem.value = item.id_inventario_risco_item;
    tituloModalItem.textContent = 'Editar Item';
    areaAtividadesItem.hidden = false;
    avisoSalvarParaAtividades.hidden = true;

    await popularSelectGhe(item.id_ghe);
    await popularSelectPerigo(item.id_perigo);
    await atualizarAmbientesDoGhe(item.id_ghe, item.id_ambiente);
    if (item.id_ambiente) {
        await atualizarPostosDoAmbiente(item.id_ambiente, item.id_posto);
    }

    campoProcessoItem.value = item.processo_descricao || '';
    campoFonteItem.value = item.fonte_circunstancia || '';
    campoLesoesItem.value = item.possiveis_lesoes_agravos || '';
    campoExpostosItem.value = item.trabalhadores_expostos_snapshot ?? '';
    campoCaracterizacaoItem.value = item.caracterizacao_exposicao || '';
    campoCaracterizacaoDescricaoItem.value = item.caracterizacao_exposicao_descricao || '';
    campoMedidasItem.value = item.medidas_existentes || '';
    campoMedidaCategoriaItem.value = item.medida_existente_categoria || '';

    await popularSelectNovaAtividade();
    renderizarAtividadesItem(item.atividades || []);

    instanciaModalItem.show();
}

function lerDadosFormularioItem() {
    return {
        id_ghe: campoGheItem.value ? Number(campoGheItem.value) : null,
        id_perigo: campoPerigoItem.value ? Number(campoPerigoItem.value) : null,
        id_ambiente: campoAmbienteItem.value ? Number(campoAmbienteItem.value) : null,
        id_posto: campoPostoItem.value ? Number(campoPostoItem.value) : null,
        processo_descricao: campoProcessoItem.value,
        fonte_circunstancia: campoFonteItem.value,
        possiveis_lesoes_agravos: campoLesoesItem.value,
        trabalhadores_expostos: campoExpostosItem.value,
        caracterizacao_exposicao: campoCaracterizacaoItem.value,
        caracterizacao_exposicao_descricao: campoCaracterizacaoDescricaoItem.value,
        medidas_existentes: campoMedidasItem.value,
        medida_existente_categoria: campoMedidaCategoriaItem.value,
    };
}

function validarFormularioItem() {
    limparErrosItem();
    let valido = true;
    if (!campoGheItem.value) {
        campoGheItem.classList.add('is-invalid');
        document.getElementById('erro-ghe-item').textContent = 'Selecione o GHE.';
        valido = false;
    }
    if (!campoPerigoItem.value) {
        campoPerigoItem.classList.add('is-invalid');
        document.getElementById('erro-perigo-item').textContent = 'Selecione o perigo.';
        valido = false;
    }
    return valido;
}

formularioItem.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validarFormularioItem()) return;

    const idExistente = campoIdItem.value;
    const textoOriginal = botaoSalvarItem.textContent;
    botaoSalvarItem.disabled = true;
    botaoSalvarItem.textContent = 'Salvando...';

    try {
        const dados = lerDadosFormularioItem();
        if (idExistente) {
            await atualizarItem(Number(idExistente), dados);
            mostrarNotificacao('Item atualizado com sucesso.', 'sucesso');
            await recarregarItensERenderizar();
        } else {
            const novoItem = await criarItem(idInventario, dados);
            mostrarNotificacao('Item criado com sucesso. Você já pode associar atividades a ele.', 'sucesso');
            campoIdItem.value = novoItem.id_inventario_risco_item;
            tituloModalItem.textContent = 'Editar Item';
            areaAtividadesItem.hidden = false;
            avisoSalvarParaAtividades.hidden = true;
            await popularSelectNovaAtividade();
            renderizarAtividadesItem([]);
            await recarregarItensERenderizar();
            return;
        }
        instanciaModalItem.hide();
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarItem.disabled = false;
        botaoSalvarItem.textContent = textoOriginal;
    }
});

botaoNovoItem.addEventListener('click', abrirModalNovoItem);

// --- Editar cabecalho ------------------------------------------------------------
botaoEditarCabecalho.addEventListener('click', () => {
    campoTituloCabecalho.value = inventarioAtual.titulo;
    campoDataReferenciaCabecalho.value = inventarioAtual.data_referencia;
    campoDescricaoCabecalho.value = inventarioAtual.descricao || '';
    [campoTituloCabecalho, campoDataReferenciaCabecalho].forEach((c) => c.classList.remove('is-invalid'));
    instanciaModalCabecalho.show();
});

formularioCabecalho.addEventListener('submit', async (event) => {
    event.preventDefault();
    let valido = true;
    if (!campoPreenchido(campoTituloCabecalho.value)) {
        campoTituloCabecalho.classList.add('is-invalid');
        document.getElementById('erro-titulo-cabecalho').textContent = 'Informe o título.';
        valido = false;
    }
    if (!campoDataReferenciaCabecalho.value) {
        campoDataReferenciaCabecalho.classList.add('is-invalid');
        document.getElementById('erro-data-referencia-cabecalho').textContent = 'Informe a data de referência.';
        valido = false;
    }
    if (!valido) return;

    const textoOriginal = botaoSalvarCabecalho.textContent;
    botaoSalvarCabecalho.disabled = true;
    botaoSalvarCabecalho.textContent = 'Salvando...';

    try {
        inventarioAtual = await atualizarInventarioRascunho(idInventario, {
            titulo: campoTituloCabecalho.value,
            descricao: campoDescricaoCabecalho.value,
            data_referencia: campoDataReferenciaCabecalho.value,
        });
        mostrarNotificacao('Dados do inventário atualizados.', 'sucesso');
        instanciaModalCabecalho.hide();
        const nomeEmpresa = await buscarNomeEmpresa(inventarioAtual.id_empresa);
        renderizarCabecalho(nomeEmpresa);
    } catch (error) {
        console.error('Erro ao atualizar cabeçalho:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarCabecalho.disabled = false;
        botaoSalvarCabecalho.textContent = textoOriginal;
    }
});

// --- Cancelar rascunho -------------------------------------------------------------
botaoCancelarRascunho.addEventListener('click', () => instanciaModalConfirmarCancelamento.show());

botaoConfirmarCancelamento.addEventListener('click', async () => {
    botaoConfirmarCancelamento.disabled = true;
    try {
        inventarioAtual = await cancelarRascunho(idInventario);
        mostrarNotificacao('Inventário cancelado.', 'sucesso');
        instanciaModalConfirmarCancelamento.hide();
        atualizarBotoesCabecalho();
        areaPendenciasPublicacao.hidden = true;
        const nomeEmpresa = await buscarNomeEmpresa(inventarioAtual.id_empresa);
        renderizarCabecalho(nomeEmpresa);
        await carregarItens();
    } catch (error) {
        console.error('Erro ao cancelar rascunho:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoConfirmarCancelamento.disabled = false;
    }
});

// --- Publicacao ---------------------------------------------------------------------
botaoPublicarInventario.addEventListener('click', async () => {
    try {
        const usuarios = await listarUsuariosDaEmpresa(inventarioAtual.id_empresa);
        campoPublicador.innerHTML = '<option value="">Selecione...</option>';
        usuarios.forEach((usuario) => {
            const opcao = document.createElement('option');
            opcao.value = usuario.id_usuario;
            opcao.textContent = usuario.nome;
            campoPublicador.appendChild(opcao);
        });
        instanciaModalConfirmarPublicacao.show();
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
        mostrarNotificacao('Não foi possível carregar os usuários.', 'erro');
    }
});

botaoConfirmarPublicacao.addEventListener('click', async () => {
    if (!campoPublicador.value) {
        mostrarNotificacao('Selecione quem está publicando o inventário.', 'erro');
        return;
    }
    const textoOriginal = botaoConfirmarPublicacao.textContent;
    botaoConfirmarPublicacao.disabled = true;
    botaoConfirmarPublicacao.textContent = 'Publicando...';

    try {
        inventarioAtual = await publicarInventario(idInventario, Number(campoPublicador.value));
        mostrarNotificacao('Inventário publicado com sucesso.', 'sucesso');
        instanciaModalConfirmarPublicacao.hide();
        atualizarBotoesCabecalho();
        areaPendenciasPublicacao.hidden = true;
        const nomeEmpresa = await buscarNomeEmpresa(inventarioAtual.id_empresa);
        renderizarCabecalho(nomeEmpresa);
        await carregarItens();
    } catch (error) {
        console.error('Erro ao publicar inventário:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoConfirmarPublicacao.disabled = false;
        botaoConfirmarPublicacao.textContent = textoOriginal;
    }
});

// --- Nova versao ---------------------------------------------------------------------
botaoCriarNovaVersaoDetalhe.addEventListener('click', async () => {
    formularioNovaVersao.reset();
    [campoTituloNovaVersao, campoDataReferenciaNovaVersao, campoCriadorNovaVersao].forEach((c) => c.classList.remove('is-invalid'));
    campoTituloNovaVersao.value = inventarioAtual.titulo;
    campoDescricaoNovaVersao.value = inventarioAtual.descricao || '';

    try {
        const usuarios = await listarUsuariosDaEmpresa(inventarioAtual.id_empresa);
        campoCriadorNovaVersao.innerHTML = '<option value="">Selecione...</option>';
        usuarios.forEach((usuario) => {
            const opcao = document.createElement('option');
            opcao.value = usuario.id_usuario;
            opcao.textContent = usuario.nome;
            campoCriadorNovaVersao.appendChild(opcao);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }

    instanciaModalNovaVersao.show();
});

formularioNovaVersao.addEventListener('submit', async (event) => {
    event.preventDefault();
    let valido = true;
    if (!campoPreenchido(campoTituloNovaVersao.value)) {
        campoTituloNovaVersao.classList.add('is-invalid');
        document.getElementById('erro-titulo-nova-versao').textContent = 'Informe o título.';
        valido = false;
    }
    if (!campoDataReferenciaNovaVersao.value) {
        campoDataReferenciaNovaVersao.classList.add('is-invalid');
        document.getElementById('erro-data-referencia-nova-versao').textContent = 'Informe a data de referência.';
        valido = false;
    }
    if (!campoCriadorNovaVersao.value) {
        campoCriadorNovaVersao.classList.add('is-invalid');
        document.getElementById('erro-criador-nova-versao').textContent = 'Selecione o responsável.';
        valido = false;
    }
    if (!valido) return;

    const textoOriginal = botaoSalvarNovaVersao.textContent;
    botaoSalvarNovaVersao.disabled = true;
    botaoSalvarNovaVersao.textContent = 'Criando...';

    try {
        const nova = await criarNovaVersao(idInventario, {
            titulo: campoTituloNovaVersao.value,
            descricao: campoDescricaoNovaVersao.value,
            data_referencia: campoDataReferenciaNovaVersao.value,
            id_usuario_criador: Number(campoCriadorNovaVersao.value),
        });
        mostrarNotificacao('Nova versão criada com sucesso.', 'sucesso');
        window.location.href = `inventario-detalhe.html?id_inventario=${nova.id_inventario}`;
    } catch (error) {
        console.error('Erro ao criar nova versão:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarNovaVersao.disabled = false;
        botaoSalvarNovaVersao.textContent = textoOriginal;
    }
});

// --- Carga inicial de catalogos (GHE/perigo/atividade) --------------------------------
async function carregarCatalogos() {
    const [ghes, perigos, atividades] = await Promise.all([
        listarGhes(),
        listarPerigosOcupacionais(),
        listarAtividades({ idEmpresa: inventarioAtual.id_empresa }),
    ]);
    ghesCache = ghes;
    perigosCache = perigos;
    atividadesCache = atividades;
}

carregarPagina();
