import {
    listarVinculosPorColaborador,
    buscarVinculoAtual,
    buscarVinculoPorId,
    criarVinculo,
    atualizarVinculo,
    encerrarVinculo,
    listarSetores,
    listarCargos,
} from '../services/vinculoService.js';
import { listarUltimasAvaliacoesFinalizadasPorVinculos } from '../services/avaliacaoService.js';
import { buscarColaboradorPorId } from '../services/colaboradorService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido, dataNaoFutura } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// --- Contexto: id_colaborador vem da URL, nunca solicitado novamente ao
// usuario (ver vinculos.html?id_colaborador=...) -------------------------
const parametros = new URLSearchParams(window.location.search);
const idColaborador = Number(parametros.get('id_colaborador'));

// Link para a AVA-01, ja com o colaborador desta pagina pre-selecionado
// (ver js/pages/nova-avaliacao.js). Definido cedo porque independe do
// resultado da carga do colaborador/vinculos abaixo.
document.getElementById('link-nova-avaliacao').href = `nova-avaliacao.html?id_colaborador=${idColaborador}`;

// --- Referencias de DOM --------------------------------------------------
const contextoNome = document.getElementById('contexto-nome');
const contextoMatricula = document.getElementById('contexto-matricula');
const areaVinculoAtual = document.getElementById('area-vinculo-atual');
const areaEstado = document.getElementById('area-estado');
const areaTabela = document.getElementById('area-tabela');
const corpoTabela = document.getElementById('corpo-tabela');
const areaNotificacoes = document.getElementById('area-notificacoes');

const modalFormulario = document.getElementById('modal-formulario');
const tituloModalFormulario = document.getElementById('modal-formulario-titulo');
const formularioVinculo = document.getElementById('formulario-vinculo');
const campoIdVinculo = document.getElementById('campo-id-vinculo');
const campoSetor = document.getElementById('campo-setor');
const campoCargo = document.getElementById('campo-cargo');
const campoDataInicio = document.getElementById('campo-data-inicio');
const campoPrincipal = document.getElementById('campo-principal');
const botaoSalvarVinculo = document.getElementById('botao-salvar-vinculo');

const modalEncerrar = document.getElementById('modal-encerrar');
const formularioEncerrar = document.getElementById('formulario-encerrar');
const campoIdVinculoEncerrar = document.getElementById('campo-id-vinculo-encerrar');
const campoDataFim = document.getElementById('campo-data-fim');
const botaoConfirmarEncerrar = document.getElementById('botao-confirmar-encerrar');

const instanciaModalFormulario = new bootstrap.Modal(modalFormulario);
const instanciaModalEncerrar = new bootstrap.Modal(modalEncerrar);

// --- Estado local da pagina ------------------------------------------------
let vinculos = [];
let avaliacoesFinalizadasPorVinculo = {};

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

// --- Estados de carregamento / vazio / erro / sucesso ----------------------
function definirEstado(tipo, mensagem) {
    if (tipo === 'sucesso') {
        areaEstado.hidden = true;
        areaTabela.hidden = false;
        return;
    }

    areaTabela.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    areaEstado.textContent = mensagem;
}

// --- Carga inicial: colaborador (contexto) + catalogos + vinculos --------
async function carregarPagina() {
    if (!idColaborador || Number.isNaN(idColaborador)) {
        contextoNome.textContent = 'Colaborador não informado';
        definirEstado('erro', 'Nenhum colaborador foi informado na URL (parâmetro id_colaborador).');
        return;
    }

    try {
        const colaborador = await buscarColaboradorPorId(idColaborador);
        contextoNome.textContent = colaborador.nome;
        contextoMatricula.textContent = `Matrícula: ${colaborador.matricula}`;
    } catch (error) {
        console.error('Erro ao carregar colaborador:', error);
        contextoNome.textContent = 'Colaborador não encontrado';
        definirEstado('erro', 'Não foi possível carregar o colaborador informado.');
        return;
    }

    await carregarOpcoesSelects();
    await carregarVinculos();
}

async function carregarVinculos() {
    definirEstado('carregando', 'Carregando vínculos...');
    try {
        const [listaVinculos, vinculoAtual] = await Promise.all([
            listarVinculosPorColaborador(idColaborador),
            buscarVinculoAtual(idColaborador),
        ]);
        vinculos = listaVinculos;
        avaliacoesFinalizadasPorVinculo = await listarUltimasAvaliacoesFinalizadasPorVinculos(
            vinculos.map((v) => v.id_vinculo),
        );
        renderizarVinculoAtual(vinculoAtual);
        renderizarHistorico();
    } catch (error) {
        console.error('Erro ao carregar vínculos:', error);
        definirEstado('erro', 'Não foi possível carregar os vínculos.');
    }
}

// --- Vinculo atual (destaque) ----------------------------------------------
function renderizarVinculoAtual(vinculoAtual) {
    areaVinculoAtual.innerHTML = '';

    if (!vinculoAtual) {
        const mensagem = document.createElement('p');
        mensagem.className = 'text-muted mb-0';
        mensagem.textContent = 'Nenhum vínculo principal vigente no momento.';
        areaVinculoAtual.appendChild(mensagem);
        return;
    }

    const lista = document.createElement('dl');
    lista.className = 'row row-cols-2 row-cols-md-5 g-3 mb-0';

    // "Fim" nao aparece aqui de proposito: por definicao, o vinculo atual
    // (principal + ativo + vigente) nunca tem data_fim preenchida. O campo
    // continua disponivel na tabela de historico abaixo.
    const itens = [
        ['Setor', vinculoAtual.setor || '-'],
        ['Cargo', vinculoAtual.cargo || '-'],
        ['Início', formatarDataBR(vinculoAtual.data_inicio)],
        ['Principal', vinculoAtual.principal ? 'Sim' : 'Não'],
        ['Status', 'Vigente'],
    ];

    itens.forEach(([rotulo, valor]) => {
        const item = document.createElement('div');
        item.className = 'col';
        const dt = document.createElement('dt');
        dt.className = 'small text-uppercase text-muted mb-1';
        dt.textContent = rotulo;
        const dd = document.createElement('dd');
        dd.className = 'mb-0 fw-medium';

        if (rotulo === 'Status') {
            const badge = document.createElement('span');
            badge.className = 'badge text-bg-success';
            badge.textContent = valor;
            dd.appendChild(badge);
        } else {
            dd.textContent = valor;
        }

        item.append(dt, dd);
        lista.appendChild(item);
    });

    areaVinculoAtual.appendChild(lista);
}

// --- Historico completo (inclui o vinculo vigente, ver Bloco 8 do prompt) --
function derivarStatus(vinculo) {
    if (vinculo.data_fim) {
        return 'Encerrado';
    }
    if (vinculo.ativo) {
        return 'Vigente';
    }
    return 'Inativo';
}

function classeBadgeStatus(status) {
    if (status === 'Vigente') {
        return 'text-bg-success';
    }
    if (status === 'Encerrado') {
        return 'text-bg-secondary';
    }
    return 'text-bg-danger';
}

function renderizarHistorico() {
    if (vinculos.length === 0) {
        definirEstado('vazio', 'Este colaborador ainda não possui vínculos cadastrados.');
        return;
    }

    corpoTabela.innerHTML = '';
    vinculos.forEach((vinculo) => {
        corpoTabela.appendChild(criarLinhaVinculo(vinculo));
    });
    definirEstado('sucesso');
}

// Elementos criados via DOM API (nao innerHTML) para nao expor os dados do
// vinculo a injecao de HTML.
function criarLinhaVinculo(vinculo) {
    const linha = document.createElement('tr');

    const celulaSetor = document.createElement('td');
    celulaSetor.textContent = vinculo.setor || '-';

    const celulaCargo = document.createElement('td');
    celulaCargo.textContent = vinculo.cargo || '-';

    const celulaInicio = document.createElement('td');
    celulaInicio.textContent = formatarDataBR(vinculo.data_inicio);

    const celulaFim = document.createElement('td');
    celulaFim.textContent = vinculo.data_fim ? formatarDataBR(vinculo.data_fim) : '—';

    const celulaPrincipal = document.createElement('td');
    celulaPrincipal.textContent = vinculo.principal ? 'Sim' : 'Não';

    const celulaStatus = document.createElement('td');
    const status = derivarStatus(vinculo);
    const badge = document.createElement('span');
    badge.className = `badge ${classeBadgeStatus(status)}`;
    badge.textContent = status;
    celulaStatus.appendChild(badge);

    const celulaAcoes = document.createElement('td');
    celulaAcoes.className = 'text-nowrap';

    // Disponivel mesmo para vinculo encerrado - o resultado de uma
    // avaliacao ja finalizada e um registro permanente, independente do
    // vinculo continuar vigente ou nao.
    const avaliacaoFinalizada = avaliacoesFinalizadasPorVinculo[vinculo.id_vinculo];
    if (avaliacaoFinalizada) {
        const linkVerResultado = document.createElement('a');
        linkVerResultado.className = 'btn btn-sm btn-outline-primary me-1';
        linkVerResultado.href = `resultado.html?id_avaliacao=${avaliacaoFinalizada.id_avaliacao}`;
        linkVerResultado.setAttribute('aria-label', 'Ver resultado da avaliação');
        linkVerResultado.title = 'Ver resultado da avaliação';
        linkVerResultado.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        celulaAcoes.appendChild(linkVerResultado);
    }

    // Vinculo encerrado e historico: nao oferece edicao nem reencerramento
    // (preserva a integridade do registro passado). Acoes compactas
    // (somente icone) em vez de botoes grandes de texto.
    if (!vinculo.data_fim) {
        const botaoEditar = document.createElement('button');
        botaoEditar.type = 'button';
        botaoEditar.className = 'btn btn-sm btn-outline-secondary me-1';
        botaoEditar.dataset.acao = 'editar';
        botaoEditar.dataset.id = vinculo.id_vinculo;
        botaoEditar.setAttribute('aria-label', 'Editar vínculo');
        botaoEditar.title = 'Editar vínculo';
        botaoEditar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';

        const botaoEncerrar = document.createElement('button');
        botaoEncerrar.type = 'button';
        botaoEncerrar.className = 'btn btn-sm btn-outline-danger';
        botaoEncerrar.dataset.acao = 'encerrar';
        botaoEncerrar.dataset.id = vinculo.id_vinculo;
        botaoEncerrar.setAttribute('aria-label', 'Encerrar vínculo');
        botaoEncerrar.title = 'Encerrar vínculo';
        botaoEncerrar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"></path></svg>';

        // Leva o vinculo desta linha (nao so o colaborador) ja pre-selecionado
        // para a AVA-01 - ver js/pages/nova-avaliacao.js.
        const linkNovaAvaliacao = document.createElement('a');
        linkNovaAvaliacao.className = 'btn btn-sm btn-outline-secondary me-1';
        linkNovaAvaliacao.href = `nova-avaliacao.html?id_colaborador=${idColaborador}&id_vinculo=${vinculo.id_vinculo}`;
        linkNovaAvaliacao.setAttribute('aria-label', 'Nova avaliação com este vínculo');
        linkNovaAvaliacao.title = 'Nova avaliação com este vínculo';
        linkNovaAvaliacao.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5h6a1 1 0 011 1V6H8v-.5a1 1 0 011-1z"></path><rect x="5" y="6" width="14" height="15" rx="2"></rect><path d="M9 13l2 2 4-4.5"></path></svg>';

        celulaAcoes.append(linkNovaAvaliacao, botaoEditar, botaoEncerrar);
    }

    linha.append(celulaSetor, celulaCargo, celulaInicio, celulaFim, celulaPrincipal, celulaStatus, celulaAcoes);
    return linha;
}

// --- Acoes da tabela (delegacao de evento) ---------------------------------
corpoTabela.addEventListener('click', (event) => {
    const botao = event.target.closest('button[data-acao]');
    if (!botao) {
        return;
    }

    const id = Number(botao.dataset.id);
    if (botao.dataset.acao === 'editar') {
        abrirFormularioEdicao(id);
    } else if (botao.dataset.acao === 'encerrar') {
        abrirModalEncerrar(id);
    }
});

// --- Catalogos (setor/cargo) - somente leitura, apenas registros ativos ---
function preencherSelect(select, itens, chaveId) {
    itens.forEach((item) => {
        const opcao = document.createElement('option');
        opcao.value = item[chaveId];
        opcao.textContent = item.nome;
        select.appendChild(opcao);
    });
}

async function carregarOpcoesSelects() {
    try {
        const [setores, cargos] = await Promise.all([listarSetores(), listarCargos()]);
        preencherSelect(campoSetor, setores, 'id_setor');
        preencherSelect(campoCargo, cargos, 'id_cargo');
    } catch (error) {
        console.error('Erro ao carregar setores/cargos:', error);
        mostrarNotificacao('Não foi possível carregar setores e cargos.', 'erro');
    }
}

// --- Modal de novo/edicao de vinculo ---------------------------------------
const CAMPOS_FORMULARIO_VINCULO = [
    [campoSetor, 'erro-setor'],
    [campoCargo, 'erro-cargo'],
    [campoDataInicio, 'erro-data-inicio'],
];

function limparErrosFormularioVinculo() {
    CAMPOS_FORMULARIO_VINCULO.forEach(([campo, idErro]) => {
        campo.classList.remove('is-invalid');
        document.getElementById(idErro).textContent = '';
    });
}

function definirErroCampoVinculo(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacao() {
    formularioVinculo.reset();
    campoIdVinculo.value = '';
    limparErrosFormularioVinculo();
    tituloModalFormulario.textContent = 'Novo vínculo';
    instanciaModalFormulario.show();
    campoSetor.focus();
}

async function abrirFormularioEdicao(id) {
    try {
        const vinculo = await buscarVinculoPorId(id);
        formularioVinculo.reset();
        limparErrosFormularioVinculo();
        campoIdVinculo.value = vinculo.id_vinculo;
        campoSetor.value = vinculo.id_setor;
        campoCargo.value = vinculo.id_cargo;
        campoDataInicio.value = vinculo.data_inicio;
        campoPrincipal.checked = vinculo.principal;
        tituloModalFormulario.textContent = 'Editar vínculo';
        instanciaModalFormulario.show();
        campoSetor.focus();
    } catch (error) {
        console.error('Erro ao carregar vínculo para edição:', error);
        mostrarNotificacao('Não foi possível carregar os dados do vínculo.', 'erro');
    }
}

function fecharFormularioVinculo() {
    instanciaModalFormulario.hide();
}

function validarFormularioVinculo() {
    limparErrosFormularioVinculo();
    let valido = true;

    const idSetor = campoSetor.value;
    const idCargo = campoCargo.value;
    const dataInicio = campoDataInicio.value;
    const principal = campoPrincipal.checked;

    if (!campoPreenchido(idSetor)) {
        definirErroCampoVinculo(campoSetor, 'erro-setor', 'Selecione o setor.');
        valido = false;
    }

    if (!campoPreenchido(idCargo)) {
        definirErroCampoVinculo(campoCargo, 'erro-cargo', 'Selecione o cargo.');
        valido = false;
    }

    if (!campoPreenchido(dataInicio)) {
        definirErroCampoVinculo(campoDataInicio, 'erro-data-inicio', 'Informe a data de início.');
        valido = false;
    } else if (!dataNaoFutura(dataInicio)) {
        definirErroCampoVinculo(campoDataInicio, 'erro-data-inicio', 'A data de início não pode ser futura.');
        valido = false;
    }

    if (!valido) {
        return { valido: false };
    }

    return {
        valido: true,
        dados: {
            id_colaborador: idColaborador,
            id_setor: Number(idSetor),
            id_cargo: Number(idCargo),
            data_inicio: dataInicio,
            principal,
        },
    };
}

formularioVinculo.addEventListener('submit', async (event) => {
    event.preventDefault();

    const resultado = validarFormularioVinculo();
    if (!resultado.valido) {
        return;
    }

    const idExistente = campoIdVinculo.value;
    const textoOriginal = botaoSalvarVinculo.textContent;
    botaoSalvarVinculo.disabled = true;
    botaoSalvarVinculo.textContent = 'Salvando...';

    try {
        if (idExistente) {
            await atualizarVinculo(Number(idExistente), resultado.dados);
            mostrarNotificacao('Vínculo atualizado com sucesso.', 'sucesso');
        } else {
            await criarVinculo(resultado.dados);
            mostrarNotificacao('Vínculo criado com sucesso.', 'sucesso');
        }

        fecharFormularioVinculo();
        await carregarVinculos();
    } catch (error) {
        console.error('Erro ao salvar vínculo:', error);
        mostrarNotificacao(mensagemErroAmigavelVinculo(error), 'erro');
    } finally {
        botaoSalvarVinculo.disabled = false;
        botaoSalvarVinculo.textContent = textoOriginal;
    }
});

// --- Modal de encerramento --------------------------------------------------
function dataHojeIso() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function abrirModalEncerrar(id) {
    campoIdVinculoEncerrar.value = id;
    campoDataFim.classList.remove('is-invalid');
    document.getElementById('erro-data-fim').textContent = '';
    campoDataFim.value = dataHojeIso();
    instanciaModalEncerrar.show();
}

function fecharModalEncerrar() {
    instanciaModalEncerrar.hide();
}

formularioEncerrar.addEventListener('submit', async (event) => {
    event.preventDefault();

    const dataFim = campoDataFim.value;
    campoDataFim.classList.remove('is-invalid');
    document.getElementById('erro-data-fim').textContent = '';

    if (!campoPreenchido(dataFim)) {
        campoDataFim.classList.add('is-invalid');
        document.getElementById('erro-data-fim').textContent = 'Informe a data de encerramento.';
        return;
    }

    const idVinculo = Number(campoIdVinculoEncerrar.value);
    const textoOriginal = botaoConfirmarEncerrar.textContent;
    botaoConfirmarEncerrar.disabled = true;
    botaoConfirmarEncerrar.textContent = 'Encerrando...';

    try {
        await encerrarVinculo(idVinculo, dataFim);
        mostrarNotificacao('Vínculo encerrado com sucesso.', 'sucesso');
        fecharModalEncerrar();
        await carregarVinculos();
    } catch (error) {
        console.error('Erro ao encerrar vínculo:', error);
        mostrarNotificacao(mensagemErroAmigavelVinculo(error), 'erro');
    } finally {
        botaoConfirmarEncerrar.disabled = false;
        botaoConfirmarEncerrar.textContent = textoOriginal;
    }
});

// --- Traducao de erros do Supabase/PostgreSQL e das regras de negocio -----
function mensagemErroAmigavelVinculo(error) {
    const codigo = error?.code;
    const mensagem = (error?.message || '').toLowerCase();

    if (codigo === 'PRINCIPAL_JA_EXISTE' || codigo === 'VINCULO_ENCERRADO' || codigo === 'DATA_FIM_INVALIDA') {
        return error.message;
    }

    if (codigo === '23505') {
        if (mensagem.includes('uq_colaborador_vinculo_principal_vigente')) {
            return 'Este colaborador já possui um vínculo principal ativo e vigente.';
        }
        return 'Já existe um vínculo com esses mesmos dados para este colaborador.';
    }

    if (codigo === '23503') {
        return 'Não foi possível localizar o setor ou cargo selecionado.';
    }

    if (codigo === '23514') {
        return 'Verifique as datas informadas.';
    }

    if (mensagem.includes('permission denied') || mensagem.includes('policy') || mensagem.includes('rls')) {
        return 'Sem permissão para realizar esta operação. Verifique as políticas de acesso do Supabase.';
    }

    return 'Não foi possível salvar o vínculo. Tente novamente.';
}

// --- Abertura dos modais (fechamento fica a cargo do Bootstrap, via
// data-bs-dismiss="modal" nos botoes de fechar/cancelar) --------------------
document.getElementById('botao-novo-vinculo').addEventListener('click', abrirFormularioCriacao);

// --- Carga inicial -----------------------------------------------------------
carregarPagina();
