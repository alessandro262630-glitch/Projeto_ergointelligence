import { buscarGhePorId, buscarParticipantePorId } from '../services/gheService.js';
import { buscarAvaliacaoGhePorId, buscarColetaPorId, validarColetaParaFinalizacao, finalizarColeta } from '../services/avaliacaoGheService.js';
import { carregarQuestionario } from '../services/perguntaService.js';
import { carregarRespostasDaColeta, salvarRespostaColeta } from '../services/respostaColetaService.js';
import { formatarCategoria } from '../utils/formatadores.js';
import { marcarComoCarregando } from '../utils/carregando.js';

// MVP-07 - Coleta do GHE: reaproveita o MESMO catalogo de perguntas
// (pergunta_avaliacao/opcao_resposta) e a MESMA logica de renderizacao de
// controles de questionario.js, trocando apenas a persistencia
// (resposta_coleta/resposta_coleta_opcao em vez de
// resposta_avaliacao/resposta_opcao) e removendo qualquer acionamento do
// Motor de Risco - uma coleta NUNCA calcula pontuacao nem classifica risco.

const idColeta = Number(new URLSearchParams(window.location.search).get('id_coleta')) || null;

const areaEstado = document.getElementById('area-estado');
const areaColeta = document.getElementById('area-coleta');
const alertaSomenteLeitura = document.getElementById('alerta-somente-leitura');

const textoGheNome = document.getElementById('texto-ghe-nome');
const textoParticipanteNome = document.getElementById('texto-participante-nome');
const textoCategoria = document.getElementById('texto-categoria');
const barraProgresso = document.getElementById('barra-progresso');
const textoProgresso = document.getElementById('texto-progresso');
const legendaPergunta = document.getElementById('legenda-pergunta');
const areaControlePergunta = document.getElementById('area-controle-pergunta');
const botaoAnterior = document.getElementById('botao-anterior');
const botaoProxima = document.getElementById('botao-proxima');
const textoStatusSalvamento = document.getElementById('texto-status-salvamento');

const cardFinalizacao = document.getElementById('card-finalizacao');
const botaoConcluirColeta = document.getElementById('botao-concluir-coleta');
const alertaValidacaoFinalizacao = document.getElementById('alerta-validacao-finalizacao');
const textoValidacaoFinalizacao = document.getElementById('texto-validacao-finalizacao');
const listaErrosFinalizacao = document.getElementById('lista-erros-finalizacao');
const botaoRevisarColeta = document.getElementById('botao-revisar-coleta');
const modalConfirmarConclusaoEl = document.getElementById('modal-confirmar-conclusao');
const botaoConfirmarConclusao = document.getElementById('botao-confirmar-conclusao');
const instanciaModalConfirmarConclusao = new bootstrap.Modal(modalConfirmarConclusaoEl);

const areaPosConclusao = document.getElementById('area-pos-conclusao');
const linkVoltarAvaliacaoGhe = document.getElementById('link-voltar-avaliacao-ghe');

const estadoColeta = {
    idColeta,
    perguntas: [],
    indiceAtual: 0,
    respostas: {},
};

let somenteLeitura = false;
let idPerguntaParaRevisar = null;
let coletaAtual = null;
let avaliacaoGheAtual = null;

function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        areaColeta.hidden = false;
        return;
    }
    areaColeta.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    if (tipo === 'carregando') {
        marcarComoCarregando(areaEstado, mensagem);
    } else {
        areaEstado.textContent = mensagem;
    }
}

// --- Carga inicial -------------------------------------------------------------
async function carregarPagina() {
    if (!idColeta) {
        definirEstado('erro', 'Coleta não encontrada.');
        return;
    }
    definirEstado('carregando', 'Carregando coleta...');

    try {
        coletaAtual = await buscarColetaPorId(idColeta);
    } catch (error) {
        console.error('Erro ao carregar coleta:', error);
        definirEstado('erro', 'Coleta não encontrada.');
        return;
    }

    if (coletaAtual.status === 'CANCELADA') {
        definirEstado('erro', 'Esta coleta foi cancelada e não pode ser preenchida.');
        return;
    }

    try {
        const [avaliacao, participante] = await Promise.all([
            buscarAvaliacaoGhePorId(coletaAtual.id_avaliacao_ghe),
            buscarParticipantePorId(coletaAtual.id_amostra_participante),
        ]);
        avaliacaoGheAtual = avaliacao;
        const ghe = await buscarGhePorId(avaliacao.id_ghe);

        textoGheNome.textContent = ghe.nome;
        textoParticipanteNome.textContent = `${participante.colaborador_nome || 'Participante'} — ${participante.setor_nome || 'Sem setor'} / ${participante.cargo_nome || 'Sem cargo'}`;

        somenteLeitura = coletaAtual.status !== 'EM_ANDAMENTO' || !['RASCUNHO', 'EM_COLETA'].includes(avaliacaoGheAtual.status);

        const perguntas = await carregarQuestionario();
        if (perguntas.length === 0) {
            definirEstado('vazio', 'Nenhuma pergunta está disponível para esta coleta.');
            return;
        }

        estadoColeta.perguntas = perguntas;
        estadoColeta.indiceAtual = 0;

        definirEstado('carregando', 'Carregando respostas...');
        try {
            estadoColeta.respostas = await carregarRespostasDaColeta(idColeta, perguntas);
        } catch (error) {
            console.error('Erro ao carregar respostas anteriores da coleta:', error);
            definirEstado('erro', 'Não foi possível carregar as respostas anteriores.');
            return;
        }

        if (somenteLeitura) {
            alertaSomenteLeitura.hidden = false;
            if (coletaAtual.status === 'CONCLUIDA') {
                alertaSomenteLeitura.classList.remove('alert-warning');
                alertaSomenteLeitura.classList.add('alert-success');
                alertaSomenteLeitura.textContent = 'Esta coleta já foi concluída e não pode ser respondida novamente.';
                linkVoltarAvaliacaoGhe.href = `avaliacao-ghe.html?id_avaliacao_ghe=${avaliacaoGheAtual.id_avaliacao_ghe}`;
                areaPosConclusao.hidden = false;
            } else {
                alertaSomenteLeitura.textContent = 'Esta avaliação do GHE não permite mais alterações nas coletas.';
            }
            cardFinalizacao.hidden = true;
        } else {
            alertaSomenteLeitura.hidden = true;
            cardFinalizacao.hidden = false;
        }

        renderizarPergunta();
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar coleta do GHE:', error);
        if (error?.code === 'CATALOGO_INCONSISTENTE') {
            definirEstado('erro', 'O catálogo de perguntas precisa de validação.');
        } else {
            definirEstado('erro', 'Não foi possível carregar a coleta.');
        }
    }
}

// --- Renderizacao da pergunta atual (identico em espirito a questionario.js) ----
function renderizarPergunta() {
    const pergunta = estadoColeta.perguntas[estadoColeta.indiceAtual];
    const total = estadoColeta.perguntas.length;
    const atual = estadoColeta.indiceAtual + 1;

    textoCategoria.textContent = formatarCategoria(pergunta.categoria);
    textoProgresso.textContent = `Pergunta ${atual} de ${total}`;

    const percentual = Math.round((atual / total) * 100);
    barraProgresso.style.width = `${percentual}%`;
    barraProgresso.closest('[role="progressbar"]').setAttribute('aria-valuenow', String(atual));
    barraProgresso.closest('[role="progressbar"]').setAttribute('aria-valuemin', '1');
    barraProgresso.closest('[role="progressbar"]').setAttribute('aria-valuemax', String(total));

    legendaPergunta.textContent = pergunta.texto_pergunta;
    if (pergunta.obrigatoria) {
        const asterisco = document.createElement('span');
        asterisco.className = 'text-danger ms-1';
        asterisco.setAttribute('aria-label', 'obrigatória');
        asterisco.textContent = '*';
        legendaPergunta.appendChild(asterisco);
    }

    areaControlePergunta.innerHTML = '';
    areaControlePergunta.appendChild(criarControlePergunta(pergunta));

    if (somenteLeitura) {
        areaControlePergunta.querySelectorAll('input, textarea, select').forEach((campo) => {
            campo.disabled = true;
        });
    }

    definirStatusSalvamento('');
    desabilitarNavegacao(false);
}

function desabilitarNavegacao(bloqueado) {
    botaoAnterior.disabled = bloqueado || estadoColeta.indiceAtual === 0;
    botaoProxima.disabled = bloqueado;
}

function definirStatusSalvamento(mensagem, isErro = false) {
    textoStatusSalvamento.textContent = mensagem;
    textoStatusSalvamento.classList.toggle('text-danger', isErro);
    textoStatusSalvamento.classList.toggle('text-muted', !isErro);
}

// --- Controles de pergunta (identicos a questionario.js) ------------------------
function criarOpcaoBotao({ tipo, name, id, checked, rotulo, onChange }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';

    const input = document.createElement('input');
    input.type = tipo;
    input.className = 'btn-check';
    input.name = name;
    input.id = id;
    input.autocomplete = 'off';
    input.checked = checked;
    input.addEventListener('change', onChange);

    const label = document.createElement('label');
    label.className = 'btn btn-outline-primary w-100 text-start py-2';
    label.htmlFor = id;
    label.textContent = rotulo;

    wrapper.append(input, label);
    return wrapper;
}

function criarControleBooleano(pergunta) {
    const grupo = document.createElement('div');
    const valorAtual = estadoColeta.respostas[pergunta.id_pergunta];
    const name = `pergunta-${pergunta.id_pergunta}`;

    [
        ['true', 'Sim'],
        ['false', 'Não'],
    ].forEach(([valor, rotulo]) => {
        grupo.appendChild(
            criarOpcaoBotao({
                tipo: 'radio',
                name,
                id: `${name}-${valor}`,
                checked: valorAtual === (valor === 'true'),
                rotulo,
                onChange: () => {
                    estadoColeta.respostas[pergunta.id_pergunta] = valor === 'true';
                },
            }),
        );
    });

    return grupo;
}

function criarControleNumerico(pergunta) {
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex align-items-center gap-2';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'form-control';
    input.style.maxWidth = '160px';
    input.id = `pergunta-${pergunta.id_pergunta}`;

    const valorAtual = estadoColeta.respostas[pergunta.id_pergunta];
    if (valorAtual !== undefined && valorAtual !== null) {
        input.value = valorAtual;
    }
    input.addEventListener('input', () => {
        estadoColeta.respostas[pergunta.id_pergunta] = input.value === '' ? null : Number(input.value);
    });

    wrapper.appendChild(input);

    if (pergunta.unidade) {
        const unidade = document.createElement('span');
        unidade.className = 'text-muted';
        unidade.textContent = pergunta.unidade;
        wrapper.appendChild(unidade);
    }

    return wrapper;
}

function criarControleTexto(pergunta) {
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 4;
    textarea.id = `pergunta-${pergunta.id_pergunta}`;
    textarea.value = estadoColeta.respostas[pergunta.id_pergunta] || '';
    textarea.addEventListener('input', () => {
        estadoColeta.respostas[pergunta.id_pergunta] = textarea.value;
    });
    return textarea;
}

function criarControleComOpcoes(pergunta, multipla) {
    if (!pergunta.opcoes || pergunta.opcoes.length === 0) {
        console.error(`Pergunta "${pergunta.codigo}" não possui opções configuradas.`);
        const aviso = document.createElement('p');
        aviso.className = 'text-danger mb-0';
        aviso.textContent = 'Esta pergunta não possui opções configuradas.';
        return aviso;
    }

    const grupo = document.createElement('div');
    const valorAtual = estadoColeta.respostas[pergunta.id_pergunta];
    const name = `pergunta-${pergunta.id_pergunta}`;

    pergunta.opcoes.forEach((opcao) => {
        const id = `${name}-opcao-${opcao.id_opcao}`;
        const checked = multipla
            ? Array.isArray(valorAtual) && valorAtual.includes(opcao.id_opcao)
            : valorAtual === opcao.id_opcao;

        grupo.appendChild(
            criarOpcaoBotao({
                tipo: multipla ? 'checkbox' : 'radio',
                name: multipla ? id : name,
                id,
                checked,
                rotulo: opcao.rotulo,
                onChange: (event) => {
                    if (!multipla) {
                        estadoColeta.respostas[pergunta.id_pergunta] = opcao.id_opcao;
                        return;
                    }

                    const selecionadas = Array.isArray(estadoColeta.respostas[pergunta.id_pergunta])
                        ? [...estadoColeta.respostas[pergunta.id_pergunta]]
                        : [];
                    const posicao = selecionadas.indexOf(opcao.id_opcao);

                    if (event.target.checked && posicao === -1) {
                        selecionadas.push(opcao.id_opcao);
                    } else if (!event.target.checked && posicao !== -1) {
                        selecionadas.splice(posicao, 1);
                    }
                    estadoColeta.respostas[pergunta.id_pergunta] = selecionadas;
                },
            }),
        );
    });

    return grupo;
}

function criarControlePergunta(pergunta) {
    switch (pergunta.tipo_resposta) {
        case 'BOOLEANO':
            return criarControleBooleano(pergunta);
        case 'NUMERICO':
            return criarControleNumerico(pergunta);
        case 'TEXTO':
            return criarControleTexto(pergunta);
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return criarControleComOpcoes(pergunta, false);
        case 'ESCOLHA_MULTIPLA':
            return criarControleComOpcoes(pergunta, true);
        default: {
            console.error(`Tipo de resposta desconhecido: ${pergunta.tipo_resposta}`);
            const aviso = document.createElement('p');
            aviso.className = 'text-danger mb-0';
            aviso.textContent = 'Tipo de pergunta não suportado.';
            return aviso;
        }
    }
}

function respostaPreenchida(pergunta) {
    const valor = estadoColeta.respostas[pergunta.id_pergunta];
    switch (pergunta.tipo_resposta) {
        case 'BOOLEANO':
            return valor === true || valor === false;
        case 'NUMERICO':
            return typeof valor === 'number' && !Number.isNaN(valor);
        case 'TEXTO':
            return typeof valor === 'string' && valor.trim().length > 0;
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return valor !== null && valor !== undefined;
        case 'ESCOLHA_MULTIPLA':
            return Array.isArray(valor) && valor.length > 0;
        default:
            return false;
    }
}

// --- Persistencia da pergunta atual ---------------------------------------------
async function salvarRespostaAtual() {
    if (somenteLeitura) {
        return { ok: true };
    }

    const pergunta = estadoColeta.perguntas[estadoColeta.indiceAtual];
    const valor = estadoColeta.respostas[pergunta.id_pergunta];

    definirStatusSalvamento('Salvando resposta...');
    desabilitarNavegacao(true);

    try {
        await salvarRespostaColeta(idColeta, pergunta.id_pergunta, valor);
        definirStatusSalvamento('');
        return { ok: true };
    } catch (error) {
        console.error('Erro ao salvar resposta da coleta:', error);
        definirStatusSalvamento(mensagemErroAmigavel(error), true);
        return { ok: false };
    } finally {
        desabilitarNavegacao(false);
    }
}

function mensagemErroAmigavel(error) {
    const codigo = error?.code;

    if (codigo === 'RESPOSTA_OBRIGATORIA') {
        return 'Responda esta pergunta antes de continuar.';
    }
    if (
        [
            'COLETA_CONCLUIDA',
            'COLETA_CANCELADA',
            'STATUS_COLETA_NAO_EDITAVEL',
            'AVALIACAO_GHE_CONSOLIDADA',
            'AVALIACAO_GHE_CANCELADA',
            'STATUS_NAO_EDITAVEL',
            'TIPO_INCOMPATIVEL',
            'TIPO_PERGUNTA_INVALIDO',
            'MULTIPLAS_OPCOES_NAO_PERMITIDAS',
            'OPCAO_INEXISTENTE',
            'OPCAO_INATIVA',
            'OPCAO_INCOMPATIVEL',
        ].includes(codigo)
    ) {
        return error.message;
    }

    const mensagem = (error?.message || '').toLowerCase();
    if (mensagem.includes('permission denied') || mensagem.includes('policy') || mensagem.includes('rls')) {
        return 'Sem permissão para realizar esta operação.';
    }

    return 'Não foi possível salvar esta resposta.';
}

// --- Navegacao ------------------------------------------------------------------
botaoAnterior.addEventListener('click', async () => {
    await salvarRespostaAtual();
    if (estadoColeta.indiceAtual > 0) {
        estadoColeta.indiceAtual -= 1;
        renderizarPergunta();
    }
});

botaoProxima.addEventListener('click', async () => {
    const pergunta = estadoColeta.perguntas[estadoColeta.indiceAtual];

    if (pergunta.obrigatoria && !somenteLeitura && !respostaPreenchida(pergunta)) {
        definirStatusSalvamento('Responda esta pergunta antes de continuar.', true);
        return;
    }

    const resultado = await salvarRespostaAtual();
    if (!resultado.ok) {
        return;
    }

    if (estadoColeta.indiceAtual < estadoColeta.perguntas.length - 1) {
        estadoColeta.indiceAtual += 1;
        renderizarPergunta();
    } else if (!somenteLeitura) {
        definirStatusSalvamento('Coleta preenchida com sucesso.');
    }
});

// --- Concluir coleta -------------------------------------------------------------
function limparValidacaoFinalizacao() {
    alertaValidacaoFinalizacao.hidden = true;
    listaErrosFinalizacao.innerHTML = '';
    botaoRevisarColeta.hidden = true;
    idPerguntaParaRevisar = null;
}

function exibirValidacaoFinalizacao(validacao) {
    const erros = validacao.erros && validacao.erros.length > 0
        ? validacao.erros
        : ['Não foi possível concluir a coleta.'];

    alertaValidacaoFinalizacao.hidden = false;
    textoValidacaoFinalizacao.textContent =
        erros.length === 1 ? erros[0] : 'Existem pendências que impedem a conclusão:';

    listaErrosFinalizacao.innerHTML = '';
    if (erros.length > 1) {
        erros.forEach((mensagem) => {
            const item = document.createElement('li');
            item.textContent = mensagem;
            listaErrosFinalizacao.appendChild(item);
        });
    }

    const alvo = validacao.perguntas?.faltantes?.[0] || validacao.perguntas?.inconsistencias?.[0];
    if (alvo) {
        idPerguntaParaRevisar = alvo.id_pergunta;
        botaoRevisarColeta.hidden = false;
    } else {
        idPerguntaParaRevisar = null;
        botaoRevisarColeta.hidden = true;
    }
}

botaoRevisarColeta.addEventListener('click', () => {
    if (idPerguntaParaRevisar === null) {
        return;
    }
    const indice = estadoColeta.perguntas.findIndex((pergunta) => pergunta.id_pergunta === idPerguntaParaRevisar);
    if (indice === -1) {
        return;
    }
    estadoColeta.indiceAtual = indice;
    renderizarPergunta();
    limparValidacaoFinalizacao();
});

function ativarModoSomenteLeitura(mensagem) {
    somenteLeitura = true;
    cardFinalizacao.hidden = true;
    alertaSomenteLeitura.hidden = false;
    alertaSomenteLeitura.classList.remove('alert-warning');
    alertaSomenteLeitura.classList.add('alert-success');
    alertaSomenteLeitura.textContent = mensagem;
    renderizarPergunta();

    linkVoltarAvaliacaoGhe.href = `avaliacao-ghe.html?id_avaliacao_ghe=${avaliacaoGheAtual.id_avaliacao_ghe}`;
    areaPosConclusao.hidden = false;
}

function mensagemErroConclusao(error) {
    const codigo = error?.code;
    if (codigo === 'COLETA_JA_CONCLUIDA') {
        return 'Esta coleta já foi concluída.';
    }
    if (['VALIDACAO_FINALIZACAO_COLETA_FALHOU', 'FINALIZACAO_COLETA_FALHOU'].includes(codigo)) {
        return error.message;
    }
    return 'Não foi possível concluir a coleta. Tente novamente.';
}

botaoConcluirColeta.addEventListener('click', async () => {
    limparValidacaoFinalizacao();

    const textoOriginal = botaoConcluirColeta.textContent;
    botaoConcluirColeta.disabled = true;
    botaoConcluirColeta.textContent = 'Verificando...';

    try {
        const validacao = await validarColetaParaFinalizacao(idColeta);
        if (validacao.jaConcluida) {
            ativarModoSomenteLeitura('Esta coleta já foi concluída.');
            return;
        }
        if (!validacao.valida) {
            exibirValidacaoFinalizacao(validacao);
            return;
        }
        instanciaModalConfirmarConclusao.show();
    } catch (error) {
        console.error('Erro ao validar coleta para conclusão:', error);
        exibirValidacaoFinalizacao({ erros: ['Não foi possível verificar a coleta. Tente novamente.'] });
    } finally {
        botaoConcluirColeta.disabled = false;
        botaoConcluirColeta.textContent = textoOriginal;
    }
});

botaoConfirmarConclusao.addEventListener('click', async () => {
    const textoOriginal = botaoConfirmarConclusao.textContent;
    botaoConfirmarConclusao.disabled = true;
    botaoConcluirColeta.disabled = true;
    botaoConfirmarConclusao.textContent = 'Concluindo coleta...';

    try {
        await finalizarColeta(idColeta);
        instanciaModalConfirmarConclusao.hide();
        limparValidacaoFinalizacao();
        ativarModoSomenteLeitura('Coleta concluída com sucesso.');
    } catch (error) {
        console.error('Erro ao concluir coleta:', error);
        instanciaModalConfirmarConclusao.hide();
        if (error?.code === 'COLETA_JA_CONCLUIDA') {
            ativarModoSomenteLeitura('Esta coleta já foi concluída.');
        } else {
            exibirValidacaoFinalizacao({ erros: [mensagemErroConclusao(error)] });
        }
    } finally {
        botaoConfirmarConclusao.disabled = false;
        botaoConfirmarConclusao.textContent = textoOriginal;
        botaoConcluirColeta.disabled = false;
    }
});

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
