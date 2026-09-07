import {
  listarColaboradores,
  buscarColaboradorPorId,
  criarColaborador,
  atualizarColaborador,
  desativarColaborador,
} from "../services/colaboradorService.js";
import {
  listarSetores,
  buscarSetorEFuncaoAtuaisPorColaboradores,
} from "../services/vinculoService.js";
import { formatarDataBR, formatarStatus } from "../utils/formatadores.js";
import {
  campoPreenchido,
  emailValido,
  dataNaoFutura,
} from "../utils/validacoes.js";
import { mostrarNotificacao as mostrarNotificacaoBase } from "../utils/notificacoes.js";
import { marcarComoCarregando } from "../utils/carregando.js";

// --- Referencias de DOM --------------------------------------------------
const areaEstado = document.getElementById("area-estado");
const areaTabela = document.getElementById("area-tabela");
const corpoTabela = document.getElementById("corpo-tabela");
const campoBusca = document.getElementById("campo-busca");
const filtroSetor = document.getElementById("filtro-setor");
const botoesFiltro = document.querySelectorAll("[data-filtro-status]");
const areaNotificacoes = document.getElementById("area-notificacoes");

const modalFormulario = document.getElementById("modal-formulario");
const tituloModalFormulario = document.getElementById(
  "modal-formulario-titulo",
);
const formulario = document.getElementById("formulario-colaborador");
const campoIdColaborador = document.getElementById("campo-id-colaborador");
const campoMatricula = document.getElementById("campo-matricula");
const campoNome = document.getElementById("campo-nome");
const campoEmail = document.getElementById("campo-email");
const campoDataAdmissao = document.getElementById("campo-data-admissao");
const botaoSalvar = document.getElementById("botao-salvar-colaborador");

const modalDetalhes = document.getElementById("modal-detalhes");

const instanciaModalFormulario = new bootstrap.Modal(modalFormulario);
const instanciaModalDetalhes = new bootstrap.Modal(modalDetalhes);

// --- Estado local da pagina (cache da ultima listagem carregada) --------
let colaboradores = [];
let termoBusca = "";
let filtroStatus = "ativos";
let filtroSetorAtual = "";
let opcoesSetorPopuladas = false;

// --- Estados de carregamento / vazio / erro / sucesso -------------------
function definirEstado(tipo, mensagem) {
  if (tipo === "sucesso") {
    areaEstado.hidden = true;
    areaTabela.hidden = false;
    return;
  }

  areaTabela.hidden = true;
  areaEstado.hidden = false;
  areaEstado.classList.toggle("text-danger", tipo === "erro");
  if (tipo === "carregando") {
    marcarComoCarregando(areaEstado, mensagem);
  } else {
    areaEstado.textContent = mensagem;
  }
}

// Preenche o filtro de setor uma unica vez (o catalogo de setores nao
// muda durante a sessao) - assim uma selecao ja feita pelo usuario nao e
// perdida quando a lista e recarregada apos criar/editar/desativar.
async function popularFiltroSetorSeNecessario() {
  if (opcoesSetorPopuladas) {
    return;
  }
  try {
    const setores = await listarSetores();
    setores.forEach((setor) => {
      const opcao = document.createElement("option");
      opcao.value = setor.nome;
      opcao.textContent = setor.nome;
      filtroSetor.appendChild(opcao);
    });
    opcoesSetorPopuladas = true;
  } catch (error) {
    console.error("Erro ao carregar setores para o filtro:", error);
  }
}

async function carregarColaboradores() {
  definirEstado("carregando", "Carregando colaboradores...");
  try {
    const [listaColaboradores] = await Promise.all([
      listarColaboradores(),
      popularFiltroSetorSeNecessario(),
    ]);

    // Setor/funcao do vinculo atual, buscados em lote (nunca um SELECT por
    // colaborador) e mesclados na propria lista para exibir nas colunas
    // novas e no filtro de setor.
    const idsColaborador = listaColaboradores.map((c) => c.id_colaborador);
    const setorEFuncaoPorColaborador =
      await buscarSetorEFuncaoAtuaisPorColaboradores(idsColaborador);

    colaboradores = listaColaboradores.map((colaborador) => {
      const info = setorEFuncaoPorColaborador.get(colaborador.id_colaborador);
      return {
        ...colaborador,
        setor_atual: info?.setor ?? null,
        funcao_atual: info?.funcao ?? null,
      };
    });

    //organizar pela matricula (string) para facilitar a busca e leitura
    colaboradores.sort((a, b) => a.matricula.localeCompare(b.matricula));
    renderizar(); //mostra a tabela ou mensagem de vazio, dependendo do resultado
  } catch (error) {
    console.error("Erro ao carregar colaboradores:", error);
    definirEstado("erro", "Não foi possível carregar os colaboradores.");
  }
}

// --- Filtro + busca (aplicados localmente sobre a lista ja carregada) ---
function obterColaboradoresFiltrados() {
  const termo = termoBusca.trim().toLowerCase();

  return colaboradores.filter((colaborador) => {
    if (filtroStatus === "ativos" && !colaborador.ativo) {
      return false;
    }
    if (filtroStatus === "inativos" && colaborador.ativo) {
      return false;
    }
    if (filtroSetorAtual && colaborador.setor_atual !== filtroSetorAtual) {
      return false;
    }
    if (!termo) {
      return true;
    }

    return (
      colaborador.nome.toLowerCase().includes(termo) ||
      colaborador.matricula.toLowerCase().includes(termo) ||
      (colaborador.email || "").toLowerCase().includes(termo)
    );
  });
}

function renderizar() {
  const filtrados = obterColaboradoresFiltrados();

  if (filtrados.length === 0) {
    definirEstado("vazio", "Nenhum colaborador encontrado.");
    return;
  }

  corpoTabela.innerHTML = "";
  filtrados.forEach((colaborador) => {
    corpoTabela.appendChild(criarLinhaColaborador(colaborador));
  });
  definirEstado("sucesso");
}

// Botoes/links de acao compactos (somente icone, Bootstrap Icons) para a
// coluna de Acoes: title + aria-label mantem a acessibilidade sem precisar
// do texto visivel, que ficaria apertado com 5 acoes por linha.
function criarIconeSvg(classeIcone) {
  const icone = document.createElement("i");
  icone.className = `bi ${classeIcone}`;
  icone.setAttribute("aria-hidden", "true");
  return icone;
}

function criarBotaoIcone({ icone, rotulo, acao, id, variante = "outline-secondary" }) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = `btn btn-${variante}`;
  botao.dataset.acao = acao;
  botao.dataset.id = id;
  botao.title = rotulo;
  botao.setAttribute("aria-label", rotulo);
  botao.appendChild(criarIconeSvg(icone));
  return botao;
}

function criarLinkIcone({ icone, rotulo, href, variante = "outline-secondary" }) {
  const link = document.createElement("a");
  link.className = `btn btn-${variante}`;
  link.href = href;
  link.title = rotulo;
  link.setAttribute("aria-label", rotulo);
  link.appendChild(criarIconeSvg(icone));
  return link;
}

// Elementos criados via DOM API (nao innerHTML) para nao expor os dados do
// colaborador a injecao de HTML.
function criarLinhaColaborador(colaborador) {
  const linha = document.createElement("tr");

  const celulaMatricula = document.createElement("td");
  celulaMatricula.textContent = colaborador.matricula;

  const celulaNome = document.createElement("td");
  celulaNome.textContent = colaborador.nome;

  const celulaSetor = document.createElement("td");
  celulaSetor.textContent = colaborador.setor_atual || "-";

  const celulaFuncao = document.createElement("td");
  celulaFuncao.textContent = colaborador.funcao_atual || "-";

  const celulaEmail = document.createElement("td");
  celulaEmail.textContent = colaborador.email || "-";

  const celulaData = document.createElement("td");
  celulaData.textContent = formatarDataBR(colaborador.data_admissao);

  const celulaStatus = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `badge ${colaborador.ativo ? "text-bg-success" : "text-bg-secondary"}`;
  badge.textContent = formatarStatus(colaborador.ativo);
  celulaStatus.appendChild(badge);

  const celulaAcoes = document.createElement("td");
  celulaAcoes.className = "text-nowrap text-end";

  const grupo = document.createElement("div");
  grupo.className = "btn-group btn-group-sm";
  grupo.setAttribute("role", "group");
  grupo.setAttribute("aria-label", "Ações do colaborador");

  const botaoVisualizar = criarBotaoIcone({
    icone: "bi-eye",
    rotulo: "Visualizar",
    acao: "visualizar",
    id: colaborador.id_colaborador,
  });

  const botaoEditar = criarBotaoIcone({
    icone: "bi-pencil",
    rotulo: "Editar",
    acao: "editar",
    id: colaborador.id_colaborador,
  });

  const linkVinculos = criarLinkIcone({
    icone: "bi-diagram-3",
    rotulo: "Vínculos",
    href: `vinculos.html?id_colaborador=${colaborador.id_colaborador}`,
  });

  grupo.append(botaoVisualizar, botaoEditar, linkVinculos);

  // "Nova avaliação" e "Desativar" seguem a mesma regra: um colaborador
  // inativo nao deve poder ser lancado em uma avaliacao nova (reativacao
  // fica para uma proxima etapa).
  if (colaborador.ativo) {
    const linkNovaAvaliacao = criarLinkIcone({
      icone: "bi-clipboard-plus",
      rotulo: "Nova avaliação",
      href: `nova-avaliacao.html?id_colaborador=${colaborador.id_colaborador}`,
    });
    grupo.appendChild(linkNovaAvaliacao);

    const botaoDesativar = criarBotaoIcone({
      icone: "bi-x-circle",
      rotulo: "Desativar",
      acao: "desativar",
      id: colaborador.id_colaborador,
      variante: "outline-danger",
    });
    grupo.appendChild(botaoDesativar);
  }

  celulaAcoes.appendChild(grupo);

  linha.append(
    celulaMatricula,
    celulaNome,
    celulaSetor,
    celulaFuncao,
    celulaEmail,
    celulaData,
    celulaStatus,
    celulaAcoes,
  );
  return linha;
}

// --- Acoes da tabela (delegacao de evento) -------------------------------
corpoTabela.addEventListener("click", (event) => {
  const botao = event.target.closest("button[data-acao]");
  if (!botao) {
    return;
  }

  const id = Number(botao.dataset.id);
  if (botao.dataset.acao === "visualizar") {
    abrirDetalhes(id);
  } else if (botao.dataset.acao === "editar") {
    abrirFormularioEdicao(id);
  } else if (botao.dataset.acao === "desativar") {
    confirmarDesativacao(id);
  }
});

// --- Modal de cadastro/edicao --------------------------------------------
const CAMPOS_FORMULARIO = [
  [campoMatricula, "erro-matricula"],
  [campoNome, "erro-nome"],
  [campoEmail, "erro-email"],
  [campoDataAdmissao, "erro-data-admissao"],
];

function limparErrosFormulario() {
  CAMPOS_FORMULARIO.forEach(([campo, idErro]) => {
    campo.classList.remove("is-invalid");
    document.getElementById(idErro).textContent = "";
  });
}

function definirErroCampo(campo, idErro, mensagem) {
  campo.classList.add("is-invalid");
  document.getElementById(idErro).textContent = mensagem;
}

function abrirFormularioCriacao() {
  formulario.reset();
  campoIdColaborador.value = "";
  limparErrosFormulario();
  tituloModalFormulario.textContent = "Novo colaborador";
  instanciaModalFormulario.show();
  campoMatricula.focus();
}

async function abrirFormularioEdicao(id) {
  try {
    const colaborador = await buscarColaboradorPorId(id);
    formulario.reset();
    limparErrosFormulario();
    campoIdColaborador.value = colaborador.id_colaborador;
    campoMatricula.value = colaborador.matricula;
    campoNome.value = colaborador.nome;
    campoEmail.value = colaborador.email || "";
    campoDataAdmissao.value = colaborador.data_admissao || "";
    tituloModalFormulario.textContent = "Editar colaborador";
    instanciaModalFormulario.show();
    campoMatricula.focus();
  } catch (error) {
    console.error("Erro ao carregar colaborador para edição:", error);
    mostrarNotificacao(
      "Não foi possível carregar os dados do colaborador.",
      "erro",
    );
  }
}

function fecharFormulario() {
  instanciaModalFormulario.hide();
}

function validarFormulario() {
  limparErrosFormulario();
  let valido = true;

  const matricula = campoMatricula.value.trim();
  const nome = campoNome.value.trim();
  const email = campoEmail.value.trim();
  const dataAdmissao = campoDataAdmissao.value;

  if (!campoPreenchido(matricula)) {
    definirErroCampo(campoMatricula, "erro-matricula", "Informe a matrícula.");
    valido = false;
  }

  if (!campoPreenchido(nome)) {
    definirErroCampo(campoNome, "erro-nome", "Informe o nome.");
    valido = false;
  }

  if (!emailValido(email)) {
    definirErroCampo(campoEmail, "erro-email", "Informe um e-mail válido.");
    valido = false;
  }

  if (!campoPreenchido(dataAdmissao)) {
    definirErroCampo(
      campoDataAdmissao,
      "erro-data-admissao",
      "Informe a data de admissão.",
    );
    valido = false;
  } else if (!dataNaoFutura(dataAdmissao)) {
    definirErroCampo(
      campoDataAdmissao,
      "erro-data-admissao",
      "A data de admissão não pode ser futura.",
    );
    valido = false;
  }

  if (!valido) {
    return { valido: false };
  }

  return {
    valido: true,
    dados: {
      matricula,
      nome,
      email: email || null,
      data_admissao: dataAdmissao,
    },
  };
}

formulario.addEventListener("submit", async (event) => {
  event.preventDefault();

  const resultado = validarFormulario();
  if (!resultado.valido) {
    return;
  }

  const idExistente = campoIdColaborador.value;
  const textoOriginalBotao = botaoSalvar.textContent;
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    if (idExistente) {
      await atualizarColaborador(Number(idExistente), resultado.dados);
      mostrarNotificacao("Colaborador atualizado com sucesso.", "sucesso");
    } else {
      await criarColaborador(resultado.dados);
      mostrarNotificacao("Colaborador cadastrado com sucesso.", "sucesso");
    }

    fecharFormulario();
    await carregarColaboradores();
  } catch (error) {
    console.error("Erro ao salvar colaborador:", error);
    mostrarNotificacao(mensagemErroAmigavel(error), "erro");
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = textoOriginalBotao;
  }
});

// --- Modal de visualizacao (somente leitura) -----------------------------
async function abrirDetalhes(id) {
  try {
    const colaborador = await buscarColaboradorPorId(id);
    document.getElementById("detalhe-matricula").textContent =
      colaborador.matricula;
    document.getElementById("detalhe-nome").textContent = colaborador.nome;
    document.getElementById("detalhe-email").textContent =
      colaborador.email || "-";
    document.getElementById("detalhe-data-admissao").textContent =
      formatarDataBR(colaborador.data_admissao);
    document.getElementById("detalhe-status").textContent = formatarStatus(
      colaborador.ativo,
    );
    instanciaModalDetalhes.show();
  } catch (error) {
    console.error("Erro ao carregar detalhes do colaborador:", error);
    mostrarNotificacao(
      "Não foi possível carregar os detalhes do colaborador.",
      "erro",
    );
  }
}

// --- Desativacao (soft delete) -------------------------------------------
async function confirmarDesativacao(id) {
  const confirmado = window.confirm(
    "Deseja realmente desativar este colaborador?",
  );
  if (!confirmado) {
    return;
  }

  try {
    await desativarColaborador(id);
    mostrarNotificacao("Colaborador desativado com sucesso.", "sucesso");
    await carregarColaboradores();
  } catch (error) {
    console.error("Erro ao desativar colaborador:", error);
    mostrarNotificacao(mensagemErroAmigavel(error), "erro");
  }
}

// --- Traducao de erros do Supabase/PostgreSQL para mensagem amigavel ----
function mensagemErroAmigavel(error) {
  const codigo = error?.code;
  const mensagem = (error?.message || "").toLowerCase();

  if (codigo === "23505") {
    if (mensagem.includes("matricula")) {
      return "Já existe um colaborador com esta matrícula.";
    }
    if (mensagem.includes("email")) {
      return "Já existe um colaborador com este e-mail.";
    }
    return "Já existe um registro com esses dados.";
  }

  if (codigo === "23514") {
    return "Verifique a data de admissão informada.";
  }

  if (codigo === "23503") {
    return "Não foi possível salvar: referência inválida no cadastro.";
  }

  if (
    mensagem.includes("permission denied") ||
    mensagem.includes("policy") ||
    mensagem.includes("rls")
  ) {
    return "Sem permissão para realizar esta operação. Verifique as políticas de acesso do Supabase.";
  }

  return "Não foi possível salvar o colaborador. Tente novamente.";
}

// --- Notificacoes (toast simples, compartilhado via utils/notificacoes.js) --
function mostrarNotificacao(texto, tipo = "info") {
  mostrarNotificacaoBase(areaNotificacoes, texto, tipo);
}

// --- Busca e filtro de status ---------------------------------------------
campoBusca.addEventListener("input", (event) => {
  termoBusca = event.target.value;
  renderizar();
});

filtroSetor.addEventListener("change", (event) => {
  filtroSetorAtual = event.target.value;
  renderizar();
});

botoesFiltro.forEach((botao) => {
  botao.addEventListener("click", () => {
    filtroStatus = botao.dataset.filtroStatus;
    botoesFiltro.forEach((outro) => {
      const ativo = outro === botao;
      outro.setAttribute("aria-pressed", String(ativo));
      outro.classList.toggle("active", ativo);
    });
    renderizar();
  });
});

// --- Abertura do modal de cadastro (fechamento fica a cargo do Bootstrap,
// via data-bs-dismiss="modal" nos botoes de fechar/cancelar) ---------------
document
  .getElementById("botao-novo-colaborador")
  .addEventListener("click", abrirFormularioCriacao);

// --- Carga inicial ---------------------------------------------------------
carregarColaboradores();
