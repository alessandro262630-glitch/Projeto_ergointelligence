-- =====================================================================
-- ErgoIntelligence | Migration 004 - Fundacao Fisica do Motor de Risco
-- do GHE (MVP-08B)
-- =====================================================================
-- Cria a infraestrutura fisica do Motor de Risco do GHE, aprovada na
-- arquitetura do MVP-08A (ver docs/mvp08a-arquitetura-motor-risco-ghe.md).
-- Modelo TOTALMENTE PARALELO ao Motor individual - nenhuma tabela do
-- Motor individual e alterada, nenhuma coluna e adicionada nelas:
--
--   classificacao_risco, regra_risco, regra_condicao, avaliacao_risco,
--   avaliacao_risco_regra
--
-- permanecem exatamente como estao (migrations 001/002/003), e
-- js/domain/motorRisco.js / js/domain/classificadorRisco.js /
-- js/services/riscoService.js nao sao tocados por esta feature.
--
-- Esta migration cria SOMENTE estrutura (8 tabelas novas). Nenhuma
-- metodologia, regra, classificacao ou pontuacao cientifica e inserida
-- aqui - isso e MVP-08C (metodologia demonstrativa) e alem. Ver secao de
-- pendencias metodologicas em docs/mvp08b-fundacao-motor-ghe.md.
--
-- Pre-requisitos: 001_initial_schema.sql, 002_add_ghe_amostragem.sql e
-- 003_add_avaliacao_ghe_coletas.sql ja aplicadas.
-- Execucao transacional: se qualquer instrucao falhar, nada e criado.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 40. METODOLOGIA_RISCO (catalogo versionado)
-- ---------------------------------------------------------------------
-- Cada versao de uma metodologia e uma linha propria (mesmo espirito de
-- regra_risco.versao/pergunta_avaliacao.versao ja existentes no schema):
-- "ERGO-GHE-DEMO 1.0.0" e "ERGO-GHE-DEMO 1.1.0" sao duas linhas
-- distintas, nunca a mesma linha atualizada por UPDATE. `versao` e
-- VARCHAR (nao INTEGER como regra_risco.versao) porque o formato
-- esperado e semver-like ("1.0.0"), decisao da arquitetura MVP-08A.
--
-- status_validacao e um rotulo ADMINISTRATIVO, nunca uma validacao
-- cientifica automatica do sistema (secao 8 do prompt MVP-08B):
-- DEMONSTRATIVA = dados de teste/demo, nunca deve ser apresentada como
-- profissional; VALIDADA = alguem responsavel marcou manualmente como
-- aprovada (o sistema nao verifica isso, so guarda a marcacao);
-- INATIVA = descontinuada, nao pode iniciar novos processamentos, mas
-- processamentos historicos que a usaram continuam intactos e
-- consultaveis.
CREATE TABLE metodologia_risco (
    id_metodologia    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo            VARCHAR(60) NOT NULL,
    nome              VARCHAR(160) NOT NULL,
    versao            VARCHAR(20) NOT NULL,
    descricao         TEXT,
    tipo_contexto     VARCHAR(20) NOT NULL,
    status_validacao  VARCHAR(20) NOT NULL DEFAULT 'DEMONSTRATIVA',
    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_metodologia_risco_codigo_versao UNIQUE (codigo, versao),
    CONSTRAINT chk_metodologia_risco_tipo_contexto CHECK (tipo_contexto IN ('GHE')),
    CONSTRAINT chk_metodologia_risco_status_validacao CHECK (
        status_validacao IN ('DEMONSTRATIVA', 'VALIDADA', 'INATIVA')
    )
);

COMMENT ON TABLE metodologia_risco IS 'Metodologia versionada do Motor de Risco do GHE. Cada versao e uma linha propria e imutavel (nunca reinterpretada por UPDATE) - uma mudanca metodologica gera uma nova linha, nunca sobrescreve a anterior. status_validacao e um rotulo administrativo (quem cadastrou marcou), nunca uma validacao cientifica automatica.';

-- ---------------------------------------------------------------------
-- 41. CLASSIFICACAO_RISCO_GHE (faixas paralelas, isoladas de classificacao_risco)
-- ---------------------------------------------------------------------
-- Espelha a FORMA de classificacao_risco (faixas/prioridade/cor), mas e
-- uma tabela totalmente separada, escopada por metodologia - decisao da
-- arquitetura MVP-08A (Ajuste 01): nunca misturar faixas do Motor
-- individual com faixas do GHE na mesma tabela. classificacao_risco
-- permanece 100% intocada por esta migration.
CREATE TABLE classificacao_risco_ghe (
    id_classificacao_ghe  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_metodologia        BIGINT NOT NULL,
    codigo                VARCHAR(30) NOT NULL,
    nome                  VARCHAR(60) NOT NULL,
    descricao             TEXT,
    pontuacao_minima      NUMERIC(10,2) NOT NULL,
    pontuacao_maxima      NUMERIC(10,2),
    prioridade            INTEGER NOT NULL,
    cor_hex               CHAR(7),
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_classificacao_risco_ghe_metodologia FOREIGN KEY (id_metodologia)
        REFERENCES metodologia_risco (id_metodologia) ON DELETE RESTRICT,
    CONSTRAINT uq_classificacao_risco_ghe_metodologia_codigo UNIQUE (id_metodologia, codigo),
    CONSTRAINT uq_classificacao_risco_ghe_metodologia_nome UNIQUE (id_metodologia, nome),
    CONSTRAINT chk_classificacao_risco_ghe_pontuacao_minima CHECK (pontuacao_minima >= 0),
    CONSTRAINT chk_classificacao_risco_ghe_pontuacao_maxima CHECK (
        pontuacao_maxima IS NULL OR pontuacao_maxima >= pontuacao_minima
    ),
    CONSTRAINT chk_classificacao_risco_ghe_prioridade CHECK (prioridade > 0),
    CONSTRAINT chk_classificacao_risco_ghe_cor_hex CHECK (
        cor_hex IS NULL OR cor_hex ~ '^#[0-9A-Fa-f]{6}$'
    )
);

COMMENT ON TABLE classificacao_risco_ghe IS 'Faixas de classificacao de risco exclusivas do Motor GHE, escopadas por metodologia. Nunca compartilhada com classificacao_risco (Motor individual) - isolamento deliberado (MVP-08A, Ajuste 01). Nenhuma faixa cientifica e inserida por esta migration.';

-- ---------------------------------------------------------------------
-- 42. REGRA_RISCO_GHE (paralela a regra_risco)
-- ---------------------------------------------------------------------
-- Reaproveita risco_ergonomico como catalogo compartilhado (e um
-- catalogo puro, sem pontuacao embutida - seguro para os dois motores).
-- Cada metodologia tem seu proprio conjunto de regras - trocar de
-- versao de metodologia nunca reinterpreta regras existentes, apenas
-- outra linha de metodologia passa a ter suas proprias regras.
CREATE TABLE regra_risco_ghe (
    id_regra_ghe          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_metodologia        BIGINT NOT NULL,
    id_risco              BIGINT NOT NULL,
    codigo                VARCHAR(60) NOT NULL,
    nome                  VARCHAR(160) NOT NULL,
    descricao             TEXT,
    operador_agregacao    VARCHAR(5) NOT NULL,
    pontuacao_resultado   NUMERIC(10,2) NOT NULL,
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_regra_risco_ghe_metodologia FOREIGN KEY (id_metodologia)
        REFERENCES metodologia_risco (id_metodologia) ON DELETE RESTRICT,
    CONSTRAINT fk_regra_risco_ghe_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT uq_regra_risco_ghe_metodologia_codigo UNIQUE (id_metodologia, codigo),
    CONSTRAINT chk_regra_risco_ghe_operador_agregacao CHECK (operador_agregacao IN ('AND', 'OR')),
    CONSTRAINT chk_regra_risco_ghe_pontuacao_resultado CHECK (pontuacao_resultado >= 0)
);

COMMENT ON TABLE regra_risco_ghe IS 'Regra do Motor GHE, escopada por metodologia, relacionando condicoes (regra_condicao_ghe) a um risco (risco_ergonomico, reaproveitado) e a uma pontuacao. Paralela a regra_risco - nunca compartilhada com o Motor individual (MVP-08A). pontuacao_resultado e apenas estrutura: nenhum valor cientifico e inserido por esta migration.';

-- ---------------------------------------------------------------------
-- 43. REGRA_CONDICAO_GHE (condicao sobre METRICA, nao sobre resposta bruta)
-- ---------------------------------------------------------------------
-- Diferenca fundamental para regra_condicao (Motor individual): aqui a
-- condicao nao compara uma resposta unica a um valor fixo - ela consulta
-- uma METRICA agregada sobre as respostas de todas as coletas concluidas
-- (calculada por js/domain/ghe-risk/metricasGhe.js) e compara o
-- resultado dessa metrica contra um limiar.
--
-- parametro_metrica (usado para CALCULAR a metrica, ex.: o "4" de
-- "percentual de respostas > 4") e valor_comparacao (usado para AVALIAR
-- o resultado ja calculado, ex.: "GTE 30") sao propositalmente colunas
-- separadas (MVP-08A, Ajuste 03) - nunca devem ser confundidos, mesmo
-- quando ambos sao numeros na mesma faixa de valor.
--
-- PERCENTUAL_ACIMA_DE_OPCAO foi deliberadamente OMITIDA do CHECK de
-- tipo_metrica: permanece pendencia metodologica (ordem vs valor_numero
-- como base de "acima" em ESCALA) e nao deve ser configuravel ainda.
CREATE TABLE regra_condicao_ghe (
    id_condicao_ghe      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_regra_ghe          BIGINT NOT NULL,
    id_pergunta            BIGINT NOT NULL,
    id_opcao               BIGINT,
    tipo_metrica            VARCHAR(30) NOT NULL,
    parametro_metrica       NUMERIC(12,3),
    operador                VARCHAR(5) NOT NULL,
    valor_comparacao        NUMERIC(12,3) NOT NULL,
    ordem                   INTEGER NOT NULL,
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_regra_condicao_ghe_regra FOREIGN KEY (id_regra_ghe)
        REFERENCES regra_risco_ghe (id_regra_ghe) ON DELETE CASCADE,
    CONSTRAINT fk_regra_condicao_ghe_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT fk_regra_condicao_ghe_opcao FOREIGN KEY (id_opcao)
        REFERENCES opcao_resposta (id_opcao) ON DELETE RESTRICT,
    CONSTRAINT chk_regra_condicao_ghe_tipo_metrica CHECK (tipo_metrica IN (
        'CONTAGEM_TRUE', 'CONTAGEM_FALSE', 'PERCENTUAL_TRUE', 'PERCENTUAL_FALSE',
        'CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO',
        'MEDIA_VALOR_OPCAO', 'MAXIMO_VALOR_OPCAO', 'MINIMO_VALOR_OPCAO',
        'MEDIA_NUMERICA', 'MINIMO_NUMERICO', 'MAXIMO_NUMERICO',
        'PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR',
        'CONTAGEM_RESPOSTAS'
    )),
    CONSTRAINT chk_regra_condicao_ghe_operador CHECK (operador IN ('EQ', 'GTE')),
    CONSTRAINT chk_regra_condicao_ghe_ordem CHECK (ordem > 0),
    -- id_opcao e obrigatorio exatamente para as metricas "por opcao", e
    -- proibido para as demais - nunca redundante com parametro_metrica.
    CONSTRAINT chk_regra_condicao_ghe_opcao_por_metrica CHECK (
        (tipo_metrica IN ('CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO') AND id_opcao IS NOT NULL)
        OR (tipo_metrica NOT IN ('CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO') AND id_opcao IS NULL)
    ),
    -- parametro_metrica e obrigatorio exatamente para as metricas
    -- parametrizadas, e proibido para as demais.
    CONSTRAINT chk_regra_condicao_ghe_parametro_por_metrica CHECK (
        (tipo_metrica IN ('PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR') AND parametro_metrica IS NOT NULL)
        OR (tipo_metrica NOT IN ('PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR') AND parametro_metrica IS NULL)
    )
);

COMMENT ON TABLE regra_condicao_ghe IS 'Condicao elementar de uma regra do GHE: consulta UMA metrica de evidencia (calculada em memoria, nunca persistida como catalogo) e compara com um limiar. parametro_metrica (usado para calcular a metrica) e valor_comparacao (usado para avaliar o resultado calculado) sao colunas propositalmente separadas (MVP-08A, Ajuste 03) - nunca confundir. PERCENTUAL_ACIMA_DE_OPCAO nao e uma metrica valida ainda (pendencia metodologica).';

-- ---------------------------------------------------------------------
-- 44. PROCESSAMENTO_RISCO_GHE (uma linha = uma execucao do motor)
-- ---------------------------------------------------------------------
-- Entidade central do Ajuste 02 (MVP-08A): distingue EXECUCAO de
-- RESULTADO. Reprocessar uma avaliacao do GHE cria uma NOVA linha aqui -
-- nunca um UPDATE que substitua um processamento anterior. Os
-- resultados de um processamento antigo (avaliacao_ghe_risco e toda a
-- rastreabilidade abaixo dele) permanecem intactos para sempre.
--
-- Os campos "*_snapshot" congelam o contexto da amostra NO MOMENTO desta
-- execucao - nunca sao recalculados depois, mesmo que a avaliacao do GHE
-- ganhe mais coletas concluidas posteriormente (mesmo espirito de
-- plano_amostragem.universo_snapshot, MVP-06).
CREATE TABLE processamento_risco_ghe (
    id_processamento_risco_ghe     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao_ghe                BIGINT NOT NULL,
    id_metodologia                   BIGINT NOT NULL,
    versao_metodologia_snapshot      VARCHAR(20) NOT NULL,
    coletas_concluidas_snapshot      INTEGER NOT NULL,
    amostra_planejada_snapshot       INTEGER NOT NULL,
    percentual_cobertura_snapshot    NUMERIC(5,2) NOT NULL,
    status                           VARCHAR(20) NOT NULL,
    processado_em                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_processamento_risco_ghe_avaliacao_ghe FOREIGN KEY (id_avaliacao_ghe)
        REFERENCES avaliacao_ghe (id_avaliacao_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_processamento_risco_ghe_metodologia FOREIGN KEY (id_metodologia)
        REFERENCES metodologia_risco (id_metodologia) ON DELETE RESTRICT,
    CONSTRAINT chk_processamento_risco_ghe_status CHECK (
        status IN ('PROCESSANDO', 'CONCLUIDO', 'ERRO', 'CANCELADO')
    ),
    CONSTRAINT chk_processamento_risco_ghe_coletas_concluidas CHECK (coletas_concluidas_snapshot >= 0),
    CONSTRAINT chk_processamento_risco_ghe_amostra_planejada CHECK (amostra_planejada_snapshot > 0),
    CONSTRAINT chk_processamento_risco_ghe_percentual_cobertura CHECK (percentual_cobertura_snapshot >= 0)
);

COMMENT ON TABLE processamento_risco_ghe IS 'Uma linha = uma execucao oficial do Motor de Risco do GHE. Reprocessar cria uma NOVA linha (nunca UPDATE numa existente) - MVP-08A, Ajuste 02. Os campos *_snapshot congelam o contexto da amostra no momento da execucao. Nao existe ainda regra permanente de "qual processamento e o oficial/vigente" persistida no banco - fica a cargo de uma funcao de service centralizada (ver docs/mvp08b-fundacao-motor-ghe.md).';

-- ---------------------------------------------------------------------
-- 45. AVALIACAO_GHE_RISCO (resultado por risco, dentro de um processamento)
-- ---------------------------------------------------------------------
-- UNIQUE(id_processamento_risco_ghe, id_risco): no maximo um resultado
-- por risco DENTRO do mesmo processamento - mas o mesmo risco pode (e
-- deve) aparecer em processamentos diferentes da mesma avaliacao
-- (MVP-08A, secao 17/26).
CREATE TABLE avaliacao_ghe_risco (
    id_avaliacao_ghe_risco        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_processamento_risco_ghe     BIGINT NOT NULL,
    id_risco                        BIGINT NOT NULL,
    id_classificacao_ghe            BIGINT NOT NULL,
    pontuacao                       NUMERIC(10,2) NOT NULL,
    criado_em                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_ghe_risco_processamento FOREIGN KEY (id_processamento_risco_ghe)
        REFERENCES processamento_risco_ghe (id_processamento_risco_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_classificacao_ghe FOREIGN KEY (id_classificacao_ghe)
        REFERENCES classificacao_risco_ghe (id_classificacao_ghe) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_ghe_risco UNIQUE (id_processamento_risco_ghe, id_risco),
    CONSTRAINT chk_avaliacao_ghe_risco_pontuacao CHECK (pontuacao >= 0)
);

COMMENT ON TABLE avaliacao_ghe_risco IS 'Resultado consolidado de UM risco dentro de UM processamento do Motor GHE. Paralela a avaliacao_risco (Motor individual), mas pertence a um processamento_risco_ghe em vez de diretamente a uma avaliacao_ghe - permite reprocessamento sem apagar/sobrescrever resultados historicos (MVP-08A, secao 16/17).';

-- ---------------------------------------------------------------------
-- 46. AVALIACAO_GHE_RISCO_REGRA (rastreabilidade por regra)
-- ---------------------------------------------------------------------
-- codigo_regra_snapshot e pontuacao_resultado_snapshot congelam o que a
-- regra ERA no momento do processamento - mesmo que a linha em
-- regra_risco_ghe seja editada depois (ex.: codigo renomeado,
-- pontuacao_resultado ajustada), este historico continua correto sem
-- depender da configuracao atual (MVP-08A, secao 29).
CREATE TABLE avaliacao_ghe_risco_regra (
    id_avaliacao_ghe_risco_regra    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao_ghe_risco           BIGINT NOT NULL,
    id_regra_ghe                      BIGINT NOT NULL,
    codigo_regra_snapshot             VARCHAR(60) NOT NULL,
    pontuacao_resultado_snapshot      NUMERIC(10,2) NOT NULL,
    satisfeita                        BOOLEAN NOT NULL,
    pontuacao_aplicada                NUMERIC(10,2) NOT NULL DEFAULT 0,
    detalhe                           TEXT,
    criado_em                         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_ghe_risco_regra_resultado FOREIGN KEY (id_avaliacao_ghe_risco)
        REFERENCES avaliacao_ghe_risco (id_avaliacao_ghe_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_regra_regra FOREIGN KEY (id_regra_ghe)
        REFERENCES regra_risco_ghe (id_regra_ghe) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_ghe_risco_regra UNIQUE (id_avaliacao_ghe_risco, id_regra_ghe),
    CONSTRAINT chk_avaliacao_ghe_risco_regra_pontuacao_aplicada CHECK (pontuacao_aplicada >= 0)
);

COMMENT ON TABLE avaliacao_ghe_risco_regra IS 'Registra quais regras contribuiram para o resultado de um risco, dentro de um processamento. Paralela a avaliacao_risco_regra (Motor individual). Guarda snapshot de codigo/pontuacao_resultado da regra para o historico nunca depender da configuracao atual de regra_risco_ghe.';

-- ---------------------------------------------------------------------
-- 47. AVALIACAO_GHE_RISCO_CONDICAO (rastreabilidade por condicao - sem
-- equivalente no Motor individual)
-- ---------------------------------------------------------------------
-- Granularidade adicional pedida pela arquitetura MVP-08A (secao 9/25):
-- o Motor individual so guarda um texto por regra; aqui cada condicao
-- avaliada vira uma linha propria, com o VALOR NUMERICO da metrica
-- calculada (nao so uma frase), permitindo ao "Entenda por que" mostrar
-- o numero exato sem reprocessar nada. id_pergunta/id_opaco sao
-- snapshotados aqui (alem de existirem em regra_condicao_ghe) para o
-- historico nunca depender exclusivamente da configuracao atual da
-- condicao (MVP-08A, secao 26/29).
CREATE TABLE avaliacao_ghe_risco_condicao (
    id_avaliacao_ghe_risco_condicao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao_ghe_risco_regra       BIGINT NOT NULL,
    id_condicao_ghe                     BIGINT NOT NULL,
    id_pergunta                          BIGINT NOT NULL,
    id_opcao                             BIGINT,
    tipo_metrica                         VARCHAR(30) NOT NULL,
    parametro_metrica_utilizado          NUMERIC(12,3),
    valor_metrica_calculado              NUMERIC(14,4) NOT NULL,
    base_calculo                         INTEGER NOT NULL,
    operador_utilizado                   VARCHAR(5) NOT NULL,
    valor_comparacao_utilizado           NUMERIC(12,3) NOT NULL,
    resultado                            BOOLEAN NOT NULL,
    criado_em                            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_ghe_risco_condicao_regra_resultado FOREIGN KEY (id_avaliacao_ghe_risco_regra)
        REFERENCES avaliacao_ghe_risco_regra (id_avaliacao_ghe_risco_regra) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_condicao_condicao FOREIGN KEY (id_condicao_ghe)
        REFERENCES regra_condicao_ghe (id_condicao_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_condicao_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ghe_risco_condicao_opcao FOREIGN KEY (id_opcao)
        REFERENCES opcao_resposta (id_opcao) ON DELETE RESTRICT,
    CONSTRAINT chk_avaliacao_ghe_risco_condicao_operador CHECK (operador_utilizado IN ('EQ', 'GTE')),
    CONSTRAINT chk_avaliacao_ghe_risco_condicao_base_calculo CHECK (base_calculo >= 0)
);

COMMENT ON TABLE avaliacao_ghe_risco_condicao IS 'Rastreabilidade por condicao avaliada (sem equivalente no Motor individual): guarda o valor da metrica efetivamente calculado, a base de calculo (n), o parametro e o valor de comparacao usados, e o resultado - tudo snapshotado, nunca dependente da configuracao atual de regra_condicao_ghe (MVP-08A, secao 25/26/29).';

-- ---------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------
-- Colunas UNIQUE/PK ja sao indexadas automaticamente pelo PostgreSQL
-- (inclusive como prefixo de indice composto) e nao sao repetidas aqui -
-- mesmo criterio ja usado no restante do schema.
CREATE INDEX ix_regra_risco_ghe_id_risco ON regra_risco_ghe (id_risco);
CREATE INDEX ix_regra_condicao_ghe_id_regra_ghe ON regra_condicao_ghe (id_regra_ghe);
CREATE INDEX ix_regra_condicao_ghe_id_pergunta ON regra_condicao_ghe (id_pergunta);
CREATE INDEX ix_regra_condicao_ghe_id_opcao ON regra_condicao_ghe (id_opcao);
CREATE INDEX ix_processamento_risco_ghe_id_avaliacao_ghe ON processamento_risco_ghe (id_avaliacao_ghe);
CREATE INDEX ix_processamento_risco_ghe_id_metodologia ON processamento_risco_ghe (id_metodologia);
CREATE INDEX ix_avaliacao_ghe_risco_id_risco ON avaliacao_ghe_risco (id_risco);
CREATE INDEX ix_avaliacao_ghe_risco_id_classificacao_ghe ON avaliacao_ghe_risco (id_classificacao_ghe);
CREATE INDEX ix_avaliacao_ghe_risco_regra_id_regra_ghe ON avaliacao_ghe_risco_regra (id_regra_ghe);
CREATE INDEX ix_avaliacao_ghe_risco_condicao_id_regra_resultado ON avaliacao_ghe_risco_condicao (id_avaliacao_ghe_risco_regra);
CREATE INDEX ix_avaliacao_ghe_risco_condicao_id_condicao_ghe ON avaliacao_ghe_risco_condicao (id_condicao_ghe);
CREATE INDEX ix_avaliacao_ghe_risco_condicao_id_pergunta ON avaliacao_ghe_risco_condicao (id_pergunta);
CREATE INDEX ix_avaliacao_ghe_risco_condicao_id_opcao ON avaliacao_ghe_risco_condicao (id_opcao);

COMMIT;
