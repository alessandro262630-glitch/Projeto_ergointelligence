-- =====================================================================
-- ErgoIntelligence | Migration 007 - Plano de Acao 2.0: suporte a
-- Inventario de Riscos como segunda origem (FAIR-PA-01)
-- =====================================================================
-- PROBLEMA: plano_acao.id_avaliacao e NOT NULL e FK exclusiva para
-- avaliacao_ergonomica (schema.sql, secao 30) - hoje so o fluxo
-- individual (Avaliacao -> Recomendacao -> Plano -> Acao) consegue gerar
-- um Plano de Acao. O fluxo GHE (GHE -> Avaliacao GHE -> Processamento ->
-- Avaliacao_Ghe_Risco -> Inventario_Risco_Item) nao tem como chegar ate o
-- tratamento do risco.
--
-- SOLUCAO: adiciona uma origem explicita (origem_tipo) a plano_acao, com
-- uma segunda FK opcional para inventario_risco, e relaxa id_avaliacao
-- para NULL quando a origem for o Inventario. Em acao_plano, adiciona uma
-- FK opcional para inventario_risco_item, permitindo rastrear qual item
-- especifico do Inventario motivou aquela acao - sem remover nem tornar
-- obrigatoria a FK existente para avaliacao_recomendacao (fluxo
-- individual continua exatamente como estava).
--
-- Nao altera nenhuma tabela/coluna do Motor GHE (motorRiscoGhe.js,
-- metricasGhe.js, avaliadorGhe.js, validacaoConfiguracaoGhe.js) nem do
-- Motor individual (motorRisco.js, classificadorRisco.js, riscoService.js).
--
-- Seguro para dados existentes: toda linha de plano_acao ja tem
-- id_avaliacao preenchido (era NOT NULL ate aqui), entao o DEFAULT abaixo
-- classifica automaticamente o historico inteiro como
-- 'AVALIACAO_INDIVIDUAL' sem inventar origem (secao 15/61 do prompt
-- FAIR-PA-01) - nenhum UPDATE manual e necessario.
--
-- Pre-requisito: 001 a 006 ja aplicadas. Execucao transacional.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- PLANO_ACAO: origem explicita (AVALIACAO_INDIVIDUAL | INVENTARIO_RISCOS)
-- ---------------------------------------------------------------------

-- DEFAULT classifica todo o historico existente como AVALIACAO_INDIVIDUAL
-- (unica origem possivel ate esta migration) sem precisar de um UPDATE
-- separado; removido logo em seguida para que toda linha nova exija que a
-- aplicacao informe a origem explicitamente.
ALTER TABLE plano_acao
    ADD COLUMN origem_tipo VARCHAR(20) NOT NULL DEFAULT 'AVALIACAO_INDIVIDUAL';

ALTER TABLE plano_acao
    ALTER COLUMN origem_tipo DROP DEFAULT;

ALTER TABLE plano_acao
    ADD COLUMN id_inventario BIGINT;

ALTER TABLE plano_acao
    ADD CONSTRAINT fk_plano_acao_inventario FOREIGN KEY (id_inventario)
    REFERENCES inventario_risco (id_inventario) ON DELETE RESTRICT;

-- Um plano do Inventario nao tem avaliacao individual - a obrigatoriedade
-- muda, a FK para avaliacao_ergonomica continua intacta (secao 13).
ALTER TABLE plano_acao
    ALTER COLUMN id_avaliacao DROP NOT NULL;

ALTER TABLE plano_acao
    ADD CONSTRAINT chk_plano_acao_origem_tipo CHECK (
        origem_tipo IN ('AVALIACAO_INDIVIDUAL', 'INVENTARIO_RISCOS')
    );

-- Exatamente uma origem preenchida, nunca as duas nem nenhuma (secao 10-14
-- do prompt) - mesmo espirito de chk_inventario_risco_item_origem_consistente
-- ja usado em inventario_risco_item.
ALTER TABLE plano_acao
    ADD CONSTRAINT chk_plano_acao_origem_consistente CHECK (
        (origem_tipo = 'AVALIACAO_INDIVIDUAL' AND id_avaliacao IS NOT NULL AND id_inventario IS NULL)
        OR (origem_tipo = 'INVENTARIO_RISCOS' AND id_inventario IS NOT NULL AND id_avaliacao IS NULL)
    );

COMMENT ON COLUMN plano_acao.origem_tipo IS 'Origem do plano (FAIR-PA-01): AVALIACAO_INDIVIDUAL (fluxo legado, id_avaliacao preenchido) ou INVENTARIO_RISCOS (id_inventario preenchido). Nunca as duas FKs preenchidas ao mesmo tempo - ver chk_plano_acao_origem_consistente.';
COMMENT ON COLUMN plano_acao.id_inventario IS 'Preenchido somente quando origem_tipo = INVENTARIO_RISCOS. Plano geral de tratamento dos riscos consolidados nesta versao do Inventario - nao migra automaticamente para versoes futuras (cada versao e uma linha propria de inventario_risco).';

-- ---------------------------------------------------------------------
-- ACAO_PLANO: rastreabilidade opcional ate um item do Inventario
-- ---------------------------------------------------------------------

ALTER TABLE acao_plano
    ADD COLUMN id_inventario_risco_item BIGINT;

ALTER TABLE acao_plano
    ADD CONSTRAINT fk_acao_plano_inventario_risco_item FOREIGN KEY (id_inventario_risco_item)
    REFERENCES inventario_risco_item (id_inventario_risco_item) ON DELETE RESTRICT;

-- Uma acao tem no maximo UMA origem especifica (recomendacao do fluxo
-- individual OU item do Inventario) - nunca as duas simultaneamente.
-- Nenhuma das duas e obrigatoria: uma acao "manual", sem origem
-- especifica, continua valida nos dois fluxos (secao 17/49).
ALTER TABLE acao_plano
    ADD CONSTRAINT chk_acao_plano_origem_unica CHECK (
        id_avaliacao_recomendacao IS NULL OR id_inventario_risco_item IS NULL
    );

COMMENT ON COLUMN acao_plano.id_inventario_risco_item IS 'Preenchido quando a acao trata um item especifico do Inventario de Riscos (fluxo INVENTARIO_RISCOS). Nunca preenchido junto com id_avaliacao_recomendacao - ver chk_acao_plano_origem_unica. A validacao de que o item pertence ao MESMO id_inventario do plano (secao 18) e feita em planoAcaoService.js, nao no banco (regra entre tabelas, nao expressavel em um CHECK de coluna).';

-- ---------------------------------------------------------------------
-- Indices de apoio - consultas "planos deste inventario"/"acoes deste
-- item" sao um caminho de acesso novo e frequente na tela de Plano de
-- Acao (secao 34/37).
-- ---------------------------------------------------------------------
CREATE INDEX idx_plano_acao_inventario ON plano_acao (id_inventario) WHERE id_inventario IS NOT NULL;
CREATE INDEX idx_acao_plano_inventario_risco_item ON acao_plano (id_inventario_risco_item) WHERE id_inventario_risco_item IS NOT NULL;

COMMIT;
