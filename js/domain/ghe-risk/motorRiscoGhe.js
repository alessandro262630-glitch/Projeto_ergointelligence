import { calcularMetrica } from './metricasGhe.js';
import { avaliarCondicaoGhe, agregarResultadosCondicao } from './avaliadorGhe.js';
import { classificarPontuacao } from '../classificadorRisco.js';

// Motor de Risco do GHE - Camadas 4 a 6 (avaliacao de regras + risco +
// classificacao). MVP-08C - primeira execucao completa, com uma
// metodologia EXCLUSIVAMENTE DEMONSTRATIVA. Logica pura: sem Supabase,
// sem DOM. js/services/motorRiscoGheService.js busca os dados e persiste
// o resultado; este modulo so calcula (mesma separacao ja usada pelo
// Motor individual entre motorRisco.js e riscoService.js).

function erroMotorGhe(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// classificacao_risco_ghe usa nomes de campo deliberadamente diferentes
// de classificacao_risco (pontuacao_minima/pontuacao_maxima vs.
// pontuacao_min/pontuacao_max - MVP-08A, secao 3) para reforcar que sao
// tabelas independentes. classificarPontuacao() (Motor individual) e
// puramente generica e e REAPROVEITADA aqui tal como esta, sem nenhuma
// modificacao - so precisa deste adaptador de nomes antes de ser chamada
// (ver docs/mvp08a-arquitetura-motor-risco-ghe.md, secao 7).
function adaptarClassificacoesGhe(classificacoesGhe) {
    return classificacoesGhe.map((c) => ({
        id_classificacao: c.id_classificacao_ghe,
        codigo: c.codigo,
        nome: c.nome,
        pontuacao_min: c.pontuacao_minima,
        pontuacao_max: c.pontuacao_maxima,
        prioridade: c.prioridade,
    }));
}

// Avalia UMA condicao: calcula a metrica (Camada 3) e compara com o
// valor de comparacao (Camada 4). Retorna o rastro COMPLETO necessario
// para persistir avaliacao_ghe_risco_condicao sem depender da
// configuracao atual depois (MVP-08A, secao 9/25).
function avaliarCondicaoCompleta(condicao, contextoPerguntas) {
    const pergunta = contextoPerguntas.perguntaPorId.get(condicao.id_pergunta);
    if (!pergunta) {
        throw erroMotorGhe(`Condição #${condicao.id_condicao_ghe} referencia uma pergunta inexistente.`, 'PERGUNTA_INEXISTENTE');
    }

    const respostas = contextoPerguntas.respostasPorPergunta.get(condicao.id_pergunta) || [];
    const opcoesDaPergunta = contextoPerguntas.opcoesPorPergunta.get(condicao.id_pergunta) || [];

    const { valor: valorCalculado, baseCalculo } = calcularMetrica(condicao.tipo_metrica, {
        respostas,
        tipoResposta: pergunta.tipo_resposta,
        opcoesDaPergunta,
        idOpcao: condicao.id_opcao,
        parametroMetrica: condicao.parametro_metrica,
    });

    const resultado = avaliarCondicaoGhe({
        valorCalculado,
        operador: condicao.operador,
        valorComparacao: condicao.valor_comparacao,
    });

    return {
        id_condicao_ghe: condicao.id_condicao_ghe,
        tipoMetrica: condicao.tipo_metrica,
        idPergunta: condicao.id_pergunta,
        idOpcao: condicao.id_opcao,
        parametroMetrica: condicao.parametro_metrica,
        valorCalculado,
        baseCalculo,
        operador: condicao.operador,
        valorComparacao: condicao.valor_comparacao,
        resultado,
    };
}

function montarDetalheRegraGhe(regra, condicoesAvaliadas, satisfeita, pontuacaoAplicada) {
    const detalheCondicoes = condicoesAvaliadas
        .map((c) => `Pergunta #${c.idPergunta}: ${c.tipoMetrica} = ${c.valorCalculado === null ? 'sem base' : c.valorCalculado} (n=${c.baseCalculo}), ${c.operador} ${c.valorComparacao} -> ${c.resultado ? 'verdadeiro' : 'falso'}.`)
        .join(' | ');
    return `${regra.codigo} — ${regra.nome}. ${detalheCondicoes} Agregador: ${regra.operador_agregacao}. `
        + `Resultado: ${satisfeita ? 'satisfeita' : 'não satisfeita'}. Pontuação aplicada: ${pontuacaoAplicada}.`;
}

// Avalia uma regra completa: todas as condicoes (Camada 4), agrega pelo
// operador (AND/OR) e aplica pontuacao_resultado somente se satisfeita -
// mesmo espirito de motorRisco.avaliarRegra, adaptado para consultar
// metricas em vez de respostas brutas. Regra NAO satisfeita tambem e
// retornada (pontuacaoAplicada = 0) - a rastreabilidade de "por que uma
// regra nao foi acionada" e um requisito explicito (MVP-08C, secao 32).
function avaliarRegraGheCompleta(regra, contextoPerguntas) {
    if (!regra.condicoes || regra.condicoes.length === 0) {
        throw erroMotorGhe(`Regra "${regra.codigo}" não possui condições configuradas.`, 'REGRA_SEM_CONDICOES');
    }

    const condicoesAvaliadas = regra.condicoes.map((condicao) => avaliarCondicaoCompleta(condicao, contextoPerguntas));
    const satisfeita = agregarResultadosCondicao(regra.operador_agregacao, condicoesAvaliadas.map((c) => c.resultado));
    const pontuacaoAplicada = satisfeita ? Number(regra.pontuacao_resultado) : 0;

    return {
        id_regra_ghe: regra.id_regra_ghe,
        codigo: regra.codigo,
        nome: regra.nome,
        codigoRegraSnapshot: regra.codigo,
        pontuacaoResultadoSnapshot: Number(regra.pontuacao_resultado),
        satisfeita,
        pontuacaoAplicada,
        detalhe: montarDetalheRegraGhe(regra, condicoesAvaliadas, satisfeita, pontuacaoAplicada),
        condicoes: condicoesAvaliadas,
    };
}

// Processa UM risco: soma a pontuacao das regras satisfeitas (NUNCA soma
// entre riscos diferentes - MVP-08A, secao "riscos confirmados") e
// classifica o total dentro das faixas da metodologia. Erro de
// classificacao (0 ou >1 faixas aplicaveis) sobe tal como veio de
// classificarPontuacao(), com .code ja preenchido.
function processarRiscoGhe(risco, regrasDoRisco, contextoPerguntas, classificacoesGhe) {
    const regrasAvaliadas = regrasDoRisco.map((regra) => avaliarRegraGheCompleta(regra, contextoPerguntas));
    const pontuacao = regrasAvaliadas
        .filter((r) => r.satisfeita)
        .reduce((soma, r) => soma + r.pontuacaoAplicada, 0);

    const classificacaoAdaptada = classificarPontuacao(pontuacao, adaptarClassificacoesGhe(classificacoesGhe));
    // Devolve o objeto original de classificacao_risco_ghe (nao o
    // adaptado) - so usamos os nomes "min/max" emprestados para
    // reaproveitar a funcao pura, nunca para o restante do sistema.
    const classificacao = classificacoesGhe.find((c) => c.id_classificacao_ghe === classificacaoAdaptada.id_classificacao);

    return {
        id_risco: risco.id_risco,
        codigo: risco.codigo,
        nome: risco.nome,
        pontuacao,
        classificacao,
        regras: regrasAvaliadas,
    };
}

// Ponto de entrada do dominio (equivalente a motorRisco.processarMotorRisco,
// mas para o GHE). Entrada:
// {
//   perguntas: [{ id_pergunta, tipo_resposta }],
//   opcoesPorPergunta: Map<idPergunta, [{ idOpcao, valorNumero }]>,
//   respostasPorPergunta: Map<idPergunta, [{ respostaBooleano, respostaNumero, respostaTexto, opcoes }]>,
//   riscos: [{ id_risco, codigo, nome }],
//   regras: [{ id_regra_ghe, id_risco, codigo, nome, operador_agregacao, pontuacao_resultado, condicoes: [...] }],
//   classificacoesGhe: [{ id_classificacao_ghe, codigo, nome, pontuacao_minima, pontuacao_maxima, prioridade }],
// }
// Saida: { riscos: [ { id_risco, codigo, nome, pontuacao, classificacao, regras } ] }
// Nunca produz classificacaoGeral - PENDENCIA METODOLOGICA (MVP-08A/C).
export function processarRiscosGhePuro({ perguntas, opcoesPorPergunta, respostasPorPergunta, riscos, regras, classificacoesGhe }) {
    if (!Array.isArray(riscos) || riscos.length === 0) {
        throw erroMotorGhe('Nenhum risco ativo foi encontrado para esta metodologia.', 'CATALOGO_RISCO_VAZIO');
    }
    if (!Array.isArray(classificacoesGhe) || classificacoesGhe.length === 0) {
        throw erroMotorGhe('A metodologia não possui nenhuma classificação ativa.', 'CLASSIFICACAO_NAO_ENCONTRADA');
    }
    if (!Array.isArray(regras) || regras.length === 0) {
        throw erroMotorGhe('A metodologia não possui nenhuma regra ativa.', 'SEM_REGRAS_APLICAVEIS');
    }

    const perguntaPorId = new Map(perguntas.map((p) => [p.id_pergunta, p]));
    const contextoPerguntas = { perguntaPorId, opcoesPorPergunta, respostasPorPergunta };

    const mapaRiscos = new Map(riscos.map((r) => [r.id_risco, r]));
    regras.forEach((regra) => {
        if (!mapaRiscos.has(regra.id_risco)) {
            throw erroMotorGhe(`A regra "${regra.codigo}" referencia um risco inexistente ou inativo (id_risco=${regra.id_risco}).`, 'REGRA_RISCO_INEXISTENTE');
        }
    });

    const regrasPorRisco = new Map();
    regras.forEach((regra) => {
        const lista = regrasPorRisco.get(regra.id_risco) || [];
        lista.push(regra);
        regrasPorRisco.set(regra.id_risco, lista);
    });

    const riscosCalculados = [];
    riscos.forEach((risco) => {
        const regrasDoRisco = regrasPorRisco.get(risco.id_risco);
        if (regrasDoRisco && regrasDoRisco.length > 0) {
            riscosCalculados.push(processarRiscoGhe(risco, regrasDoRisco, contextoPerguntas, classificacoesGhe));
        }
    });

    if (riscosCalculados.length === 0) {
        throw erroMotorGhe('Nenhuma regra aplicável foi encontrada para os riscos ativos desta metodologia.', 'SEM_REGRAS_APLICAVEIS');
    }

    // classificacaoGeral nunca e calculada aqui - permanece pendencia
    // metodologica (MVP-08A, secao 34/38; MVP-08C, secao 10/42): o
    // resultado do GHE e SEMPRE por risco, nunca um score/classificacao
    // geral opaca.
    return { riscos: riscosCalculados };
}
