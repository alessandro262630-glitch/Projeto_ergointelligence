import { classificarPontuacao, obterClassificacaoGeral } from './classificadorRisco.js';

// Motor de Risco Ergonomico - camada de dominio.
// Logica pura: recebe estruturas JavaScript, retorna estruturas
// JavaScript. NAO importa Supabase, NAO manipula DOM, NAO usa LLM/IA
// generativa. Determinístico: mesmas respostas + mesmas regras + mesma
// versão = sempre o mesmo resultado. Toda regra/risco/classificação vem do
// banco (ver js/services/riscoService.js) - nada aqui e hardcoded.

// Versao fixa e explicita (nunca "latest"/"atual") - persistida em
// avaliacao_risco.versao_motor_regras e
// avaliacao_ergonomica.versao_motor_regras.
export const MOTOR_RISCO_VERSAO = 'MVP-1.0.0';

// Operadores/agregadores efetivamente suportados por esta versao do motor
// (secoes 15/16/23 do prompt). Uma regra ativa que use algo fora disso deve
// interromper o calculo com erro explicito - nunca ser ignorada ou tratada
// como falsa por padrao.
const OPERADORES_CONDICAO_SUPORTADOS = ['EQ', 'GTE'];
const AGREGADORES_SUPORTADOS = ['AND', 'OR'];

function erroMotor(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// vigencia_inicio/vigencia_fim sao DATE; data_avaliacao e TIMESTAMPTZ.
// Compara so a parte de data (YYYY-MM-DD) como texto - uma comparacao de
// Date completa introduziria fuso horario onde o banco so tem uma data.
function extrairDataIso(valor) {
    return String(valor).slice(0, 10);
}

// Regra vigente quando vigencia_inicio <= data_avaliacao E (vigencia_fim
// e nulo OU vigencia_fim >= data_avaliacao) - sempre relativo a data DA
// AVALIACAO, nunca a data de hoje (secao 13): permite reprocessar/auditar
// avaliacoes historicas com o conjunto de regras que estava vigente na
// epoca, mesmo que o catalogo de regras tenha mudado depois.
function regraVigente(regra, dataAvaliacaoIso) {
    const dataAvaliacao = extrairDataIso(dataAvaliacaoIso);
    const inicio = extrairDataIso(regra.vigencia_inicio);

    if (dataAvaliacao < inicio) {
        return false;
    }
    if (regra.vigencia_fim === null || regra.vigencia_fim === undefined) {
        return true;
    }
    return dataAvaliacao <= extrairDataIso(regra.vigencia_fim);
}

function obterRespostaPergunta(respostas, idPergunta) {
    return respostas ? respostas[idPergunta] || null : null;
}

// EQ e aplicavel a booleano, numero, texto ou id_opcao - regra_condicao
// sempre tem exatamente um desses valores preenchido (constraint do
// schema), entao o proprio formato da condicao diz qual comparacao fazer.
function avaliarEq(condicao, resposta) {
    if (condicao.id_opcao !== null && condicao.id_opcao !== undefined) {
        if (!condicao.opcaoReferenciada) {
            throw erroMotor(
                `Condição #${condicao.id_condicao}: a opção #${condicao.id_opcao} não existe no catálogo.`,
                'CONDICAO_OPCAO_INEXISTENTE',
            );
        }
        if (condicao.opcaoReferenciada.id_pergunta !== condicao.id_pergunta) {
            throw erroMotor(
                `Condição #${condicao.id_condicao}: a opção #${condicao.id_opcao} não pertence à pergunta #${condicao.id_pergunta}.`,
                'CONDICAO_OPCAO_INCOMPATIVEL',
            );
        }

        const selecionada = (resposta.opcoes || []).some((opcao) => opcao.idOpcao === condicao.id_opcao);
        return {
            satisfeita: selecionada,
            detalhe: `Pergunta #${condicao.id_pergunta}: opção "${condicao.opcaoReferenciada.codigo}" ${selecionada ? '' : 'não '}selecionada (EQ).`,
        };
    }

    if (condicao.valor_booleano !== null && condicao.valor_booleano !== undefined) {
        // false e um valor de resposta/condicao legitimo - nunca usar
        // checagem "falsy" aqui (secao 17).
        if (resposta.respostaBooleano === null || resposta.respostaBooleano === undefined) {
            return { satisfeita: false, detalhe: `Pergunta #${condicao.id_pergunta}: sem resposta.` };
        }
        const satisfeita = resposta.respostaBooleano === condicao.valor_booleano;
        return {
            satisfeita,
            detalhe: `Pergunta #${condicao.id_pergunta}: valor selecionado = ${resposta.respostaBooleano}, EQ ${condicao.valor_booleano}, resultado = ${satisfeita ? 'verdadeiro' : 'falso'}.`,
        };
    }

    if (condicao.valor_numero !== null && condicao.valor_numero !== undefined) {
        if (resposta.respostaNumero === null || resposta.respostaNumero === undefined) {
            return { satisfeita: false, detalhe: `Pergunta #${condicao.id_pergunta}: sem resposta.` };
        }
        const satisfeita = Number(resposta.respostaNumero) === Number(condicao.valor_numero);
        return {
            satisfeita,
            detalhe: `Pergunta #${condicao.id_pergunta}: valor = ${resposta.respostaNumero}, EQ ${condicao.valor_numero}, resultado = ${satisfeita ? 'verdadeiro' : 'falso'}.`,
        };
    }

    if (condicao.valor_texto !== null && condicao.valor_texto !== undefined) {
        if (typeof resposta.respostaTexto !== 'string') {
            return { satisfeita: false, detalhe: `Pergunta #${condicao.id_pergunta}: sem resposta.` };
        }
        const satisfeita = resposta.respostaTexto === condicao.valor_texto;
        return {
            satisfeita,
            detalhe: `Pergunta #${condicao.id_pergunta}: texto = "${resposta.respostaTexto}", EQ "${condicao.valor_texto}", resultado = ${satisfeita ? 'verdadeiro' : 'falso'}.`,
        };
    }

    throw erroMotor(
        `Condição #${condicao.id_condicao} não possui valor de comparação válido para EQ.`,
        'CONDICAO_SEM_VALOR',
    );
}

// GTE e aplicavel a valores numericos. No projeto atual, ESCALA persiste o
// valor em opcao_resposta.valor_numero (nunca em resposta_numero) - ver
// secao 10/19 do prompt. O motor decide qual campo usar pela FORMA da
// resposta (tem opcoes selecionadas = veio de opcao_resposta), nao pelo
// tipo_resposta da pergunta, evitando precisar carregar esse metadado extra.
function avaliarGte(condicao, resposta) {
    if (condicao.valor_numero === null || condicao.valor_numero === undefined) {
        throw erroMotor(
            `Condição #${condicao.id_condicao} do tipo GTE não possui valor numérico de comparação.`,
            'CONDICAO_NUMERICA_SEM_VALOR',
        );
    }

    const limiar = Number(condicao.valor_numero);

    if (resposta.opcoes && resposta.opcoes.length > 0) {
        // Multiplas opcoes selecionadas (ex.: futura ESCOLHA_MULTIPLA em
        // comparacao numerica): satisfeita se AO MENOS UMA opcao com
        // valor_numero valido atender a comparacao (secao 20).
        const opcaoValida = resposta.opcoes.find(
            (opcao) => opcao.valorNumero !== null && opcao.valorNumero !== undefined && Number(opcao.valorNumero) >= limiar,
        );
        const satisfeita = Boolean(opcaoValida);
        const valores = resposta.opcoes.map((opcao) => opcao.valorNumero).join(', ');
        return {
            satisfeita,
            detalhe: `Pergunta #${condicao.id_pergunta}: valor(es) selecionado(s) = ${valores}, GTE ${limiar}, resultado = ${satisfeita ? 'verdadeiro' : 'falso'}.`,
        };
    }

    if (resposta.respostaNumero === null || resposta.respostaNumero === undefined) {
        return { satisfeita: false, detalhe: `Pergunta #${condicao.id_pergunta}: sem resposta.` };
    }

    const satisfeita = Number(resposta.respostaNumero) >= limiar;
    return {
        satisfeita,
        detalhe: `Pergunta #${condicao.id_pergunta}: valor = ${resposta.respostaNumero}, GTE ${limiar}, resultado = ${satisfeita ? 'verdadeiro' : 'falso'}.`,
    };
}

// Ausencia de resposta nunca lanca excecao: vira condicao FALSE, registrada
// no detalhe (secao 21) - o motor e defensivo mesmo que a AVA-05 ja deva
// impedir perguntas obrigatorias sem resposta.
function avaliarCondicao(condicao, respostas) {
    const resposta = obterRespostaPergunta(respostas, condicao.id_pergunta);

    if (!resposta) {
        return { satisfeita: false, detalhe: `Pergunta #${condicao.id_pergunta}: sem resposta.` };
    }

    if (!OPERADORES_CONDICAO_SUPORTADOS.includes(condicao.operador)) {
        throw erroMotor(
            `Operador de regra não suportado pelo Motor MVP: ${condicao.operador}`,
            'OPERADOR_NAO_SUPORTADO',
        );
    }

    if (condicao.operador === 'EQ') {
        return avaliarEq(condicao, resposta);
    }
    return avaliarGte(condicao, resposta);
}

function montarDetalheRegra(regra, resultadosCondicoes, satisfeita, pontuacaoAplicada) {
    const detalheCondicoes = resultadosCondicoes.map((resultado) => resultado.detalhe).join(' | ');
    return `${regra.codigo} — ${regra.nome}. ${detalheCondicoes} Agregador: ${regra.operador_agregacao}. `
        + `Resultado: ${satisfeita ? 'satisfeita' : 'não satisfeita'}. Pontuação aplicada: ${pontuacaoAplicada}.`;
}

// Avalia uma regra completa: todas as condicoes, agrega pelo operador
// (AND = todas verdadeiras, OR = pelo menos uma), aplica
// pontuacao_resultado somente se satisfeita (secao 22/24) - nunca a partir
// de opcao_resposta.pontuacao_base, para evitar dupla contagem.
function avaliarRegra(regra, respostas) {
    if (!regra.condicoes || regra.condicoes.length === 0) {
        throw erroMotor(`Regra "${regra.codigo}" não possui condições configuradas.`, 'REGRA_SEM_CONDICOES');
    }
    if (!AGREGADORES_SUPORTADOS.includes(regra.operador_agregacao)) {
        throw erroMotor(
            `Regra "${regra.codigo}" utiliza um agregador não suportado: ${regra.operador_agregacao}`,
            'AGREGADOR_NAO_SUPORTADO',
        );
    }

    const resultadosCondicoes = regra.condicoes.map((condicao) => ({
        ...avaliarCondicao(condicao, respostas),
        id_condicao: condicao.id_condicao,
    }));

    const satisfeita = regra.operador_agregacao === 'AND'
        ? resultadosCondicoes.every((resultado) => resultado.satisfeita)
        : resultadosCondicoes.some((resultado) => resultado.satisfeita);

    const pontuacaoAplicada = satisfeita ? Number(regra.pontuacao_resultado) : 0;

    return {
        id_regra: regra.id_regra,
        codigo: regra.codigo,
        satisfeita,
        pontuacaoAplicada,
        detalhe: montarDetalheRegra(regra, resultadosCondicoes, satisfeita, pontuacaoAplicada),
    };
}

// Justificativa determinística (nunca texto clinico/diagnostico - secao 32):
// so enumera quais regras pontuaram, sem interpretar o significado.
function montarJustificativaRisco(resultadosRegras) {
    const satisfeitas = resultadosRegras.filter((resultado) => resultado.satisfeita);

    if (satisfeitas.length === 0) {
        return 'Nenhuma regra de pontuação deste risco foi satisfeita.';
    }

    const codigos = satisfeitas.map((resultado) => resultado.codigo);
    if (codigos.length === 1) {
        return `Pontuação resultante da regra ${codigos[0]}.`;
    }

    const ultimo = codigos[codigos.length - 1];
    const demais = codigos.slice(0, -1).join(', ');
    return `Pontuação resultante das regras ${demais} e ${ultimo}.`;
}

// Processa um unico risco: avalia todas as suas regras vigentes, soma a
// pontuacao das satisfeitas (secao 25) e classifica o total (secao 27/29).
function processarRisco(risco, regrasDoRisco, respostas, classificacoes) {
    const resultadosRegras = regrasDoRisco.map((regra) => avaliarRegra(regra, respostas));
    const pontuacao = resultadosRegras
        .filter((resultado) => resultado.satisfeita)
        .reduce((soma, resultado) => soma + resultado.pontuacaoAplicada, 0);

    return {
        id_risco: risco.id_risco,
        codigo: risco.codigo,
        nome: risco.nome,
        pontuacao,
        classificacao: classificarPontuacao(pontuacao, classificacoes),
        justificativa: montarJustificativaRisco(resultadosRegras),
        regras: resultadosRegras,
    };
}

// Ponto de entrada do dominio. Entrada e saida descritas nas secoes 4/35 do
// prompt. Funciona com objetos JavaScript puros - sem Supabase, sem DOM -
// permitindo testar o motor inteiro fornecendo apenas os dados (secao 49).
//
// dados: {
//   avaliacao: { id_avaliacao, data_avaliacao, ... },
//   respostas: { [idPergunta]: { respostaBooleano, respostaNumero, respostaTexto, opcoes: [{ idOpcao, codigo, rotulo, valorNumero }] } },
//   regras: [ { id_regra, id_risco, codigo, nome, operador_agregacao, pontuacao_resultado, vigencia_inicio, vigencia_fim, condicoes: [...] } ],
//   riscos: [ { id_risco, codigo, nome, categoria } ],
//   classificacoes: [ { id_classificacao, codigo, nome, pontuacao_min, pontuacao_max, prioridade } ],
// }
export function processarMotorRisco({ avaliacao, respostas, regras, riscos, classificacoes }) {
    if (!avaliacao || !avaliacao.data_avaliacao) {
        throw erroMotor('Dados da avaliação ausentes ou incompletos para o motor de risco.', 'AVALIACAO_AUSENTE');
    }
    if (!Array.isArray(riscos) || riscos.length === 0) {
        throw erroMotor('Nenhum risco ergonômico ativo foi encontrado no catálogo.', 'CATALOGO_RISCO_VAZIO');
    }
    if (!Array.isArray(classificacoes) || classificacoes.length === 0) {
        throw erroMotor('Nenhuma classificação de risco ativa foi encontrada no catálogo.', 'CATALOGO_CLASSIFICACAO_VAZIO');
    }

    const mapaRiscos = new Map(riscos.map((risco) => [risco.id_risco, risco]));
    const regrasVigentes = (regras || []).filter((regra) => regraVigente(regra, avaliacao.data_avaliacao));

    // Toda regra vigente deve apontar para um risco ativo carregado - do
    // contrario e inconsistencia de configuracao (secao 45), nunca um
    // "pular e seguir em frente" silencioso.
    regrasVigentes.forEach((regra) => {
        if (!mapaRiscos.has(regra.id_risco)) {
            throw erroMotor(
                `A regra "${regra.codigo}" referencia um risco inexistente ou inativo (id_risco=${regra.id_risco}).`,
                'REGRA_RISCO_INEXISTENTE',
            );
        }
    });

    const regrasPorRisco = new Map();
    regrasVigentes.forEach((regra) => {
        const lista = regrasPorRisco.get(regra.id_risco) || [];
        lista.push(regra);
        regrasPorRisco.set(regra.id_risco, lista);
    });

    // Gera resultado para todo risco ativo com pelo menos uma regra vigente
    // aplicavel, mesmo que a pontuacao final seja 0 (secao 26).
    const riscosCalculados = [];
    riscos.forEach((risco) => {
        const regrasDoRisco = regrasPorRisco.get(risco.id_risco);
        if (regrasDoRisco && regrasDoRisco.length > 0) {
            riscosCalculados.push(processarRisco(risco, regrasDoRisco, respostas, classificacoes));
        }
    });

    if (riscosCalculados.length === 0) {
        throw erroMotor(
            'Nenhuma regra vigente aplicável foi encontrada para os riscos ativos nesta data de avaliação.',
            'SEM_REGRAS_APLICAVEIS',
        );
    }

    const pontuacaoTotal = riscosCalculados.reduce((soma, risco) => soma + risco.pontuacao, 0);

    return {
        versaoMotor: MOTOR_RISCO_VERSAO,
        pontuacaoTotal,
        // Classificacao geral = maior severidade entre os riscos
        // individuais (secao 36) - nunca reclassifica pontuacaoTotal.
        classificacaoGeral: obterClassificacaoGeral(riscosCalculados),
        riscos: riscosCalculados,
    };
}
