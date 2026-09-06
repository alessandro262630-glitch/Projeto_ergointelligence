import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { processarRiscosGhePuro } from '../motorRiscoGhe.js';

// Testes de integracao do dominio puro (Camadas 3-6 juntas), com dados
// sinteticos que espelham a FORMA da metodologia ERGO-GHE-DEMO 1.0.0
// (ver database/demo/05_seed_metodologia_ghe_demo.sql), mas sem depender
// do banco - tudo em memoria (secao 30/31 do prompt MVP-08B).

function respostaBooleana(valor) {
    return { respostaBooleano: valor, respostaNumero: null, respostaTexto: null, opcoes: [] };
}
function respostaComOpcao(idOpcao) {
    return { respostaBooleano: null, respostaNumero: null, respostaTexto: null, opcoes: [{ idOpcao, valorNumero: null }] };
}

const perguntas = [
    { id_pergunta: 17, tipo_resposta: 'BOOLEANO' }, // Q14
    { id_pergunta: 18, tipo_resposta: 'ESCALA' },    // Q15
];
const opcoesPorPergunta = new Map([
    [18, [{ idOpcao: 28, valorNumero: 4 }]], // "SEMPRE"
]);

describe('processarRiscosGhePuro - cenario espelhando ERGO-GHE-DEMO 1.0.0 (RISCO-FAD-01)', () => {
    const riscos = [{ id_risco: 8, codigo: 'RISCO-FAD-01', nome: 'Fadiga ocupacional' }];
    const regras = [
        {
            id_regra_ghe: 1, id_risco: 8, codigo: 'R-DEMO-FAD-01', nome: 'AND', operador_agregacao: 'AND', pontuacao_resultado: 4,
            condicoes: [
                { id_condicao_ghe: 1, id_pergunta: 17, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 50 },
                { id_condicao_ghe: 2, id_pergunta: 18, id_opcao: 28, tipo_metrica: 'PERCENTUAL_OPCAO', parametro_metrica: null, operador: 'GTE', valor_comparacao: 30 },
            ],
        },
    ];
    const classificacoesGhe = [
        { id_classificacao_ghe: 1, codigo: 'BAIXO', pontuacao_minima: 0, pontuacao_maxima: 1, prioridade: 1 },
        { id_classificacao_ghe: 2, codigo: 'MODERADO', pontuacao_minima: 2, pontuacao_maxima: 3, prioridade: 2 },
        { id_classificacao_ghe: 3, codigo: 'ALTO', pontuacao_minima: 4, pontuacao_maxima: 5, prioridade: 3 },
        { id_classificacao_ghe: 4, codigo: 'CRITICO', pontuacao_minima: 6, pontuacao_maxima: null, prioridade: 4 },
    ];

    test('AND satisfeito (ambas condicoes verdadeiras) -> pontuacao 4 -> classificacao ALTO', () => {
        const respostasPorPergunta = new Map([
            [17, [respostaBooleana(true), respostaBooleana(true), respostaBooleana(false)]], // 66.7% true
            [18, [respostaComOpcao(28), respostaComOpcao(28), respostaComOpcao(28)]], // 100% "SEMPRE"
        ]);

        const resultado = processarRiscosGhePuro({ perguntas, opcoesPorPergunta, respostasPorPergunta, riscos, regras, classificacoesGhe });
        const risco = resultado.riscos[0];
        assert.equal(risco.pontuacao, 4);
        assert.equal(risco.classificacao.codigo, 'ALTO');
        assert.equal(risco.regras[0].satisfeita, true);
        assert.equal(risco.regras[0].pontuacaoAplicada, 4);
    });

    test('AND nao satisfeito (uma condicao falsa) -> pontuacao 0 -> classificacao BAIXO, mas regra e condicoes ficam rastreadas', () => {
        const respostasPorPergunta = new Map([
            [17, [respostaBooleana(false), respostaBooleana(false), respostaBooleana(true)]], // 33.3% true, abaixo de 50
            [18, [respostaComOpcao(28), respostaComOpcao(28), respostaComOpcao(28)]], // 100% "SEMPRE" (esta sozinha seria verdadeira)
        ]);

        const resultado = processarRiscosGhePuro({ perguntas, opcoesPorPergunta, respostasPorPergunta, riscos, regras, classificacoesGhe });
        const risco = resultado.riscos[0];
        assert.equal(risco.pontuacao, 0, 'AND exige AMBAS - uma condicao falsa e suficiente para a regra inteira nao ser satisfeita');
        assert.equal(risco.classificacao.codigo, 'BAIXO');
        assert.equal(risco.regras[0].satisfeita, false);
        assert.equal(risco.regras[0].pontuacaoAplicada, 0);
        // Rastreabilidade: mesmo nao satisfeita, as DUAS condicoes aparecem,
        // uma true (18) e outra false (17) - "por que a regra NAO foi
        // acionada" precisa ficar visivel (secao 32 do prompt MVP-08C).
        assert.equal(risco.regras[0].condicoes.length, 2);
        assert.equal(risco.regras[0].condicoes[0].resultado, false);
        assert.equal(risco.regras[0].condicoes[1].resultado, true);
    });
});

describe('processarRiscosGhePuro - OR e soma por risco (nunca entre riscos)', () => {
    test('regra OR satisfeita por apenas uma condicao, e riscos diferentes nunca somam pontuacao entre si', () => {
        const riscosDoisTipos = [
            { id_risco: 8, codigo: 'RISCO-FAD-01', nome: 'Fadiga' },
            { id_risco: 5, codigo: 'RISCO-POST-02', nome: 'Postura' },
        ];
        const regrasDoisTipos = [
            {
                id_regra_ghe: 2, id_risco: 8, codigo: 'R-OR', nome: 'OR', operador_agregacao: 'OR', pontuacao_resultado: 3,
                condicoes: [
                    { id_condicao_ghe: 3, id_pergunta: 17, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 90 }, // vai dar falso
                    { id_condicao_ghe: 4, id_pergunta: 18, id_opcao: 28, tipo_metrica: 'PERCENTUAL_OPCAO', parametro_metrica: null, operador: 'GTE', valor_comparacao: 10 }, // vai dar verdadeiro
                ],
            },
            {
                id_regra_ghe: 3, id_risco: 5, codigo: 'R-POST', nome: 'Postura', operador_agregacao: 'AND', pontuacao_resultado: 2,
                condicoes: [
                    { id_condicao_ghe: 5, id_pergunta: 17, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 10 },
                ],
            },
        ];
        const classificacoesGhe = [
            { id_classificacao_ghe: 1, codigo: 'BAIXO', pontuacao_minima: 0, pontuacao_maxima: 1, prioridade: 1 },
            { id_classificacao_ghe: 2, codigo: 'MODERADO', pontuacao_minima: 2, pontuacao_maxima: 3, prioridade: 2 },
            { id_classificacao_ghe: 3, codigo: 'ALTO', pontuacao_minima: 4, pontuacao_maxima: 5, prioridade: 3 },
            { id_classificacao_ghe: 4, codigo: 'CRITICO', pontuacao_minima: 6, pontuacao_maxima: null, prioridade: 4 },
        ];
        const respostasPorPergunta = new Map([
            [17, [respostaBooleana(true), respostaBooleana(false)]], // 50% true
            [18, [respostaComOpcao(28)]], // 100% "SEMPRE"
        ]);

        const resultado = processarRiscosGhePuro({
            perguntas, opcoesPorPergunta, respostasPorPergunta,
            riscos: riscosDoisTipos, regras: regrasDoisTipos, classificacoesGhe,
        });

        const fadiga = resultado.riscos.find((r) => r.id_risco === 8);
        const postura = resultado.riscos.find((r) => r.id_risco === 5);

        assert.equal(fadiga.regras[0].satisfeita, true, 'OR: basta uma condicao verdadeira');
        assert.equal(fadiga.pontuacao, 3);
        assert.equal(postura.pontuacao, 2);
        // Nunca 3+2=5 num unico resultado - cada risco tem sua PROPRIA
        // pontuacao, nunca somada com a de outro risco.
        assert.notEqual(fadiga.pontuacao, 5);
        assert.notEqual(postura.pontuacao, 5);
    });
});

describe('processarRiscosGhePuro - erros de configuracao', () => {
    test('classificacao ausente para a pontuacao obtida lanca CLASSIFICACAO_NAO_ENCONTRADA', () => {
        const riscos = [{ id_risco: 1, codigo: 'X', nome: 'X' }];
        const regras = [{
            id_regra_ghe: 1, id_risco: 1, codigo: 'R1', nome: 'R1', operador_agregacao: 'AND', pontuacao_resultado: 100,
            condicoes: [{ id_condicao_ghe: 1, id_pergunta: 17, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 0 }],
        }];
        const classificacoesIncompletas = [{ id_classificacao_ghe: 1, codigo: 'BAIXO', pontuacao_minima: 0, pontuacao_maxima: 1, prioridade: 1 }];
        const respostasPorPergunta = new Map([[17, [respostaBooleana(true)]]]);

        assert.throws(
            () => processarRiscosGhePuro({ perguntas, opcoesPorPergunta, respostasPorPergunta, riscos, regras, classificacoesGhe: classificacoesIncompletas }),
            (erro) => erro.code === 'CLASSIFICACAO_NAO_ENCONTRADA',
        );
    });

    test('nunca produz classificacaoGeral (permanece pendencia metodologica)', () => {
        const riscos = [{ id_risco: 8, codigo: 'RISCO-FAD-01', nome: 'Fadiga' }];
        const regras = [{
            id_regra_ghe: 1, id_risco: 8, codigo: 'R1', nome: 'R1', operador_agregacao: 'AND', pontuacao_resultado: 1,
            condicoes: [{ id_condicao_ghe: 1, id_pergunta: 17, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 0 }],
        }];
        const classificacoesGhe = [{ id_classificacao_ghe: 1, codigo: 'BAIXO', pontuacao_minima: 0, pontuacao_maxima: null, prioridade: 1 }];
        const respostasPorPergunta = new Map([[17, [respostaBooleana(true)]]]);

        const resultado = processarRiscosGhePuro({ perguntas, opcoesPorPergunta, respostasPorPergunta, riscos, regras, classificacoesGhe });
        assert.equal('classificacaoGeral' in resultado, false);
    });
});
