-- =====================================================================
-- ErgoIntelligence | Migration 002 - GHE e Amostragem Demonstrativa (MVP-06)
-- =====================================================================
-- Adiciona a fundacao do novo modelo organizacional (Empresa -> Setor ->
-- GHE -> Universo -> Plano de Amostragem -> Amostra), sem alterar nenhuma
-- tabela/regra existente. Consolidacao de coletas e risco do GHE ficam
-- para o MVP-07 (ver docs/ghe-amostragem-mvp.md).
--
-- Pre-requisito: 001_initial_schema.sql ja aplicada (usa empresa, setor,
-- cargo, colaborador_vinculo, usuario).
-- Execucao transacional: se qualquer instrucao falhar, nada e criado.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 32. GHE (Grupo Homogeneo de Exposicao)
-- ---------------------------------------------------------------------
CREATE TABLE ghe (
    id_ghe          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    id_setor        BIGINT,
    codigo          VARCHAR(30),
    nome            VARCHAR(160) NOT NULL,
    descricao       TEXT,
    universo        INTEGER NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ghe_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT fk_ghe_setor FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor) ON DELETE RESTRICT,
    CONSTRAINT uq_ghe_empresa_codigo UNIQUE (id_empresa, codigo),
    CONSTRAINT uq_ghe_empresa_nome UNIQUE (id_empresa, nome),
    CONSTRAINT chk_ghe_universo CHECK (universo > 0)
);

COMMENT ON TABLE ghe IS 'Grupo Homogeneo de Exposicao: conjunto de trabalhadores com condicoes semelhantes de exposicao. Unidade principal de analise de risco ocupacional a partir do MVP-06 - nao representa necessariamente um unico cargo/colaborador. id_setor e opcional (nem todo GHE mapeia 1:1 para um setor). "universo" e o tamanho declarado do grupo, nao exige cadastro individual de cada trabalhador (ver docs/ghe-amostragem-mvp.md).';

-- ---------------------------------------------------------------------
-- 33. GHE_CARGO (associativa N:N)
-- ---------------------------------------------------------------------
CREATE TABLE ghe_cargo (
    id_ghe_cargo    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ghe          BIGINT NOT NULL,
    id_cargo        BIGINT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ghe_cargo_ghe FOREIGN KEY (id_ghe)
        REFERENCES ghe (id_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_ghe_cargo_cargo FOREIGN KEY (id_cargo)
        REFERENCES cargo (id_cargo) ON DELETE RESTRICT,
    CONSTRAINT uq_ghe_cargo UNIQUE (id_ghe, id_cargo)
);

COMMENT ON TABLE ghe_cargo IS 'Cargos compativeis com o contexto de exposicao de cada GHE (N:N) - um GHE pode abranger mais de um cargo.';

-- ---------------------------------------------------------------------
-- 34. PLANO_AMOSTRAGEM
-- ---------------------------------------------------------------------
CREATE TABLE plano_amostragem (
    id_plano_amostragem  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ghe               BIGINT NOT NULL,
    universo_snapshot    INTEGER NOT NULL,
    amostra_planejada    INTEGER NOT NULL,
    criterio             TEXT,
    observacao           TEXT,
    status               VARCHAR(20) NOT NULL,
    id_responsavel       BIGINT NOT NULL,
    data_plano           DATE NOT NULL,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_plano_amostragem_ghe FOREIGN KEY (id_ghe)
        REFERENCES ghe (id_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_plano_amostragem_responsavel FOREIGN KEY (id_responsavel)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_plano_amostragem_universo CHECK (universo_snapshot > 0),
    CONSTRAINT chk_plano_amostragem_amostra CHECK (amostra_planejada > 0),
    CONSTRAINT chk_plano_amostragem_amostra_universo CHECK (amostra_planejada <= universo_snapshot),
    CONSTRAINT chk_plano_amostragem_status CHECK (
        status IN ('PLANEJADO', 'EM_COLETA', 'CONCLUIDO', 'CANCELADO')
    )
);

COMMENT ON TABLE plano_amostragem IS 'Planejamento da amostra de um GHE. universo_snapshot preserva o tamanho do universo no momento do plano (historico, nao acompanha alteracoes futuras do GHE). Nao calcula representatividade estatistica - amostra_planejada/universo_snapshot e apenas percentual descritivo de participacao (MVP-06, secao 5/16).';

-- ---------------------------------------------------------------------
-- 35. AMOSTRA_PARTICIPANTE (associativa)
-- ---------------------------------------------------------------------
CREATE TABLE amostra_participante (
    id_amostra_participante  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_plano_amostragem      BIGINT NOT NULL,
    id_vinculo               BIGINT NOT NULL,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_amostra_participante_plano FOREIGN KEY (id_plano_amostragem)
        REFERENCES plano_amostragem (id_plano_amostragem) ON DELETE RESTRICT,
    CONSTRAINT fk_amostra_participante_vinculo FOREIGN KEY (id_vinculo)
        REFERENCES colaborador_vinculo (id_vinculo) ON DELETE RESTRICT,
    CONSTRAINT uq_amostra_participante UNIQUE (id_plano_amostragem, id_vinculo)
);

COMMENT ON TABLE amostra_participante IS 'Vinculos de colaboradores registrados como participantes de um Plano de Amostragem. Nao e o mesmo conceito que amostra_planejada (tamanho pretendido) - ver contagem real em COUNT(*) desta tabela por plano.';

-- ---------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------
CREATE INDEX ix_ghe_id_empresa ON ghe (id_empresa);
CREATE INDEX ix_ghe_id_setor ON ghe (id_setor);
CREATE INDEX ix_ghe_cargo_id_cargo ON ghe_cargo (id_cargo);
CREATE INDEX ix_plano_amostragem_id_ghe ON plano_amostragem (id_ghe);
CREATE INDEX ix_plano_amostragem_id_responsavel ON plano_amostragem (id_responsavel);
CREATE INDEX ix_amostra_participante_id_vinculo ON amostra_participante (id_vinculo);

COMMIT;
