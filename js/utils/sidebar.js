// Comportamento minimo da sidebar em telas estreitas (gaveta deslizante).
// Puramente de interface - sem dependencia de Supabase ou de dados.
export function iniciarSidebar() {
    const sidebar = document.getElementById('sidebar');
    const botaoMenu = document.getElementById('botao-menu');
    const overlay = document.getElementById('overlay-sidebar');

    if (!sidebar || !botaoMenu || !overlay) {
        return;
    }

    function abrir() {
        sidebar.classList.add('sidebar--aberta');
        overlay.hidden = false;
    }

    function fechar() {
        sidebar.classList.remove('sidebar--aberta');
        overlay.hidden = true;
    }

    botaoMenu.addEventListener('click', () => {
        if (sidebar.classList.contains('sidebar--aberta')) {
            fechar();
        } else {
            abrir();
        }
    });

    overlay.addEventListener('click', fechar);
}
