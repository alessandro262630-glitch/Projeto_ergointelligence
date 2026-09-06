// Motor de Risco do GHE - Camada 4 (avaliacao de condicoes e regras).
// MVP-08B - fundacao fisica. Logica pura: sem Supabase, sem DOM, sem
// LLM. Nesta fundacao, opera SOMENTE sobre metricas ja calculadas
// (js/domain/ghe-risk/metricasGhe.js) - nunca sobre resposta_coleta
// diretamente (secao 14 da arquitetura MVP-08A: "regras GHE consultam
// METRICAS, nao respostas individuais").

function erroAvaliador(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Apenas EQ/GTE nesta fundacao (secao 37 do prompt MVP-08B) - mesma
// restricao ja em vigor no Motor individual (motorRisco.js), mantida
// aqui por compatibilidade deliberada, nao por limitacao tecnica do
// modelo (a arquitetura admite expansao futura).
export const OPERADORES_CONDICAO_GHE_SUPORTADOS = ['EQ', 'GTE'];
export const AGREGADORES_REGRA_GHE_SUPORTADOS = ['AND', 'OR'];

// Avalia uma condicao ja com a metrica calculada - nunca recalcula nada,
// so compara. `valorCalculado` pode ser `null` quando a metrica nao teve
// nenhuma base valida (ex.: MEDIA_NUMERICA sem nenhuma resposta
// numerica) - nesse caso a condicao e FALSE, nunca lanca excecao (mesmo
// espirito defensivo de motorRisco.avaliarCondicao: ausencia de dado
// vira condicao nao satisfeita, nunca erro de execucao).
export function avaliarCondicaoGhe({ valorCalculado, operador, valorComparacao }) {
    if (!OPERADORES_CONDICAO_GHE_SUPORTADOS.includes(operador)) {
        throw erroAvaliador(`Operador de condição não suportado pelo Motor GHE: ${operador}`, 'OPERADOR_NAO_SUPORTADO');
    }

    if (valorCalculado === null || valorCalculado === undefined) {
        return false;
    }

    const valor = Number(valorCalculado);
    const limite = Number(valorComparacao);

    if (operador === 'EQ') {
        return valor === limite;
    }
    return valor >= limite; // GTE
}

// Agrega os resultados (ja booleanos) de todas as condicoes de uma regra
// - AND exige todas verdadeiras, OR exige pelo menos uma. Identico em
// espirito ao agregador do Motor individual (motorRisco.avaliarRegra,
// linhas 213-215), extraido aqui como funcao pura e reaproveitavel sem
// tocar naquele arquivo (ver docs/mvp08a-arquitetura-motor-risco-ghe.md,
// secao 6: "algoritmo AND/OR pode virar helper puro compartilhado").
export function agregarResultadosCondicao(operadorAgregacao, resultadosBooleanos) {
    if (!AGREGADORES_REGRA_GHE_SUPORTADOS.includes(operadorAgregacao)) {
        throw erroAvaliador(
            `Agregador de regra não suportado pelo Motor GHE: ${operadorAgregacao}`,
            'AGREGADOR_NAO_SUPORTADO',
        );
    }
    if (!Array.isArray(resultadosBooleanos) || resultadosBooleanos.length === 0) {
        throw erroAvaliador('Uma regra do GHE precisa de ao menos uma condição avaliada.', 'REGRA_SEM_CONDICOES');
    }

    return operadorAgregacao === 'AND'
        ? resultadosBooleanos.every(Boolean)
        : resultadosBooleanos.some(Boolean);
}
