import {
    buscarAvaliacaoPorId,
    atualizarContextoAvaliacao,
    listarFuncoesDoVinculo,
    listarAmbientesDoContexto,
    listarPostosPorAmbiente,
    listarPerfisDoColaborador,
    listarAtividades,
    listarAtividadesDaAvaliacao,
    adicionarAtividadeAvaliacao,
    atualizarAtividadeAvaliacao,
    removerAtividadeAvaliacao,
} from '../services/avaliacaoService.js';
import { buscarVinculoPorId, buscarFuncaoVinculoPorId } from '../services/vinculoService.js';
import { buscarColaboradorPorId } from '../services/colaboradorService.js';
import { buscarAmbientePorId, buscarPostoPorId } from '../services/ambienteService.js';
import { buscarPerfilPorId } from '../services/perfilAntropometricoService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// AVA-02 - Selecionar e completar o contexto da avaliacao.
// A avaliacao ja existe (criada pela AVA-01): esta pagina so LE por id e
// faz UPDATE em avaliacao_ergonomica/avaliacao_atividade, nunca INSERT em
// avaliacao_ergonomica (ver js/services/avaliacaoService.js).

// --- Identificacao da avaliacao, sempre via URL (mesmo padrao usado por
// vinculos.html?id_colaborador e nova-avaliacao.html?id_colaborador) -------
const parametrosUrl = new URLSearchParams(window.location.search);
const idAvaliacao = Number(parametrosUrl.get('id_avaliacao')) || null;

// --- Referencias de DOM ----------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const conteudoContexto = document.getElementById('conteudo-contexto');
const alertaSomenteLeitura = document.getElementById('alerta-somente-leitura');
const areaNotificacoes = document.getElementById('area-notificacoes');

const contextoColaboradorNome = document.getElementById('contexto-colaborador-nome');
const contextoColaboradorMatricula = document.getElementById('contexto-colaborador-matricula');
const contextoVinculoSetor = document.getElementById('contexto-vinculo-setor');
const contextoVinculoCargo = document.getElementById('contexto-vinculo-cargo');
const contextoVinculoInicio = document.getElementById('contexto-vinculo-inicio');
const contextoVinculoFim = document.getElementById('contexto-vinculo-fim');
const contextoVinculoStatus = document.getElementById('contexto-vinculo-status');

const campoFuncao = document.getElementById('campo-funcao');
const campoAmbiente = document.getElementById('campo-ambiente');
const campoPosto = document.getElementById('campo-posto');
const campoPerfil = document.getElementById('campo-perfil');
const campoObservacoes = document.getElementById('campo-observacoes');
const botaoSalvarContexto = document.getElementById('botao-salvar-contexto');
const botaoProximo = document.getElementById('botao-proximo');

const botaoNovaAtividade = document.getElementById('botao-nova-atividade');
const textoSemAtividades = document.getElementById('texto-sem-atividades');
const listaAtividadesEl = document.getElementById('lista-atividades');

const modalAtividadeEl = document.getElementById('modal-atividade');
const tituloModalAtividade = document.getElementById('modal-atividade-titulo');
const formularioAtividade = document.getElementById('formulario-atividade');
const campoIdAtividadeAssociacao = document.getElementById('campo-id-atividade-associacao');
const grupoCampoAtividade = document.getElementById('grupo-campo-atividade');
const campoAtividadeSelect = document.getElementById('campo-atividade-select');
const textoAtividadeFixa = document.getElementById('texto-atividade-fixa');
const campoPrincipalAtividade = document.getElementById('campo-principal-atividade');
const campoTempoExposicao = document.getElementById('campo-tempo-exposicao');
const campoFrequenciaDiaria = document.getElementById('campo-frequencia-diaria');
const campoObservacaoAtividade = document.getElementById('campo-observacao-atividade');
const botaoSalvarAtividade = document.getElementById('botao-salvar-atividade');

const instanciaModalAtividade = new bootstrap.Modal(modalAtividadeEl);

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

// --- Estado local da pagina --------------------------------------------------
let avaliacaoAtual = null;
let vinculoAtual = null;
let colaboradorAtual = null;
let somenteLeitura = false;
let catalogoAtividades = [];
let atividadesDaAvaliacao = [];

// --- Estados de carregamento / erro / conteudo pronto ------------------------
function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        conteudoContexto.hidden = false;
        return;
    }

    conteudoContexto.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    if (tipo === 'carregando') {
        marcarComoCarregando(areaEstado, mensagem);
    } else {
        areaEstado.textContent = mensagem;
    }
}

// Garante que uma referencia ja gravada na avaliacao (funcao/ambiente/
// posto/perfil) nunca desapareca do select so porque deixou de aparecer na
// lista "atual" (ex.: ambiente desativado, funcao encerrada depois que a
// avaliacao foi criada). Sem isso, salvar o formulario sem tocar naquele
// campo apagaria silenciosamente uma referencia valida.
async function garantirOpcaoAtual(lista, idAtual, buscarPorId, obterId) {
    if (idAtual === null || idAtual === undefined) {
        return lista;
    }
    if (lista.some((item) => obterId(item) === idAtual)) {
        return lista;
    }
    try {
        const item = await buscarPorId(idAtual);
        return [item, ...lista];
    } catch (error) {
        console.error('Erro ao recuperar referência atual do contexto:', error);
        return lista;
    }
}

// --- Carga inicial (secao 29 do prompt AVA-02) -------------------------------
async function carregarPagina() {
    if (!idAvaliacao) {
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    definirEstado('carregando', 'Carregando contexto da avaliação...');

    let avaliacao;
    try {
        avaliacao = await buscarAvaliacaoPorId(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    avaliacaoAtual = avaliacao;
    somenteLeitura = avaliacao.status === 'FINALIZADA' || avaliacao.status === 'CANCELADA';

    let vinculo;
    let colaborador;
    try {
        vinculo = await buscarVinculoPorId(avaliacao.id_vinculo);
        colaborador = await buscarColaboradorPorId(vinculo.id_colaborador);
    } catch (error) {
        console.error('Erro ao carregar vínculo/colaborador da avaliação:', error);
        definirEstado('erro', 'Não foi possível carregar o contexto da avaliação.');
        return;
    }
    vinculoAtual = vinculo;
    colaboradorAtual = colaborador;

    renderizarCabecalho();

    try {
        const [funcoesBase, ambientesBase, perfisBase, atividadesAssociadas] = await Promise.all([
            listarFuncoesDoVinculo(vinculo.id_vinculo),
            listarAmbientesDoContexto(vinculo.id_setor),
            listarPerfisDoColaborador(colaborador.id_colaborador),
            listarAtividadesDaAvaliacao(idAvaliacao),
        ]);

        const funcoes = await garantirOpcaoAtual(
            funcoesBase,
            avaliacao.id_vinculo_funcao,
            buscarFuncaoVinculoPorId,
            (item) => item.id_vinculo_funcao,
        );
        const ambientes = await garantirOpcaoAtual(
            ambientesBase,
            avaliacao.id_ambiente,
            buscarAmbientePorId,
            (item) => item.id_ambiente,
        );
        const perfis = await garantirOpcaoAtual(
            perfisBase,
            avaliacao.id_perfil_antropometrico,
            buscarPerfilPorId,
            (item) => item.id_perfil_antropometrico,
        );

        preencherSelectFuncao(funcoes, avaliacao.id_vinculo_funcao);
        preencherSelectAmbiente(ambientes, avaliacao.id_ambiente);
        preencherSelectPerfil(perfis, avaliacao.id_perfil_antropometrico);
        campoObservacoes.value = avaliacao.observacoes || '';

        if (avaliacao.id_ambiente) {
            const postosBase = await listarPostosPorAmbiente(avaliacao.id_ambiente);
            const postos = await garantirOpcaoAtual(
                postosBase,
                avaliacao.id_posto,
                buscarPostoPorId,
                (item) => item.id_posto,
            );
            preencherSelectPosto(postos, avaliacao.id_posto);
        }

        const funcaoAtual = funcoes.find((item) => item.id_vinculo_funcao === avaliacao.id_vinculo_funcao);
        catalogoAtividades = await listarAtividades({
            idEmpresa: avaliacao.id_empresa,
            idFuncao: funcaoAtual?.id_funcao ?? null,
        });
        atividadesDaAvaliacao = atividadesAssociadas;
        renderizarAtividades();

        aplicarModoSomenteLeitura();
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar contexto da avaliação:', error);
        definirEstado('erro', 'Não foi possível carregar o contexto da avaliação.');
    }
}

function renderizarCabecalho() {
    contextoColaboradorNome.textContent = colaboradorAtual.nome;
    contextoColaboradorMatricula.textContent = `Matrícula: ${colaboradorAtual.matricula}`;

    contextoVinculoSetor.textContent = vinculoAtual.setor || '-';
    contextoVinculoCargo.textContent = vinculoAtual.cargo || '-';
    contextoVinculoInicio.textContent = formatarDataBR(vinculoAtual.data_inicio);
    contextoVinculoFim.textContent = vinculoAtual.data_fim ? formatarDataBR(vinculoAtual.data_fim) : '-';
    contextoVinculoStatus.textContent = vinculoAtual.data_fim ? 'Encerrado' : 'Vigente';

    if (avaliacaoAtual.status === 'FINALIZADA') {
        alertaSomenteLeitura.hidden = false;
        alertaSomenteLeitura.textContent = 'Esta avaliação já foi finalizada e não pode ser alterada.';
    } else if (avaliacaoAtual.status === 'CANCELADA') {
        alertaSomenteLeitura.hidden = false;
        alertaSomenteLeitura.textContent = 'Esta avaliação foi cancelada e não pode ser alterada.';
    } else {
        alertaSomenteLeitura.hidden = true;
    }
}

function aplicarModoSomenteLeitura() {
    campoFuncao.disabled = somenteLeitura;
    campoAmbiente.disabled = somenteLeitura;
    campoPosto.disabled = somenteLeitura || !campoPosto.dataset.temOpcoes;
    campoPerfil.disabled = somenteLeitura;
    campoObservacoes.disabled = somenteLeitura;
    botaoSalvarContexto.hidden = somenteLeitura;
    botaoNovaAtividade.hidden = somenteLeitura;
    renderizarAtividades();
}

// --- Selects de contexto ------------------------------------------------------
function preencherSelectFuncao(funcoes, idSelecionado) {
    campoFuncao.innerHTML = '';
    const opcaoVazia = document.createElement('option');
    opcaoVazia.value = '';
    opcaoVazia.textContent = 'Nenhuma';
    campoFuncao.appendChild(opcaoVazia);

    funcoes.forEach((funcao) => {
        const opcao = document.createElement('option');
        opcao.value = funcao.id_vinculo_funcao;
        opcao.textContent = funcao.nome + (funcao.principal ? ' (principal)' : '');
        campoFuncao.appendChild(opcao);
    });

    campoFuncao.value = idSelecionado ? String(idSelecionado) : '';
}

function preencherSelectAmbiente(ambientes, idSelecionado) {
    campoAmbiente.innerHTML = '';
    const opcaoVazia = document.createElement('option');
    opcaoVazia.value = '';
    opcaoVazia.textContent = 'Selecione...';
    campoAmbiente.appendChild(opcaoVazia);

    ambientes.forEach((ambiente) => {
        const opcao = document.createElement('option');
        opcao.value = ambiente.id_ambiente;
        opcao.textContent = ambiente.nome;
        campoAmbiente.appendChild(opcao);
    });

    campoAmbiente.value = idSelecionado ? String(idSelecionado) : '';
}

function preencherSelectPosto(postos, idSelecionado) {
    campoPosto.innerHTML = '';
    const opcaoVazia = document.createElement('option');
    opcaoVazia.value = '';
    opcaoVazia.textContent = 'Nenhum';
    campoPosto.appendChild(opcaoVazia);

    postos.forEach((posto) => {
        const opcao = document.createElement('option');
        opcao.value = posto.id_posto;
        opcao.textContent = posto.nome;
        campoPosto.appendChild(opcao);
    });

    campoPosto.value = idSelecionado ? String(idSelecionado) : '';
    campoPosto.disabled = somenteLeitura;
    campoPosto.dataset.temOpcoes = 'true';
}

function preencherSelectPerfil(perfis, idSelecionado) {
    campoPerfil.innerHTML = '';
    const opcaoVazia = document.createElement('option');
    opcaoVazia.value = '';
    opcaoVazia.textContent = 'Nenhum';
    campoPerfil.appendChild(opcaoVazia);

    perfis.forEach((perfil) => {
        const opcao = document.createElement('option');
        opcao.value = perfil.id_perfil_antropometrico;
        const altura = perfil.altura_cm != null ? `${perfil.altura_cm} cm` : '-';
        const peso = perfil.peso_kg != null ? `${perfil.peso_kg} kg` : '-';
        opcao.textContent = `${formatarDataBR(perfil.data_medicao)} · ${altura} · ${peso} · ${perfil.origem}`;
        campoPerfil.appendChild(opcao);
    });

    campoPerfil.value = idSelecionado ? String(idSelecionado) : '';
}

// --- Cascata: ambiente -> posto (so roda enquanto editavel) ------------------
campoAmbiente.addEventListener('change', async () => {
    if (somenteLeitura) {
        return;
    }

    const idAmbiente = Number(campoAmbiente.value);
    if (!idAmbiente) {
        preencherSelectPosto([], null);
        campoPosto.disabled = true;
        return;
    }

    try {
        const postos = await listarPostosPorAmbiente(idAmbiente);
        preencherSelectPosto(postos, null);
    } catch (error) {
        console.error('Erro ao carregar postos do ambiente:', error);
        mostrarNotificacao('Não foi possível carregar os postos do ambiente selecionado.', 'erro');
    }
});

// Reordena o catalogo de atividades sugerido quando a funcao muda (secao 28:
// prioriza as atividades da funcao, sem nunca restringir as demais).
campoFuncao.addEventListener('change', async () => {
    if (somenteLeitura) {
        return;
    }

    const idVinculoFuncao = Number(campoFuncao.value) || null;
    let idFuncao = null;
    if (idVinculoFuncao) {
        try {
            const funcao = await buscarFuncaoVinculoPorId(idVinculoFuncao);
            idFuncao = funcao.id_funcao;
        } catch (error) {
            console.error('Erro ao identificar a função selecionada:', error);
        }
    }

    try {
        catalogoAtividades = await listarAtividades({ idEmpresa: avaliacaoAtual.id_empresa, idFuncao });
    } catch (error) {
        console.error('Erro ao atualizar catálogo de atividades:', error);
    }
});

// --- Salvar contexto (secao 25: "SALVAR CONTEXTO") --------------------------
function limparErroAmbiente() {
    campoAmbiente.classList.remove('is-invalid');
    document.getElementById('erro-ambiente').textContent = '';
}

async function salvarContexto() {
    if (somenteLeitura) {
        return null;
    }

    limparErroAmbiente();
    if (!campoAmbiente.value) {
        campoAmbiente.classList.add('is-invalid');
        document.getElementById('erro-ambiente').textContent = 'Selecione o ambiente.';
        return null;
    }

    const dados = {
        id_vinculo_funcao: campoFuncao.value ? Number(campoFuncao.value) : null,
        id_ambiente: Number(campoAmbiente.value),
        id_posto: campoPosto.value ? Number(campoPosto.value) : null,
        id_perfil_antropometrico: campoPerfil.value ? Number(campoPerfil.value) : null,
        observacoes: campoObservacoes.value.trim() || null,
    };

    const textoOriginal = botaoSalvarContexto.textContent;
    botaoSalvarContexto.disabled = true;
    botaoSalvarContexto.textContent = 'Salvando contexto...';

    try {
        avaliacaoAtual = await atualizarContextoAvaliacao(idAvaliacao, dados);
        mostrarNotificacao('Contexto da avaliação salvo com sucesso.', 'sucesso');
        return avaliacaoAtual;
    } catch (error) {
        console.error('Erro ao salvar contexto da avaliação:', error);
        mostrarNotificacao(mensagemErroAmigavelContexto(error), 'erro');
        return null;
    } finally {
        botaoSalvarContexto.disabled = false;
        botaoSalvarContexto.textContent = textoOriginal;
    }
}

botaoSalvarContexto.addEventListener('click', salvarContexto);

// --- Proximo: salva o contexto, exige ao menos uma atividade e prepara a
// navegacao para o questionario (ainda nao implementado - secao 25) --------
botaoProximo.addEventListener('click', async () => {
    if (somenteLeitura) {
        window.location.href = `questionario.html?id_avaliacao=${idAvaliacao}`;
        return;
    }

    botaoProximo.disabled = true;
    const resultado = await salvarContexto();
    botaoProximo.disabled = false;

    if (!resultado) {
        return;
    }

    if (atividadesDaAvaliacao.length === 0) {
        mostrarNotificacao('Adicione pelo menos uma atividade à avaliação.', 'erro');
        return;
    }

    window.location.href = `questionario.html?id_avaliacao=${idAvaliacao}`;
});

// --- Atividades: renderizacao -------------------------------------------------
function renderizarAtividades() {
    listaAtividadesEl.innerHTML = '';
    textoSemAtividades.hidden = atividadesDaAvaliacao.length > 0;

    atividadesDaAvaliacao.forEach((item) => {
        listaAtividadesEl.appendChild(criarItemAtividade(item));
    });
}

function criarItemAtividade(item) {
    const linha = document.createElement('div');
    linha.className = 'list-group-item d-flex justify-content-between align-items-start gap-3';

    const info = document.createElement('div');

    const tituloLinha = document.createElement('div');
    tituloLinha.className = 'fw-semibold mb-1';
    tituloLinha.textContent = item.nome;
    if (item.principal) {
        const badge = document.createElement('span');
        badge.className = 'badge text-bg-primary ms-2';
        badge.textContent = 'Principal';
        tituloLinha.appendChild(badge);
    }

    const detalhes = document.createElement('div');
    detalhes.className = 'small text-muted';
    const partes = [];
    if (item.tempo_exposicao_minutos != null) {
        partes.push(`Tempo de exposição: ${item.tempo_exposicao_minutos} min`);
    }
    if (item.frequencia_diaria != null) {
        partes.push(`Frequência: ${item.frequencia_diaria}`);
    }
    detalhes.textContent = partes.length > 0 ? partes.join(' · ') : 'Sem tempo/frequência informados';

    info.append(tituloLinha, detalhes);

    if (item.observacao) {
        const observacao = document.createElement('div');
        observacao.className = 'small text-muted fst-italic mt-1';
        observacao.textContent = item.observacao;
        info.appendChild(observacao);
    }

    linha.appendChild(info);

    if (!somenteLeitura) {
        const acoes = document.createElement('div');
        acoes.className = 'text-nowrap';

        const botaoEditar = document.createElement('button');
        botaoEditar.type = 'button';
        botaoEditar.className = 'btn btn-sm btn-outline-secondary me-1';
        botaoEditar.dataset.acao = 'editar';
        botaoEditar.dataset.id = item.id_avaliacao_atividade;
        botaoEditar.setAttribute('aria-label', 'Editar atividade');
        botaoEditar.title = 'Editar atividade';
        botaoEditar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';

        const botaoRemover = document.createElement('button');
        botaoRemover.type = 'button';
        botaoRemover.className = 'btn btn-sm btn-outline-danger';
        botaoRemover.dataset.acao = 'remover';
        botaoRemover.dataset.id = item.id_avaliacao_atividade;
        botaoRemover.setAttribute('aria-label', 'Remover atividade');
        botaoRemover.title = 'Remover atividade';
        botaoRemover.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7"></path><path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"></path></svg>';

        acoes.append(botaoEditar, botaoRemover);
        linha.appendChild(acoes);
    }

    return linha;
}

listaAtividadesEl.addEventListener('click', (event) => {
    const botao = event.target.closest('button[data-acao]');
    if (!botao) {
        return;
    }

    const id = Number(botao.dataset.id);
    if (botao.dataset.acao === 'editar') {
        abrirModalEditarAtividade(id);
    } else if (botao.dataset.acao === 'remover') {
        removerAtividade(id);
    }
});

// --- Modal de adicionar/editar atividade -------------------------------------
function preencherSelectCatalogoAtividades() {
    campoAtividadeSelect.innerHTML = '';
    const opcaoVazia = document.createElement('option');
    opcaoVazia.value = '';
    opcaoVazia.textContent = 'Selecione...';
    campoAtividadeSelect.appendChild(opcaoVazia);

    catalogoAtividades.forEach((atividade) => {
        const opcao = document.createElement('option');
        opcao.value = atividade.id_atividade;
        opcao.textContent = atividade.nome;
        campoAtividadeSelect.appendChild(opcao);
    });
}

function limparErrosAtividade() {
    campoAtividadeSelect.classList.remove('is-invalid');
    document.getElementById('erro-atividade-select').textContent = '';
    campoTempoExposicao.classList.remove('is-invalid');
    document.getElementById('erro-tempo-exposicao').textContent = '';
    campoFrequenciaDiaria.classList.remove('is-invalid');
    document.getElementById('erro-frequencia-diaria').textContent = '';
}

function abrirModalNovaAtividade() {
    formularioAtividade.reset();
    campoIdAtividadeAssociacao.value = '';
    limparErrosAtividade();
    tituloModalAtividade.textContent = 'Adicionar atividade';
    grupoCampoAtividade.hidden = false;
    campoAtividadeSelect.disabled = false;
    textoAtividadeFixa.hidden = true;
    preencherSelectCatalogoAtividades();
    instanciaModalAtividade.show();
}

function abrirModalEditarAtividade(idAvaliacaoAtividade) {
    const item = atividadesDaAvaliacao.find((atividade) => atividade.id_avaliacao_atividade === idAvaliacaoAtividade);
    if (!item) {
        return;
    }

    formularioAtividade.reset();
    limparErrosAtividade();
    campoIdAtividadeAssociacao.value = item.id_avaliacao_atividade;
    tituloModalAtividade.textContent = 'Editar atividade';
    grupoCampoAtividade.hidden = true;
    textoAtividadeFixa.hidden = false;
    textoAtividadeFixa.textContent = item.nome;
    campoPrincipalAtividade.checked = item.principal;
    campoTempoExposicao.value = item.tempo_exposicao_minutos ?? '';
    campoFrequenciaDiaria.value = item.frequencia_diaria ?? '';
    campoObservacaoAtividade.value = item.observacao || '';
    instanciaModalAtividade.show();
}

botaoNovaAtividade.addEventListener('click', abrirModalNovaAtividade);

formularioAtividade.addEventListener('submit', async (event) => {
    event.preventDefault();
    limparErrosAtividade();

    const idAssociacaoTexto = campoIdAtividadeAssociacao.value;
    const emEdicao = Boolean(idAssociacaoTexto);
    const tempo = campoTempoExposicao.value !== '' ? Number(campoTempoExposicao.value) : null;
    const frequencia = campoFrequenciaDiaria.value !== '' ? Number(campoFrequenciaDiaria.value) : null;
    const principal = campoPrincipalAtividade.checked;
    const observacao = campoObservacaoAtividade.value.trim() || null;

    let valido = true;
    if (!emEdicao && !campoAtividadeSelect.value) {
        campoAtividadeSelect.classList.add('is-invalid');
        document.getElementById('erro-atividade-select').textContent = 'Selecione a atividade.';
        valido = false;
    }
    if (tempo !== null && (!Number.isInteger(tempo) || tempo <= 0)) {
        campoTempoExposicao.classList.add('is-invalid');
        document.getElementById('erro-tempo-exposicao').textContent = 'Informe um número inteiro maior que zero.';
        valido = false;
    }
    if (frequencia !== null && (!Number.isInteger(frequencia) || frequencia < 0)) {
        campoFrequenciaDiaria.classList.add('is-invalid');
        document.getElementById('erro-frequencia-diaria').textContent = 'Informe um número inteiro maior ou igual a zero.';
        valido = false;
    }
    if (!valido) {
        return;
    }

    if (principal) {
        const outraPrincipal = atividadesDaAvaliacao.find(
            (atividade) => atividade.principal && String(atividade.id_avaliacao_atividade) !== idAssociacaoTexto,
        );
        if (outraPrincipal) {
            const confirmado = window.confirm(
                `A atividade "${outraPrincipal.nome}" já está marcada como principal. Deseja substituí-la por esta?`,
            );
            if (!confirmado) {
                return;
            }
        }
    }

    const textoOriginal = botaoSalvarAtividade.textContent;
    botaoSalvarAtividade.disabled = true;
    botaoSalvarAtividade.textContent = 'Salvando...';

    try {
        if (emEdicao) {
            await atualizarAtividadeAvaliacao(Number(idAssociacaoTexto), {
                principal,
                tempo_exposicao_minutos: tempo,
                frequencia_diaria: frequencia,
                observacao,
            });
            mostrarNotificacao('Atividade atualizada com sucesso.', 'sucesso');
        } else {
            await adicionarAtividadeAvaliacao(idAvaliacao, {
                id_atividade: Number(campoAtividadeSelect.value),
                principal,
                tempo_exposicao_minutos: tempo,
                frequencia_diaria: frequencia,
                observacao,
            });
            mostrarNotificacao('Atividade adicionada com sucesso.', 'sucesso');
        }

        instanciaModalAtividade.hide();
        atividadesDaAvaliacao = await listarAtividadesDaAvaliacao(idAvaliacao);
        renderizarAtividades();
    } catch (error) {
        console.error('Erro ao salvar atividade da avaliação:', error);
        mostrarNotificacao(mensagemErroAmigavelAtividade(error), 'erro');
    } finally {
        botaoSalvarAtividade.disabled = false;
        botaoSalvarAtividade.textContent = textoOriginal;
    }
});

async function removerAtividade(idAvaliacaoAtividade) {
    const confirmado = window.confirm('Deseja realmente remover esta atividade da avaliação?');
    if (!confirmado) {
        return;
    }

    try {
        await removerAtividadeAvaliacao(idAvaliacaoAtividade);
        mostrarNotificacao('Atividade removida com sucesso.', 'sucesso');
        atividadesDaAvaliacao = await listarAtividadesDaAvaliacao(idAvaliacao);
        renderizarAtividades();
    } catch (error) {
        console.error('Erro ao remover atividade da avaliação:', error);
        mostrarNotificacao(mensagemErroAmigavelAtividade(error), 'erro');
    }
}

// --- Traducao de erros do Supabase/PostgreSQL e das regras de negocio -------
const CODIGOS_ERRO_CONTEXTO = [
    'AMBIENTE_OBRIGATORIO',
    'EMPRESA_INCOMPATIVEL',
    'AMBIENTE_INATIVO',
    'AMBIENTE_INCOMPATIVEL',
    'POSTO_INCOMPATIVEL',
    'FUNCAO_INCOMPATIVEL',
    'PERFIL_INCOMPATIVEL',
    'AVALIACAO_FINALIZADA',
    'AVALIACAO_CANCELADA',
    'STATUS_NAO_EDITAVEL',
];

const CODIGOS_ERRO_ATIVIDADE = [
    'ATIVIDADE_OBRIGATORIA',
    'ATIVIDADE_DUPLICADA',
    'TEMPO_EXPOSICAO_INVALIDO',
    'FREQUENCIA_INVALIDA',
    'AVALIACAO_FINALIZADA',
    'AVALIACAO_CANCELADA',
    'STATUS_NAO_EDITAVEL',
];

function mensagemErroGenerica(error, codigosConhecidos) {
    const codigo = error?.code;
    const mensagem = (error?.message || '').toLowerCase();

    if (codigosConhecidos.includes(codigo)) {
        return error.message;
    }

    if (codigo === '23505') {
        return 'Esta atividade já foi associada a esta avaliação.';
    }

    if (codigo === '23503') {
        return 'Não foi possível salvar: referência inválida no contexto selecionado.';
    }

    if (codigo === '23514') {
        return 'Verifique os dados informados.';
    }

    if (mensagem.includes('permission denied') || mensagem.includes('policy') || mensagem.includes('rls')) {
        return 'Sem permissão para realizar esta operação. Verifique as políticas de acesso do Supabase.';
    }

    return null;
}

function mensagemErroAmigavelContexto(error) {
    return mensagemErroGenerica(error, CODIGOS_ERRO_CONTEXTO) || 'Não foi possível salvar o contexto da avaliação. Tente novamente.';
}

function mensagemErroAmigavelAtividade(error) {
    return mensagemErroGenerica(error, CODIGOS_ERRO_ATIVIDADE) || 'Não foi possível salvar a atividade. Tente novamente.';
}

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
