import { criarAvaliacao, obterAvaliadorPadrao } from '../services/avaliacaoService.js';
import { listarColaboradores } from '../services/colaboradorService.js';
import { listarVinculosPorColaborador, listarFuncoesPorVinculo } from '../services/vinculoService.js';
import { listarAmbientesPorSetor, listarPostosPorAmbiente } from '../services/ambienteService.js';
import { listarPerfisPorColaborador } from '../services/perfilAntropometricoService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// AVA-01 - Criar nova avaliacao ergonomica.
// Esta pagina so registra o contexto inicial (RASCUNHO ou EM_ANDAMENTO).
// Questionario, calculo de risco e recomendacoes ficam para as proximas
// features (ver js/services/avaliacaoService.js).

// --- Referencias de DOM ----------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const formulario = document.getElementById('formulario-avaliacao');
const areaNotificacoes = document.getElementById('area-notificacoes');

const campoColaborador = document.getElementById('campo-colaborador');
const campoVinculo = document.getElementById('campo-vinculo');
const campoFuncao = document.getElementById('campo-funcao');
const campoPerfil = document.getElementById('campo-perfil');
const campoAmbiente = document.getElementById('campo-ambiente');
const campoPosto = document.getElementById('campo-posto');
const campoTipoAvaliacao = document.getElementById('campo-tipo-avaliacao');
const campoDataAvaliacao = document.getElementById('campo-data-avaliacao');
const campoAvaliador = document.getElementById('campo-avaliador');
const campoObservacoes = document.getElementById('campo-observacoes');

const botaoSalvarRascunho = document.getElementById('botao-salvar-rascunho');
const botaoIniciarAvaliacao = document.getElementById('botao-iniciar-avaliacao');

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

// --- Contexto opcional vindo de outra pagina (colaboradores.html /
// vinculos.html), no mesmo padrao de URL usado por vinculos.html?id_colaborador
// - permite chegar aqui com o colaborador (e opcionalmente o vinculo) ja
// pre-selecionados, sem duplicar a escolha que o usuario acabou de fazer. ---
const parametrosUrl = new URLSearchParams(window.location.search);
const idColaboradorPreSelecionado = Number(parametrosUrl.get('id_colaborador')) || null;
const idVinculoPreSelecionado = Number(parametrosUrl.get('id_vinculo')) || null;

// --- Estado local da pagina --------------------------------------------------
let colaboradores = [];
let vinculosDoColaborador = [];
let idAvaliadorAtual = null;

// --- Estados de carregamento / erro / formulario pronto ---------------------
function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        formulario.hidden = false;
        return;
    }

    formulario.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    if (tipo === 'carregando') {
        marcarComoCarregando(areaEstado, mensagem);
    } else {
        areaEstado.textContent = mensagem;
    }
}

// --- Carga inicial: apenas os colaboradores ativos (o restante do contexto
// e resolvido em cascata a partir da selecao do colaborador/vinculo) --------
async function carregarPagina() {
    definirEstado('carregando', 'Carregando dados da avaliação...');
    try {
        colaboradores = (await listarColaboradores()).filter((colaborador) => colaborador.ativo);
        preencherSelectColaboradores();
        definirEstado('pronto');
        inicializarDataAvaliacao();
        await aplicarContextoDaUrl();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais da avaliação:', error);
        definirEstado('erro', 'Não foi possível carregar os dados necessários.');
    }
}

// Preenche colaborador (e, se possivel, vinculo) a partir dos parametros da
// URL - usado pelos links "Nova avaliação" em colaboradores.html/vinculos.html.
// Falha em encontrar o registro nao e um erro bloqueante: o usuario ainda
// pode escolher manualmente pelos selects.
async function aplicarContextoDaUrl() {
    if (!idColaboradorPreSelecionado) {
        return;
    }

    const colaboradorExiste = colaboradores.some(
        (item) => item.id_colaborador === idColaboradorPreSelecionado,
    );
    if (!colaboradorExiste) {
        mostrarNotificacao('Colaborador informado não encontrado ou inativo.', 'erro');
        return;
    }

    campoColaborador.value = String(idColaboradorPreSelecionado);
    await aoMudarColaborador();

    if (idVinculoPreSelecionado) {
        const vinculoExiste = vinculosDoColaborador.some(
            (item) => item.id_vinculo === idVinculoPreSelecionado,
        );
        if (vinculoExiste) {
            campoVinculo.value = String(idVinculoPreSelecionado);
            await aoMudarVinculo();
        } else {
            mostrarNotificacao('Vínculo informado não encontrado para este colaborador.', 'erro');
        }
    }
}

function preencherSelectColaboradores() {
    colaboradores.forEach((colaborador) => {
        const opcao = document.createElement('option');
        opcao.value = colaborador.id_colaborador;
        opcao.textContent = `${colaborador.nome} (${colaborador.matricula})`;
        campoColaborador.appendChild(opcao);
    });
}

// Data/hora atual, no formato aceito por <input type="datetime-local">
// (fuso horario local do navegador, sem segundos).
function inicializarDataAvaliacao() {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    campoDataAvaliacao.value = agora.toISOString().slice(0, 16);
}

// --- Utilitario comum de selects dependentes ---------------------------------
function reiniciarSelect(select, textoPlaceholder, desabilitado) {
    select.innerHTML = '';
    const opcaoPlaceholder = document.createElement('option');
    opcaoPlaceholder.value = '';
    opcaoPlaceholder.textContent = textoPlaceholder;
    select.appendChild(opcaoPlaceholder);
    select.disabled = desabilitado;
    select.value = '';
}

// --- Cascata: colaborador -> vinculo, funcao (via vinculo), perfil, avaliador
// Funcao nomeada (em vez de closure anonima) para poder ser chamada tanto
// pelo evento "change" quanto pela pre-selecao vinda da URL (ver
// aplicarContextoDaUrl), mantendo as duas rotas de entrada em um so lugar.
async function aoMudarColaborador() {
    reiniciarSelect(campoVinculo, 'Selecione o vínculo primeiro...', true);
    reiniciarSelect(campoFuncao, 'Selecione o vínculo primeiro...', true);
    reiniciarSelect(campoPerfil, 'Selecione o colaborador primeiro...', true);
    reiniciarSelect(campoAmbiente, 'Selecione o vínculo primeiro...', true);
    reiniciarSelect(campoPosto, 'Selecione o ambiente primeiro...', true);
    limparAvaliador();

    const idColaborador = Number(campoColaborador.value);
    if (!idColaborador) {
        vinculosDoColaborador = [];
        return;
    }

    const colaborador = colaboradores.find((item) => item.id_colaborador === idColaborador);

    try {
        const [vinculos, perfis, avaliador] = await Promise.all([
            listarVinculosPorColaborador(idColaborador),
            listarPerfisPorColaborador(idColaborador),
            obterAvaliadorPadrao(colaborador.id_empresa),
        ]);

        vinculosDoColaborador = vinculos;
        preencherSelectVinculos(vinculos);
        preencherSelectPerfis(perfis);
        definirAvaliador(avaliador);
    } catch (error) {
        console.error('Erro ao carregar vínculos/perfis do colaborador:', error);
        mostrarNotificacao('Não foi possível carregar os dados do colaborador selecionado.', 'erro');
    }
}

campoColaborador.addEventListener('change', aoMudarColaborador);

function preencherSelectVinculos(vinculos) {
    reiniciarSelect(campoVinculo, 'Selecione...', vinculos.length === 0);
    vinculos.forEach((vinculo) => {
        const opcao = document.createElement('option');
        opcao.value = vinculo.id_vinculo;
        const situacao = vinculo.data_fim ? ' (encerrado)' : '';
        opcao.textContent = `${vinculo.setor || '-'} · ${vinculo.cargo || '-'}${situacao}`;
        campoVinculo.appendChild(opcao);
    });
    if (vinculos.length === 0) {
        campoVinculo.firstElementChild.textContent = 'Nenhum vínculo cadastrado';
    }
}

function preencherSelectPerfis(perfis) {
    reiniciarSelect(campoPerfil, 'Nenhum', false);
    perfis.forEach((perfil) => {
        const opcao = document.createElement('option');
        opcao.value = perfil.id_perfil_antropometrico;
        const altura = perfil.altura_cm != null ? `${perfil.altura_cm} cm` : '-';
        const peso = perfil.peso_kg != null ? `${perfil.peso_kg} kg` : '-';
        opcao.textContent = `${formatarDataBR(perfil.data_medicao)} · ${altura} · ${peso} · ${perfil.origem}`;
        campoPerfil.appendChild(opcao);
    });
}

function definirAvaliador(avaliador) {
    if (!avaliador) {
        idAvaliadorAtual = null;
        campoAvaliador.value = '';
        campoAvaliador.classList.add('is-invalid');
        document.getElementById('erro-avaliador').textContent =
            'Nenhum avaliador ativo cadastrado para a empresa deste colaborador.';
        return;
    }

    idAvaliadorAtual = avaliador.id_usuario;
    campoAvaliador.value = avaliador.nome;
    campoAvaliador.classList.remove('is-invalid');
    document.getElementById('erro-avaliador').textContent = '';
}

function limparAvaliador() {
    idAvaliadorAtual = null;
    campoAvaliador.value = '';
    campoAvaliador.classList.remove('is-invalid');
    document.getElementById('erro-avaliador').textContent = '';
}

// --- Cascata: vinculo -> funcao, ambiente ------------------------------------
async function aoMudarVinculo() {
    reiniciarSelect(campoFuncao, 'Nenhuma', true);
    reiniciarSelect(campoAmbiente, 'Selecione...', true);
    reiniciarSelect(campoPosto, 'Selecione o ambiente primeiro...', true);

    const idVinculo = Number(campoVinculo.value);
    if (!idVinculo) {
        return;
    }

    const vinculo = vinculosDoColaborador.find((item) => item.id_vinculo === idVinculo);

    try {
        const [funcoes, ambientes] = await Promise.all([
            listarFuncoesPorVinculo(idVinculo),
            listarAmbientesPorSetor(vinculo.id_setor),
        ]);

        reiniciarSelect(campoFuncao, 'Nenhuma', false);
        funcoes.forEach((funcao) => {
            const opcao = document.createElement('option');
            opcao.value = funcao.id_vinculo_funcao;
            opcao.textContent = funcao.nome + (funcao.principal ? ' (principal)' : '');
            campoFuncao.appendChild(opcao);
        });

        reiniciarSelect(campoAmbiente, 'Selecione...', ambientes.length === 0);
        ambientes.forEach((ambiente) => {
            const opcao = document.createElement('option');
            opcao.value = ambiente.id_ambiente;
            opcao.textContent = ambiente.nome;
            campoAmbiente.appendChild(opcao);
        });
        if (ambientes.length === 0) {
            campoAmbiente.firstElementChild.textContent = 'Nenhum ambiente cadastrado para este setor';
        }
    } catch (error) {
        console.error('Erro ao carregar funções/ambientes do vínculo:', error);
        mostrarNotificacao('Não foi possível carregar os dados do vínculo selecionado.', 'erro');
    }
}

campoVinculo.addEventListener('change', aoMudarVinculo);

// --- Cascata: ambiente -> posto -----------------------------------------------
campoAmbiente.addEventListener('change', async () => {
    reiniciarSelect(campoPosto, 'Nenhum', true);

    const idAmbiente = Number(campoAmbiente.value);
    if (!idAmbiente) {
        return;
    }

    try {
        const postos = await listarPostosPorAmbiente(idAmbiente);
        reiniciarSelect(campoPosto, 'Nenhum', false);
        postos.forEach((posto) => {
            const opcao = document.createElement('option');
            opcao.value = posto.id_posto;
            opcao.textContent = posto.nome;
            campoPosto.appendChild(opcao);
        });
    } catch (error) {
        console.error('Erro ao carregar postos do ambiente:', error);
        mostrarNotificacao('Não foi possível carregar os postos do ambiente selecionado.', 'erro');
    }
});

// --- Validacao do formulario ---------------------------------------------------
const CAMPOS_OBRIGATORIOS = [
    [campoColaborador, 'erro-colaborador', 'Selecione o colaborador.'],
    [campoVinculo, 'erro-vinculo', 'Selecione o vínculo.'],
    [campoAmbiente, 'erro-ambiente', 'Selecione o ambiente.'],
    [campoTipoAvaliacao, 'erro-tipo-avaliacao', 'Selecione o tipo de avaliação.'],
];

function limparErrosFormulario() {
    CAMPOS_OBRIGATORIOS.forEach(([campo, idErro]) => {
        campo.classList.remove('is-invalid');
        document.getElementById(idErro).textContent = '';
    });
    campoDataAvaliacao.classList.remove('is-invalid');
    document.getElementById('erro-data-avaliacao').textContent = '';
}

function validarFormulario() {
    limparErrosFormulario();
    let valido = true;

    CAMPOS_OBRIGATORIOS.forEach(([campo, idErro, mensagem]) => {
        if (!campoPreenchido(campo.value)) {
            campo.classList.add('is-invalid');
            document.getElementById(idErro).textContent = mensagem;
            valido = false;
        }
    });

    if (!campoPreenchido(campoDataAvaliacao.value)) {
        campoDataAvaliacao.classList.add('is-invalid');
        document.getElementById('erro-data-avaliacao').textContent = 'Informe a data da avaliação.';
        valido = false;
    }

    if (!idAvaliadorAtual) {
        valido = false;
    }

    if (!valido) {
        return { valido: false };
    }

    const idColaborador = Number(campoColaborador.value);
    const colaborador = colaboradores.find((item) => item.id_colaborador === idColaborador);

    return {
        valido: true,
        dados: {
            id_empresa: colaborador.id_empresa,
            id_vinculo: Number(campoVinculo.value),
            id_vinculo_funcao: campoFuncao.value ? Number(campoFuncao.value) : null,
            id_ambiente: Number(campoAmbiente.value),
            id_posto: campoPosto.value ? Number(campoPosto.value) : null,
            id_perfil_antropometrico: campoPerfil.value ? Number(campoPerfil.value) : null,
            id_avaliador: idAvaliadorAtual,
            tipo_avaliacao: campoTipoAvaliacao.value,
            data_avaliacao: new Date(campoDataAvaliacao.value).toISOString(),
            observacoes: campoObservacoes.value.trim() || null,
        },
    };
}

// --- Reset do formulario apos salvar como rascunho (permite lancar outra) ---
function reiniciarFormularioParaNovaAvaliacao() {
    formulario.reset();
    limparErrosFormulario();
    reiniciarSelect(campoVinculo, 'Selecione o colaborador primeiro...', true);
    reiniciarSelect(campoFuncao, 'Selecione o vínculo primeiro...', true);
    reiniciarSelect(campoPerfil, 'Selecione o colaborador primeiro...', true);
    reiniciarSelect(campoAmbiente, 'Selecione o vínculo primeiro...', true);
    reiniciarSelect(campoPosto, 'Selecione o ambiente primeiro...', true);
    limparAvaliador();
    inicializarDataAvaliacao();
    campoColaborador.focus();
}

// --- Envio: Salvar rascunho / Iniciar avaliacao --------------------------------
// Os dois botoes sao desabilitados juntos durante a requisicao para nunca
// permitir dois INSERTs por duplo clique (mesmo clicando no outro botao).
async function salvarAvaliacao(status, botaoAcionado) {
    const resultado = validarFormulario();
    if (!resultado.valido) {
        return;
    }

    const textoOriginal = botaoAcionado.textContent;
    botaoSalvarRascunho.disabled = true;
    botaoIniciarAvaliacao.disabled = true;
    botaoAcionado.textContent = 'Salvando avaliação...';

    try {
        const avaliacao = await criarAvaliacao({ ...resultado.dados, status });

        if (status === 'RASCUNHO') {
            mostrarNotificacao('Avaliação salva como rascunho.', 'sucesso');
            reiniciarFormularioParaNovaAvaliacao();
            botaoSalvarRascunho.disabled = false;
            botaoIniciarAvaliacao.disabled = false;
            botaoAcionado.textContent = textoOriginal;
            return;
        }

        mostrarNotificacao('Avaliação criada com sucesso.', 'sucesso');
        // Proxima etapa do fluxo: AVA-02 (contexto-avaliacao.html), que
        // carrega esta mesma avaliacao pelo id e completa funcao/ambiente/
        // posto/perfil/atividades antes do questionario.
        window.setTimeout(() => {
            window.location.href = `contexto-avaliacao.html?id_avaliacao=${avaliacao.id_avaliacao}`;
        }, 900);
    } catch (error) {
        console.error('Erro ao salvar avaliação:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
        botaoSalvarRascunho.disabled = false;
        botaoIniciarAvaliacao.disabled = false;
        botaoAcionado.textContent = textoOriginal;
    }
}

botaoSalvarRascunho.addEventListener('click', () => salvarAvaliacao('RASCUNHO', botaoSalvarRascunho));
botaoIniciarAvaliacao.addEventListener('click', () => salvarAvaliacao('EM_ANDAMENTO', botaoIniciarAvaliacao));

// --- Traducao de erros do Supabase/PostgreSQL e das regras de negocio -------
const CODIGOS_ERRO_NEGOCIO = [
    'VINCULO_OBRIGATORIO',
    'EMPRESA_OBRIGATORIA',
    'AMBIENTE_OBRIGATORIO',
    'AVALIADOR_OBRIGATORIO',
    'TIPO_INVALIDO',
    'STATUS_INVALIDO',
    'DATA_OBRIGATORIA',
    'EMPRESA_INCOMPATIVEL',
    'AMBIENTE_INATIVO',
    'AMBIENTE_INCOMPATIVEL',
    'POSTO_INCOMPATIVEL',
    'FUNCAO_INCOMPATIVEL',
    'PERFIL_INCOMPATIVEL',
    'AVALIADOR_INVALIDO',
];

function mensagemErroAmigavel(error) {
    const codigo = error?.code;
    const mensagem = (error?.message || '').toLowerCase();

    if (CODIGOS_ERRO_NEGOCIO.includes(codigo)) {
        return error.message;
    }

    if (codigo === '23503') {
        return 'Não foi possível salvar: referência inválida no contexto selecionado.';
    }

    if (codigo === '23514') {
        return 'Verifique os dados informados na avaliação.';
    }

    if (mensagem.includes('permission denied') || mensagem.includes('policy') || mensagem.includes('rls')) {
        return 'Sem permissão para realizar esta operação. Verifique as políticas de acesso do Supabase.';
    }

    return 'Não foi possível salvar a avaliação. Tente novamente.';
}

// --- Popovers de ajuda ("Saiba mais") -------------------------------------------
document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => new bootstrap.Popover(el));

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
