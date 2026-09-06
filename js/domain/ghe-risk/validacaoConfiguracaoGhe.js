import { TIPOS_METRICA_SUPORTADOS, METRICAS_QUE_EXIGEM_OPCAO, METRICAS_QUE_EXIGEM_PARAMETRO } from './metricasGhe.js';
import { OPERADORES_CONDICAO_GHE_SUPORTADOS, AGREGADORES_REGRA_GHE_SUPORTADOS } from './avaliadorGhe.js';

// Motor de Risco do GHE - validacao ESTRUTURAL de configuracao.
// MVP-08B - fundacao fisica. Logica pura: recebe as linhas ja
// carregadas do banco (pergunta, opcao, regra, condicoes), nunca
// consulta o Supabase sozinha - isso e responsabilidade de
// js/services/motorRiscoGheService.js.
//
// DIFERENCA FUNDAMENTAL (secao 43 do prompt MVP-08B): isto responde
// "esta configuracao PODE SER EXECUTADA pelo software" - nunca "esta
// configuracao E CIENTIFICAMENTE VALIDA". As duas perguntas nunca devem
// ser confundidas em nenhum ponto de chamada.

function erroValidacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Tipos de pergunta compativeis com cada metrica - CONTAGEM_RESPOSTAS e
// universal (nenhuma restricao). Mantido num unico lugar para nunca
// divergir da tabela documentada em
// docs/mvp08a-arquitetura-motor-risco-ghe.md (secao "Metricas e
// Parametros").
const TIPOS_PERGUNTA_POR_METRICA = {
    CONTAGEM_TRUE: ['BOOLEANO'],
    CONTAGEM_FALSE: ['BOOLEANO'],
    PERCENTUAL_TRUE: ['BOOLEANO'],
    PERCENTUAL_FALSE: ['BOOLEANO'],
    CONTAGEM_OPCAO: ['ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA'],
    PERCENTUAL_OPCAO: ['ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA'],
    MEDIA_VALOR_OPCAO: ['ESCALA'],
    MAXIMO_VALOR_OPCAO: ['ESCALA'],
    MINIMO_VALOR_OPCAO: ['ESCALA'],
    MEDIA_NUMERICA: ['NUMERICO'],
    MINIMO_NUMERICO: ['NUMERICO'],
    MAXIMO_NUMERICO: ['NUMERICO'],
    PERCENTUAL_ACIMA_DE_VALOR: ['NUMERICO'],
    PERCENTUAL_ABAIXO_DE_VALOR: ['NUMERICO'],
    // CONTAGEM_RESPOSTAS: universal, ausente do mapa de proposito.
};

// Valida UMA condicao contra a pergunta/opcao reais que ela referencia.
// Retorna um relatorio ({valida, erros}) em vez de lancar na primeira
// falha, para validarMetodologiaProcessavel poder reportar TODOS os
// problemas de uma metodologia de uma vez (mesmo espirito de
// verificarPerguntasObrigatoriasRespondidas em respostaService.js, que
// tambem nunca para no primeiro erro).
//
// pergunta: linha de pergunta_avaliacao (ou null se id_pergunta nao
// existir mais no catalogo). opcao: linha de opcao_resposta referenciada
// por condicao.id_opcao, ou null quando a condicao nao usa opcao ou a
// opcao nao existe mais.
export function validarCondicaoGhe(condicao, pergunta, opcao) {
    const erros = [];

    if (!pergunta) {
        erros.push({ codigo: 'PERGUNTA_INEXISTENTE', mensagem: `A pergunta #${condicao.id_pergunta} referenciada não existe.` });
        return { valida: false, erros };
    }
    if (!pergunta.ativo) {
        erros.push({ codigo: 'PERGUNTA_INATIVA', mensagem: `A pergunta #${condicao.id_pergunta} está inativa no catálogo.` });
    }

    if (!TIPOS_METRICA_SUPORTADOS.includes(condicao.tipo_metrica)) {
        erros.push({ codigo: 'METRICA_NAO_SUPORTADA', mensagem: `Métrica não suportada: ${condicao.tipo_metrica}.` });
        // Sem tipo de metrica valido, as checagens seguintes (que dependem
        // dele) nao fazem sentido - encerra aqui, mas ja retornando o que
        // foi encontrado ate agora.
        return { valida: false, erros };
    }

    const tiposCompatveis = TIPOS_PERGUNTA_POR_METRICA[condicao.tipo_metrica];
    if (tiposCompatveis && !tiposCompatveis.includes(pergunta.tipo_resposta)) {
        erros.push({
            codigo: 'METRICA_INCOMPATIVEL_COM_PERGUNTA',
            mensagem: `A métrica ${condicao.tipo_metrica} exige pergunta do tipo ${tiposCompatveis.join('/')}, mas a pergunta #${condicao.id_pergunta} é ${pergunta.tipo_resposta}.`,
        });
    }

    const exigeOpcao = METRICAS_QUE_EXIGEM_OPCAO.includes(condicao.tipo_metrica);
    if (exigeOpcao && !condicao.id_opcao) {
        erros.push({ codigo: 'ID_OPCAO_OBRIGATORIO_AUSENTE', mensagem: `A métrica ${condicao.tipo_metrica} exige uma opção-alvo (id_opcao).` });
    } else if (exigeOpcao && condicao.id_opcao) {
        if (!opcao) {
            erros.push({ codigo: 'OPCAO_INEXISTENTE', mensagem: `A opção #${condicao.id_opcao} referenciada não existe.` });
        } else {
            if (!opcao.ativo) {
                erros.push({ codigo: 'OPCAO_INATIVA', mensagem: `A opção #${condicao.id_opcao} está inativa no catálogo.` });
            }
            if (opcao.id_pergunta !== condicao.id_pergunta) {
                erros.push({ codigo: 'OPCAO_INCOMPATIVEL', mensagem: `A opção #${condicao.id_opcao} não pertence à pergunta #${condicao.id_pergunta}.` });
            }
        }
    } else if (!exigeOpcao && condicao.id_opcao) {
        erros.push({ codigo: 'ID_OPCAO_NAO_PERMITIDO', mensagem: `A métrica ${condicao.tipo_metrica} não aceita uma opção-alvo.` });
    }

    const exigeParametro = METRICAS_QUE_EXIGEM_PARAMETRO.includes(condicao.tipo_metrica);
    const parametroPreenchido = condicao.parametro_metrica !== null && condicao.parametro_metrica !== undefined;
    if (exigeParametro && !parametroPreenchido) {
        erros.push({ codigo: 'PARAMETRO_METRICA_AUSENTE', mensagem: `A métrica ${condicao.tipo_metrica} exige um parâmetro numérico.` });
    } else if (!exigeParametro && parametroPreenchido) {
        erros.push({ codigo: 'PARAMETRO_METRICA_NAO_PERMITIDO', mensagem: `A métrica ${condicao.tipo_metrica} não aceita um parâmetro.` });
    }

    if (!OPERADORES_CONDICAO_GHE_SUPORTADOS.includes(condicao.operador)) {
        erros.push({ codigo: 'OPERADOR_NAO_SUPORTADO', mensagem: `Operador não suportado pelo Motor GHE: ${condicao.operador}.` });
    }
    if (condicao.valor_comparacao === null || condicao.valor_comparacao === undefined || Number.isNaN(Number(condicao.valor_comparacao))) {
        erros.push({ codigo: 'VALOR_COMPARACAO_AUSENTE', mensagem: 'A condição não possui um valor de comparação válido.' });
    }

    return { valida: erros.length === 0, erros };
}

// Avalia se UMA regra do GHE pode ser processada pelo software - nunca
// se ela e cientificamente correta. `condicoesValidadas` e o array de
// { valida, erros } ja calculado por validarCondicaoGhe para cada
// condicao desta regra.
export function avaliarRegraProcessavel(regra, condicoesValidadas) {
    const motivos = [];

    if (!regra.ativo) {
        motivos.push({ codigo: 'REGRA_INATIVA', mensagem: `A regra ${regra.codigo} está inativa.` });
    }
    if (!Array.isArray(regra.condicoes) || regra.condicoes.length === 0) {
        motivos.push({ codigo: 'REGRA_SEM_CONDICOES', mensagem: `A regra ${regra.codigo} não possui condições configuradas.` });
    }
    if (!AGREGADORES_REGRA_GHE_SUPORTADOS.includes(regra.operador_agregacao)) {
        motivos.push({ codigo: 'AGREGADOR_NAO_SUPORTADO', mensagem: `A regra ${regra.codigo} usa um agregador não suportado: ${regra.operador_agregacao}.` });
    }
    if (regra.pontuacao_resultado === null || regra.pontuacao_resultado === undefined || Number.isNaN(Number(regra.pontuacao_resultado))) {
        motivos.push({ codigo: 'PONTUACAO_RESULTADO_AUSENTE', mensagem: `A regra ${regra.codigo} não possui uma pontuação de resultado válida.` });
    }

    (condicoesValidadas || []).forEach(({ condicao, valida, erros }) => {
        if (!valida) {
            erros.forEach((erro) => {
                motivos.push({ codigo: erro.codigo, mensagem: `Condição #${condicao.id_condicao_ghe}: ${erro.mensagem}` });
            });
        }
    });

    return { processavel: motivos.length === 0, motivos };
}

// Estrutura minima esperada de uma metodologia processavel: precisa
// estar ativa e ter ao menos uma classificacao ativa (a existencia de
// pelo menos uma regra processavel e responsabilidade de
// validarMetodologiaProcessavel, no service, que tem acesso as regras
// completas). Puramente estrutural - nunca afirma que as faixas
// cobrem cientificamente o espaco de pontuacao esperado.
export function avaliarMetodologiaBaseProcessavel(metodologia, classificacoes) {
    const motivos = [];

    if (!metodologia) {
        return { processavel: false, motivos: [{ codigo: 'METODOLOGIA_NAO_ENCONTRADA', mensagem: 'Metodologia não encontrada.' }] };
    }
    if (!metodologia.ativo) {
        motivos.push({ codigo: 'METODOLOGIA_INATIVA', mensagem: `A metodologia ${metodologia.codigo} ${metodologia.versao} está inativa.` });
    }
    if (!Array.isArray(classificacoes) || classificacoes.filter((c) => c.ativo).length === 0) {
        motivos.push({ codigo: 'CLASSIFICACAO_NAO_ENCONTRADA', mensagem: `A metodologia ${metodologia.codigo} ${metodologia.versao} não possui nenhuma classificação ativa.` });
    }

    return { processavel: motivos.length === 0, motivos };
}
