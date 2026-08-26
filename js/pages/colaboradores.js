import {
  listarColaboradores,
  buscarColaboradorPorId,
  criarColaborador,
  atualizarColaborador,
  desativarColaborador,
} from "../services/colaboradorService.js";
import { formatarDataBR, formatarStatus } from "../utils/formatadores.js";
import {
  campoPreenchido,
  emailValido,
  dataNaoFutura,
} from "../utils/validacoes.js";
import { mostrarNotificacao as mostrarNotificacaoBase } from "../utils/notificacoes.js";
import { iniciarSidebar } from "../utils/sidebar.js";

iniciarSidebar();

// --- Referencias de DOM --------------------------------------------------
const areaEstado = document.getElementById("area-estado");
const areaTabela = document.getElementById("area-tabela");
const corpoTabela = document.getElementById("corpo-tabela");
const campoBusca = document.getElementById("campo-busca");
const botoesFiltro = document.querySelectorAll(".colaboradores__filtro");
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

// --- Estado local da pagina (cache da ultima listagem carregada) --------
let colaboradores = [];
let termoBusca = "";
let filtroStatus = "ativos";

// --- Estados de carregamento / vazio / erro / sucesso -------------------
function definirEstado(tipo, mensagem) {
  if (tipo === "sucesso") {
    areaEstado.hidden = true;
    areaTabela.hidden = false;
    return;
  }

  areaTabela.hidden = true;
  areaEstado.hidden = false;
  areaEstado.classList.toggle("estado--erro", tipo === "erro");
  areaEstado.textContent = mensagem;
}

async function carregarColaboradores() {
  definirEstado("carregando", "Carregando colaboradores...");
  try {
    colaboradores = await listarColaboradores();
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

// Elementos criados via DOM API (nao innerHTML) para nao expor os dados do
// colaborador a injecao de HTML.
function criarLinhaColaborador(colaborador) {
  const linha = document.createElement("tr");

  const celulaMatricula = document.createElement("td");
  celulaMatricula.textContent = colaborador.matricula;

  const celulaNome = document.createElement("td");
  celulaNome.textContent = colaborador.nome;

  const celulaEmail = document.createElement("td");
  celulaEmail.textContent = colaborador.email || "-";

  const celulaData = document.createElement("td");
  celulaData.textContent = formatarDataBR(colaborador.data_admissao);

  const celulaStatus = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `badge ${colaborador.ativo ? "badge--ativo" : "badge--inativo"}`;
  badge.textContent = formatarStatus(colaborador.ativo);
  celulaStatus.appendChild(badge);

  const celulaAcoes = document.createElement("td");
  celulaAcoes.className = "tabela__acoes";

  const botaoVisualizar = document.createElement("button");
  botaoVisualizar.type = "button";
  botaoVisualizar.className = "botao botao--texto";
  botaoVisualizar.textContent = "Visualizar";
  botaoVisualizar.dataset.acao = "visualizar";
  botaoVisualizar.dataset.id = colaborador.id_colaborador;

  const botaoEditar = document.createElement("button");
  botaoEditar.type = "button";
  botaoEditar.className = "botao botao--texto";
  botaoEditar.textContent = "Editar";
  botaoEditar.dataset.acao = "editar";
  botaoEditar.dataset.id = colaborador.id_colaborador;

  const linkVinculos = document.createElement("a");
  linkVinculos.className = "botao botao--texto";
  linkVinculos.textContent = "Vínculos";
  linkVinculos.href = `vinculos.html?id_colaborador=${colaborador.id_colaborador}`;

  celulaAcoes.append(botaoVisualizar, botaoEditar, linkVinculos);

  // Colaborador ja inativo nao deve oferecer "Desativar" novamente
  // (reativacao fica para uma proxima etapa).
  if (colaborador.ativo) {
    const botaoDesativar = document.createElement("button");
    botaoDesativar.type = "button";
    botaoDesativar.className = "botao botao--perigo";
    botaoDesativar.textContent = "Desativar";
    botaoDesativar.dataset.acao = "desativar";
    botaoDesativar.dataset.id = colaborador.id_colaborador;
    celulaAcoes.appendChild(botaoDesativar);
  }

  linha.append(
    celulaMatricula,
    celulaNome,
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
function limparErrosFormulario() {
  document.getElementById("erro-matricula").textContent = "";
  document.getElementById("erro-nome").textContent = "";
  document.getElementById("erro-email").textContent = "";
  document.getElementById("erro-data-admissao").textContent = "";
}

function abrirFormularioCriacao() {
  formulario.reset();
  campoIdColaborador.value = "";
  limparErrosFormulario();
  tituloModalFormulario.textContent = "Novo colaborador";
  modalFormulario.hidden = false;
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
    modalFormulario.hidden = false;
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
  modalFormulario.hidden = true;
}

function validarFormulario() {
  limparErrosFormulario();
  let valido = true;

  const matricula = campoMatricula.value.trim();
  const nome = campoNome.value.trim();
  const email = campoEmail.value.trim();
  const dataAdmissao = campoDataAdmissao.value;

  if (!campoPreenchido(matricula)) {
    document.getElementById("erro-matricula").textContent =
      "Informe a matrícula.";
    valido = false;
  }

  if (!campoPreenchido(nome)) {
    document.getElementById("erro-nome").textContent = "Informe o nome.";
    valido = false;
  }

  if (!emailValido(email)) {
    document.getElementById("erro-email").textContent =
      "Informe um e-mail válido.";
    valido = false;
  }

  if (!campoPreenchido(dataAdmissao)) {
    document.getElementById("erro-data-admissao").textContent =
      "Informe a data de admissão.";
    valido = false;
  } else if (!dataNaoFutura(dataAdmissao)) {
    document.getElementById("erro-data-admissao").textContent =
      "A data de admissão não pode ser futura.";
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
    modalDetalhes.hidden = false;
  } catch (error) {
    console.error("Erro ao carregar detalhes do colaborador:", error);
    mostrarNotificacao(
      "Não foi possível carregar os detalhes do colaborador.",
      "erro",
    );
  }
}

function fecharDetalhes() {
  modalDetalhes.hidden = true;
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

botoesFiltro.forEach((botao) => {
  botao.addEventListener("click", () => {
    filtroStatus = botao.dataset.filtroStatus;
    botoesFiltro.forEach((outro) =>
      outro.setAttribute("aria-pressed", String(outro === botao)),
    );
    renderizar();
  });
});

// --- Abertura/fechamento dos modais ---------------------------------------
document
  .getElementById("botao-novo-colaborador")
  .addEventListener("click", abrirFormularioCriacao);
document
  .getElementById("botao-fechar-formulario")
  .addEventListener("click", fecharFormulario);
document
  .getElementById("botao-cancelar-formulario")
  .addEventListener("click", fecharFormulario);
document
  .getElementById("botao-fechar-detalhes")
  .addEventListener("click", fecharDetalhes);
document
  .getElementById("botao-fechar-detalhes-rodape")
  .addEventListener("click", fecharDetalhes);

modalFormulario.addEventListener("click", (event) => {
  if (event.target === modalFormulario) {
    fecharFormulario();
  }
});

modalDetalhes.addEventListener("click", (event) => {
  if (event.target === modalDetalhes) {
    fecharDetalhes();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!modalFormulario.hidden) {
    fecharFormulario();
  }
  if (!modalDetalhes.hidden) {
    fecharDetalhes();
  }
});

// --- Carga inicial ---------------------------------------------------------
carregarColaboradores();
