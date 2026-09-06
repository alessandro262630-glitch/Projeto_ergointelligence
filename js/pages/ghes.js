import { listarGhes, buscarGhePorId, criarGhe, atualizarGhe, listarSetoresDaEmpresa } from '../services/gheService.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// MVP-06 - Listagem de GHEs. So interface/eventos - toda regra de dominio
// fica em js/services/gheService.js.

const areaEstado = document.getElementById('area-estado');
const areaTabela = document.getElementById('area-tabela');
const corpoTabela = document.getElementById('corpo-tabela');
const areaNotificacoes = document.getElementById('area-notificacoes');

const modalGhe = document.getElementById('modal-ghe');
const tituloModalGhe = document.getElementById('modal-ghe-titulo');
const formularioGhe = document.getElementById('formulario-ghe');
const campoIdGhe = document.getElementById('campo-id-ghe');
const campoCodigoGhe = document.getElementById('campo-codigo-ghe');
const campoNomeGhe = document.getElementById('campo-nome-ghe');
const campoSetorGhe = document.getElementById('campo-setor-ghe');
const campoUniversoGhe = document.getElementById('campo-universo-ghe');
const campoDescricaoGhe = document.getElementById('campo-descricao-ghe');
const botaoSalvarGhe = document.getElementById('botao-salvar-ghe');

const instanciaModalGhe = new bootstrap.Modal(modalGhe);

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

const ROTULOS_STATUS_PLANO = { PLANEJADO: 'Planejado', EM_COLETA: 'Em coleta', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

function criarBadgeAtivo(ativo) {
    const badge = document.createElement('span');
    badge.className = `badge ${ativo ? 'text-bg-success' : 'text-bg-secondary'}`;
    badge.textContent = ativo ? 'Ativo' : 'Inativo';
    return badge;
}

function criarLinhaGhe(ghe) {
    const linha = document.createElement('tr');
    linha.style.cursor = 'pointer';
    linha.addEventListener('click', () => {
        window.location.href = `ghe-detalhe.html?id_ghe=${ghe.id_ghe}`;
    });

    const celulaCodigo = document.createElement('td');
    celulaCodigo.textContent = ghe.codigo || '-';

    const celulaNome = document.createElement('td');
    celulaNome.className = 'fw-semibold';
    celulaNome.textContent = ghe.nome;

    const celulaSetor = document.createElement('td');
    celulaSetor.textContent = ghe.setor || '-';

    const celulaUniverso = document.createElement('td');
    celulaUniverso.className = 'text-end';
    celulaUniverso.textContent = ghe.universo;

    const celulaAmostra = document.createElement('td');
    celulaAmostra.className = 'text-end';
    celulaAmostra.textContent = ghe.planoAtual ? ghe.planoAtual.amostra_planejada : '—';

    const celulaStatusPlano = document.createElement('td');
    if (ghe.planoAtual) {
        celulaStatusPlano.textContent = ROTULOS_STATUS_PLANO[ghe.planoAtual.status] || ghe.planoAtual.status;
    } else {
        const span = document.createElement('span');
        span.className = 'text-muted';
        span.textContent = 'Sem plano';
        celulaStatusPlano.appendChild(span);
    }

    const celulaAtivo = document.createElement('td');
    celulaAtivo.appendChild(criarBadgeAtivo(ghe.ativo));

    const celulaAcoes = document.createElement('td');
    const botaoEditar = document.createElement('button');
    botaoEditar.type = 'button';
    botaoEditar.className = 'btn btn-sm btn-outline-secondary';
    botaoEditar.title = 'Editar GHE';
    botaoEditar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
    botaoEditar.addEventListener('click', (event) => {
        event.stopPropagation();
        abrirFormularioEdicao(ghe.id_ghe);
    });
    celulaAcoes.appendChild(botaoEditar);

    linha.append(celulaCodigo, celulaNome, celulaSetor, celulaUniverso, celulaAmostra, celulaStatusPlano, celulaAtivo, celulaAcoes);
    return linha;
}

async function carregarGhes() {
    definirEstado('carregando', 'Carregando GHEs...');
    try {
        const ghes = await listarGhes();
        if (ghes.length === 0) {
            definirEstado('vazio', 'Nenhum GHE cadastrado ainda.');
            return;
        }
        corpoTabela.innerHTML = '';
        ghes.forEach((ghe) => corpoTabela.appendChild(criarLinhaGhe(ghe)));
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar GHEs:', error);
        definirEstado('erro', 'Não foi possível carregar os GHEs.');
    }
}

async function carregarSetoresSelect() {
    try {
        const setores = await listarSetoresDaEmpresa();
        setores.forEach((setor) => {
            const opcao = document.createElement('option');
            opcao.value = setor.id_setor;
            opcao.textContent = setor.nome;
            campoSetorGhe.appendChild(opcao);
        });
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
    }
}

function limparErrosFormularioGhe() {
    [campoNomeGhe, campoUniversoGhe].forEach((campo) => campo.classList.remove('is-invalid'));
    ['erro-nome-ghe', 'erro-universo-ghe'].forEach((id) => { document.getElementById(id).textContent = ''; });
}

function definirErroCampo(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacao() {
    formularioGhe.reset();
    limparErrosFormularioGhe();
    campoIdGhe.value = '';
    tituloModalGhe.textContent = 'Novo GHE';
    instanciaModalGhe.show();
    campoNomeGhe.focus();
}

async function abrirFormularioEdicao(idGhe) {
    try {
        const ghe = await buscarGhePorId(idGhe);
        formularioGhe.reset();
        limparErrosFormularioGhe();
        campoIdGhe.value = ghe.id_ghe;
        campoCodigoGhe.value = ghe.codigo || '';
        campoNomeGhe.value = ghe.nome;
        campoSetorGhe.value = ghe.id_setor || '';
        campoUniversoGhe.value = ghe.universo;
        campoDescricaoGhe.value = ghe.descricao || '';
        tituloModalGhe.textContent = 'Editar GHE';
        instanciaModalGhe.show();
        campoNomeGhe.focus();
    } catch (error) {
        console.error('Erro ao carregar GHE para edição:', error);
        mostrarNotificacao('Não foi possível carregar os dados do GHE.', 'erro');
    }
}

function validarFormularioGhe() {
    limparErrosFormularioGhe();
    let valido = true;

    if (!campoPreenchido(campoNomeGhe.value)) {
        definirErroCampo(campoNomeGhe, 'erro-nome-ghe', 'Informe o nome do GHE.');
        valido = false;
    }
    const universo = Number(campoUniversoGhe.value);
    if (!campoUniversoGhe.value || !Number.isInteger(universo) || universo <= 0) {
        definirErroCampo(campoUniversoGhe, 'erro-universo-ghe', 'Informe um universo válido (maior que zero).');
        valido = false;
    }

    if (!valido) return { valido: false };

    return {
        valido: true,
        dados: {
            id_setor: campoSetorGhe.value ? Number(campoSetorGhe.value) : null,
            codigo: campoCodigoGhe.value,
            nome: campoNomeGhe.value,
            descricao: campoDescricaoGhe.value,
            universo,
        },
    };
}

function mensagemErroAmigavel(error) {
    if (error?.code && error.code !== '23505') {
        return error.message;
    }
    if (error?.code === '23505') {
        return 'Já existe um GHE com este código ou nome nesta empresa.';
    }
    return 'Não foi possível salvar o GHE. Tente novamente.';
}

formularioGhe.addEventListener('submit', async (event) => {
    event.preventDefault();
    const resultado = validarFormularioGhe();
    if (!resultado.valido) return;

    const idExistente = campoIdGhe.value;
    const textoOriginal = botaoSalvarGhe.textContent;
    botaoSalvarGhe.disabled = true;
    botaoSalvarGhe.textContent = 'Salvando...';

    try {
        if (idExistente) {
            await atualizarGhe(Number(idExistente), resultado.dados);
            mostrarNotificacao('GHE atualizado com sucesso.', 'sucesso');
        } else {
            await criarGhe(resultado.dados);
            mostrarNotificacao('GHE criado com sucesso.', 'sucesso');
        }
        instanciaModalGhe.hide();
        await carregarGhes();
    } catch (error) {
        console.error('Erro ao salvar GHE:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarGhe.disabled = false;
        botaoSalvarGhe.textContent = textoOriginal;
    }
});

document.getElementById('botao-novo-ghe').addEventListener('click', abrirFormularioCriacao);

// --- Popovers de ajuda ("Saiba mais") -------------------------------------------
document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => new bootstrap.Popover(el));

carregarSetoresSelect();
carregarGhes();
