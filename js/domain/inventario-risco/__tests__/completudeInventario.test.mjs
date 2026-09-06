import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCompletudeItem } from '../completudeInventario.js';

function itemBase(overrides = {}) {
    return {
        id_ghe: 1,
        id_perigo: 2,
        fonte_circunstancia: 'Operação contínua de montagem com ciclo curto.',
        possiveis_lesoes_agravos: 'Lesões por esforço repetitivo (LER/DORT).',
        trabalhadores_expostos_snapshot: 12,
        id_ambiente: 5,
        id_posto: null,
        processo_descricao: null,
        medidas_existentes: 'Rodízio de tarefas a cada 2 horas.',
        caracterizacao_exposicao: 'HABITUAL',
        ...overrides,
    };
}

describe('avaliarCompletudeItem', () => {
    test('item com todos os campos preenchidos e contexto via ambiente e completo', () => {
        const resultado = avaliarCompletudeItem(itemBase());
        assert.equal(resultado.completo, true);
        assert.deepEqual(resultado.camposPendentes, []);
    });

    test('item sem NENHUM campo alem dos estruturais reporta todas as pendencias', () => {
        const resultado = avaliarCompletudeItem({ id_ghe: 1, id_perigo: 2 });
        assert.equal(resultado.completo, false);
        const codigos = resultado.camposPendentes.map((c) => c.codigo);
        assert.ok(codigos.includes('FONTE_CIRCUNSTANCIA_AUSENTE'));
        assert.ok(codigos.includes('POSSIVEIS_LESOES_AUSENTES'));
        assert.ok(codigos.includes('TRABALHADORES_EXPOSTOS_AUSENTE'));
        assert.ok(codigos.includes('CONTEXTO_AUSENTE'));
        assert.ok(codigos.includes('MEDIDAS_EXISTENTES_AUSENTES'));
        assert.ok(codigos.includes('CARACTERIZACAO_EXPOSICAO_AUSENTE'));
    });

    test('GHE ausente e reportado mesmo com os demais campos preenchidos', () => {
        const resultado = avaliarCompletudeItem(itemBase({ id_ghe: null }));
        assert.equal(resultado.completo, false);
        assert.ok(resultado.camposPendentes.some((c) => c.codigo === 'GHE_AUSENTE'));
    });

    test('perigo ausente e reportado', () => {
        const resultado = avaliarCompletudeItem(itemBase({ id_perigo: null }));
        assert.ok(resultado.camposPendentes.some((c) => c.codigo === 'PERIGO_AUSENTE'));
    });

    test('contexto satisfeito por atividade associada, mesmo sem ambiente/posto/processo', () => {
        const item = itemBase({ id_ambiente: null, id_posto: null, processo_descricao: null });
        const resultado = avaliarCompletudeItem(item, [{ id_atividade: 9 }]);
        assert.equal(resultado.completo, true);
    });

    test('contexto satisfeito por processo_descricao, mesmo sem ambiente/posto/atividade', () => {
        const item = itemBase({ id_ambiente: null, id_posto: null, processo_descricao: 'Linha de embalagem manual.' });
        const resultado = avaliarCompletudeItem(item);
        assert.equal(resultado.completo, true);
    });

    test('contexto ausente quando nenhum dos quatro sinais existe', () => {
        const item = itemBase({ id_ambiente: null, id_posto: null, processo_descricao: '   ' });
        const resultado = avaliarCompletudeItem(item, []);
        assert.ok(resultado.camposPendentes.some((c) => c.codigo === 'CONTEXTO_AUSENTE'));
    });

    test('trabalhadores_expostos_snapshot = 0 e um valor valido (nao e "ausente")', () => {
        const resultado = avaliarCompletudeItem(itemBase({ trabalhadores_expostos_snapshot: 0 }));
        assert.equal(resultado.completo, true);
    });

    test('texto so com espacos em branco conta como ausente', () => {
        const resultado = avaliarCompletudeItem(itemBase({ fonte_circunstancia: '   ' }));
        assert.ok(resultado.camposPendentes.some((c) => c.codigo === 'FONTE_CIRCUNSTANCIA_AUSENTE'));
    });

    test('item MANUAL sem classificacao nao gera pendencia de classificacao (campo nem existe na checagem)', () => {
        const item = itemBase({ origem_tipo: 'MANUAL', id_avaliacao_ghe_risco: null, pontuacao_snapshot: null });
        const resultado = avaliarCompletudeItem(item);
        assert.equal(resultado.completo, true);
    });
});
