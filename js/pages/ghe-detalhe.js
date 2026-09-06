import {
    buscarGhePorId,
    atualizarGhe,
    alternarStatusGhe,
    buscarNomeEmpresa,
    listarSetoresDaEmpresa,
    listarCargosDaEmpresa,
    listarCargosDoGhe,
    associarCargoAoGhe,
    desassociarCargoDoGhe,
    buscarPlanoAmostragemAtual,
    criarPlanoAmostragem,
    atualizarPlanoAmostragem,
    listarParticipantes,
    adicionarParticipante,
    removerParticipante,
    listarVinculosCompativeisComGhe,
} from '../services/gheService.js';
import { listarUsuariosDaEmpresa } from '../services/planoAcaoService.js';
import { obterAvaliadorPadrao } from '../services/avaliacaoService.js';
import { buscarAvaliacaoGheAtual, iniciarOuContinuarAvaliacaoGhe } from '../services/avaliacaoGheService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// MVP-06 - Detalhe do GHE: contexto, cargos relacionados, plano de
// amostragem e participantes. So interface/eventos - toda regra de
// dominio fica em js/services/gheService.js. NUNCA calcula
// representatividade estatistica nem consolida coletas (isso e o MVP-07).

const idGhe = Number(new URLSearchParams(window.location.search).get('id_ghe')) || null;

const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');
const areaNotificacoes = document.getElementById('area-notificacoes');

const badgeGheStatus = document.getElementById('badge-ghe-status');
const botaoAlternarStatusGhe = document.getElementById('botao-alternar-status-ghe');
const textoGheNome = document.getElementById('texto-ghe-nome');
const textoGheDescricao = document.getElementById('texto-ghe-descricao');
const textoGheEmpresa = document.getElementById('texto-ghe-empresa');
const textoGheSetor = document.getElementById('texto-ghe-setor');
const textoGheCodigo = document.getElementById('texto-ghe-codigo');

const numeroUniverso = document.getElementById('numero-universo');
const numeroAmostraPlanejada = document.getElementById('numero-amostra-planejada');
const numeroParticipantes = document.getElementById('numero-participantes');
const numeroParticipacao = document.getElementById('numero-participacao');

const areaSemCargos = document.getElementById('area-sem-cargos');
const listaCargos = document.getElementById('lista-cargos');

const botaoEditarPlano = document.getElementById('botao-editar-plano');
const areaSemPlano = document.getElementById('area-sem-plano');
const areaPlano = document.getElementById('area-plano');
const textoPlanoUniverso = document.getElementById('texto-plano-universo');
const textoPlanoAmostra = document.getElementById('texto-plano-amostra');
const textoPlanoStatus = document.getElementById('texto-plano-status');
const textoPlanoData = document.getElementById('texto-plano-data');
const textoPlanoCriterio = document.getElementById('texto-plano-criterio');
const textoPlanoObservacao = document.getElementById('texto-plano-observacao');
const textoPlanoResponsavel = document.getElementById('texto-plano-responsavel');

const cardAvaliacaoGhe = document.getElementById('card-avaliacao-ghe');
const textoAvaliacaoGheStatus = document.getElementById('texto-avaliacao-ghe-status');
const botaoNovaAvaliacaoGhe = document.getElementById('botao-nova-avaliacao-ghe');
const botaoContinuarAvaliacaoGhe = document.getElementById('botao-continuar-avaliacao-ghe');
const linkVerConsolidacaoGhe = document.getElementById('link-ver-consolidacao-ghe');

const cardParticipantes = document.getElementById('card-participantes');
const textoResumoParticipantes = document.getElementById('texto-resumo-participantes');
const areaSemParticipantes = document.getElementById('area-sem-participantes');
const areaTabelaParticipantes = document.getElementById('area-tabela-participantes');
const corpoTabelaParticipantes = document.getElementById('corpo-tabela-participantes');

// Modal GHE
const modalGhe = document.getElementById('modal-ghe');
const formularioGhe = document.getElementById('formulario-ghe');
const campoCodigoGhe = document.getElementById('campo-codigo-ghe');
const campoNomeGhe = document.getElementById('campo-nome-ghe');
const campoSetorGhe = document.getElementById('campo-setor-ghe');
const campoUniversoGhe = document.getElementById('campo-universo-ghe');
const campoDescricaoGhe = document.getElementById('campo-descricao-ghe');
const botaoSalvarGhe = document.getElementById('botao-salvar-ghe');
const instanciaModalGhe = new bootstrap.Modal(modalGhe);

// Modal cargo
const modalCargo = document.getElementById('modal-cargo');
const formularioCargo = document.getElementById('formulario-cargo');
const campoCargo = document.getElementById('campo-cargo');
const instanciaModalCargo = new bootstrap.Modal(modalCargo);

// Modal plano
const modalPlano = document.getElementById('modal-plano');
const tituloModalPlano = document.getElementById('modal-plano-titulo');
const formularioPlano = document.getElementById('formulario-plano');
const campoIdPlano = document.getElementById('campo-id-plano');
const campoUniversoPlano = document.getElementById('campo-universo-plano');
const campoAmostraPlano = document.getElementById('campo-amostra-plano');
const campoStatusPlano = document.getElementById('campo-status-plano');
const campoDataPlano = document.getElementById('campo-data-plano');
const grupoResponsavelPlano = document.getElementById('grupo-responsavel-plano');
const campoResponsavelPlano = document.getElementById('campo-responsavel-plano');
const botaoSalvarPlano = document.getElementById('botao-salvar-plano');
const instanciaModalPlano = new bootstrap.Modal(modalPlano);

// Modal participante
const modalParticipante = document.getElementById('modal-participante');
const formularioParticipante = document.getElementById('formulario-participante');
const campoVinculoParticipante = document.getElementById('campo-vinculo-participante');
const instanciaModalParticipante = new bootstrap.Modal(modalParticipante);

let gheAtual = null;
let planoAtual = null;
let participantesAtuais = [];
let cargosAtuais = [];

const botaoAdicionarParticipante = document.getElementById('botao-adicionar-participante');

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

const ROTULOS_STATUS_PLANO = { PLANEJADO: 'Planejado', EM_COLETA: 'Em coleta', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

function mensagemErroAmigavel(error) {
    if (error?.code && error.code !== '23505' && error.code !== '23503') {
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
    if (!idGhe) {
        definirEstado('erro', 'Nenhum GHE informado na URL.');
        return;
    }
    definirEstado('carregando', 'Carregando GHE...');

    try {
        gheAtual = await buscarGhePorId(idGhe);
    } catch (error) {
        console.error('Erro ao carregar GHE:', error);
        definirEstado('erro', 'GHE não encontrado.');
        return;
    }

    try {
        const nomeEmpresa = await buscarNomeEmpresa(gheAtual.id_empresa);
        renderizarGhe(nomeEmpresa);
        await carregarCargos();
        await carregarPlano();
        await carregarAvaliacaoGhe();
    } catch (error) {
        console.error('Erro ao carregar detalhe do GHE:', error);
        definirEstado('erro', 'Não foi possível carregar os dados do GHE.');
        return;
    }

    definirEstado('pronto');
}

function renderizarGhe(nomeEmpresa) {
    textoGheNome.textContent = gheAtual.nome;
    textoGheDescricao.textContent = gheAtual.descricao || 'Sem descrição.';
    textoGheEmpresa.textContent = nomeEmpresa;
    textoGheSetor.textContent = gheAtual.setor || 'Não especificado';
    textoGheCodigo.textContent = gheAtual.codigo || '-';
    badgeGheStatus.className = `badge ${gheAtual.ativo ? 'text-bg-success' : 'text-bg-secondary'}`;
    badgeGheStatus.textContent = gheAtual.ativo ? 'Ativo' : 'Inativo';
    botaoAlternarStatusGhe.textContent = gheAtual.ativo ? 'Desativar' : 'Ativar';
    numeroUniverso.textContent = gheAtual.universo;
}

// Sem nenhum cargo associado, nao ha como validar se um vinculo e
// compativel com o GHE (secao de correcao MVP-06/MVP-07) - o botao de
// adicionar participante fica desabilitado ate que ao menos um cargo seja
// associado, em vez de deixar o usuario descobrir isso so ao tentar salvar.
function atualizarDisponibilidadeParticipante() {
    const semCargos = cargosAtuais.length === 0;
    botaoAdicionarParticipante.disabled = semCargos;
    botaoAdicionarParticipante.title = semCargos
        ? 'Associe ao menos um cargo a este GHE antes de adicionar participantes.'
        : '';
}

// --- Cargos relacionados -------------------------------------------------------
async function carregarCargos() {
    const cargos = await listarCargosDoGhe(idGhe);
    cargosAtuais = cargos;
    atualizarDisponibilidadeParticipante();

    if (cargos.length === 0) {
        areaSemCargos.hidden = false;
        listaCargos.hidden = true;
        return;
    }
    areaSemCargos.hidden = true;
    listaCargos.hidden = false;
    listaCargos.innerHTML = '';
    cargos.forEach((cargo) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center px-0';
        const nome = document.createElement('span');
        nome.textContent = cargo.cargo_nome;
        const botaoRemover = document.createElement('button');
        botaoRemover.type = 'button';
        botaoRemover.className = 'btn btn-sm btn-outline-danger';
        botaoRemover.title = 'Remover associação';
        botaoRemover.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        botaoRemover.addEventListener('click', async () => {
            try {
                await desassociarCargoDoGhe(cargo.id_ghe_cargo);
                mostrarNotificacao('Cargo desassociado.', 'sucesso');
                await carregarCargos();
            } catch (error) {
                console.error('Erro ao desassociar cargo:', error);
                mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
            }
        });
        item.append(nome, botaoRemover);
        listaCargos.appendChild(item);
    });
}

document.getElementById('botao-adicionar-cargo').addEventListener('click', async () => {
    formularioCargo.reset();
    campoCargo.innerHTML = '<option value="">Selecione...</option>';
    try {
        const cargos = await listarCargosDaEmpresa();
        cargos.forEach((cargo) => {
            const opcao = document.createElement('option');
            opcao.value = cargo.id_cargo;
            opcao.textContent = cargo.nome;
            campoCargo.appendChild(opcao);
        });
        instanciaModalCargo.show();
    } catch (error) {
        console.error('Erro ao carregar cargos:', error);
        mostrarNotificacao('Não foi possível carregar os cargos.', 'erro');
    }
});

formularioCargo.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!campoCargo.value) return;
    const botao = document.getElementById('botao-salvar-cargo');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Associando...';
    try {
        await associarCargoAoGhe(idGhe, Number(campoCargo.value));
        mostrarNotificacao('Cargo associado com sucesso.', 'sucesso');
        instanciaModalCargo.hide();
        await carregarCargos();
    } catch (error) {
        console.error('Erro ao associar cargo:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
});

// --- Plano de amostragem -------------------------------------------------------
function atualizarNumerosDestaque() {
    const amostra = planoAtual ? planoAtual.amostra_planejada : 0;
    numeroAmostraPlanejada.textContent = amostra;
    numeroParticipantes.textContent = participantesAtuais.length;

    if (planoAtual && planoAtual.universo_snapshot > 0) {
        const percentual = (amostra / planoAtual.universo_snapshot) * 100;
        numeroParticipacao.textContent = `${percentual.toFixed(1).replace('.', ',')}%`;
    } else {
        numeroParticipacao.textContent = '-';
    }
}

async function carregarPlano() {
    planoAtual = await buscarPlanoAmostragemAtual(idGhe);

    if (!planoAtual) {
        areaSemPlano.hidden = false;
        areaPlano.hidden = true;
        botaoEditarPlano.hidden = true;
        cardParticipantes.hidden = true;
        participantesAtuais = [];
        atualizarNumerosDestaque();
        return;
    }

    areaSemPlano.hidden = true;
    areaPlano.hidden = false;
    botaoEditarPlano.hidden = false;
    cardParticipantes.hidden = false;

    textoPlanoUniverso.textContent = planoAtual.universo_snapshot;
    textoPlanoAmostra.textContent = planoAtual.amostra_planejada;
    textoPlanoStatus.textContent = ROTULOS_STATUS_PLANO[planoAtual.status] || planoAtual.status;
    textoPlanoData.textContent = formatarDataBR(planoAtual.data_plano);
    textoPlanoCriterio.textContent = planoAtual.criterio || 'Não informado.';
    textoPlanoObservacao.textContent = planoAtual.observacao || 'Nenhuma.';
    textoPlanoResponsavel.textContent = planoAtual.responsavel_nome || '-';

    await carregarParticipantes();
}

function limparErrosFormularioPlano() {
    [campoUniversoPlano, campoAmostraPlano, campoDataPlano, campoResponsavelPlano].forEach((c) => c.classList.remove('is-invalid'));
    ['erro-universo-plano', 'erro-amostra-plano', 'erro-data-plano', 'erro-responsavel-plano'].forEach((id) => {
        document.getElementById(id).textContent = '';
    });
}

function definirErroCampoPlano(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function dataHojeIso() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

async function abrirFormularioCriacaoPlano() {
    formularioPlano.reset();
    limparErrosFormularioPlano();
    campoIdPlano.value = '';
    campoUniversoPlano.value = gheAtual.universo;
    campoStatusPlano.value = 'PLANEJADO';
    campoDataPlano.value = dataHojeIso();
    grupoResponsavelPlano.hidden = false;
    campoResponsavelPlano.required = true;

    try {
        const usuarios = await listarUsuariosDaEmpresa(gheAtual.id_empresa);
        campoResponsavelPlano.innerHTML = '<option value="">Selecione...</option>';
        usuarios.forEach((usuario) => {
            const opcao = document.createElement('option');
            opcao.value = usuario.id_usuario;
            opcao.textContent = usuario.nome;
            campoResponsavelPlano.appendChild(opcao);
        });
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
    }

    tituloModalPlano.textContent = 'Novo Plano de Amostragem';
    instanciaModalPlano.show();
}

function abrirFormularioEdicaoPlano() {
    formularioPlano.reset();
    limparErrosFormularioPlano();
    campoIdPlano.value = planoAtual.id_plano_amostragem;
    campoUniversoPlano.value = planoAtual.universo_snapshot;
    campoUniversoPlano.disabled = true; // snapshot historico - nao editavel (secao 15)
    campoAmostraPlano.value = planoAtual.amostra_planejada;
    campoStatusPlano.value = planoAtual.status;
    campoDataPlano.value = planoAtual.data_plano;
    // Responsavel tambem nao e editavel na edicao (mesmo motivo do
    // universo_snapshot - preserva quem planejou originalmente).
    grupoResponsavelPlano.hidden = true;
    campoResponsavelPlano.required = false;
    tituloModalPlano.textContent = 'Editar Plano de Amostragem';
    instanciaModalPlano.show();
}

function validarFormularioPlano() {
    limparErrosFormularioPlano();
    let valido = true;

    const universo = Number(campoUniversoPlano.value);
    const amostra = Number(campoAmostraPlano.value);

    if (!campoUniversoPlano.value || !Number.isInteger(universo) || universo <= 0) {
        definirErroCampoPlano(campoUniversoPlano, 'erro-universo-plano', 'Informe um universo válido.');
        valido = false;
    }
    if (!campoAmostraPlano.value || !Number.isInteger(amostra) || amostra <= 0) {
        definirErroCampoPlano(campoAmostraPlano, 'erro-amostra-plano', 'Informe uma amostra válida.');
        valido = false;
    }
    if (valido && amostra > universo) {
        definirErroCampoPlano(campoAmostraPlano, 'erro-amostra-plano', 'A amostra não pode ser maior que o universo.');
        valido = false;
    }
    if (!campoPreenchido(campoDataPlano.value)) {
        definirErroCampoPlano(campoDataPlano, 'erro-data-plano', 'Informe a data do plano.');
        valido = false;
    }
    if (!campoIdPlano.value && !campoResponsavelPlano.value) {
        definirErroCampoPlano(campoResponsavelPlano, 'erro-responsavel-plano', 'Selecione o responsável.');
        valido = false;
    }

    if (!valido) return { valido: false };

    return {
        valido: true,
        dados: {
            id_ghe: idGhe,
            universo_snapshot: universo,
            amostra_planejada: amostra,
            status: campoStatusPlano.value,
            data_plano: campoDataPlano.value,
            id_responsavel: campoResponsavelPlano.value ? Number(campoResponsavelPlano.value) : null,
            criterio: document.getElementById('campo-criterio-plano').value,
            observacao: document.getElementById('campo-observacao-plano').value,
        },
    };
}

formularioPlano.addEventListener('submit', async (event) => {
    event.preventDefault();
    const resultado = validarFormularioPlano();
    if (!resultado.valido) return;

    const idExistente = campoIdPlano.value;
    const textoOriginal = botaoSalvarPlano.textContent;
    botaoSalvarPlano.disabled = true;
    botaoSalvarPlano.textContent = 'Salvando...';

    try {
        if (idExistente) {
            await atualizarPlanoAmostragem(Number(idExistente), resultado.dados);
            mostrarNotificacao('Plano de amostragem atualizado.', 'sucesso');
        } else {
            await criarPlanoAmostragem(resultado.dados);
            mostrarNotificacao('Plano de amostragem criado com sucesso.', 'sucesso');
        }
        instanciaModalPlano.hide();
        campoUniversoPlano.disabled = false;
        await carregarPlano();
        atualizarNumerosDestaque();
    } catch (error) {
        console.error('Erro ao salvar plano de amostragem:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarPlano.disabled = false;
        botaoSalvarPlano.textContent = textoOriginal;
    }
});

document.getElementById('botao-criar-plano').addEventListener('click', abrirFormularioCriacaoPlano);
botaoEditarPlano.addEventListener('click', abrirFormularioEdicaoPlano);

// --- Participantes ---------------------------------------------------------------
async function carregarParticipantes() {
    participantesAtuais = await listarParticipantes(planoAtual.id_plano_amostragem);
    atualizarNumerosDestaque();

    textoResumoParticipantes.textContent =
        `${participantesAtuais.length} de ${planoAtual.amostra_planejada} participante(s) planejado(s) registrados.`;

    if (participantesAtuais.length === 0) {
        areaSemParticipantes.hidden = false;
        areaTabelaParticipantes.hidden = true;
        return;
    }
    areaSemParticipantes.hidden = true;
    areaTabelaParticipantes.hidden = false;
    corpoTabelaParticipantes.innerHTML = '';
    participantesAtuais.forEach((participante) => {
        const linha = document.createElement('tr');

        const celulaNome = document.createElement('td');
        celulaNome.textContent = participante.colaborador_nome || '-';
        const celulaMatricula = document.createElement('td');
        celulaMatricula.textContent = participante.colaborador_matricula || '-';
        const celulaSetor = document.createElement('td');
        celulaSetor.textContent = participante.setor_nome || '-';
        const celulaCargo = document.createElement('td');
        celulaCargo.textContent = participante.cargo_nome || '-';

        const celulaAcoes = document.createElement('td');
        const botaoRemover = document.createElement('button');
        botaoRemover.type = 'button';
        botaoRemover.className = 'btn btn-sm btn-outline-danger';
        botaoRemover.title = 'Remover participante';
        botaoRemover.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        botaoRemover.addEventListener('click', async () => {
            try {
                await removerParticipante(participante.id_amostra_participante);
                mostrarNotificacao('Participante removido.', 'sucesso');
                await carregarParticipantes();
            } catch (error) {
                console.error('Erro ao remover participante:', error);
                mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
            }
        });
        celulaAcoes.appendChild(botaoRemover);

        linha.append(celulaNome, celulaMatricula, celulaSetor, celulaCargo, celulaAcoes);
        corpoTabelaParticipantes.appendChild(linha);
    });
}

botaoAdicionarParticipante.addEventListener('click', async () => {
    if (cargosAtuais.length === 0) {
        mostrarNotificacao('Associe ao menos um cargo a este GHE antes de adicionar participantes.', 'erro');
        return;
    }

    formularioParticipante.reset();
    campoVinculoParticipante.classList.remove('is-invalid');
    campoVinculoParticipante.innerHTML = '<option value="">Selecione...</option>';
    try {
        // Somente vinculos compativeis com este GHE (mesmo setor, quando o
        // GHE tiver um definido, e cargo dentre os associados) - nunca
        // todos os vinculos da empresa (correcao: evita registrar um
        // participante de setor/cargo incompativel com o GHE).
        const vinculos = await listarVinculosCompativeisComGhe(idGhe);
        const idsJaParticipantes = new Set(participantesAtuais.map((p) => p.id_vinculo));
        const disponiveis = vinculos.filter((vinculo) => !idsJaParticipantes.has(vinculo.id_vinculo));

        disponiveis.forEach((vinculo) => {
            const opcao = document.createElement('option');
            opcao.value = vinculo.id_vinculo;
            opcao.textContent = `${vinculo.colaborador_nome} — ${vinculo.setor_nome || 'Sem setor'} / ${vinculo.cargo_nome || 'Sem cargo'}`;
            campoVinculoParticipante.appendChild(opcao);
        });

        if (disponiveis.length === 0) {
            mostrarNotificacao('Não há colaboradores compatíveis disponíveis para este GHE no momento.', 'info');
            return;
        }

        instanciaModalParticipante.show();
    } catch (error) {
        console.error('Erro ao carregar vínculos disponíveis:', error);
        if (error?.code === 'GHE_SEM_CARGOS_ASSOCIADOS') {
            mostrarNotificacao(error.message, 'erro');
        } else {
            mostrarNotificacao('Não foi possível carregar os colaboradores disponíveis.', 'erro');
        }
    }
});

formularioParticipante.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!campoVinculoParticipante.value) {
        campoVinculoParticipante.classList.add('is-invalid');
        document.getElementById('erro-vinculo-participante').textContent = 'Selecione o colaborador.';
        return;
    }

    const botao = document.getElementById('botao-confirmar-participante');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Adicionando...';

    try {
        await adicionarParticipante(planoAtual.id_plano_amostragem, Number(campoVinculoParticipante.value));
        mostrarNotificacao('Participante adicionado com sucesso.', 'sucesso');
        instanciaModalParticipante.hide();
        await carregarParticipantes();
    } catch (error) {
        console.error('Erro ao adicionar participante:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
});

// --- Avaliacao do GHE (MVP-07) ---------------------------------------------------
const ROTULOS_STATUS_AVALIACAO_GHE = {
    RASCUNHO: 'Rascunho',
    EM_COLETA: 'Em coleta',
    CONSOLIDADA: 'Consolidada',
    CANCELADA: 'Cancelada',
};

async function carregarAvaliacaoGhe() {
    cardAvaliacaoGhe.hidden = false;
    botaoNovaAvaliacaoGhe.hidden = true;
    botaoContinuarAvaliacaoGhe.hidden = true;
    linkVerConsolidacaoGhe.hidden = true;
    botaoNovaAvaliacaoGhe.textContent = 'Nova Avaliação do GHE';

    if (!planoAtual) {
        textoAvaliacaoGheStatus.textContent = 'Crie um plano de amostragem antes de iniciar a avaliação do GHE.';
        return;
    }

    let avaliacaoGheAtual;
    try {
        avaliacaoGheAtual = await buscarAvaliacaoGheAtual(idGhe);
    } catch (error) {
        console.error('Erro ao carregar avaliação do GHE:', error);
        textoAvaliacaoGheStatus.textContent = 'Não foi possível carregar a avaliação do GHE.';
        return;
    }

    if (!avaliacaoGheAtual) {
        textoAvaliacaoGheStatus.textContent = 'Nenhuma avaliação do GHE foi iniciada ainda.';
        botaoNovaAvaliacaoGhe.hidden = false;
        return;
    }

    const rotulo = ROTULOS_STATUS_AVALIACAO_GHE[avaliacaoGheAtual.status] || avaliacaoGheAtual.status;
    textoAvaliacaoGheStatus.textContent = `Status: ${rotulo} — iniciada em ${formatarDataBR(avaliacaoGheAtual.data_avaliacao.slice(0, 10))}.`;

    if (['RASCUNHO', 'EM_COLETA'].includes(avaliacaoGheAtual.status)) {
        botaoContinuarAvaliacaoGhe.hidden = false;
        linkVerConsolidacaoGhe.hidden = false;
    } else if (avaliacaoGheAtual.status === 'CONSOLIDADA') {
        linkVerConsolidacaoGhe.hidden = false;
        botaoNovaAvaliacaoGhe.hidden = false;
        botaoNovaAvaliacaoGhe.textContent = 'Iniciar Nova Rodada';
    } else if (avaliacaoGheAtual.status === 'CANCELADA') {
        botaoNovaAvaliacaoGhe.hidden = false;
    }
    linkVerConsolidacaoGhe.href = `consolidacao-ghe.html?id_avaliacao_ghe=${avaliacaoGheAtual.id_avaliacao_ghe}`;
}

async function avancarParaAvaliacaoGhe(botao) {
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Processando...';

    try {
        const avaliador = await obterAvaliadorPadrao(gheAtual.id_empresa);
        if (!avaliador) {
            mostrarNotificacao('Nenhum avaliador ativo cadastrado para esta empresa.', 'erro');
            return;
        }
        const avaliacao = await iniciarOuContinuarAvaliacaoGhe({ id_ghe: idGhe, id_avaliador: avaliador.id_usuario });
        window.location.href = `avaliacao-ghe.html?id_avaliacao_ghe=${avaliacao.id_avaliacao_ghe}`;
    } catch (error) {
        console.error('Erro ao iniciar/continuar avaliação do GHE:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

botaoNovaAvaliacaoGhe.addEventListener('click', () => avancarParaAvaliacaoGhe(botaoNovaAvaliacaoGhe));
botaoContinuarAvaliacaoGhe.addEventListener('click', () => avancarParaAvaliacaoGhe(botaoContinuarAvaliacaoGhe));

// --- Editar / ativar-desativar GHE -----------------------------------------------
function limparErrosFormularioGhe() {
    [campoNomeGhe, campoUniversoGhe].forEach((c) => c.classList.remove('is-invalid'));
    ['erro-nome-ghe', 'erro-universo-ghe'].forEach((id) => { document.getElementById(id).textContent = ''; });
}

document.getElementById('botao-editar-ghe').addEventListener('click', async () => {
    formularioGhe.reset();
    limparErrosFormularioGhe();
    campoCodigoGhe.value = gheAtual.codigo || '';
    campoNomeGhe.value = gheAtual.nome;
    campoUniversoGhe.value = gheAtual.universo;
    campoDescricaoGhe.value = gheAtual.descricao || '';

    campoSetorGhe.innerHTML = '<option value="">Não especificado</option>';
    try {
        const setores = await listarSetoresDaEmpresa();
        setores.forEach((setor) => {
            const opcao = document.createElement('option');
            opcao.value = setor.id_setor;
            opcao.textContent = setor.nome;
            campoSetorGhe.appendChild(opcao);
        });
        campoSetorGhe.value = gheAtual.id_setor || '';
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
    }

    instanciaModalGhe.show();
});

formularioGhe.addEventListener('submit', async (event) => {
    event.preventDefault();
    limparErrosFormularioGhe();
    let valido = true;

    if (!campoPreenchido(campoNomeGhe.value)) {
        campoNomeGhe.classList.add('is-invalid');
        document.getElementById('erro-nome-ghe').textContent = 'Informe o nome do GHE.';
        valido = false;
    }
    const universo = Number(campoUniversoGhe.value);
    if (!campoUniversoGhe.value || !Number.isInteger(universo) || universo <= 0) {
        campoUniversoGhe.classList.add('is-invalid');
        document.getElementById('erro-universo-ghe').textContent = 'Informe um universo válido.';
        valido = false;
    }
    if (!valido) return;

    const textoOriginal = botaoSalvarGhe.textContent;
    botaoSalvarGhe.disabled = true;
    botaoSalvarGhe.textContent = 'Salvando...';

    try {
        gheAtual = await atualizarGhe(idGhe, {
            id_setor: campoSetorGhe.value ? Number(campoSetorGhe.value) : null,
            codigo: campoCodigoGhe.value,
            nome: campoNomeGhe.value,
            descricao: campoDescricaoGhe.value,
            universo,
        });
        mostrarNotificacao('GHE atualizado com sucesso.', 'sucesso');
        instanciaModalGhe.hide();
        const nomeEmpresa = await buscarNomeEmpresa(gheAtual.id_empresa);
        renderizarGhe(nomeEmpresa);
    } catch (error) {
        console.error('Erro ao atualizar GHE:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarGhe.disabled = false;
        botaoSalvarGhe.textContent = textoOriginal;
    }
});

botaoAlternarStatusGhe.addEventListener('click', async () => {
    const novoStatus = !gheAtual.ativo;
    // Evita duplo clique disparar duas trocas de status em corrida (mesmo
    // principio ja usado nos botoes de salvar do restante do app).
    botaoAlternarStatusGhe.disabled = true;
    try {
        gheAtual = await alternarStatusGhe(idGhe, novoStatus);
        mostrarNotificacao(novoStatus ? 'GHE ativado.' : 'GHE desativado.', 'sucesso');
        const nomeEmpresa = await buscarNomeEmpresa(gheAtual.id_empresa);
        renderizarGhe(nomeEmpresa);
    } catch (error) {
        console.error('Erro ao alternar status do GHE:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoAlternarStatusGhe.disabled = false;
    }
});

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
