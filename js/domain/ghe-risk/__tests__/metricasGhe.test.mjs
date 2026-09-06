import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    calcularContagemTrue,
    calcularContagemFalse,
    calcularPercentualTrue,
    calcularPercentualFalse,
    calcularContagemOpcao,
    calcularPercentualOpcao,
    calcularMediaValorOpcao,
    calcularMaximoValorOpcao,
    calcularMinimoValorOpcao,
    calcularMediaNumerica,
    calcularMinimoNumerico,
    calcularMaximoNumerico,
    calcularPercentualAcimaDeValor,
    calcularPercentualAbaixoDeValor,
    calcularContagemRespostas,
    calcularMetrica,
} from '../metricasGhe.js';

// Testes unitarios do dominio puro do Motor de Risco do GHE (MVP-08B,
// secao 45/46 do prompt). Nenhum teste toca Supabase/DOM - so objetos
// JavaScript simples entram e saem, exatamente como o dominio exige
// (secao 30/31 do prompt).

function respostaBooleana(valor) {
    return { respostaBooleano: valor, respostaNumero: null, respostaTexto: null, opcoes: [] };
}
function respostaNumerica(valor) {
    return { respostaBooleano: null, respostaNumero: valor, respostaTexto: null, opcoes: [] };
}
function respostaComOpcoes(idsOpcoes, valoresNumericos = {}) {
    return {
        respostaBooleano: null,
        respostaNumero: null,
        respostaTexto: null,
        opcoes: idsOpcoes.map((idOpcao) => ({ idOpcao, valorNumero: valoresNumericos[idOpcao] ?? null })),
    };
}

describe('1. CONTAGEM_TRUE', () => {
    test('conta corretamente true/false, ignorando nao respondidas', () => {
        const respostas = [respostaBooleana(true), respostaBooleana(true), respostaBooleana(false), respostaBooleana(null)];
        const resultado = calcularContagemTrue(respostas);
        assert.equal(resultado.valor, 2);
        assert.equal(resultado.baseCalculo, 3); // 3 respondidas (true/true/false), 1 vazia excluida
    });

    test('false e um valor respondido valido, nunca tratado como ausencia', () => {
        const resultado = calcularContagemFalse([respostaBooleana(false), respostaBooleana(false)]);
        assert.equal(resultado.valor, 2);
        assert.equal(resultado.baseCalculo, 2);
    });
});

describe('2. PERCENTUAL_TRUE', () => {
    test('4 de 6 = 66.6667% (precisao total, sem arredondar no dominio)', () => {
        const respostas = [
            respostaBooleana(true), respostaBooleana(true), respostaBooleana(true), respostaBooleana(true),
            respostaBooleana(false), respostaBooleana(false),
        ];
        const resultado = calcularPercentualTrue(respostas);
        assert.equal(resultado.baseCalculo, 6);
        assert.ok(Math.abs(resultado.valor - 66.66666666666667) < 1e-9, `esperado ~66.6667, recebido ${resultado.valor}`);
        assert.notEqual(resultado.valor, 67, 'o dominio nunca arredonda antes de avaliar a regra (secao 36)');
    });
});

describe('3. CONTAGEM_OPCAO', () => {
    test('conta quantas respostas selecionaram a opcao-alvo', () => {
        const respostas = [
            respostaComOpcoes([10]),
            respostaComOpcoes([11]),
            respostaComOpcoes([10]),
        ];
        const resultado = calcularContagemOpcao(respostas, 10, 'ESCOLHA_UNICA');
        assert.equal(resultado.valor, 2);
        assert.equal(resultado.baseCalculo, 3);
    });
});

describe('4. PERCENTUAL_OPCAO', () => {
    test('percentual sobre o total de respondidas, nao sobre selecoes (ESCOLHA_MULTIPLA pode passar de 100% somando todas as opcoes)', () => {
        const respostas = [
            respostaComOpcoes([10, 11]),
            respostaComOpcoes([10]),
            respostaComOpcoes([11]),
        ];
        const percentualOpcao10 = calcularPercentualOpcao(respostas, 10, 'ESCOLHA_MULTIPLA');
        const percentualOpcao11 = calcularPercentualOpcao(respostas, 11, 'ESCOLHA_MULTIPLA');
        assert.equal(percentualOpcao10.baseCalculo, 3);
        assert.ok(Math.abs(percentualOpcao10.valor - 66.66666666666667) < 1e-9);
        assert.ok(Math.abs(percentualOpcao11.valor - 66.66666666666667) < 1e-9);
        // 66.67% + 66.67% > 100% - esperado e correto, nunca normalizado.
        assert.ok(percentualOpcao10.valor + percentualOpcao11.valor > 100);
    });
});

describe('MEDIA/MAXIMO/MINIMO_VALOR_OPCAO (ESCALA)', () => {
    const opcoesDaPergunta = [
        { idOpcao: 1, valorNumero: 0 },
        { idOpcao: 2, valorNumero: 1 },
        { idOpcao: 3, valorNumero: 2 },
        { idOpcao: 4, valorNumero: 3 },
        { idOpcao: 5, valorNumero: 4 },
    ];

    test('media/maximo/minimo calculados corretamente quando todas as opcoes tem valor_numero', () => {
        const respostas = [respostaComOpcoes([5], { 5: 4 }), respostaComOpcoes([1], { 1: 0 })];
        assert.equal(calcularMediaValorOpcao(respostas, 'ESCALA', opcoesDaPergunta).valor, 2);
        assert.equal(calcularMaximoValorOpcao(respostas, 'ESCALA', opcoesDaPergunta).valor, 4);
        assert.equal(calcularMinimoValorOpcao(respostas, 'ESCALA', opcoesDaPergunta).valor, 0);
    });

    test('lanca METRICA_INDISPONIVEL quando alguma opcao nao tem valor_numero - nunca usa ordem como substituto silencioso (secao 33)', () => {
        const opcoesIncompletas = [{ idOpcao: 1, valorNumero: 0 }, { idOpcao: 2, valorNumero: null }];
        assert.throws(
            () => calcularMediaValorOpcao([respostaComOpcoes([1])], 'ESCALA', opcoesIncompletas),
            (erro) => erro.code === 'METRICA_INDISPONIVEL',
        );
    });
});

describe('5. MEDIA_NUMERICA', () => {
    test('media simples sobre respostas numericas preenchidas', () => {
        const respostas = [respostaNumerica(2), respostaNumerica(3), respostaNumerica(5), respostaNumerica(5), respostaNumerica(6)];
        const resultado = calcularMediaNumerica(respostas);
        assert.equal(resultado.valor, 4.2);
        assert.equal(resultado.baseCalculo, 5);
    });
});

describe('6. MINIMO_NUMERICO', () => {
    test('retorna o menor valor', () => {
        const resultado = calcularMinimoNumerico([respostaNumerica(2), respostaNumerica(3), respostaNumerica(5)]);
        assert.equal(resultado.valor, 2);
        assert.equal(resultado.baseCalculo, 3);
    });
});

describe('7. MAXIMO_NUMERICO', () => {
    test('retorna o maior valor', () => {
        const resultado = calcularMaximoNumerico([respostaNumerica(2), respostaNumerica(3), respostaNumerica(5)]);
        assert.equal(resultado.valor, 5);
        assert.equal(resultado.baseCalculo, 3);
    });
});

describe('8. PERCENTUAL_ACIMA_DE_VALOR', () => {
    test('exemplo obrigatorio (secao 46): respostas 2,3,5,5,6, parametro 4 -> 3 de 5 = 60%', () => {
        const respostas = [2, 3, 5, 5, 6].map(respostaNumerica);
        const resultado = calcularPercentualAcimaDeValor(respostas, 4);
        assert.equal(resultado.baseCalculo, 5);
        assert.equal(resultado.valor, 60);
    });

    test('16. lanca PARAMETRO_METRICA_AUSENTE quando o parametro nao e informado', () => {
        assert.throws(
            () => calcularPercentualAcimaDeValor([respostaNumerica(5)], undefined),
            (erro) => erro.code === 'PARAMETRO_METRICA_AUSENTE',
        );
    });
});

describe('9. PERCENTUAL_ABAIXO_DE_VALOR', () => {
    test('complementar ao ACIMA (estritamente abaixo, nao inclui igual)', () => {
        const respostas = [2, 3, 5, 5, 6].map(respostaNumerica);
        const resultado = calcularPercentualAbaixoDeValor(respostas, 4);
        assert.equal(resultado.baseCalculo, 5);
        assert.equal(resultado.valor, 40); // so 2 e 3 estao abaixo de 4
    });
});

describe('10. CONTAGEM_RESPOSTAS', () => {
    test('universal - conta respostas preenchidas conforme o tipo', () => {
        const resultadoBooleano = calcularContagemRespostas([respostaBooleana(true), respostaBooleana(false), respostaBooleana(null)], 'BOOLEANO');
        assert.equal(resultadoBooleano.valor, 2);
        assert.equal(resultadoBooleano.baseCalculo, 2);
    });
});

describe('15. Base zero', () => {
    test('nenhuma resposta preenchida -> percentual 0, baseCalculo 0, sem lancar erro', () => {
        const resultado = calcularPercentualTrue([]);
        assert.equal(resultado.valor, 0);
        assert.equal(resultado.baseCalculo, 0);
    });

    test('MEDIA_NUMERICA sem nenhuma resposta -> valor null, baseCalculo 0 (nunca NaN)', () => {
        const resultado = calcularMediaNumerica([]);
        assert.equal(resultado.valor, null);
        assert.equal(resultado.baseCalculo, 0);
    });
});

describe('Dispatcher unico (calcularMetrica)', () => {
    test('roteia PERCENTUAL_TRUE corretamente pelo tipo_metrica', () => {
        const resultado = calcularMetrica('PERCENTUAL_TRUE', {
            respostas: [respostaBooleana(true), respostaBooleana(false)],
            tipoResposta: 'BOOLEANO',
        });
        assert.equal(resultado.valor, 50);
    });

    test('lanca METRICA_NAO_SUPORTADA para tipo desconhecido (nunca PERCENTUAL_ACIMA_DE_OPCAO - pendencia metodologica)', () => {
        assert.throws(
            () => calcularMetrica('PERCENTUAL_ACIMA_DE_OPCAO', { respostas: [] }),
            (erro) => erro.code === 'METRICA_NAO_SUPORTADA',
        );
    });
});
