// MVP-09B - Completude do Inventario de Riscos Ocupacionais.
//
// Modulo de dominio PURO (sem Supabase, sem DOM) - reflete a arquitetura
// aprovada em docs/mvp09a-arquitetura-inventario-riscos.md (secao 21) e
// docs/mvp09b-inventario-riscos.md. Um item incompleto pode existir
// livremente em RASCUNHO (nunca bloqueado na criacao/edicao) - esta
// funcao so decide se ele pode ser considerado completo, nunca impede a
// persistencia.
//
// Regra deliberada (MVP-09A, secao 21): itens MANUAL nunca precisam de
// classificacao/pontuacao para serem publicaveis - eles registram a
// presenca de um perigo/contexto gerenciado sem nota quantificada, o que
// e uma pratica legitima de inventario. Itens MOTOR_GHE sempre tem esses
// campos preenchidos automaticamente na importacao (garantido pelo CHECK
// chk_inventario_risco_item_origem_consistente do banco), entao nunca ha
// pendencia de classificacao a reportar para eles tambem - o campo so
// existiria como pendencia se a importacao (MVP-09C) falhasse em
// preenche-lo, o que a propria constraint do banco ja impede.

function camposDeContextoPreenchidos(item, atividades) {
    const temAmbiente = item.id_ambiente !== null && item.id_ambiente !== undefined;
    const temPosto = item.id_posto !== null && item.id_posto !== undefined;
    const temProcesso = typeof item.processo_descricao === 'string' && item.processo_descricao.trim().length > 0;
    const temAtividade = Array.isArray(atividades) && atividades.length > 0;
    return temAmbiente || temPosto || temProcesso || temAtividade;
}

function textoPreenchido(valor) {
    return typeof valor === 'string' && valor.trim().length > 0;
}

// item: linha de inventario_risco_item (ou objeto equivalente em memoria).
// atividades: array de associacoes inventario_risco_item_atividade do
// item (passado separadamente porque e uma tabela N:N, nao um campo do
// item) - pode ser omitido/[] quando ainda nao houver nenhuma associada.
//
// Retorno: { completo: boolean, camposPendentes: [{ codigo, mensagem }] }
// Nunca lanca erro - um item sem NENHUM campo preenchido alem dos
// estruturais e um resultado valido (completo=false, com a lista cheia).
export function avaliarCompletudeItem(item, atividades = []) {
    const camposPendentes = [];

    if (!item || !item.id_ghe) {
        camposPendentes.push({ codigo: 'GHE_AUSENTE', mensagem: 'Informe o GHE do item.' });
    }
    if (!item || !item.id_perigo) {
        camposPendentes.push({ codigo: 'PERIGO_AUSENTE', mensagem: 'Informe o perigo do item.' });
    }
    if (!textoPreenchido(item?.fonte_circunstancia)) {
        camposPendentes.push({ codigo: 'FONTE_CIRCUNSTANCIA_AUSENTE', mensagem: 'Descreva a fonte/circunstância concreta do perigo.' });
    }
    if (!textoPreenchido(item?.possiveis_lesoes_agravos)) {
        camposPendentes.push({ codigo: 'POSSIVEIS_LESOES_AUSENTES', mensagem: 'Informe as possíveis lesões ou agravos associados.' });
    }
    if (item?.trabalhadores_expostos_snapshot === null || item?.trabalhadores_expostos_snapshot === undefined) {
        camposPendentes.push({ codigo: 'TRABALHADORES_EXPOSTOS_AUSENTE', mensagem: 'Informe a quantidade de trabalhadores expostos.' });
    }
    if (!camposDeContextoPreenchidos(item || {}, atividades)) {
        camposPendentes.push({
            codigo: 'CONTEXTO_AUSENTE',
            mensagem: 'Informe ao menos um contexto: ambiente, posto, atividade ou descrição do processo.',
        });
    }
    if (!textoPreenchido(item?.medidas_existentes)) {
        camposPendentes.push({ codigo: 'MEDIDAS_EXISTENTES_AUSENTES', mensagem: 'Registre as medidas existentes (ou informe explicitamente que não há nenhuma).' });
    }
    if (!textoPreenchido(item?.caracterizacao_exposicao)) {
        camposPendentes.push({ codigo: 'CARACTERIZACAO_EXPOSICAO_AUSENTE', mensagem: 'Selecione a caracterização da exposição.' });
    }

    return {
        completo: camposPendentes.length === 0,
        camposPendentes,
    };
}
