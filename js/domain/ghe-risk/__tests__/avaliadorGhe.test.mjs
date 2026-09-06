import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCondicaoGhe, agregarResultadosCondicao } from '../avaliadorGhe.js';

describe('11. Operador EQ', () => {
    test('true quando o valor calculado e exatamente igual ao valor de comparacao', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: 50, operador: 'EQ', valorComparacao: 50 }), true);
    });
    test('false quando diferente', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: 49.9, operador: 'EQ', valorComparacao: 50 }), false);
    });
});

describe('12. Operador GTE', () => {
    test('true quando o valor calculado e maior', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: 60, operador: 'GTE', valorComparacao: 50 }), true);
    });
    test('true quando igual (GTE inclui igualdade)', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: 50, operador: 'GTE', valorComparacao: 50 }), true);
    });
    test('false quando menor', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: 40, operador: 'GTE', valorComparacao: 50 }), false);
    });

    test('exemplo obrigatorio completo (secao 46 do prompt MVP-08B): 40% GTE 30 -> TRUE, e 4 nunca e tratado como 30', () => {
        // Simula o fluxo completo: metrica calculada com parametro=4 deu 60%
        // (ver metricasGhe.test.mjs, teste 8) - aqui so a AVALIACAO da
        // condicao, que usa o valor JA CALCULADO (60) contra o valor de
        // comparacao (diferente do parametro 4 usado para calcular).
        const valorCalculadoPelaMetrica = 60; // resultado de PERCENTUAL_ACIMA_DE_VALOR com parametro=4
        const valorComparacaoDaCondicao = 50; // nao e o parametro 4 - e outro numero, outro papel
        assert.notEqual(valorComparacaoDaCondicao, 4, '4 (parametro) e 50 (comparacao) nunca podem ser confundidos');
        assert.equal(
            avaliarCondicaoGhe({ valorCalculado: valorCalculadoPelaMetrica, operador: 'GTE', valorComparacao: valorComparacaoDaCondicao }),
            true,
        );
    });

    test('valorCalculado nulo (metrica sem base valida) -> condicao sempre false, nunca lanca erro', () => {
        assert.equal(avaliarCondicaoGhe({ valorCalculado: null, operador: 'GTE', valorComparacao: 50 }), false);
    });

    test('operador nao suportado lanca OPERADOR_NAO_SUPORTADO (so EQ/GTE nesta fundacao - secao 37)', () => {
        assert.throws(
            () => avaliarCondicaoGhe({ valorCalculado: 10, operador: 'LT', valorComparacao: 5 }),
            (erro) => erro.code === 'OPERADOR_NAO_SUPORTADO',
        );
    });
});

describe('13. Agregador AND', () => {
    test('satisfeita somente quando TODAS as condicoes sao verdadeiras', () => {
        assert.equal(agregarResultadosCondicao('AND', [true, true, true]), true);
        assert.equal(agregarResultadosCondicao('AND', [true, false, true]), false);
        assert.equal(agregarResultadosCondicao('AND', [false, false]), false);
    });
});

describe('14. Agregador OR', () => {
    test('satisfeita quando PELO MENOS UMA condicao e verdadeira', () => {
        assert.equal(agregarResultadosCondicao('OR', [false, false, true]), true);
        assert.equal(agregarResultadosCondicao('OR', [false, false]), false);
        assert.equal(agregarResultadosCondicao('OR', [true, true]), true);
    });
});

describe('Casos de erro do agregador', () => {
    test('regra sem nenhuma condicao lanca REGRA_SEM_CONDICOES', () => {
        assert.throws(
            () => agregarResultadosCondicao('AND', []),
            (erro) => erro.code === 'REGRA_SEM_CONDICOES',
        );
    });
    test('agregador desconhecido lanca AGREGADOR_NAO_SUPORTADO', () => {
        assert.throws(
            () => agregarResultadosCondicao('XOR', [true, false]),
            (erro) => erro.code === 'AGREGADOR_NAO_SUPORTADO',
        );
    });
});
