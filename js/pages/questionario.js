import { buscarAvaliacaoPorId, validarAvaliacaoParaFinalizacao, finalizarAvaliacao } from '../services/avaliacaoService.js';
import { carregarQuestionario } from '../services/perguntaService.js';
import { carregarRespostasDaAvaliacao, salvarResposta } from '../services/respostaService.js';
import { formatarCategoria } from '../utils/formatadores.js';

// AVA-03 - Carrega o questionario ergonomico dinamicamente.
// AVA-04 - Evolui a mesma pagina/estado para persistir as respostas em
// resposta_avaliacao/resposta_opcao (ver js/services/respostaService.js).
// AVA-05 - Acao explicita "Finalizar avaliacao": valida tudo de novo no
// servidor (nunca confia so no estado acumulado aqui) e muda o status para
// FINALIZADA (ver js/services/avaliacaoService.js). Nao calcula risco, nao
// gera classificacao/recomendacao - isso e responsabilidade do Motor de
// Risco, em uma proxima fase.

// --- Identificacao da avaliacao, sempre via URL (mesmo padrao das demais
// paginas do fluxo: nova-avaliacao.html, contexto-avaliacao.html) ----------
const parametrosUrl = new URLSearchParams(window.location.search);
const idAvaliacao = Number(parametrosUrl.get('id_avaliacao')) || null;

// --- Referencias de DOM ----------------------------------------------------
const areaEstado = document.getElementById('area-estado');
const areaQuestionario = document.getElementById('area-questionario');
const alertaSomenteLeitura = document.getElementById('alerta-somente-leitura');

const textoCategoria = document.getElementById('texto-categoria');
const barraProgresso = document.getElementById('barra-progresso');
const textoProgresso = document.getElementById('texto-progresso');
const legendaPergunta = document.getElementById('legenda-pergunta');
const areaControlePergunta = document.getElementById('area-controle-pergunta');
const botaoAnterior = document.getElementById('botao-anterior');
const botaoProxima = document.getElementById('botao-proxima');
const textoStatusSalvamento = document.getElementById('texto-status-salvamento');

const cardFinalizacao = document.getElementById('card-finalizacao');
const botaoFinalizarAvaliacao = document.getElementById('botao-finalizar-avaliacao');
const alertaValidacaoFinalizacao = document.getElementById('alerta-validacao-finalizacao');
const textoValidacaoFinalizacao = document.getElementById('texto-validacao-finalizacao');
const listaErrosFinalizacao = document.getElementById('lista-erros-finalizacao');
const botaoRevisarQuestionario = document.getElementById('botao-revisar-questionario');
const modalConfirmarFinalizacaoEl = document.getElementById('modal-confirmar-finalizacao');
const botaoConfirmarFinalizacao = document.getElementById('botao-confirmar-finalizacao');
const instanciaModalConfirmarFinalizacao = new bootstrap.Modal(modalConfirmarFinalizacaoEl);

// --- Estado local da pagina (mesmo modelo desenhado na AVA-03; a AVA-04 so
// passa a persistir estadoQuestionario.respostas em vez de mante-lo somente
// em memoria) ----------------------------------------------------------------
const estadoQuestionario = {
    idAvaliacao,
    perguntas: [],
    indiceAtual: 0,
    respostas: {},
};

let somenteLeitura = false;
// Preenchido quando validarAvaliacaoParaFinalizacao aponta uma pergunta
// faltante/inconsistente, para o botao "Revisar questionário" saber para
// onde pular (secao 30 do prompt AVA-05).
let idPerguntaParaRevisar = null;

// --- Estados de carregamento / vazio / erro / pronto ------------------------
function definirEstado(tipo, mensagem) {
    if (tipo === 'pronto') {
        areaEstado.hidden = true;
        areaQuestionario.hidden = false;
        return;
    }

    areaQuestionario.hidden = true;
    areaEstado.hidden = false;
    areaEstado.classList.toggle('text-danger', tipo === 'erro');
    areaEstado.textContent = mensagem;
}

// --- Carga inicial -------------------------------------------------------------
async function carregarPagina() {
    if (!idAvaliacao) {
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    definirEstado('carregando', 'Carregando questionário...');

    let avaliacao;
    try {
        avaliacao = await buscarAvaliacaoPorId(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        definirEstado('erro', 'Avaliação não encontrada.');
        return;
    }

    if (avaliacao.status === 'CANCELADA') {
        definirEstado('erro', 'Esta avaliação foi cancelada e não pode ser preenchida.');
        return;
    }

    somenteLeitura = avaliacao.status === 'FINALIZADA';

    try {
        const perguntas = await carregarQuestionario();

        if (perguntas.length === 0) {
            definirEstado('vazio', 'Nenhuma pergunta está disponível para esta avaliação.');
            return;
        }

        estadoQuestionario.perguntas = perguntas;
        estadoQuestionario.indiceAtual = 0;

        definirEstado('carregando', 'Carregando respostas...');
        try {
            estadoQuestionario.respostas = await carregarRespostasDaAvaliacao(idAvaliacao, perguntas);
        } catch (error) {
            console.error('Erro ao carregar respostas anteriores:', error);
            definirEstado('erro', 'Não foi possível carregar suas respostas anteriores.');
            return;
        }

        if (somenteLeitura) {
            alertaSomenteLeitura.hidden = false;
            alertaSomenteLeitura.classList.remove('alert-success');
            alertaSomenteLeitura.classList.add('alert-warning');
            alertaSomenteLeitura.textContent = 'Esta avaliação já foi finalizada e não pode ser respondida novamente.';
            cardFinalizacao.hidden = true;
        } else {
            alertaSomenteLeitura.hidden = true;
            cardFinalizacao.hidden = false;
        }

        renderizarPergunta();
        definirEstado('pronto');
    } catch (error) {
        console.error('Erro ao carregar questionário:', error);
        if (error?.code === 'CATALOGO_INCONSISTENTE') {
            definirEstado('erro', 'O catálogo de perguntas precisa de validação.');
        } else {
            definirEstado('erro', 'Não foi possível carregar o questionário.');
        }
    }
}

// --- Renderizacao da pergunta atual (cabecalho + progresso + controle) -----
function renderizarPergunta() {
    const pergunta = estadoQuestionario.perguntas[estadoQuestionario.indiceAtual];
    const total = estadoQuestionario.perguntas.length;
    const atual = estadoQuestionario.indiceAtual + 1;

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

// Reaplicada apos cada render (que sempre parte de um estado "nao esta
// salvando"); durante um salvamento em andamento, desabilitarNavegacao(true)
// sobrescreve os dois temporariamente (secao 21 do prompt AVA-04).
function desabilitarNavegacao(bloqueado) {
    botaoAnterior.disabled = bloqueado || estadoQuestionario.indiceAtual === 0;
    botaoProxima.disabled = bloqueado;
}

function definirStatusSalvamento(mensagem, isErro = false) {
    textoStatusSalvamento.textContent = mensagem;
    textoStatusSalvamento.classList.toggle('text-danger', isErro);
    textoStatusSalvamento.classList.toggle('text-muted', !isErro);
}

// --- Controle "estilo botao" (radio/checkbox grandes, area de toque
// adequada - secao 35) reutilizado por BOOLEANO/ESCALA/ESCOLHA_UNICA/
// ESCOLHA_MULTIPLA. O estado de selecao nunca depende so de cor: o proprio
// input (checked) carrega o significado semantico e visual (preenchido x
// contornado). ----------------------------------------------------------------
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
    const valorAtual = estadoQuestionario.respostas[pergunta.id_pergunta];
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
                    estadoQuestionario.respostas[pergunta.id_pergunta] = valor === 'true';
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

    const valorAtual = estadoQuestionario.respostas[pergunta.id_pergunta];
    if (valorAtual !== undefined && valorAtual !== null) {
        input.value = valorAtual;
    }
    input.addEventListener('input', () => {
        estadoQuestionario.respostas[pergunta.id_pergunta] = input.value === '' ? null : Number(input.value);
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
    textarea.value = estadoQuestionario.respostas[pergunta.id_pergunta] || '';
    textarea.addEventListener('input', () => {
        estadoQuestionario.respostas[pergunta.id_pergunta] = textarea.value;
    });
    return textarea;
}

// ESCALA e ESCOLHA_UNICA sao renderizadas da mesma forma (radio, uma
// escolha); ESCOLHA_MULTIPLA usa checkbox e acumula em um array. Nenhuma
// das tres inventa opcoes: vem sempre de pergunta.opcoes (opcao_resposta).
function criarControleComOpcoes(pergunta, multipla) {
    if (!pergunta.opcoes || pergunta.opcoes.length === 0) {
        console.error(`Pergunta "${pergunta.codigo}" não possui opções configuradas.`);
        const aviso = document.createElement('p');
        aviso.className = 'text-danger mb-0';
        aviso.textContent = 'Esta pergunta não possui opções configuradas.';
        return aviso;
    }

    const grupo = document.createElement('div');
    const valorAtual = estadoQuestionario.respostas[pergunta.id_pergunta];
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
                        estadoQuestionario.respostas[pergunta.id_pergunta] = opcao.id_opcao;
                        return;
                    }

                    const selecionadas = Array.isArray(estadoQuestionario.respostas[pergunta.id_pergunta])
                        ? [...estadoQuestionario.respostas[pergunta.id_pergunta]]
                        : [];
                    const posicao = selecionadas.indexOf(opcao.id_opcao);

                    if (event.target.checked && posicao === -1) {
                        selecionadas.push(opcao.id_opcao);
                    } else if (!event.target.checked && posicao !== -1) {
                        selecionadas.splice(posicao, 1);
                    }
                    estadoQuestionario.respostas[pergunta.id_pergunta] = selecionadas;
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

// --- Validacao local de obrigatoriedade (secao 18) ---------------------------
// Espelha, do lado do cliente, a mesma nocao de "vazio" que o service aplica
// antes de gravar - so para dar feedback imediato sem round-trip ao Supabase.
// A validacao que realmente vale (e que nunca confia no frontend) e a do
// respostaService.js.
function respostaPreenchida(pergunta) {
    const valor = estadoQuestionario.respostas[pergunta.id_pergunta];
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

// --- Persistencia da pergunta atual (secao 19/20/21 do prompt AVA-04) -------
// Usada tanto por "Proxima" quanto por "Anterior": os dois devem persistir o
// que estiver preenchido antes de navegar. Retorna { ok } para quem chamou
// decidir se pode avancar (Proxima nao avanca se falhar; Anterior sempre
// volta, mesmo em erro - ver os handlers abaixo).
async function salvarRespostaAtual() {
    if (somenteLeitura) {
        return { ok: true };
    }

    const pergunta = estadoQuestionario.perguntas[estadoQuestionario.indiceAtual];
    const valor = estadoQuestionario.respostas[pergunta.id_pergunta];

    definirStatusSalvamento('Salvando resposta...');
    desabilitarNavegacao(true);

    try {
        await salvarResposta(idAvaliacao, pergunta.id_pergunta, valor);
        definirStatusSalvamento('');
        return { ok: true };
    } catch (error) {
        console.error('Erro ao salvar resposta:', error);
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
            'AVALIACAO_FINALIZADA',
            'AVALIACAO_CANCELADA',
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
// "Anterior": nunca bloqueia o retorno, mesmo que a pergunta atual seja
// obrigatoria e esteja vazia (secao 20) - o usuario deve poder voltar para
// corrigir respostas anteriores.
botaoAnterior.addEventListener('click', async () => {
    await salvarRespostaAtual();
    if (estadoQuestionario.indiceAtual > 0) {
        estadoQuestionario.indiceAtual -= 1;
        renderizarPergunta();
    }
});

// "Proxima": bloqueia se a pergunta e obrigatoria e ainda esta vazia (sem
// round-trip), e nao avanca se o salvamento falhar (secao 19). Na ultima
// pergunta, so confirma a conclusao (secao 26) - nao ha "Finalizar" aqui.
botaoProxima.addEventListener('click', async () => {
    const pergunta = estadoQuestionario.perguntas[estadoQuestionario.indiceAtual];

    if (pergunta.obrigatoria && !somenteLeitura && !respostaPreenchida(pergunta)) {
        definirStatusSalvamento('Responda esta pergunta antes de continuar.', true);
        return;
    }

    const resultado = await salvarRespostaAtual();
    if (!resultado.ok) {
        return;
    }

    if (estadoQuestionario.indiceAtual < estadoQuestionario.perguntas.length - 1) {
        estadoQuestionario.indiceAtual += 1;
        renderizarPergunta();
    } else if (!somenteLeitura) {
        definirStatusSalvamento('Questionário preenchido com sucesso.');
    }
});

// --- Finalizar avaliação (AVA-05) --------------------------------------------
// Acao explicita, separada de "Proxima" (secao 5): a ultima resposta salva
// nunca finaliza sozinha. O botao fica disponivel a qualquer momento (nao
// so na ultima pergunta) - a propria validacao do servidor e quem diz o que
// falta, funcionando como a "revisao" antes de finalizar.

function limparValidacaoFinalizacao() {
    alertaValidacaoFinalizacao.hidden = true;
    listaErrosFinalizacao.innerHTML = '';
    botaoRevisarQuestionario.hidden = true;
    idPerguntaParaRevisar = null;
}

// `validacao` segue o retorno de validarAvaliacaoParaFinalizacao/o erro
// lancado por finalizarAvaliacao - em ambos os casos so precisamos de
// `erros` (array de mensagens amigaveis) e, opcionalmente, de `perguntas`
// (faltantes/inconsistencias) para oferecer "Revisar questionário".
function exibirValidacaoFinalizacao(validacao) {
    const erros = validacao.erros && validacao.erros.length > 0
        ? validacao.erros
        : ['Não foi possível finalizar a avaliação.'];

    alertaValidacaoFinalizacao.hidden = false;
    textoValidacaoFinalizacao.textContent =
        erros.length === 1 ? erros[0] : 'Existem pendências que impedem a finalização:';

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
        botaoRevisarQuestionario.hidden = false;
    } else {
        idPerguntaParaRevisar = null;
        botaoRevisarQuestionario.hidden = true;
    }
}

botaoRevisarQuestionario.addEventListener('click', () => {
    if (idPerguntaParaRevisar === null) {
        return;
    }
    const indice = estadoQuestionario.perguntas.findIndex((pergunta) => pergunta.id_pergunta === idPerguntaParaRevisar);
    if (indice === -1) {
        return;
    }
    estadoQuestionario.indiceAtual = indice;
    renderizarPergunta();
    limparValidacaoFinalizacao();
});

// Transicao definitiva para o modo somente-leitura, usada tanto no sucesso
// da propria finalizacao quanto na descoberta de que outra sessao ja
// finalizou entre a validacao e a confirmacao (secao 25 - concorrencia).
function ativarModoSomenteLeitura(mensagem, tipoAlerta) {
    somenteLeitura = true;
    cardFinalizacao.hidden = true;
    alertaSomenteLeitura.hidden = false;
    alertaSomenteLeitura.classList.remove('alert-warning', 'alert-success');
    alertaSomenteLeitura.classList.add(`alert-${tipoAlerta}`);
    alertaSomenteLeitura.textContent = mensagem;
    renderizarPergunta();
}

function mensagemErroFinalizacao(error) {
    const codigo = error?.code;
    if (codigo === 'AVALIACAO_JA_FINALIZADA') {
        return 'Esta avaliação já foi finalizada.';
    }
    if (['VALIDACAO_FINALIZACAO_FALHOU', 'FINALIZACAO_FALHOU', 'FINALIZACAO_NAO_CONFIRMADA'].includes(codigo)) {
        return error.message;
    }
    return 'Não foi possível finalizar a avaliação. Tente novamente.';
}

// 1o clique: so valida (secao 22) - se houver pendencia, mostra o que falta
// e nunca chega a perguntar "tem certeza?" para uma finalizacao que ja se
// sabe impossivel. Só quando esta tudo certo e que a confirmacao aparece
// (secao 29).
botaoFinalizarAvaliacao.addEventListener('click', async () => {
    limparValidacaoFinalizacao();

    const textoOriginal = botaoFinalizarAvaliacao.textContent;
    botaoFinalizarAvaliacao.disabled = true;
    botaoFinalizarAvaliacao.textContent = 'Verificando...';

    try {
        const validacao = await validarAvaliacaoParaFinalizacao(idAvaliacao);
        if (validacao.jaFinalizada) {
            ativarModoSomenteLeitura('Esta avaliação já foi finalizada.', 'warning');
            return;
        }
        if (!validacao.valida) {
            exibirValidacaoFinalizacao(validacao);
            return;
        }
        instanciaModalConfirmarFinalizacao.show();
    } catch (error) {
        console.error('Erro ao validar avaliação para finalização:', error);
        exibirValidacaoFinalizacao({ erros: ['Não foi possível verificar a avaliação. Tente novamente.'] });
    } finally {
        botaoFinalizarAvaliacao.disabled = false;
        botaoFinalizarAvaliacao.textContent = textoOriginal;
    }
});

// 2o clique (dentro do modal): a acao definitiva. Desabilita o botao
// imediatamente para proteger contra duplo clique (secao 24) - o proprio
// service tambem protege contra concorrencia no UPDATE (secao 25).
botaoConfirmarFinalizacao.addEventListener('click', async () => {
    const textoOriginal = botaoConfirmarFinalizacao.textContent;
    botaoConfirmarFinalizacao.disabled = true;
    botaoFinalizarAvaliacao.disabled = true;
    botaoConfirmarFinalizacao.textContent = 'Finalizando avaliação...';

    try {
        await finalizarAvaliacao(idAvaliacao);
        instanciaModalConfirmarFinalizacao.hide();
        limparValidacaoFinalizacao();
        ativarModoSomenteLeitura('Avaliação finalizada com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao finalizar avaliação:', error);
        instanciaModalConfirmarFinalizacao.hide();
        if (error?.code === 'AVALIACAO_JA_FINALIZADA') {
            ativarModoSomenteLeitura('Esta avaliação já foi finalizada.', 'warning');
        } else {
            exibirValidacaoFinalizacao({ erros: [mensagemErroFinalizacao(error)] });
        }
    } finally {
        botaoConfirmarFinalizacao.disabled = false;
        botaoConfirmarFinalizacao.textContent = textoOriginal;
        botaoFinalizarAvaliacao.disabled = false;
    }
});

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
