import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validarCondicaoGhe, avaliarRegraProcessavel, avaliarMetodologiaBaseProcessavel } from '../validacaoConfiguracaoGhe.js';

const perguntaBooleana = { id_pergunta: 4, tipo_resposta: 'BOOLEANO', ativo: true };
const perguntaNumerica = { id_pergunta: 8, tipo_resposta: 'NUMERICO', ativo: true };
const perguntaEscala = { id_pergunta: 11, tipo_resposta: 'ESCALA', ativo: true };
const opcaoDaEscala = { id_opcao: 100, id_pergunta: 11, ativo: true };

describe('17. id_opcao obrigatorio ausente', () => {
    test('PERCENTUAL_OPCAO sem id_opcao e rejeitada estruturalmente', () => {
        const condicao = {
            id_condicao_ghe: 1, id_pergunta: 11, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_OPCAO', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 50,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaEscala, null);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'ID_OPCAO_OBRIGATORIO_AUSENTE'));
    });

    test('id_opcao presente mas de outra pergunta e rejeitado (OPCAO_INCOMPATIVEL)', () => {
        const condicao = {
            id_condicao_ghe: 2, id_pergunta: 11, id_opcao: 100,
            tipo_metrica: 'PERCENTUAL_OPCAO', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 50,
        };
        const opcaoDeOutraPergunta = { id_opcao: 100, id_pergunta: 999, ativo: true };
        const resultado = validarCondicaoGhe(condicao, perguntaEscala, opcaoDeOutraPergunta);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'OPCAO_INCOMPATIVEL'));
    });

    test('id_opcao informado quando a metrica nao aceita opcao e rejeitado (ID_OPCAO_NAO_PERMITIDO)', () => {
        const condicao = {
            id_condicao_ghe: 3, id_pergunta: 4, id_opcao: 100,
            tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 50,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaBooleana, opcaoDaEscala);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'ID_OPCAO_NAO_PERMITIDO'));
    });
});

describe('18. Tipo de pergunta incompativel', () => {
    test('PERCENTUAL_TRUE sobre pergunta NUMERICO e rejeitada (METRICA_INCOMPATIVEL_COM_PERGUNTA)', () => {
        const condicao = {
            id_condicao_ghe: 4, id_pergunta: 8, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 50,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaNumerica, null);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'METRICA_INCOMPATIVEL_COM_PERGUNTA'));
    });

    test('MEDIA_NUMERICA sobre pergunta BOOLEANO e rejeitada', () => {
        const condicao = {
            id_condicao_ghe: 5, id_pergunta: 4, id_opcao: null,
            tipo_metrica: 'MEDIA_NUMERICA', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 3,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaBooleana, null);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'METRICA_INCOMPATIVEL_COM_PERGUNTA'));
    });

    test('condicao valida (PERCENTUAL_TRUE sobre BOOLEANO) nao gera nenhum erro', () => {
        const condicao = {
            id_condicao_ghe: 6, id_pergunta: 4, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 50,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaBooleana, null);
        assert.equal(resultado.valida, true);
        assert.deepEqual(resultado.erros, []);
    });
});

describe('Parametro de metrica - validacao estrutural', () => {
    test('PERCENTUAL_ACIMA_DE_VALOR sem parametro_metrica e rejeitada', () => {
        const condicao = {
            id_condicao_ghe: 7, id_pergunta: 8, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_ACIMA_DE_VALOR', parametro_metrica: null,
            operador: 'GTE', valor_comparacao: 30,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaNumerica, null);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'PARAMETRO_METRICA_AUSENTE'));
    });

    test('PERCENTUAL_TRUE com parametro_metrica preenchido e rejeitada (nao aceita parametro)', () => {
        const condicao = {
            id_condicao_ghe: 8, id_pergunta: 4, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: 4,
            operador: 'GTE', valor_comparacao: 50,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaBooleana, null);
        assert.equal(resultado.valida, false);
        assert.ok(resultado.erros.some((e) => e.codigo === 'PARAMETRO_METRICA_NAO_PERMITIDO'));
    });

    test('exemplo obrigatorio (secao 15/19 do prompt): PERCENTUAL_ACIMA_DE_VALOR com parametro=4 e valor_comparacao=30 - ambos presentes, condicao estruturalmente valida', () => {
        const condicao = {
            id_condicao_ghe: 9, id_pergunta: 8, id_opcao: null,
            tipo_metrica: 'PERCENTUAL_ACIMA_DE_VALOR', parametro_metrica: 4,
            operador: 'GTE', valor_comparacao: 30,
        };
        const resultado = validarCondicaoGhe(condicao, perguntaNumerica, null);
        assert.equal(resultado.valida, true);
        assert.notEqual(condicao.parametro_metrica, condicao.valor_comparacao, '4 (parametro) e 30 (comparacao) sao papeis diferentes, nunca o mesmo campo');
    });
});

describe('avaliarRegraProcessavel', () => {
    test('regra sem condicoes e NAO_PROCESSAVEL (REGRA_SEM_CONDICOES)', () => {
        const regra = { codigo: 'R-TESTE', ativo: true, operador_agregacao: 'AND', pontuacao_resultado: 1, condicoes: [] };
        const resultado = avaliarRegraProcessavel(regra, []);
        assert.equal(resultado.processavel, false);
        assert.ok(resultado.motivos.some((m) => m.codigo === 'REGRA_SEM_CONDICOES'));
    });

    test('regra com todas as condicoes validas e processavel', () => {
        const condicao = { id_condicao_ghe: 1, id_pergunta: 4, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 50 };
        const regra = { codigo: 'R-TESTE', ativo: true, operador_agregacao: 'AND', pontuacao_resultado: 1, condicoes: [condicao] };
        const condicoesValidadas = [{ condicao, ...validarCondicaoGhe(condicao, perguntaBooleana, null) }];
        const resultado = avaliarRegraProcessavel(regra, condicoesValidadas);
        assert.equal(resultado.processavel, true);
        assert.deepEqual(resultado.motivos, []);
    });

    test('regra com uma condicao invalida contamina o resultado (NAO_PROCESSAVEL)', () => {
        const condicaoInvalida = { id_condicao_ghe: 2, id_pergunta: 8, id_opcao: null, tipo_metrica: 'PERCENTUAL_TRUE', parametro_metrica: null, operador: 'GTE', valor_comparacao: 50 };
        const regra = { codigo: 'R-TESTE-2', ativo: true, operador_agregacao: 'AND', pontuacao_resultado: 1, condicoes: [condicaoInvalida] };
        const condicoesValidadas = [{ condicao: condicaoInvalida, ...validarCondicaoGhe(condicaoInvalida, perguntaNumerica, null) }];
        const resultado = avaliarRegraProcessavel(regra, condicoesValidadas);
        assert.equal(resultado.processavel, false);
    });
});

describe('avaliarMetodologiaBaseProcessavel', () => {
    test('metodologia inexistente retorna METODOLOGIA_NAO_ENCONTRADA', () => {
        const resultado = avaliarMetodologiaBaseProcessavel(null, []);
        assert.equal(resultado.processavel, false);
        assert.equal(resultado.motivos[0].codigo, 'METODOLOGIA_NAO_ENCONTRADA');
    });

    test('metodologia ativa sem nenhuma classificacao ativa e NAO_PROCESSAVEL', () => {
        const metodologia = { codigo: 'ERGO-GHE-DEMO', versao: '1.0.0', ativo: true };
        const resultado = avaliarMetodologiaBaseProcessavel(metodologia, []);
        assert.equal(resultado.processavel, false);
        assert.ok(resultado.motivos.some((m) => m.codigo === 'CLASSIFICACAO_NAO_ENCONTRADA'));
    });

    test('metodologia ativa com classificacao ativa e processavel na base', () => {
        const metodologia = { codigo: 'ERGO-GHE-DEMO', versao: '1.0.0', ativo: true };
        const resultado = avaliarMetodologiaBaseProcessavel(metodologia, [{ ativo: true }]);
        assert.equal(resultado.processavel, true);
    });
});
