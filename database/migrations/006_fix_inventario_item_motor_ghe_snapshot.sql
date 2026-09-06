-- =====================================================================
-- ErgoIntelligence | Migration 006 - Correcao de integridade dos
-- snapshots de item MOTOR_GHE do Inventario de Riscos (pre-requisito do
-- MVP-09C - Integracao Motor GHE -> Inventario)
-- =====================================================================
-- A migration 005 (MVP-09B) criou chk_inventario_risco_item_origem_consistente
-- exigindo, para origem_tipo='MOTOR_GHE', apenas id_avaliacao_ghe_risco
-- NOT NULL. Os demais campos de snapshot (pontuacao_snapshot,
-- classificacao_codigo_snapshot, classificacao_nome_snapshot,
-- metodologia_codigo_snapshot, metodologia_versao_snapshot) podiam ficar
-- NULL sem violar o CHECK - uma lacuna de integridade: um item MOTOR_GHE
-- sem esses snapshots perderia justamente a rastreabilidade que e a razao
-- de existir da origem MOTOR_GHE (MVP-09A, secao 11).
--
-- Esta migration torna TODOS os 6 campos de origem MOTOR_GHE obrigatorios
-- (NOT NULL via CHECK), sem alterar nenhuma coluna, tabela do Motor GHE
-- (motorRiscoGhe.js, metricasGhe.js, avaliadorGhe.js,
-- validacaoConfiguracaoGhe.js permanecem intocados) ou dado ja existente -
-- inventario_risco_item esta vazia neste momento (nenhum item MOTOR_GHE
-- foi criado ate a MVP-09B), entao a substituicao do CHECK e segura.
--
-- Pre-requisito: 001 a 005 ja aplicadas. Execucao transacional.
-- =====================================================================

BEGIN;

ALTER TABLE inventario_risco_item
    DROP CONSTRAINT chk_inventario_risco_item_origem_consistente;

ALTER TABLE inventario_risco_item
    ADD CONSTRAINT chk_inventario_risco_item_origem_consistente CHECK (
        (
            origem_tipo = 'MOTOR_GHE'
            AND id_avaliacao_ghe_risco IS NOT NULL
            AND pontuacao_snapshot IS NOT NULL
            AND classificacao_codigo_snapshot IS NOT NULL
            AND classificacao_nome_snapshot IS NOT NULL
            AND metodologia_codigo_snapshot IS NOT NULL
            AND metodologia_versao_snapshot IS NOT NULL
        )
        OR (
            origem_tipo = 'MANUAL'
            AND id_avaliacao_ghe_risco IS NULL
            AND pontuacao_snapshot IS NULL
            AND classificacao_codigo_snapshot IS NULL
            AND classificacao_nome_snapshot IS NULL
            AND metodologia_codigo_snapshot IS NULL
            AND metodologia_versao_snapshot IS NULL
        )
    );

COMMENT ON CONSTRAINT chk_inventario_risco_item_origem_consistente ON inventario_risco_item IS
    'MOTOR_GHE exige TODOS os 6 campos de origem/snapshot preenchidos (corrigido na migration 006 - MVP-09C, secao 1); MANUAL exige todos nulos (regra original da migration 005, MVP-09B).';

COMMIT;
