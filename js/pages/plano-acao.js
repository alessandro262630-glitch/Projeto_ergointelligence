import { buscarAvaliacaoPorId, obterAvaliadorPadrao } from '../services/avaliacaoService.js';
import { buscarVinculoPorId } from '../services/vinculoService.js';
import { buscarColaboradorPorId } from '../services/colaboradorService.js';
import { buscarClassificacaoPorId } from '../services/riscoService.js';
import {
    buscarPlanoPorAvaliacao,
    criarPlano,
    atualizarPlano,
    listarAcoesDoPlano,
    buscarAcaoPorId,
    criarAcao,
    atualizarAcao,
    alterarStatusAcao,
    listarUsuariosDaEmpresa,
    listarRecomendacoesDisponiveisDaAvaliacao,
} from '../services/planoAcaoService.js';
import { formatarDataBR } from '../utils/formatadores.js';
import { campoPreenchido } from '../utils/validacoes.js';
import { mostrarNotificacao as mostrarNotificacaoBase } from '../utils/notificacoes.js';

// FEIRA-04 - Plano de Acao MVP.
// So LE resultado de risco/classificacao/recomendacoes ja persistidos -
// NUNCA chama motorRisco.js/classificadorRisco.js/riscoService.js.
// processarRiscosDaAvaliacao e NUNCA gera avaliacao_recomendacao nova.
// Toda escrita passa por js/services/planoAcaoService.js (PLANO_ACAO e
// ACAO_PLANO, tabelas ja existentes no schema - nenhuma tabela nova).

// --- Contexto: id_avaliacao vem da URL -----------------------------------------
const parametrosUrl = new URLSearchParams(window.location.search);
const idAvaliacao = Number(parametrosUrl.get('id_avaliacao')) || null;

// --- Referencias de DOM ---------------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const areaConteudo = document.getElementById('area-conteudo');
const areaNotificacoes = document.getElementById('area-notificacoes');
const linkVoltarResultado = document.getElementById('link-voltar-resultado');

const textoContextoColaborador = document.getElementById('texto-contexto-colaborador');
const textoContextoSetor = document.getElementById('texto-contexto-setor');
const textoContextoData = document.getElementById('texto-contexto-data');
const textoContextoClassificacao = document.getElementById('texto-contexto-classificacao');

const areaSemPlano = document.getElementById('area-sem-plano');
const areaPlano = document.getElementById('area-plano');
const botaoCriarPlano = document.getElementById('botao-criar-plano');
const botaoEditarPlano = document.getElementById('botao-editar-plano');

const textoPlanoTitulo = document.getElementById('texto-plano-titulo');
const textoPlanoDescricao = document.getElementById('texto-plano-descricao');
const badgePlanoStatus = document.getElementById('badge-plano-status');
const textoPlanoDataInicio = document.getElementById('texto-plano-data-inicio');
const textoPlanoDataAlvo = document.getElementById('texto-plano-data-alvo');
const textoPlanoDataConclusao = document.getElementById('texto-plano-data-conclusao');

const resumoTotal = document.getElementById('resumo-total');
const resumoAbertas = document.getElementById('resumo-abertas');
const resumoAndamento = document.getElementById('resumo-andamento');
const resumoConcluidas = document.getElementById('resumo-concluidas');

const areaSemAcoes = document.getElementById('area-sem-acoes');
const areaTabelaAcoes = document.getElementById('area-tabela-acoes');
const corpoTabelaAcoes = document.getElementById('corpo-tabela-acoes');
const botaoAdicionarAcao = document.getElementById('botao-adicionar-acao');

const modalPlano = document.getElementById('modal-plano');
const tituloModalPlano = document.getElementById('modal-plano-titulo');
const formularioPlano = document.getElementById('formulario-plano');
const campoIdPlano = document.getElementById('campo-id-plano');
const campoTituloPlano = document.getElementById('campo-titulo-plano');
const campoDescricaoPlano = document.getElementById('campo-descricao-plano');
const campoStatusPlano = document.getElementById('campo-status-plano');
const campoDataInicioPlano = document.getElementById('campo-data-inicio-plano');
const campoDataAlvoPlano = document.getElementById('campo-data-alvo-plano');
const campoDataConclusaoPlano = document.getElementById('campo-data-conclusao-plano');
const botaoSalvarPlano = document.getElementById('botao-salvar-plano');

const modalAcao = document.getElementById('modal-acao');
const tituloModalAcao = document.getElementById('modal-acao-titulo');
const formularioAcao = document.getElementById('formulario-acao');
const campoIdAcao = document.getElementById('campo-id-acao');
const campoDescricaoAcao = document.getElementById('campo-descricao-acao');
const campoRecomendacaoAcao = document.getElementById('campo-recomendacao-acao');
const campoResponsavelAcao = document.getElementById('campo-responsavel-acao');
const campoPrioridadeAcao = document.getElementById('campo-prioridade-acao');
const campoPrazoAcao = document.getElementById('campo-prazo-acao');
const campoStatusAcao = document.getElementById('campo-status-acao');
const grupoDataConclusaoAcao = document.getElementById('grupo-data-conclusao-acao');
const campoDataConclusaoAcao = document.getElementById('campo-data-conclusao-acao');
const campoEvidenciaAcao = document.getElementById('campo-evidencia-acao');
const botaoSalvarAcao = document.getElementById('botao-salvar-acao');

const modalConcluirAcao = document.getElementById('modal-concluir-acao');
const formularioConcluirAcao = document.getElementById('formulario-concluir-acao');
const campoIdAcaoConcluir = document.getElementById('campo-id-acao-concluir');
const campoDataConclusaoRapida = document.getElementById('campo-data-conclusao-rapida');
const botaoConfirmarConcluir = document.getElementById('botao-confirmar-concluir');

const instanciaModalPlano = new bootstrap.Modal(modalPlano);
const instanciaModalAcao = new bootstrap.Modal(modalAcao);
const instanciaModalConcluir = new bootstrap.Modal(modalConcluirAcao);

// --- Estado local da pagina -------------------------------------------------------
let avaliacaoAtual = null;
let avaliadorPadrao = null; // usado como plano_acao.criado_por (secao 32 - sem auth no MVP)
let planoAtual = null;
let acoesAtuais = [];
let usuariosDaEmpresa = [];
let recomendacoesDaAvaliacao = [];

function mostrarNotificacao(texto, tipo = 'info') {
    mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

function dataHojeIso() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

// --- Estados de carregamento / vazio / erro / pronto ------------------------------
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

// --- Rotulos amigaveis (apenas exibicao - valores oficiais nunca mudam) -----------
const ROTULOS_STATUS_PLANO = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const CORES_STATUS_PLANO = { ABERTO: 'text-bg-secondary', EM_ANDAMENTO: 'text-bg-primary', CONCLUIDO: 'text-bg-success', CANCELADO: 'text-bg-danger' };

const ROTULOS_STATUS_ACAO = { ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', BLOQUEADA: 'Bloqueada', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };
const ROTULOS_PRIORIDADE_ACAO = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const CORES_PRIORIDADE_ACAO = { BAIXA: 'text-bg-light border text-dark', MEDIA: 'text-bg-info', ALTA: 'text-bg-warning text-dark', CRITICA: 'text-bg-danger' };
const ROTULOS_STATUS_RECOMENDACAO = { SUGERIDA: 'Sugerida', ACEITA: 'Aceita', REJEITADA: 'Rejeitada', CONCLUIDA: 'Concluída' };

const STATUS_ACAO_CONCLUIDOS = ['CONCLUIDA', 'CANCELADA'];

function acaoAtrasada(acao) {
    return Boolean(acao.prazo) && acao.prazo < dataHojeIso() && !STATUS_ACAO_CONCLUIDOS.includes(acao.status);
}

// --- Carga inicial -----------------------------------------------------------------
async function carregarPagina() {
    if (!idAvaliacao) {
        definirEstado(
            'erro',
            'Nenhuma avaliação selecionada. Acesse o Plano de Ação a partir do Resultado de uma avaliação finalizada.',
        );
        return;
    }

    definirEstado('carregando', 'Carregando Plano de Ação...');
    linkVoltarResultado.href = `resultado.html?id_avaliacao=${idAvaliacao}`;

    try {
        avaliacaoAtual = await buscarAvaliacaoPorId(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    if (avaliacaoAtual.status !== 'FINALIZADA') {
        definirEstado('erro', 'Finalize a avaliação e calcule o resultado antes de acessar o Plano de Ação.');
        return;
    }

    try {
        await carregarContexto();
        avaliadorPadrao = await obterAvaliadorPadrao(avaliacaoAtual.id_empresa);
        usuariosDaEmpresa = await listarUsuariosDaEmpresa(avaliacaoAtual.id_empresa);
        recomendacoesDaAvaliacao = await listarRecomendacoesDisponiveisDaAvaliacao(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar contexto do plano de ação:', error);
        definirEstado('erro', 'Não foi possível carregar o contexto da avaliação.');
        return;
    }

    try {
        await carregarPlano();
    } catch (error) {
        console.error('Erro ao carregar plano de ação:', error);
        definirEstado('erro', 'Não foi possível carregar o plano de ação desta avaliação.');
        return;
    }

    definirEstado('pronto');
}

// --- Contexto (secao 17/18) ---------------------------------------------------------
async function carregarContexto() {
    const vinculo = await buscarVinculoPorId(avaliacaoAtual.id_vinculo);
    const colaborador = await buscarColaboradorPorId(vinculo.id_colaborador);

    textoContextoColaborador.textContent = colaborador.nome;
    textoContextoSetor.textContent = vinculo.setor || '-';
    // data_avaliacao e TIMESTAMPTZ (tem hora); formatarDataBR espera so a
    // parte de data (YYYY-MM-DD), mesma extracao ja usada em
    // dashboardService.agruparAvaliacoesPorMes para este mesmo campo.
    textoContextoData.textContent = formatarDataBR(String(avaliacaoAtual.data_avaliacao).slice(0, 10));

    textoContextoClassificacao.innerHTML = '';
    if (avaliacaoAtual.id_classificacao_geral) {
        const classificacao = await buscarClassificacaoPorId(avaliacaoAtual.id_classificacao_geral);
        const badge = document.createElement('span');
        badge.className = 'badge';
        // Cor vem de classificacao_risco.cor_hex (nunca hardcoded), mesmo
        // padrao de resultado.js - a classificacao NUNCA e recalculada
        // aqui (secao 18), so exibida a partir do resultado ja persistido.
        badge.style.backgroundColor = classificacao.cor_hex || '#6c757d';
        badge.style.color = '#fff';
        badge.textContent = classificacao.nome;
        textoContextoClassificacao.appendChild(badge);
    } else {
        textoContextoClassificacao.textContent = '-';
    }
}

// --- Plano (secao 15/16) -------------------------------------------------------------
async function carregarPlano() {
    planoAtual = await buscarPlanoPorAvaliacao(idAvaliacao);

    if (!planoAtual) {
        areaSemPlano.hidden = false;
        areaPlano.hidden = true;
        return;
    }

    areaSemPlano.hidden = true;
    areaPlano.hidden = false;
    renderizarPlano();
    await carregarAcoes();
}

function renderizarPlano() {
    textoPlanoTitulo.textContent = planoAtual.titulo;
    textoPlanoDescricao.textContent = planoAtual.descricao || 'Sem descrição.';
    badgePlanoStatus.className = `badge ${CORES_STATUS_PLANO[planoAtual.status] || 'text-bg-secondary'}`;
    badgePlanoStatus.textContent = ROTULOS_STATUS_PLANO[planoAtual.status] || planoAtual.status;
    textoPlanoDataInicio.textContent = formatarDataBR(planoAtual.data_inicio);
    textoPlanoDataAlvo.textContent = planoAtual.data_alvo ? formatarDataBR(planoAtual.data_alvo) : '-';
    textoPlanoDataConclusao.textContent = planoAtual.data_conclusao ? formatarDataBR(planoAtual.data_conclusao) : '-';
}

// --- Acoes do plano (secao 25/26/42) --------------------------------------------------
async function carregarAcoes() {
    acoesAtuais = await listarAcoesDoPlano(planoAtual.id_plano);
    renderizarResumo();
    renderizarTabelaAcoes();
}

// Contagens calculadas em memoria a partir das acoes carregadas (secao 42:
// "nao hardcodar numeros"). BLOQUEADA e agrupada visualmente junto de "Em
// andamento" (nao e concluida nem cancelada) - o status real gravado no
// banco permanece intacto, isso e so um agrupamento de exibicao.
function renderizarResumo() {
    resumoTotal.textContent = acoesAtuais.length;
    resumoAbertas.textContent = acoesAtuais.filter((acao) => acao.status === 'ABERTA').length;
    resumoAndamento.textContent = acoesAtuais.filter((acao) => acao.status === 'EM_ANDAMENTO' || acao.status === 'BLOQUEADA').length;
    resumoConcluidas.textContent = acoesAtuais.filter((acao) => acao.status === 'CONCLUIDA').length;
}

function criarCelulaOrigem(acao) {
    const celula = document.createElement('td');
    if (acao.recomendacao_titulo) {
        celula.textContent = acao.recomendacao_codigo ? `${acao.recomendacao_codigo} — ${acao.recomendacao_titulo}` : acao.recomendacao_titulo;
    } else {
        const span = document.createElement('span');
        span.className = 'text-muted';
        span.textContent = 'Manual';
        celula.appendChild(span);
    }
    return celula;
}

function criarSelectStatusAcao(acao) {
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.style.minWidth = '9.5rem';
    Object.entries(ROTULOS_STATUS_ACAO).forEach(([valor, rotulo]) => {
        const opcao = document.createElement('option');
        opcao.value = valor;
        opcao.textContent = rotulo;
        select.appendChild(opcao);
    });
    select.value = acao.status;
    select.dataset.valorAnterior = acao.status;

    select.addEventListener('change', async () => {
        const novoStatus = select.value;

        if (novoStatus === 'CONCLUIDA') {
            abrirModalConcluirAcao(acao.id_acao, select);
            return;
        }

        select.disabled = true;
        try {
            await alterarStatusAcao(acao.id_acao, novoStatus);
            mostrarNotificacao('Status atualizado.', 'sucesso');
            await carregarAcoes();
        } catch (error) {
            console.error('Erro ao alterar status da ação:', error);
            mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
            select.value = select.dataset.valorAnterior;
            select.disabled = false;
        }
    });

    return select;
}

function criarLinhaAcao(acao) {
    const linha = document.createElement('tr');

    const celulaDescricao = document.createElement('td');
    celulaDescricao.textContent = acao.descricao;
    if (acaoAtrasada(acao)) {
        const selo = document.createElement('div');
        selo.className = 'selo-atrasada';
        selo.textContent = 'ATRASADA';
        celulaDescricao.appendChild(selo);
    }

    const celulaResponsavel = document.createElement('td');
    celulaResponsavel.textContent = acao.responsavel_nome || '-';

    const celulaPrioridade = document.createElement('td');
    const badgePrioridade = document.createElement('span');
    badgePrioridade.className = `badge ${CORES_PRIORIDADE_ACAO[acao.prioridade] || 'text-bg-light border text-dark'}`;
    badgePrioridade.textContent = ROTULOS_PRIORIDADE_ACAO[acao.prioridade] || acao.prioridade;
    celulaPrioridade.appendChild(badgePrioridade);

    const celulaPrazo = document.createElement('td');
    celulaPrazo.textContent = formatarDataBR(acao.prazo);

    const celulaStatus = document.createElement('td');
    celulaStatus.appendChild(criarSelectStatusAcao(acao));

    const celulaAcoes = document.createElement('td');
    const botaoEditar = document.createElement('button');
    botaoEditar.type = 'button';
    botaoEditar.className = 'btn btn-sm btn-outline-secondary';
    botaoEditar.setAttribute('aria-label', 'Editar ação');
    botaoEditar.title = 'Editar ação';
    botaoEditar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
    botaoEditar.addEventListener('click', () => abrirFormularioEdicaoAcao(acao.id_acao));
    celulaAcoes.appendChild(botaoEditar);

    linha.append(celulaDescricao, criarCelulaOrigem(acao), celulaResponsavel, celulaPrioridade, celulaPrazo, celulaStatus, celulaAcoes);
    return linha;
}

function renderizarTabelaAcoes() {
    if (acoesAtuais.length === 0) {
        areaSemAcoes.hidden = false;
        areaTabelaAcoes.hidden = true;
        return;
    }
    areaSemAcoes.hidden = true;
    areaTabelaAcoes.hidden = false;
    corpoTabelaAcoes.innerHTML = '';
    acoesAtuais.forEach((acao) => corpoTabelaAcoes.appendChild(criarLinhaAcao(acao)));
}

// --- Erros amigaveis (mesmo padrao de vinculos.js) ------------------------------------
function mensagemErroAmigavel(error) {
    const codigo = error?.code;
    if (codigo && codigo !== '23503' && codigo !== '23514' && codigo !== '23505' && !/^\d+$/.test(String(codigo))) {
        // Codigos definidos pelo proprio planoAcaoService.js (ex.:
        // TITULO_OBRIGATORIO, DATA_CONCLUSAO_OBRIGATORIA) ja trazem
        // mensagem pronta para o usuario.
        return error.message;
    }
    if (codigo === '23503') {
        return 'Não foi possível localizar um dos itens selecionados (responsável ou recomendação).';
    }
    if (codigo === '23514') {
        return 'Verifique os dados informados, especialmente as datas.';
    }
    const mensagem = (error?.message || '').toLowerCase();
    if (mensagem.includes('permission denied') || mensagem.includes('policy') || mensagem.includes('rls')) {
        return 'Sem permissão para realizar esta operação. Verifique as políticas de acesso do Supabase.';
    }
    return 'Não foi possível salvar. Tente novamente.';
}

// =====================================================================
// Modal: Plano de Acao (criar/editar - secao 19-24/38)
// =====================================================================

function limparErrosFormularioPlano() {
    [campoTituloPlano, campoDataInicioPlano, campoDataAlvoPlano, campoDataConclusaoPlano].forEach((campo) => {
        campo.classList.remove('is-invalid');
    });
    ['erro-titulo-plano', 'erro-data-inicio-plano', 'erro-data-alvo-plano', 'erro-data-conclusao-plano'].forEach((id) => {
        document.getElementById(id).textContent = '';
    });
}

function definirErroCampoPlano(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacaoPlano() {
    formularioPlano.reset();
    limparErrosFormularioPlano();
    campoIdPlano.value = '';
    campoStatusPlano.value = 'ABERTO';
    campoDataInicioPlano.value = dataHojeIso();
    campoDataInicioPlano.disabled = false;
    tituloModalPlano.textContent = 'Novo Plano de Ação';
    instanciaModalPlano.show();
    campoTituloPlano.focus();
}

function abrirFormularioEdicaoPlano() {
    formularioPlano.reset();
    limparErrosFormularioPlano();
    campoIdPlano.value = planoAtual.id_plano;
    campoTituloPlano.value = planoAtual.titulo;
    campoDescricaoPlano.value = planoAtual.descricao || '';
    campoStatusPlano.value = planoAtual.status;
    campoDataInicioPlano.value = planoAtual.data_inicio;
    // data_inicio nao e alteravel na edicao (secao 38) - mantida visivel
    // para contexto, apenas desabilitada.
    campoDataInicioPlano.disabled = true;
    campoDataAlvoPlano.value = planoAtual.data_alvo || '';
    campoDataConclusaoPlano.value = planoAtual.data_conclusao || '';
    tituloModalPlano.textContent = 'Editar Plano de Ação';
    instanciaModalPlano.show();
    campoTituloPlano.focus();
}

function validarFormularioPlano() {
    limparErrosFormularioPlano();
    let valido = true;

    if (!campoPreenchido(campoTituloPlano.value)) {
        definirErroCampoPlano(campoTituloPlano, 'erro-titulo-plano', 'Informe o título do plano.');
        valido = false;
    }
    if (!campoPreenchido(campoDataInicioPlano.value)) {
        definirErroCampoPlano(campoDataInicioPlano, 'erro-data-inicio-plano', 'Informe a data de início.');
        valido = false;
    }

    const dataInicio = campoDataInicioPlano.value;
    const dataAlvo = campoDataAlvoPlano.value;
    const dataConclusao = campoDataConclusaoPlano.value;

    if (dataAlvo && dataInicio && dataAlvo < dataInicio) {
        definirErroCampoPlano(campoDataAlvoPlano, 'erro-data-alvo-plano', 'A data alvo não pode ser anterior à data de início.');
        valido = false;
    }
    if (dataConclusao && dataInicio && dataConclusao < dataInicio) {
        definirErroCampoPlano(campoDataConclusaoPlano, 'erro-data-conclusao-plano', 'A data de conclusão não pode ser anterior à data de início.');
        valido = false;
    }

    if (!valido) {
        return { valido: false };
    }

    return {
        valido: true,
        dados: {
            id_avaliacao: idAvaliacao,
            titulo: campoTituloPlano.value,
            descricao: campoDescricaoPlano.value,
            status: campoStatusPlano.value,
            criado_por: avaliadorPadrao?.id_usuario ?? null,
            data_inicio: dataInicio,
            data_alvo: dataAlvo || null,
            data_conclusao: dataConclusao || null,
        },
    };
}

formularioPlano.addEventListener('submit', async (event) => {
    event.preventDefault();

    const resultado = validarFormularioPlano();
    if (!resultado.valido) {
        return;
    }

    const idExistente = campoIdPlano.value;
    if (!idExistente && !resultado.dados.criado_por) {
        mostrarNotificacao('Não foi possível identificar um usuário responsável pela criação do plano nesta empresa.', 'erro');
        return;
    }

    const textoOriginal = botaoSalvarPlano.textContent;
    botaoSalvarPlano.disabled = true;
    botaoSalvarPlano.textContent = 'Salvando...';

    try {
        if (idExistente) {
            await atualizarPlano(Number(idExistente), resultado.dados);
            mostrarNotificacao('Plano atualizado com sucesso.', 'sucesso');
        } else {
            await criarPlano(resultado.dados);
            mostrarNotificacao('Plano criado com sucesso.', 'sucesso');
        }
        instanciaModalPlano.hide();
        await carregarPlano();
    } catch (error) {
        console.error('Erro ao salvar plano de ação:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarPlano.disabled = false;
        botaoSalvarPlano.textContent = textoOriginal;
    }
});

botaoCriarPlano.addEventListener('click', abrirFormularioCriacaoPlano);
botaoEditarPlano.addEventListener('click', abrirFormularioEdicaoPlano);

// =====================================================================
// Modal: Acao do plano (criar/editar - secao 27-37)
// =====================================================================

function preencherSelectResponsaveis(selecionado = '') {
    campoResponsavelAcao.innerHTML = '<option value="">Selecione...</option>';
    usuariosDaEmpresa.forEach((usuario) => {
        const opcao = document.createElement('option');
        opcao.value = usuario.id_usuario;
        opcao.textContent = usuario.nome;
        campoResponsavelAcao.appendChild(opcao);
    });
    campoResponsavelAcao.value = selecionado;
}

// So recomendacoes da MESMA avaliacao (secao 29/64) - recomendacoesDaAvaliacao
// ja vem filtrada por id_avaliacao (planoAcaoService.listarRecomendacoesDisponiveisDaAvaliacao).
function preencherSelectRecomendacoes(selecionado = '') {
    campoRecomendacaoAcao.innerHTML = '<option value="">Nenhuma (ação definida manualmente)</option>';
    recomendacoesDaAvaliacao.forEach((recomendacao) => {
        const opcao = document.createElement('option');
        opcao.value = recomendacao.id_avaliacao_recomendacao;
        const statusRotulo = ROTULOS_STATUS_RECOMENDACAO[recomendacao.status] || recomendacao.status;
        opcao.textContent = `${recomendacao.codigo || ''} — ${recomendacao.titulo || ''} (${statusRotulo})`;
        campoRecomendacaoAcao.appendChild(opcao);
    });
    campoRecomendacaoAcao.value = selecionado;
}

function alternarGrupoDataConclusaoAcao() {
    const exigeConclusao = campoStatusAcao.value === 'CONCLUIDA';
    grupoDataConclusaoAcao.hidden = !exigeConclusao;
    campoDataConclusaoAcao.required = exigeConclusao;
    if (exigeConclusao && !campoDataConclusaoAcao.value) {
        // Sugestao visivel e editavel (secao 36) - nunca gravada sem o
        // usuario ver/confirmar, ja que o campo continua no formulario.
        campoDataConclusaoAcao.value = dataHojeIso();
    }
}
campoStatusAcao.addEventListener('change', alternarGrupoDataConclusaoAcao);

function limparErrosFormularioAcao() {
    [campoDescricaoAcao, campoResponsavelAcao, campoPrazoAcao, campoDataConclusaoAcao].forEach((campo) => campo.classList.remove('is-invalid'));
    ['erro-descricao-acao', 'erro-responsavel-acao', 'erro-prazo-acao', 'erro-data-conclusao-acao'].forEach((id) => {
        document.getElementById(id).textContent = '';
    });
}

function definirErroCampoAcao(campo, idErro, mensagem) {
    campo.classList.add('is-invalid');
    document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacaoAcao() {
    formularioAcao.reset();
    limparErrosFormularioAcao();
    campoIdAcao.value = '';
    preencherSelectResponsaveis();
    preencherSelectRecomendacoes();
    campoPrioridadeAcao.value = 'MEDIA';
    campoStatusAcao.value = 'ABERTA';
    grupoDataConclusaoAcao.hidden = true;
    campoDataConclusaoAcao.required = false;
    campoDataConclusaoAcao.value = '';
    tituloModalAcao.textContent = 'Nova Ação';
    instanciaModalAcao.show();
    campoDescricaoAcao.focus();
}

async function abrirFormularioEdicaoAcao(idAcao) {
    try {
        const acao = await buscarAcaoPorId(idAcao);
        formularioAcao.reset();
        limparErrosFormularioAcao();
        campoIdAcao.value = acao.id_acao;
        campoDescricaoAcao.value = acao.descricao;
        preencherSelectResponsaveis(acao.id_responsavel);
        preencherSelectRecomendacoes(acao.id_avaliacao_recomendacao || '');
        campoPrioridadeAcao.value = acao.prioridade;
        campoPrazoAcao.value = acao.prazo;
        campoStatusAcao.value = acao.status;
        campoEvidenciaAcao.value = acao.evidencia_texto || '';
        campoDataConclusaoAcao.value = acao.data_conclusao || '';
        alternarGrupoDataConclusaoAcao();
        tituloModalAcao.textContent = 'Editar Ação';
        instanciaModalAcao.show();
        campoDescricaoAcao.focus();
    } catch (error) {
        console.error('Erro ao carregar ação para edição:', error);
        mostrarNotificacao('Não foi possível carregar os dados da ação.', 'erro');
    }
}

function validarFormularioAcao() {
    limparErrosFormularioAcao();
    let valido = true;

    if (!campoPreenchido(campoDescricaoAcao.value)) {
        definirErroCampoAcao(campoDescricaoAcao, 'erro-descricao-acao', 'Descreva a ação a ser realizada.');
        valido = false;
    }
    if (!campoResponsavelAcao.value) {
        definirErroCampoAcao(campoResponsavelAcao, 'erro-responsavel-acao', 'Selecione o responsável.');
        valido = false;
    }
    if (!campoPreenchido(campoPrazoAcao.value)) {
        definirErroCampoAcao(campoPrazoAcao, 'erro-prazo-acao', 'Informe o prazo.');
        valido = false;
    }
    if (campoStatusAcao.value === 'CONCLUIDA' && !campoPreenchido(campoDataConclusaoAcao.value)) {
        definirErroCampoAcao(campoDataConclusaoAcao, 'erro-data-conclusao-acao', 'Informe a data de conclusão.');
        valido = false;
    }

    if (!valido) {
        return { valido: false };
    }

    return {
        valido: true,
        dados: {
            id_avaliacao_recomendacao: campoRecomendacaoAcao.value ? Number(campoRecomendacaoAcao.value) : null,
            id_responsavel: Number(campoResponsavelAcao.value),
            descricao: campoDescricaoAcao.value,
            prioridade: campoPrioridadeAcao.value,
            prazo: campoPrazoAcao.value,
            status: campoStatusAcao.value,
            data_conclusao: campoStatusAcao.value === 'CONCLUIDA' ? campoDataConclusaoAcao.value : null,
            evidencia_texto: campoEvidenciaAcao.value,
        },
    };
}

formularioAcao.addEventListener('submit', async (event) => {
    event.preventDefault();

    const resultado = validarFormularioAcao();
    if (!resultado.valido) {
        return;
    }

    const idExistente = campoIdAcao.value;
    const textoOriginal = botaoSalvarAcao.textContent;
    botaoSalvarAcao.disabled = true;
    botaoSalvarAcao.textContent = 'Salvando...';

    try {
        if (idExistente) {
            await atualizarAcao(Number(idExistente), resultado.dados);
            mostrarNotificacao('Ação atualizada com sucesso.', 'sucesso');
        } else {
            await criarAcao({ ...resultado.dados, id_plano: planoAtual.id_plano });
            mostrarNotificacao('Ação cadastrada com sucesso.', 'sucesso');
        }
        instanciaModalAcao.hide();
        await carregarAcoes();
    } catch (error) {
        console.error('Erro ao salvar ação do plano:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoSalvarAcao.disabled = false;
        botaoSalvarAcao.textContent = textoOriginal;
    }
});

botaoAdicionarAcao.addEventListener('click', abrirFormularioCriacaoAcao);

// =====================================================================
// Modal: conclusao rapida (troca de status direto na tabela - secao 36/45)
// =====================================================================

let selectStatusEmEdicao = null;

function abrirModalConcluirAcao(idAcao, selectOrigem) {
    selectStatusEmEdicao = selectOrigem;
    campoIdAcaoConcluir.value = idAcao;
    campoDataConclusaoRapida.value = dataHojeIso();
    campoDataConclusaoRapida.classList.remove('is-invalid');
    document.getElementById('erro-data-conclusao-rapida').textContent = '';
    instanciaModalConcluir.show();
}

// Fechar por qualquer via (X, Cancelar, backdrop, Esc) devolve o select ao
// status anterior - sem isso o <select> ficaria mostrando "Concluída" sem
// a acao ter sido de fato persistida com essa mudanca. No caminho de
// sucesso (submit), selectStatusEmEdicao ja e zerado ANTES do hide(), entao
// este listener nao tem efeito nesse caso.
modalConcluirAcao.addEventListener('hidden.bs.modal', () => {
    if (selectStatusEmEdicao) {
        selectStatusEmEdicao.value = selectStatusEmEdicao.dataset.valorAnterior;
        selectStatusEmEdicao.disabled = false;
        selectStatusEmEdicao = null;
    }
});

formularioConcluirAcao.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!campoPreenchido(campoDataConclusaoRapida.value)) {
        campoDataConclusaoRapida.classList.add('is-invalid');
        document.getElementById('erro-data-conclusao-rapida').textContent = 'Informe a data de conclusão.';
        return;
    }

    const idAcao = Number(campoIdAcaoConcluir.value);
    const textoOriginal = botaoConfirmarConcluir.textContent;
    botaoConfirmarConcluir.disabled = true;
    botaoConfirmarConcluir.textContent = 'Salvando...';

    try {
        await alterarStatusAcao(idAcao, 'CONCLUIDA', campoDataConclusaoRapida.value);
        mostrarNotificacao('Status atualizado.', 'sucesso');
        selectStatusEmEdicao = null; // sucesso: nao reverter no evento "hidden" do modal
        instanciaModalConcluir.hide();
        await carregarAcoes();
    } catch (error) {
        console.error('Erro ao concluir ação:', error);
        mostrarNotificacao(mensagemErroAmigavel(error), 'erro');
    } finally {
        botaoConfirmarConcluir.disabled = false;
        botaoConfirmarConcluir.textContent = textoOriginal;
    }
});

// --- Carga inicial -------------------------------------------------------------------
carregarPagina();
