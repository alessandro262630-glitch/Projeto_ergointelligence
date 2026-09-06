import { listarInventarios, criarInventario, criarNovaVersao } from '../services/inventarioRiscoService.js';
import { listarUsuariosDaEmpresa } from '../services/planoAcaoService.js';
import { obterIdEmpresaAtiva } from '../services/colaboradorService.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// MVP-09B - Listagem de versoes do Inventario de Riscos Ocupacionais. So
// interface/eventos - toda regra de dominio fica em
// js/services/inventarioRiscoService.js. Nunca chama isso de "PGR" na UI
// (secao 82 do prompt) - o PGR completo depende de integracao futura com
// o Plano de Acao.

const areaEstado = document.getElementById('area-estado');
const areaTabela = document.getElementById('area-tabela');
const corpoTabela = document.getElementById('corpo-tabela');
const areaNotificacoes = document.getElementById('area-notificacoes');

const modalInventario = document.getElementById('modal-inventario');
const formularioInventario = document.getElementById('formulario-inventario');
const campoTituloInventario = document.getElementById('campo-titulo-inventario');
const campoDataReferenciaInventario = document.getElementById('campo-data-referencia-inventario');
const campoCriadorInventario = document.getElementById('campo-criador-inventario');
const campoDescricaoInventario = document.getElementById('campo-descricao-inventario');
const botaoSalvarInventario = document.getElementById('botao-salvar-inventario');

const modalNovaVersao = document.getElementById('modal-nova-versao');
const formularioNovaVersao = document.getElementById('formulario-nova-versao');
const campoIdInventarioAnterior = document.getElementById('campo-id-inventario-anterior');
const campoTituloNovaVersao = document.getElementById('campo-titulo-nova-versao');
const campoDataReferenciaNovaVersao = document.getElementById('campo-data-referencia-nova-versao');
const campoCriadorNovaVersao = document.getElementById('campo-criador-nova-versao');
const campoDescricaoNovaVersao = document.getElementById('campo-descricao-nova-versao');
const botaoSalvarNovaVersao = document.getElementById('botao-salvar-nova-versao');

const instanciaModalInventario = new bootstrap.Modal(modalInventario);
const instanciaModalNovaVersao = new bootstrap.Modal(modalNovaVersao);

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        areaTabela.hidden = false;
        return;
    }
    areaTabela.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    areaEstado.textContent = mensagem;
}

const ROTULOS_STATUS = { RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado', CANCELADO: 'Cancelado' };
const CLASSE_STATUS = {
    RASCUNHO: 'badge-status-inventario--rascunho',
    PUBLICADO: 'badge-status-inventario--publicado',
    CANCELADO: 'badge-status-inventario--cancelado',
};

function criarBadgeStatus(status) {
    const badge = document.createElement('span');
    badge.className = `badge badge-status-inventario ${CLASSE_STATUS[status] || ''}`;
    badge.textContent = ROTULOS_STATUS[status] || status;
    return badge;
}

function formatarData(dataIso) {
    if (!campoPreenchido(dataIso)) return '-';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(timestampIso) {
    if (!timestampIso) return '-';
    return new Date(timestampIso).toLocaleString('pt-BR');
}

function criarLinhaInventario(inventario) {
    const linha = document.createElement('tr');
    linha.style.cursor = 'pointer';
    linha.addEventListener('click', () => {
        window.location.href = `inventario-detalhe.html?id_inventario=${inventario.id_inventario}`;
    });

    const celulaVersao = document.createElement('td');
    celulaVersao.className = 'fw-semibold';
    celulaVersao.textContent = `v${inventario.numero_versao}`;

    const celulaTitulo = document.createElement('td');
    celulaTitulo.textContent = inventario.titulo;

    const celulaData = document.createElement('td');
    celulaData.textContent = formatarData(inventario.data_referencia);

    const celulaStatus = document.createElement('td');
    celulaStatus.appendChild(criarBadgeStatus(inventario.status));

    const celulaItens = document.createElement('td');
    celulaItens.className = 'text-end';
    celulaItens.textContent = inventario.totalItens;

    const celulaGhes = document.createElement('td');
    celulaGhes.className = 'text-end';
    celulaGhes.textContent = inventario.totalGhes;

    const celulaCriador = document.createElement('td');
    celulaCriador.textContent = inventario.criado_por_nome || '-';

    const celulaPublicado = document.createElement('td');
    celulaPublicado.textContent = inventario.status === 'PUBLICADO' ? formatarDataHora(inventario.publicado_em) : '-';

    const celulaAcoes = document.createElement('td');
    const botaoAbrir = document.createElement('button');
    botaoAbrir.type = 'button';
    botaoAbrir.className = 'btn btn-sm btn-outline-secondary me-1';
    botaoAbrir.textContent = inventario.status === 'RASCUNHO' ? 'Abrir' : 'Visualizar';
    botaoAbrir.addEventListener('click', (event) => {
        event.stopPropagation();
        window.location.href = `inventario-detalhe.html?id_inventario=${inventario.id_inventario}`;
    });
    celulaAcoes.appendChild(botaoAbrir);

    if (inventario.status === 'PUBLICADO') {
        const botaoNovaVersao = document.createElement('button');
        botaoNovaVersao.type = 'button';
        botaoNovaVersao.className = 'btn btn-sm btn-outline-primary';
        botaoNovaVersao.textContent = 'Criar nova versão';
        botaoNovaVersao.addEventListener('click', (event) => {
            event.stopPropagation();
            abrirModalNovaVersao(inventario);
        });
        celulaAcoes.appendChild(botaoNovaVersao);
    }

    linha.append(celulaVersao, celulaTitulo, celulaData, celulaStatus, celulaItens, celulaGhes, celulaCriador, celulaPublicado, celulaAcoes);
    return linha;
}

async function carregarInventarios() {
    definirEstado('carregando', 'Carregando inventários...');
    try {
        const inventarios = await listarInventarios();
        if (inventarios.length === 0) {
            definirEstado('vazio', 'Nenhum inventário criado ainda.');
            return;
        }
        corpoTabela.innerHTML = '';
        inventarios.forEach((inventario) => corpoTabela.appendChild(criarLinhaInventario(inventario)));
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar inventários:', error);
        definirEstado('erro', 'Não foi possível carregar os inventários.');
    }
}

async function carregarUsuariosSelects() {
    try {
        const idEmpresa = await obterIdEmpresaAtiva();
        const usuarios = await listarUsuariosDaEmpresa(idEmpresa);
        [campoCriadorInventario, campoCriadorNovaVersao].forEach((select) => {
            usuarios.forEach((usuario) => {
                const opcao = document.createElement('option');
                opcao.value = usuario.id_usuario;
                opcao.textContent = usuario.nome;
                select.appendChild(opcao);
            });
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

function limparErros(campos, idsErro) {
    campos.forEach((campo) => campo.classList.remove('is-invalid'));
    idsErro.forEach((id) => { document.getElementById(id).textContent = ''; });
}

function definirErroCampo(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacao() {
    formularioInventario.reset();
    limparErros(
        [campoTituloInventario, campoDataReferenciaInventario, campoCriadorInventario],
        ['erro-titulo-inventario', 'erro-data-referencia-inventario', 'erro-criador-inventario'],
    );
    instanciaModalInventario.show();
    campoTituloInventario.focus();
}

function validarFormulario(campoTitulo, campoData, campoCriador, idsErro) {
    limparErros([campoTitulo, campoData, campoCriador], idsErro);
    let valido = true;

    if (!campoPreenchido(campoTitulo.value)) {
        definirErroCampo(campoTitulo, idsErro[0], 'Informe o título do inventário.');
        valido = false;
    }
    if (!campoData.value) {
        definirErroCampo(campoData, idsErro[1], 'Informe a data de referência.');
        valido = false;
    }
    if (!campoCriador.value) {
        definirErroCampo(campoCriador, idsErro[2], 'Selecione o responsável pela criação.');
        valido = false;
    }

    return valido;
}

function mensagemErroAmigavel(error) {
    if (error?.code === 'VERSAO_DUPLICADA') {
        return 'Já existe uma versão com este número para esta empresa. Tente novamente.';
    }
    if (error?.code) {
        return error.message;
    }
    return 'Não foi possível salvar o inventário. Tente novamente.';
}

formularioInventario.addEventListener('submit', async (event) => {
    event.preventDefault();
    const valido = validarFormulario(
        campoTituloInventario, campoDataReferenciaInventario, campoCriadorInventario,
        ['erro-titulo-inventario', 'erro-data-referencia-inventario', 'erro-criador-inventario'],
    );
    if (!valido) return;

    const textoOriginal = botaoSalvarInventario.textContent;
    botaoSalvarInventario.disabled = true;
    botaoSalvarInventario.textContent = 'Criando...';

    try {
        const novo = await criarInventario({
            titulo: campoTituloInventario.value,
            descricao: campoDescricaoInventario.value,
            data_referencia: campoDataReferenciaInventario.value,
            id_usuario_criador: Number(campoCriadorInventario.value),
        });
        instanciaModalInventario.hide();
        mostrarNotificacao('Inventário criado com sucesso.', 'sucesso');
        window.location.href = `inventario-detalhe.html?id_inventario=${novo.id_inventario}`;
    } catch (error) {
        console.error('Erro ao criar inventário:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarInventario.disabled = false;
        botaoSalvarInventario.textContent = textoOriginal;
    }
});

function abrirModalNovaVersao(inventarioPublicado) {
    formularioNovaVersao.reset();
    limparErros(
        [campoTituloNovaVersao, campoDataReferenciaNovaVersao, campoCriadorNovaVersao],
        ['erro-titulo-nova-versao', 'erro-data-referencia-nova-versao', 'erro-criador-nova-versao'],
    );
    campoIdInventarioAnterior.value = inventarioPublicado.id_inventario;
    campoTituloNovaVersao.value = inventarioPublicado.titulo;
    campoDescricaoNovaVersao.value = inventarioPublicado.descricao || '';
    instanciaModalNovaVersao.show();
    campoTituloNovaVersao.focus();
}

formularioNovaVersao.addEventListener('submit', async (event) => {
    event.preventDefault();
    const valido = validarFormulario(
        campoTituloNovaVersao, campoDataReferenciaNovaVersao, campoCriadorNovaVersao,
        ['erro-titulo-nova-versao', 'erro-data-referencia-nova-versao', 'erro-criador-nova-versao'],
    );
    if (!valido) return;

    const textoOriginal = botaoSalvarNovaVersao.textContent;
    botaoSalvarNovaVersao.disabled = true;
    botaoSalvarNovaVersao.textContent = 'Criando...';

    try {
        const nova = await criarNovaVersao(Number(campoIdInventarioAnterior.value), {
            titulo: campoTituloNovaVersao.value,
            descricao: campoDescricaoNovaVersao.value,
            data_referencia: campoDataReferenciaNovaVersao.value,
            id_usuario_criador: Number(campoCriadorNovaVersao.value),
        });
        instanciaModalNovaVersao.hide();
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

document.getElementById('botao-novo-inventario').addEventListener('click', abrirFormularioCriacao);

carregarUsuariosSelects();
carregarInventarios();
