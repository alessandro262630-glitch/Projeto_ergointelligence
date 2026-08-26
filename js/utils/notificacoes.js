// Toast simples e reutilizavel (sem biblioteca externa). Cada pagina tem seu
// proprio elemento #area-notificacoes e o passa como `container`.
export function mostrarNotificacao(container, texto, tipo = 'info') {
    const item = document.createElement('div');
    item.className = `notificacao notificacao--${tipo}`;
    item.textContent = texto;
    container.appendChild(item);
    setTimeout(() => item.remove(), 4000);
}
