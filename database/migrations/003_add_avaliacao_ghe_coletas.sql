-- =====================================================================
-- ErgoIntelligence | Migration 003 - Avaliacao do GHE e Coletas (MVP-07)
-- =====================================================================
-- Adiciona o processo coletivo de avaliacao do GHE: uma Avaliacao do GHE
-- agrupa Coletas (uma por participante da amostra), cada Coleta reutiliza
-- o catalogo existente de perguntas/opcoes (pergunta_avaliacao,
-- opcao_resposta) sem duplica-lo. NAO calcula risco/classificacao do GHE
-- (isso e o MVP-08) e NAO altera nenhuma tabela do fluxo individual
-- (avaliacao_ergonomica, resposta_avaliacao, avaliacao_risco, etc.) nem
-- do MVP-06 (ghe, ghe_cargo, plano_amostragem, amostra_participante).
--
-- Pre-requisitos: 001_initial_schema.sql e 002_add_ghe_amostragem.sql ja
-- aplicadas.
-- Execucao transacional: se qualquer instrucao falhar, nada e criado.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 36. AVALIACAO_GHE
-- ---------------------------------------------------------------------
-- Representa o PROCESSO COLETIVO de avaliacao de um GHE a partir de um
-- Plano de Amostragem - nao e "1 participante = 1 avaliacao completa".
-- tipo_avaliacao fica restrito a 'AEP' nesta etapa (secao 18 do prompt
-- MVP-07); ampliar o CHECK e decisao de produto futura, nao um limite
-- tecnico desta tabela.
CREATE TABLE avaliacao_ghe (
    id_avaliacao_ghe     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ghe               BIGINT NOT NULL,
    id_plano_amostragem  BIGINT NOT NULL,
    id_avaliador         BIGINT NOT NULL,
    tipo_avaliacao       VARCHAR(30) NOT NULL DEFAULT 'AEP',
    status               VARCHAR(20) NOT NULL,
    data_avaliacao       TIMESTAMPTZ NOT NULL,
    observacoes          TEXT,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_ghe_ghe FOREIGN KEY (id_ghe)
        REFERENCES ghe (id_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_plano_amostragem FOREIGN KEY (id_plano_amostragem)
        REFERENCES plano_amostragem (id_plano_amostragem) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_avaliador FOREIGN KEY (id_avaliador)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_avaliacao_ghe_tipo CHECK (tipo_avaliacao IN ('AEP')),
    CONSTRAINT chk_avaliacao_ghe_status CHECK (
        status IN ('RASCUNHO', 'EM_COLETA', 'CONSOLIDADA', 'CANCELADA')
    )
);

COMMENT ON TABLE avaliacao_ghe IS 'Processo coletivo de avaliacao de um GHE, agrupando as coletas dos participantes de um Plano de Amostragem. Nao calcula risco/classificacao do GHE (MVP-08) - so organiza a coleta de evidencias.';

-- ---------------------------------------------------------------------
-- 37. COLETA_GHE
-- ---------------------------------------------------------------------
-- Uma coleta por participante da amostra dentro de uma Avaliacao do GHE.
-- id_amostra_participante (nao id_colaborador/id_vinculo direto - secao
-- 21 do prompt) garante que o participante pertence ao Plano de
-- Amostragem correto. UNIQUE garante no maximo uma coleta "principal" por
-- participante nesta avaliacao (secao 22) - pre/pos fica para evolucao
-- futura, fora de escopo aqui.
CREATE TABLE coleta_ghe (
    id_coleta                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao_ghe         BIGINT NOT NULL,
    id_amostra_participante  BIGINT NOT NULL,
    status                   VARCHAR(20) NOT NULL,
    data_conclusao           TIMESTAMPTZ,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_coleta_ghe_avaliacao_ghe FOREIGN KEY (id_avaliacao_ghe)
        REFERENCES avaliacao_ghe (id_avaliacao_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_coleta_ghe_amostra_participante FOREIGN KEY (id_amostra_participante)
        REFERENCES amostra_participante (id_amostra_participante) ON DELETE RESTRICT,
    CONSTRAINT uq_coleta_ghe_avaliacao_participante UNIQUE (id_avaliacao_ghe, id_amostra_participante),
    CONSTRAINT chk_coleta_ghe_status CHECK (
        status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')
    ),
    CONSTRAINT chk_coleta_ghe_conclusao CHECK (
        status <> 'CONCLUIDA' OR data_conclusao IS NOT NULL
    )
);

COMMENT ON TABLE coleta_ghe IS 'Coleta de evidencias de UM participante da amostra dentro de uma Avaliacao do GHE. E evidencia, nao resultado ocupacional individual definitivo (secao 2 do prompt MVP-07).';

-- ---------------------------------------------------------------------
-- 38. RESPOSTA_COLETA
-- ---------------------------------------------------------------------
-- Espelha resposta_avaliacao (mesmo catalogo de perguntas, mesmos tipos),
-- mas em um dominio proprio: nao mistura com o fluxo individual (secao
-- 24 do prompt) e deliberadamente NAO possui pontuacao_calculada - coleta
-- e evidencia bruta, pontuacao/risco pertence ao Motor individual, que
-- esta tabela nao aciona (secao 32).
CREATE TABLE resposta_coleta (
    id_resposta_coleta   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_coleta            BIGINT NOT NULL,
    id_pergunta          BIGINT NOT NULL,
    resposta_texto       TEXT,
    resposta_numero      NUMERIC(12,3),
    resposta_booleano    BOOLEAN,
    observacao           TEXT,
    respondido_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_resposta_coleta_coleta FOREIGN KEY (id_coleta)
        REFERENCES coleta_ghe (id_coleta) ON DELETE CASCADE,
    CONSTRAINT fk_resposta_coleta_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT uq_resposta_coleta UNIQUE (id_coleta, id_pergunta),
    CONSTRAINT chk_resposta_coleta_valor_unico CHECK (
        (CASE WHEN resposta_texto IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN resposta_numero IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN resposta_booleano IS NOT NULL THEN 1 ELSE 0 END) <= 1
    )
);

COMMENT ON TABLE resposta_coleta IS 'Resposta unica por pergunta/coleta; valores de escolha ficam na associativa resposta_coleta_opcao. Sem pontuacao (a coleta nao aciona o Motor de Risco).';

-- ---------------------------------------------------------------------
-- 39. RESPOSTA_COLETA_OPCAO (associativa)
-- ---------------------------------------------------------------------
CREATE TABLE resposta_coleta_opcao (
    id_resposta_coleta_opcao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_resposta_coleta          BIGINT NOT NULL,
    id_opcao                    BIGINT NOT NULL,
    criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_resposta_coleta_opcao_resposta FOREIGN KEY (id_resposta_coleta)
        REFERENCES resposta_coleta (id_resposta_coleta) ON DELETE CASCADE,
    CONSTRAINT fk_resposta_coleta_opcao_opcao FOREIGN KEY (id_opcao)
        REFERENCES opcao_resposta (id_opcao) ON DELETE RESTRICT,
    CONSTRAINT uq_resposta_coleta_opcao UNIQUE (id_resposta_coleta, id_opcao)
);

COMMENT ON TABLE resposta_coleta_opcao IS 'Opcoes selecionadas em uma resposta de coleta de escolha unica ou multipla.';

-- ---------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------
CREATE INDEX ix_avaliacao_ghe_id_ghe ON avaliacao_ghe (id_ghe);
CREATE INDEX ix_avaliacao_ghe_id_plano_amostragem ON avaliacao_ghe (id_plano_amostragem);
CREATE INDEX ix_avaliacao_ghe_id_avaliador ON avaliacao_ghe (id_avaliador);
CREATE INDEX ix_coleta_ghe_id_avaliacao_ghe ON coleta_ghe (id_avaliacao_ghe);
CREATE INDEX ix_coleta_ghe_id_amostra_participante ON coleta_ghe (id_amostra_participante);
CREATE INDEX ix_resposta_coleta_id_pergunta ON resposta_coleta (id_pergunta);
CREATE INDEX ix_resposta_coleta_opcao_id_opcao ON resposta_coleta_opcao (id_opcao);

COMMIT;
