import { buscarAvaliacaoPorId } from '../services/avaliacaoService.js';
import { carregarQuestionario } from '../services/perguntaService.js';
import { formatarCategoria } from '../utils/formatadores.js';

// AVA-03 - Carregar questionario ergonomico.
// So LE pergunta_avaliacao/opcao_resposta e valida a avaliacao pelo id.
// Nao salva resposta_avaliacao/resposta_opcao (isso e a AVA-04) e nao
// calcula risco algum (ver js/services/perguntaService.js).

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

// --- Estado local da pagina (secao 37: preparo para a AVA-04, respostas
// ficam somente em memoria nesta feature - nada e persistido) --------------
const estadoQuestionario = {
    idAvaliacao,
    perguntas: [],
    indiceAtual: 0,
    respostas: {},
};

let somenteLeitura = false;

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
        estadoQuestionario.respostas = {};

        if (somenteLeitura) {
            alertaSomenteLeitura.hidden = false;
            alertaSomenteLeitura.textContent = 'Esta avaliação já foi finalizada e não pode ser respondida novamente.';
        } else {
            alertaSomenteLeitura.hidden = true;
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

    botaoAnterior.disabled = estadoQuestionario.indiceAtual === 0;
    botaoProxima.disabled = estadoQuestionario.indiceAtual === total - 1;
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

// --- Navegacao (secao 26: apenas visual nesta feature, estado em memoria) --
botaoAnterior.addEventListener('click', () => {
    if (estadoQuestionario.indiceAtual > 0) {
        estadoQuestionario.indiceAtual -= 1;
        renderizarPergunta();
    }
});

botaoProxima.addEventListener('click', () => {
    if (estadoQuestionario.indiceAtual < estadoQuestionario.perguntas.length - 1) {
        estadoQuestionario.indiceAtual += 1;
        renderizarPergunta();
    }
});

// --- Carga inicial -------------------------------------------------------------
carregarPagina();
