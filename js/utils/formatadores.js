export function formatarDataBR(dataIso) {
    if (!dataIso) {
        return '-';
    }
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

export function formatarStatus(ativo) {
    return ativo ? 'Ativo' : 'Inativo';
}

// Rotulos amigaveis para pergunta_avaliacao.categoria (ver database/schema.sql,
// chk_pergunta_avaliacao_categoria). Apenas apresentacao - o valor persistido
// no banco nunca e alterado.
const ROTULOS_CATEGORIA = {
    POSTURA: 'Postura',
    REPETITIVIDADE: 'Repetitividade',
    ESFORCO: 'Esforço',
    MOBILIARIO: 'Mobiliário',
    AMBIENTE: 'Ambiente',
    FADIGA: 'Fadiga',
    ORGANIZACAO: 'Organização',
    OUTRO: 'Outros',
};

export function formatarCategoria(categoria) {
    return ROTULOS_CATEGORIA[categoria] || categoria;
}
