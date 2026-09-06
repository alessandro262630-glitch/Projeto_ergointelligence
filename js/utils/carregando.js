// Indicador de carregamento com a marca ErgoIntelligence (anel giratorio +
// simbolo da logo, ver .eg-carregando em css/custom.css). Usado no lugar de
// um simples texto "Carregando..." em qualquer area de estado que busca
// dados no Supabase - a mesma identidade visual em todas as paginas.
export function marcarComoCarregando(elemento, mensagem) {
    elemento.innerHTML = `
        <div class="eg-carregando">
            <span class="eg-carregando__anel">
                <img src="assets/logo/logo-marca.png" alt="" class="eg-carregando__logo">
            </span>
            <span class="eg-carregando__texto">${mensagem}</span>
        </div>
    `;
}
