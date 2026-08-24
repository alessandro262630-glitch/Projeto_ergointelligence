export function campoPreenchido(valor) {
    return typeof valor === 'string' && valor.trim().length > 0;
}

export function emailValido(email) {
    if (!campoPreenchido(email)) {
        return true; // campo opcional: ausencia nao e erro de formato
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Compara strings ISO (YYYY-MM-DD) diretamente para evitar o fuso horario
// introduzido por `new Date('YYYY-MM-DD')` (interpretado como UTC).
export function dataNaoFutura(dataIso) {
    if (!campoPreenchido(dataIso)) {
        return false;
    }
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return dataIso <= hojeIso;
}
