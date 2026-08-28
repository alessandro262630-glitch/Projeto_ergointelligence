// Motor de Risco Ergonomico - camada de dominio (classificacao).
// Logica pura: recebe estruturas JavaScript, retorna estruturas
// JavaScript. NAO importa Supabase, NAO manipula DOM, NAO usa LLM.
// As faixas (BAIXO/MODERADO/ALTO/CRITICO) e suas pontuacoes minimas/maximas
// NUNCA sao hardcoded aqui - vem sempre de classificacao_risco (ver
// database/schema.sql), carregado pelo js/services/riscoService.js.

function erroClassificacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Encontra a classificacao cuja faixa [pontuacao_min, pontuacao_max] contem
// a pontuacao informada. pontuacao_max NULL significa faixa aberta (sem
// limite superior - ex.: CRITICO no seed atual).
//
// Por contrato (secao 28 do prompt do Motor de Risco) deve existir
// EXATAMENTE uma classificacao aplicavel: nenhuma e faixas sobrepostas sao
// ambos erros de configuracao do catalogo, nunca escolhidos "na sorte".
export function classificarPontuacao(pontuacao, classificacoes) {
    if (!Array.isArray(classificacoes) || classificacoes.length === 0) {
        throw erroClassificacao(
            'Nenhuma classificação de risco ativa está configurada no catálogo.',
            'CATALOGO_CLASSIFICACAO_VAZIO',
        );
    }

    const valor = Number(pontuacao);
    const candidatas = classificacoes.filter((classificacao) => {
        const min = Number(classificacao.pontuacao_min);
        const max = classificacao.pontuacao_max === null || classificacao.pontuacao_max === undefined
            ? null
            : Number(classificacao.pontuacao_max);
        const atendeMinimo = valor >= min;
        const atendeMaximo = max === null || valor <= max;
        return atendeMinimo && atendeMaximo;
    });

    if (candidatas.length === 0) {
        throw erroClassificacao(
            `Nenhuma classificação de risco corresponde à pontuação ${valor}. Verifique as faixas configuradas em classificacao_risco.`,
            'CLASSIFICACAO_NAO_ENCONTRADA',
        );
    }

    if (candidatas.length > 1) {
        const codigos = candidatas.map((classificacao) => classificacao.codigo).join(', ');
        throw erroClassificacao(
            `Mais de uma classificação de risco corresponde à pontuação ${valor} (faixas sobrepostas: ${codigos}). Verifique classificacao_risco.`,
            'CLASSIFICACAO_AMBIGUA',
        );
    }

    return candidatas[0];
}

// Classificacao geral = maior severidade (maior classificacao_risco.prioridade)
// entre os riscos individuais ja calculados - NUNCA a soma das pontuacoes
// reclassificada (secao 36): as faixas foram calibradas por risco, nao para
// uma pontuacao agregada.
//
// `riscosCalculados` e o array de riscos ja processados pelo motor, cada um
// com um campo `classificacao` (o objeto retornado por classificarPontuacao).
export function obterClassificacaoGeral(riscosCalculados) {
    if (!Array.isArray(riscosCalculados) || riscosCalculados.length === 0) {
        throw erroClassificacao(
            'Não há riscos calculados para determinar a classificação geral.',
            'SEM_RISCOS_PARA_CLASSIFICACAO_GERAL',
        );
    }

    return riscosCalculados.reduce((maisSevero, atual) => {
        const prioridadeAtual = Number(atual.classificacao.prioridade);
        const prioridadeMaisSevero = Number(maisSevero.classificacao.prioridade);
        return prioridadeAtual > prioridadeMaisSevero ? atual : maisSevero;
    }).classificacao;
}
