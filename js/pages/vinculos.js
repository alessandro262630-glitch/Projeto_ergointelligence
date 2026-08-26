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
import { buscarColaboradorPorId } from '../services/colaboradorService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido, dataNaoFutura } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';
import { iniciarSidebar } from '../utils/sidebar.js';

iniciarSidebar();

// --- Contexto: id_colaborador vem da URL, nunca solicitado novamente ao
// usuario (ver vinculos.html?id_colaborador=...) -------------------------
const parametros = new URLSearchParams(window.location.search);
const idColaborador = Number(parametros.get('id_colaborador'));

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

// --- Estado local da pagina ------------------------------------------------
let vinculos = [];

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
    areaEstado.classList.toggle('estado--erro', tipo === 'erro');
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
        mensagem.className = 'conteudo__descricao';
        mensagem.textContent = 'Nenhum vínculo principal vigente no momento.';
        areaVinculoAtual.appendChild(mensagem);
        return;
    }

    const lista = document.createElement('dl');
    lista.className = 'vinculos__atual';

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
        item.className = 'vinculos__atual-item';
        const dt = document.createElement('dt');
        dt.textContent = rotulo;
        const dd = document.createElement('dd');

        if (rotulo === 'Status') {
            const badge = document.createElement('span');
            badge.className = 'badge badge--ativo';
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
        return 'badge--ativo';
    }
    if (status === 'Encerrado') {
        return 'badge--inativo';
    }
    return 'badge--vinculo-inativo';
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
    celulaAcoes.className = 'tabela__acoes';

    // Vinculo encerrado e historico: nao oferece edicao nem reencerramento
    // (preserva a integridade do registro passado). Acoes compactas
    // (somente icone) em vez de botoes grandes de texto.
    if (!vinculo.data_fim) {
        const botaoEditar = document.createElement('button');
        botaoEditar.type = 'button';
        botaoEditar.className = 'botao-icone';
        botaoEditar.dataset.acao = 'editar';
        botaoEditar.dataset.id = vinculo.id_vinculo;
        botaoEditar.setAttribute('aria-label', 'Editar vínculo');
        botaoEditar.title = 'Editar vínculo';
        botaoEditar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';

        const botaoEncerrar = document.createElement('button');
        botaoEncerrar.type = 'button';
        botaoEncerrar.className = 'botao-icone botao-icone--perigo';
        botaoEncerrar.dataset.acao = 'encerrar';
        botaoEncerrar.dataset.id = vinculo.id_vinculo;
        botaoEncerrar.setAttribute('aria-label', 'Encerrar vínculo');
        botaoEncerrar.title = 'Encerrar vínculo';
        botaoEncerrar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"></path></svg>';

        celulaAcoes.append(botaoEditar, botaoEncerrar);
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
function limparErrosFormularioVinculo() {
    document.getElementById('erro-setor').textContent = '';
    document.getElementById('erro-cargo').textContent = '';
    document.getElementById('erro-data-inicio').textContent = '';
}

function abrirFormularioCriacao() {
    formularioVinculo.reset();
    campoIdVinculo.value = '';
    limparErrosFormularioVinculo();
    tituloModalFormulario.textContent = 'Novo vínculo';
    modalFormulario.hidden = false;
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
        modalFormulario.hidden = false;
        campoSetor.focus();
    } catch (error) {
        console.error('Erro ao carregar vínculo para edição:', error);
        mostrarNotificacao('Não foi possível carregar os dados do vínculo.', 'erro');
    }
}

function fecharFormularioVinculo() {
    modalFormulario.hidden = true;
}

function validarFormularioVinculo() {
    limparErrosFormularioVinculo();
    let valido = true;

    const idSetor = campoSetor.value;
    const idCargo = campoCargo.value;
    const dataInicio = campoDataInicio.value;
    const principal = campoPrincipal.checked;

    if (!campoPreenchido(idSetor)) {
        document.getElementById('erro-setor').textContent = 'Selecione o setor.';
        valido = false;
    }

    if (!campoPreenchido(idCargo)) {
        document.getElementById('erro-cargo').textContent = 'Selecione o cargo.';
        valido = false;
    }

    if (!campoPreenchido(dataInicio)) {
        document.getElementById('erro-data-inicio').textContent = 'Informe a data de início.';
        valido = false;
    } else if (!dataNaoFutura(dataInicio)) {
        document.getElementById('erro-data-inicio').textContent = 'A data de início não pode ser futura.';
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
    document.getElementById('erro-data-fim').textContent = '';
    campoDataFim.value = dataHojeIso();
    modalEncerrar.hidden = false;
}

function fecharModalEncerrar() {
    modalEncerrar.hidden = true;
}

formularioEncerrar.addEventListener('submit', async (event) => {
    event.preventDefault();

    const dataFim = campoDataFim.value;
    document.getElementById('erro-data-fim').textContent = '';

    if (!campoPreenchido(dataFim)) {
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

// --- Abertura/fechamento dos modais -----------------------------------------
document.getElementById('botao-novo-vinculo').addEventListener('click', abrirFormularioCriacao);
document.getElementById('botao-fechar-formulario').addEventListener('click', fecharFormularioVinculo);
document.getElementById('botao-cancelar-formulario').addEventListener('click', fecharFormularioVinculo);
document.getElementById('botao-fechar-encerrar').addEventListener('click', fecharModalEncerrar);
document.getElementById('botao-cancelar-encerrar').addEventListener('click', fecharModalEncerrar);

modalFormulario.addEventListener('click', (event) => {
    if (event.target === modalFormulario) {
        fecharFormularioVinculo();
    }
});

modalEncerrar.addEventListener('click', (event) => {
    if (event.target === modalEncerrar) {
        fecharModalEncerrar();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
        return;
    }
    if (!modalFormulario.hidden) {
        fecharFormularioVinculo();
    }
    if (!modalEncerrar.hidden) {
        fecharModalEncerrar();
    }
});

// --- Carga inicial -----------------------------------------------------------
carregarPagina();
