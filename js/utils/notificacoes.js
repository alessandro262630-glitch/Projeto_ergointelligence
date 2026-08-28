// Toast do Bootstrap 5 (bootstrap.bundle.min.js, carregado via CDN no HTML).
// Cada pagina tem seu proprio elemento #area-notificacoes (toast-container)
// e o passa como `container`.
const CLASSE_POR_TIPO = {
  sucesso: "text-bg-success",
  erro: "text-bg-danger",
  info: "text-bg-secondary",
};

export function mostrarNotificacao(container, texto, tipo = "info") {
  const classeCor = CLASSE_POR_TIPO[tipo] || CLASSE_POR_TIPO.info;

  const item = document.createElement("div");
  item.className = `toast align-items-center ${classeCor} border-0`;
  item.setAttribute("role", "alert");
  item.setAttribute("aria-live", "assertive");
  item.setAttribute("aria-atomic", "true");

  const flexo = document.createElement("div");
  flexo.className = "d-flex";

  const corpo = document.createElement("div");
  corpo.className = "toast-body";
  corpo.textContent = texto;

  const botaoFechar = document.createElement("button");
  botaoFechar.type = "button";
  botaoFechar.className = "btn-close btn-close-white me-2 m-auto";
  botaoFechar.setAttribute("data-bs-dismiss", "toast");
  botaoFechar.setAttribute("aria-label", "Fechar");

  flexo.append(corpo, botaoFechar);
  item.appendChild(flexo);
  container.appendChild(item);

  const toast = new bootstrap.Toast(item, { delay: 4000 });
  item.addEventListener("hidden.bs.toast", () => item.remove());
  toast.show();
}
