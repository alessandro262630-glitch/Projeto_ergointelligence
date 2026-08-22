-- =====================================================================
-- ErgoIntelligence | Schema Oficial - Fundacao do MVP
-- =====================================================================
-- Fonte da verdade: docs/modelo-logico/ErgoIntelligence_Modelo_Logico_Fundacao_MVP.pdf (v2.0)
-- Alvo: PostgreSQL (Supabase na fase MVP; migravel para PostgreSQL proprio)
--
-- Este arquivo contem APENAS estrutura (DDL). Dados ficam em database/seed.sql.
-- Execucao transacional: se qualquer instrucao falhar, nada e criado.
-- =====================================================================

BEGIN;

-- =====================================================================
-- BLOCO 1 - ESTRUTURA ORGANIZACIONAL
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EMPRESA (raiz de segregacao / tenant)
-- ---------------------------------------------------------------------
CREATE TABLE empresa (
    id_empresa      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razao_social    VARCHAR(160) NOT NULL,
    nome_fantasia   VARCHAR(160),
    cnpj            CHAR(14) NOT NULL,
    email           VARCHAR(254),
    telefone        VARCHAR(20),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_empresa_cnpj UNIQUE (cnpj),
    CONSTRAINT chk_empresa_cnpj_formato CHECK (cnpj ~ '^[0-9]{14}$')
);

COMMENT ON TABLE empresa IS 'Raiz de segregacao dos dados (tenant) e identificacao da organizacao.';

-- ---------------------------------------------------------------------
-- 2. SETOR
-- ---------------------------------------------------------------------
CREATE TABLE setor (
    id_setor        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    codigo_interno  VARCHAR(30),
    nome            VARCHAR(120) NOT NULL,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_setor_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT uq_setor_empresa_codigo_interno UNIQUE (id_empresa, codigo_interno),
    CONSTRAINT uq_setor_empresa_nome UNIQUE (id_empresa, nome)
);

COMMENT ON TABLE setor IS 'Estrutura organizacional onde colaboradores e ambientes sao alocados.';

-- ---------------------------------------------------------------------
-- 3. CARGO
-- ---------------------------------------------------------------------
CREATE TABLE cargo (
    id_cargo        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    codigo_interno  VARCHAR(30),
    nome            VARCHAR(120) NOT NULL,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cargo_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT uq_cargo_empresa_codigo_interno UNIQUE (id_empresa, codigo_interno),
    CONSTRAINT uq_cargo_empresa_nome UNIQUE (id_empresa, nome)
);

COMMENT ON TABLE cargo IS 'Cargo formal/organizacional do colaborador.';

-- ---------------------------------------------------------------------
-- 4. FUNCAO
-- ---------------------------------------------------------------------
CREATE TABLE funcao (
    id_funcao       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    codigo          VARCHAR(30),
    nome            VARCHAR(140) NOT NULL,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_funcao_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT uq_funcao_empresa_codigo UNIQUE (id_empresa, codigo),
    CONSTRAINT uq_funcao_empresa_nome UNIQUE (id_empresa, nome)
);

COMMENT ON TABLE funcao IS 'Funcao executada dentro de um ou mais cargos.';

-- ---------------------------------------------------------------------
-- 5. CARGO_FUNCAO (associativa N:N)
-- ---------------------------------------------------------------------
CREATE TABLE cargo_funcao (
    id_cargo_funcao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cargo          BIGINT NOT NULL,
    id_funcao         BIGINT NOT NULL,
    principal_padrao  BOOLEAN NOT NULL DEFAULT FALSE,
    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cargo_funcao_cargo FOREIGN KEY (id_cargo)
        REFERENCES cargo (id_cargo) ON DELETE RESTRICT,
    CONSTRAINT fk_cargo_funcao_funcao FOREIGN KEY (id_funcao)
        REFERENCES funcao (id_funcao) ON DELETE RESTRICT,
    CONSTRAINT uq_cargo_funcao UNIQUE (id_cargo, id_funcao)
);

COMMENT ON TABLE cargo_funcao IS 'Define quais funcoes podem compor cada cargo.';

-- ---------------------------------------------------------------------
-- 6. COLABORADOR
-- ---------------------------------------------------------------------
CREATE TABLE colaborador (
    id_colaborador  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    matricula       VARCHAR(50) NOT NULL,
    nome            VARCHAR(160) NOT NULL,
    email           VARCHAR(254),
    data_admissao   DATE,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_colaborador_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT uq_colaborador_empresa_matricula UNIQUE (id_empresa, matricula),
    CONSTRAINT chk_colaborador_data_admissao CHECK (data_admissao <= CURRENT_DATE)
);

COMMENT ON TABLE colaborador IS 'Identificacao do trabalhador avaliado. Nao concentra dados que mudam com o tempo.';

-- Unicidade condicional: email so precisa ser unico quando informado.
CREATE UNIQUE INDEX uq_colaborador_empresa_email
    ON colaborador (id_empresa, email)
    WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. USUARIO
-- ---------------------------------------------------------------------
-- Nota de ordenacao: USUARIO referencia COLABORADOR (FK opcional), por
-- isso e criada apos COLABORADOR nesta versao do script.
CREATE TABLE usuario (
    id_usuario      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa      BIGINT NOT NULL,
    id_colaborador  BIGINT,
    nome            VARCHAR(160) NOT NULL,
    email           VARCHAR(254) NOT NULL,
    senha_hash      VARCHAR(255) NOT NULL,
    perfil          VARCHAR(30) NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso   TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_usuario_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_colaborador FOREIGN KEY (id_colaborador)
        REFERENCES colaborador (id_colaborador) ON DELETE RESTRICT,
    CONSTRAINT uq_usuario_colaborador UNIQUE (id_colaborador),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT chk_usuario_perfil CHECK (
        perfil IN ('ADMIN', 'SST', 'GESTOR', 'COLABORADOR')
    )
);

COMMENT ON TABLE usuario IS 'Conta de acesso e referencia para avaliador, responsavel e validacoes.';

-- ---------------------------------------------------------------------
-- 8. PERFIL_ANTROPOMETRICO
-- ---------------------------------------------------------------------
CREATE TABLE perfil_antropometrico (
    id_perfil_antropometrico  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_colaborador            BIGINT NOT NULL,
    altura_cm                 NUMERIC(5,2),
    peso_kg                   NUMERIC(6,2),
    mao_dominante             VARCHAR(12),
    data_medicao              DATE NOT NULL,
    origem                    VARCHAR(20) NOT NULL,
    ativo                     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_perfil_antropometrico_colaborador FOREIGN KEY (id_colaborador)
        REFERENCES colaborador (id_colaborador) ON DELETE RESTRICT,
    CONSTRAINT chk_perfil_antropometrico_altura CHECK (altura_cm > 0),
    CONSTRAINT chk_perfil_antropometrico_peso CHECK (peso_kg > 0),
    CONSTRAINT chk_perfil_antropometrico_mao_dominante CHECK (
        mao_dominante IN ('DIREITA', 'ESQUERDA', 'AMBIDESTRO')
    ),
    CONSTRAINT chk_perfil_antropometrico_data_medicao CHECK (data_medicao <= CURRENT_DATE),
    CONSTRAINT chk_perfil_antropometrico_origem CHECK (
        origem IN ('MEDIDO', 'AUTODECLARADO')
    )
);

COMMENT ON TABLE perfil_antropometrico IS 'Mantem historico de dados fisicos usados como contexto da avaliacao.';

-- ---------------------------------------------------------------------
-- 9. COLABORADOR_VINCULO (entidade historica de lotacao)
-- ---------------------------------------------------------------------
CREATE TABLE colaborador_vinculo (
    id_vinculo      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_colaborador  BIGINT NOT NULL,
    id_setor        BIGINT NOT NULL,
    id_cargo        BIGINT NOT NULL,
    data_inicio     DATE NOT NULL,
    data_fim        DATE,
    principal       BOOLEAN NOT NULL DEFAULT TRUE,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_colaborador_vinculo_colaborador FOREIGN KEY (id_colaborador)
        REFERENCES colaborador (id_colaborador) ON DELETE RESTRICT,
    CONSTRAINT fk_colaborador_vinculo_setor FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor) ON DELETE RESTRICT,
    CONSTRAINT fk_colaborador_vinculo_cargo FOREIGN KEY (id_cargo)
        REFERENCES cargo (id_cargo) ON DELETE RESTRICT,
    CONSTRAINT uq_colaborador_vinculo UNIQUE (id_colaborador, id_setor, id_cargo, data_inicio),
    CONSTRAINT chk_colaborador_vinculo_datas CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

COMMENT ON TABLE colaborador_vinculo IS 'Historico de lotacao do colaborador, ligando setor e cargo no periodo. Entidade historica, nao apenas tabela de juncao.';

-- Regra fisica recomendada pelo modelo logico: apenas um vinculo
-- principal vigente (sem data_fim) por colaborador.
CREATE UNIQUE INDEX uq_colaborador_vinculo_principal_vigente
    ON colaborador_vinculo (id_colaborador)
    WHERE principal = TRUE AND ativo = TRUE AND data_fim IS NULL;

-- ---------------------------------------------------------------------
-- 10. VINCULO_FUNCAO (associativa)
-- ---------------------------------------------------------------------
CREATE TABLE vinculo_funcao (
    id_vinculo_funcao  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_vinculo         BIGINT NOT NULL,
    id_funcao          BIGINT NOT NULL,
    data_inicio        DATE NOT NULL,
    data_fim           DATE,
    principal          BOOLEAN NOT NULL DEFAULT FALSE,
    ativo              BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_vinculo_funcao_vinculo FOREIGN KEY (id_vinculo)
        REFERENCES colaborador_vinculo (id_vinculo) ON DELETE RESTRICT,
    CONSTRAINT fk_vinculo_funcao_funcao FOREIGN KEY (id_funcao)
        REFERENCES funcao (id_funcao) ON DELETE RESTRICT,
    CONSTRAINT uq_vinculo_funcao UNIQUE (id_vinculo, id_funcao, data_inicio),
    CONSTRAINT chk_vinculo_funcao_datas CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

COMMENT ON TABLE vinculo_funcao IS 'Funcoes exercidas dentro de um vinculo, preservando historico.';

CREATE UNIQUE INDEX uq_vinculo_funcao_principal_vigente
    ON vinculo_funcao (id_vinculo)
    WHERE principal = TRUE AND ativo = TRUE AND data_fim IS NULL;

-- ---------------------------------------------------------------------
-- 11. AMBIENTE_TRABALHO
-- ---------------------------------------------------------------------
CREATE TABLE ambiente_trabalho (
    id_ambiente     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_setor        BIGINT NOT NULL,
    codigo          VARCHAR(30),
    nome            VARCHAR(140) NOT NULL,
    tipo_ambiente   VARCHAR(40),
    localizacao     VARCHAR(200),
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ambiente_trabalho_setor FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor) ON DELETE RESTRICT,
    CONSTRAINT uq_ambiente_trabalho_setor_codigo UNIQUE (id_setor, codigo),
    CONSTRAINT uq_ambiente_trabalho_setor_nome UNIQUE (id_setor, nome)
);

COMMENT ON TABLE ambiente_trabalho IS 'Area fisica/organizacional onde existem um ou mais postos.';

-- ---------------------------------------------------------------------
-- 12. POSTO_TRABALHO
-- ---------------------------------------------------------------------
CREATE TABLE posto_trabalho (
    id_posto        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ambiente     BIGINT NOT NULL,
    codigo          VARCHAR(40) NOT NULL,
    nome            VARCHAR(140) NOT NULL,
    tipo_posto      VARCHAR(50),
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_posto_trabalho_ambiente FOREIGN KEY (id_ambiente)
        REFERENCES ambiente_trabalho (id_ambiente) ON DELETE RESTRICT,
    CONSTRAINT uq_posto_trabalho_ambiente_codigo UNIQUE (id_ambiente, codigo)
);

COMMENT ON TABLE posto_trabalho IS 'Ponto especifico do trabalho (mesa, maquina, estacao), dentro de um ambiente.';

-- ---------------------------------------------------------------------
-- 13. ATIVIDADE
-- ---------------------------------------------------------------------
CREATE TABLE atividade (
    id_atividade            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa              BIGINT NOT NULL,
    codigo                  VARCHAR(40),
    nome                    VARCHAR(160) NOT NULL,
    descricao               TEXT NOT NULL,
    postura_predominante    VARCHAR(25),
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_atividade_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT uq_atividade_empresa_codigo UNIQUE (id_empresa, codigo),
    CONSTRAINT uq_atividade_empresa_nome UNIQUE (id_empresa, nome),
    CONSTRAINT chk_atividade_postura CHECK (
        postura_predominante IN ('SENTADO', 'EM_PE', 'ALTERNADO', 'MOVIMENTO', 'OUTRO')
    )
);

COMMENT ON TABLE atividade IS 'Atividade observavel executada no trabalho e sujeita a avaliacao ergonomica.';

-- ---------------------------------------------------------------------
-- 14. FUNCAO_ATIVIDADE (associativa)
-- ---------------------------------------------------------------------
CREATE TABLE funcao_atividade (
    id_funcao_atividade   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_funcao             BIGINT NOT NULL,
    id_atividade          BIGINT NOT NULL,
    principal             BOOLEAN NOT NULL DEFAULT FALSE,
    tempo_medio_minutos   INTEGER,
    frequencia_diaria     INTEGER,
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_funcao_atividade_funcao FOREIGN KEY (id_funcao)
        REFERENCES funcao (id_funcao) ON DELETE RESTRICT,
    CONSTRAINT fk_funcao_atividade_atividade FOREIGN KEY (id_atividade)
        REFERENCES atividade (id_atividade) ON DELETE RESTRICT,
    CONSTRAINT uq_funcao_atividade UNIQUE (id_funcao, id_atividade),
    CONSTRAINT chk_funcao_atividade_tempo_medio CHECK (tempo_medio_minutos > 0),
    CONSTRAINT chk_funcao_atividade_frequencia CHECK (frequencia_diaria >= 0)
);

COMMENT ON TABLE funcao_atividade IS 'Atividades normalmente executadas dentro de uma funcao.';

-- =====================================================================
-- BLOCO 2 - AVALIACAO ERGONOMICA E QUESTIONARIO
-- =====================================================================

-- ---------------------------------------------------------------------
-- 15. AVALIACAO_ERGONOMICA (evento central do dominio)
-- ---------------------------------------------------------------------
-- Nota: a FK de id_classificacao_geral para classificacao_risco (Bloco 3)
-- e adicionada via ALTER TABLE ao final do script, pois a tabela
-- classificacao_risco ainda nao existe neste ponto (dependencia cruzada
-- entre blocos 2 e 3).
CREATE TABLE avaliacao_ergonomica (
    id_avaliacao              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa                BIGINT NOT NULL,
    id_vinculo                BIGINT NOT NULL,
    id_vinculo_funcao         BIGINT,
    id_ambiente                BIGINT NOT NULL,
    id_posto                  BIGINT,
    id_perfil_antropometrico  BIGINT,
    id_avaliador              BIGINT NOT NULL,
    tipo_avaliacao             VARCHAR(30) NOT NULL,
    status                     VARCHAR(20) NOT NULL,
    data_avaliacao             TIMESTAMPTZ NOT NULL,
    data_finalizacao           TIMESTAMPTZ,
    pontuacao_total            NUMERIC(10,2) NOT NULL DEFAULT 0,
    id_classificacao_geral     BIGINT,
    versao_motor_regras        VARCHAR(30),
    observacoes                TEXT,
    criado_em                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_ergonomica_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_vinculo FOREIGN KEY (id_vinculo)
        REFERENCES colaborador_vinculo (id_vinculo) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_vinculo_funcao FOREIGN KEY (id_vinculo_funcao)
        REFERENCES vinculo_funcao (id_vinculo_funcao) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_ambiente FOREIGN KEY (id_ambiente)
        REFERENCES ambiente_trabalho (id_ambiente) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_posto FOREIGN KEY (id_posto)
        REFERENCES posto_trabalho (id_posto) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_perfil_antropometrico FOREIGN KEY (id_perfil_antropometrico)
        REFERENCES perfil_antropometrico (id_perfil_antropometrico) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_ergonomica_avaliador FOREIGN KEY (id_avaliador)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_avaliacao_ergonomica_tipo CHECK (
        tipo_avaliacao IN ('INICIAL', 'ACOMPANHAMENTO', 'POS_INTERVENCAO', 'AEP')
    ),
    CONSTRAINT chk_avaliacao_ergonomica_status CHECK (
        status IN ('RASCUNHO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA')
    ),
    CONSTRAINT chk_avaliacao_ergonomica_data_finalizacao CHECK (
        data_finalizacao IS NULL OR data_finalizacao >= data_avaliacao
    ),
    CONSTRAINT chk_avaliacao_ergonomica_pontuacao CHECK (pontuacao_total >= 0),
    CONSTRAINT chk_avaliacao_ergonomica_finalizada_data CHECK (
        status <> 'FINALIZADA' OR data_finalizacao IS NOT NULL
    )
);

COMMENT ON TABLE avaliacao_ergonomica IS 'Evento central do dominio; registra o contexto avaliado e preserva o historico.';

-- ---------------------------------------------------------------------
-- 16. AVALIACAO_ATIVIDADE (associativa)
-- ---------------------------------------------------------------------
-- ON DELETE CASCADE reflete a intencao do modelo logico ("apenas
-- enquanto rascunho"); a restricao a avaliacoes em RASCUNHO precisa ser
-- garantida pela aplicacao, pois o PostgreSQL nao permite uma acao de FK
-- condicional ao status de outra linha.
CREATE TABLE avaliacao_atividade (
    id_avaliacao_atividade    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao              BIGINT NOT NULL,
    id_atividade               BIGINT NOT NULL,
    principal                  BOOLEAN NOT NULL DEFAULT FALSE,
    tempo_exposicao_minutos    INTEGER,
    frequencia_diaria          INTEGER,
    observacao                 TEXT,
    criado_em                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_atividade_avaliacao FOREIGN KEY (id_avaliacao)
        REFERENCES avaliacao_ergonomica (id_avaliacao) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_atividade_atividade FOREIGN KEY (id_atividade)
        REFERENCES atividade (id_atividade) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_atividade UNIQUE (id_avaliacao, id_atividade),
    CONSTRAINT chk_avaliacao_atividade_tempo CHECK (tempo_exposicao_minutos > 0),
    CONSTRAINT chk_avaliacao_atividade_frequencia CHECK (frequencia_diaria >= 0)
);

COMMENT ON TABLE avaliacao_atividade IS 'Associa uma avaliacao a uma ou mais atividades efetivamente executadas.';

-- ---------------------------------------------------------------------
-- 17. PERGUNTA_AVALIACAO (catalogo mestre versionado)
-- ---------------------------------------------------------------------
CREATE TABLE pergunta_avaliacao (
    id_pergunta     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          VARCHAR(50) NOT NULL,
    categoria       VARCHAR(35) NOT NULL,
    texto_pergunta  TEXT NOT NULL,
    tipo_resposta   VARCHAR(25) NOT NULL,
    unidade         VARCHAR(30),
    obrigatoria     BOOLEAN NOT NULL DEFAULT TRUE,
    ordem           INTEGER NOT NULL,
    versao          INTEGER NOT NULL DEFAULT 1,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pergunta_avaliacao_codigo UNIQUE (codigo),
    CONSTRAINT chk_pergunta_avaliacao_categoria CHECK (
        categoria IN ('POSTURA', 'REPETITIVIDADE', 'ESFORCO', 'MOBILIARIO', 'AMBIENTE', 'FADIGA', 'ORGANIZACAO', 'OUTRO')
    ),
    CONSTRAINT chk_pergunta_avaliacao_tipo_resposta CHECK (
        tipo_resposta IN ('BOOLEANO', 'NUMERICO', 'ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA', 'TEXTO')
    ),
    CONSTRAINT chk_pergunta_avaliacao_ordem CHECK (ordem > 0),
    CONSTRAINT chk_pergunta_avaliacao_versao CHECK (versao >= 1)
);

COMMENT ON TABLE pergunta_avaliacao IS 'Catalogo versionado de perguntas do instrumento ergonomico.';

-- ---------------------------------------------------------------------
-- 18. OPCAO_RESPOSTA
-- ---------------------------------------------------------------------
CREATE TABLE opcao_resposta (
    id_opcao         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pergunta      BIGINT NOT NULL,
    codigo           VARCHAR(30) NOT NULL,
    rotulo           VARCHAR(160) NOT NULL,
    valor_numero     NUMERIC(10,2),
    pontuacao_base   NUMERIC(10,2) NOT NULL DEFAULT 0,
    ordem            INTEGER NOT NULL,
    ativo            BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_opcao_resposta_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT uq_opcao_resposta_pergunta_codigo UNIQUE (id_pergunta, codigo),
    CONSTRAINT chk_opcao_resposta_pontuacao_base CHECK (pontuacao_base >= 0),
    CONSTRAINT chk_opcao_resposta_ordem CHECK (ordem > 0)
);

COMMENT ON TABLE opcao_resposta IS 'Opcoes disponiveis para perguntas de escolha unica/multipla e escalas catalogadas.';

-- ---------------------------------------------------------------------
-- 19. RESPOSTA_AVALIACAO
-- ---------------------------------------------------------------------
-- ON DELETE CASCADE reflete a intencao do modelo logico ("somente antes
-- de finalizar"); impedir a exclusao apos finalizacao e regra de
-- aplicacao (ver relatorio final).
CREATE TABLE resposta_avaliacao (
    id_resposta            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao           BIGINT NOT NULL,
    id_pergunta            BIGINT NOT NULL,
    resposta_texto         TEXT,
    resposta_numero        NUMERIC(12,3),
    resposta_booleano      BOOLEAN,
    pontuacao_calculada    NUMERIC(10,2) NOT NULL DEFAULT 0,
    observacao             TEXT,
    respondido_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_resposta_avaliacao_avaliacao FOREIGN KEY (id_avaliacao)
        REFERENCES avaliacao_ergonomica (id_avaliacao) ON DELETE CASCADE,
    CONSTRAINT fk_resposta_avaliacao_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT uq_resposta_avaliacao UNIQUE (id_avaliacao, id_pergunta),
    CONSTRAINT chk_resposta_avaliacao_pontuacao CHECK (pontuacao_calculada >= 0),
    CONSTRAINT chk_resposta_avaliacao_valor_unico CHECK (
        (CASE WHEN resposta_texto IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN resposta_numero IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN resposta_booleano IS NOT NULL THEN 1 ELSE 0 END) <= 1
    )
);

COMMENT ON TABLE resposta_avaliacao IS 'Resposta unica por pergunta/avaliacao; valores de escolha ficam na associativa resposta_opcao.';

-- ---------------------------------------------------------------------
-- 20. RESPOSTA_OPCAO (associativa)
-- ---------------------------------------------------------------------
CREATE TABLE resposta_opcao (
    id_resposta_opcao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_resposta         BIGINT NOT NULL,
    id_opcao            BIGINT NOT NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_resposta_opcao_resposta FOREIGN KEY (id_resposta)
        REFERENCES resposta_avaliacao (id_resposta) ON DELETE CASCADE,
    CONSTRAINT fk_resposta_opcao_opcao FOREIGN KEY (id_opcao)
        REFERENCES opcao_resposta (id_opcao) ON DELETE RESTRICT,
    CONSTRAINT uq_resposta_opcao UNIQUE (id_resposta, id_opcao)
);

COMMENT ON TABLE resposta_opcao IS 'Opcoes selecionadas em uma resposta de escolha unica ou multipla.';

-- =====================================================================
-- BLOCO 3 - MOTOR DE CALCULO E CLASSIFICACAO DE RISCOS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 21. RISCO_ERGONOMICO (catalogo mestre)
-- ---------------------------------------------------------------------
CREATE TABLE risco_ergonomico (
    id_risco        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          VARCHAR(50) NOT NULL,
    nome            VARCHAR(160) NOT NULL,
    descricao       TEXT NOT NULL,
    categoria       VARCHAR(35) NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risco_ergonomico_codigo UNIQUE (codigo),
    CONSTRAINT chk_risco_ergonomico_categoria CHECK (
        categoria IN ('POSTURAL', 'REPETITIVIDADE', 'ESFORCO', 'MOBILIARIO', 'AMBIENTAL', 'ORGANIZACIONAL', 'FADIGA', 'OUTRO')
    )
);

COMMENT ON TABLE risco_ergonomico IS 'Catalogo de fatores/riscos que o sistema pode identificar.';

-- ---------------------------------------------------------------------
-- 22. CLASSIFICACAO_RISCO (faixas configuraveis)
-- ---------------------------------------------------------------------
-- Pendencia de decisao: "faixas ativas nao podem se sobrepor" e citada
-- no modelo logico como "regra de negocio/constraint avancada", sem
-- definir a implementacao. Nao foi criada uma EXCLUDE constraint (exigiria
-- a extensao btree_gist e uma decisao sobre como tratar pontuacao_max
-- nula como limite aberto). Ver relatorio final.
CREATE TABLE classificacao_risco (
    id_classificacao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(30) NOT NULL,
    nome                VARCHAR(60) NOT NULL,
    pontuacao_min       NUMERIC(10,2) NOT NULL,
    pontuacao_max       NUMERIC(10,2),
    prioridade          INTEGER NOT NULL,
    cor_hex             CHAR(7),
    descricao           TEXT,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_classificacao_risco_codigo UNIQUE (codigo),
    CONSTRAINT uq_classificacao_risco_nome UNIQUE (nome),
    CONSTRAINT chk_classificacao_risco_pontuacao_min CHECK (pontuacao_min >= 0),
    CONSTRAINT chk_classificacao_risco_pontuacao_max CHECK (
        pontuacao_max IS NULL OR pontuacao_max >= pontuacao_min
    ),
    CONSTRAINT chk_classificacao_risco_prioridade CHECK (prioridade > 0),
    CONSTRAINT chk_classificacao_risco_cor_hex CHECK (
        cor_hex IS NULL OR cor_hex ~ '^#[0-9A-Fa-f]{6}$'
    )
);

COMMENT ON TABLE classificacao_risco IS 'Faixas configuraveis para Baixo/Moderado/Alto/Critico.';

-- ---------------------------------------------------------------------
-- 23. REGRA_RISCO (regra versionada)
-- ---------------------------------------------------------------------
CREATE TABLE regra_risco (
    id_regra                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_risco                BIGINT NOT NULL,
    codigo                   VARCHAR(60) NOT NULL,
    nome                     VARCHAR(160) NOT NULL,
    descricao                TEXT NOT NULL,
    operador_agregacao       VARCHAR(5) NOT NULL,
    pontuacao_resultado      NUMERIC(10,2) NOT NULL,
    versao                   INTEGER NOT NULL DEFAULT 1,
    vigencia_inicio          DATE NOT NULL,
    vigencia_fim             DATE,
    fonte_tecnica            TEXT,
    ativo                    BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_regra_risco_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT uq_regra_risco_codigo UNIQUE (codigo),
    CONSTRAINT chk_regra_risco_operador_agregacao CHECK (operador_agregacao IN ('AND', 'OR')),
    CONSTRAINT chk_regra_risco_pontuacao_resultado CHECK (pontuacao_resultado >= 0),
    CONSTRAINT chk_regra_risco_versao CHECK (versao >= 1),
    CONSTRAINT chk_regra_risco_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

COMMENT ON TABLE regra_risco IS 'Regra versionada que relaciona condicoes a um risco e pontuacao.';

-- ---------------------------------------------------------------------
-- 24. REGRA_CONDICAO
-- ---------------------------------------------------------------------
-- ON DELETE CASCADE reflete a intencao do modelo logico ("se regra nunca
-- foi publicada"); impedir exclusao de regras ja publicadas e regra de
-- aplicacao (ver relatorio final).
CREATE TABLE regra_condicao (
    id_condicao       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_regra          BIGINT NOT NULL,
    id_pergunta       BIGINT NOT NULL,
    operador          VARCHAR(12) NOT NULL,
    id_opcao          BIGINT,
    valor_texto       TEXT,
    valor_numero      NUMERIC(12,3),
    valor_booleano    BOOLEAN,
    ordem             INTEGER NOT NULL,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_regra_condicao_regra FOREIGN KEY (id_regra)
        REFERENCES regra_risco (id_regra) ON DELETE CASCADE,
    CONSTRAINT fk_regra_condicao_pergunta FOREIGN KEY (id_pergunta)
        REFERENCES pergunta_avaliacao (id_pergunta) ON DELETE RESTRICT,
    CONSTRAINT fk_regra_condicao_opcao FOREIGN KEY (id_opcao)
        REFERENCES opcao_resposta (id_opcao) ON DELETE RESTRICT,
    CONSTRAINT chk_regra_condicao_operador CHECK (
        operador IN ('EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS')
    ),
    CONSTRAINT chk_regra_condicao_ordem CHECK (ordem > 0),
    CONSTRAINT chk_regra_condicao_valor_unico CHECK (
        (CASE WHEN id_opcao IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN valor_texto IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN valor_numero IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN valor_booleano IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

COMMENT ON TABLE regra_condicao IS 'Condicoes elementares de uma regra; permite multiplas perguntas por regra.';

-- ---------------------------------------------------------------------
-- 25. AVALIACAO_RISCO (resultado consolidado)
-- ---------------------------------------------------------------------
CREATE TABLE avaliacao_risco (
    id_avaliacao_risco    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao          BIGINT NOT NULL,
    id_risco               BIGINT NOT NULL,
    id_classificacao       BIGINT NOT NULL,
    pontuacao               NUMERIC(10,2) NOT NULL,
    justificativa           TEXT,
    calculado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    versao_motor_regras     VARCHAR(30) NOT NULL,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_risco_avaliacao FOREIGN KEY (id_avaliacao)
        REFERENCES avaliacao_ergonomica (id_avaliacao) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_risco_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_risco_classificacao FOREIGN KEY (id_classificacao)
        REFERENCES classificacao_risco (id_classificacao) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_risco UNIQUE (id_avaliacao, id_risco),
    CONSTRAINT chk_avaliacao_risco_pontuacao CHECK (pontuacao >= 0)
);

COMMENT ON TABLE avaliacao_risco IS 'Resultado consolidado de cada risco encontrado em uma avaliacao.';

-- ---------------------------------------------------------------------
-- 26. AVALIACAO_RISCO_REGRA (rastreabilidade do calculo)
-- ---------------------------------------------------------------------
CREATE TABLE avaliacao_risco_regra (
    id_avaliacao_risco_regra   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao_risco          BIGINT NOT NULL,
    id_regra                    BIGINT NOT NULL,
    satisfeita                  BOOLEAN NOT NULL,
    pontuacao_aplicada           NUMERIC(10,2) NOT NULL DEFAULT 0,
    detalhe                      TEXT,
    avaliado_em                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_risco_regra_avaliacao_risco FOREIGN KEY (id_avaliacao_risco)
        REFERENCES avaliacao_risco (id_avaliacao_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_risco_regra_regra FOREIGN KEY (id_regra)
        REFERENCES regra_risco (id_regra) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_risco_regra UNIQUE (id_avaliacao_risco, id_regra),
    CONSTRAINT chk_avaliacao_risco_regra_pontuacao CHECK (pontuacao_aplicada >= 0)
);

COMMENT ON TABLE avaliacao_risco_regra IS 'Registra quais regras contribuiram para o risco calculado, garantindo rastreabilidade.';

-- =====================================================================
-- BLOCO 4 - RECOMENDACOES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 27. RECOMENDACAO (catalogo mestre)
-- ---------------------------------------------------------------------
CREATE TABLE recomendacao (
    id_recomendacao     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo               VARCHAR(60) NOT NULL,
    titulo                VARCHAR(180) NOT NULL,
    descricao             TEXT NOT NULL,
    tipo                  VARCHAR(30) NOT NULL,
    duracao_minutos       INTEGER,
    intervalo_minutos     INTEGER,
    prioridade_padrao     VARCHAR(12) NOT NULL,
    fonte_tecnica         TEXT,
    requer_validacao      BOOLEAN NOT NULL DEFAULT TRUE,
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recomendacao_codigo UNIQUE (codigo),
    CONSTRAINT chk_recomendacao_tipo CHECK (
        tipo IN ('PAUSA', 'POSTURA', 'MOBILIARIO', 'ORGANIZACAO', 'AMBIENTE', 'MOVIMENTO', 'ORIENTACAO')
    ),
    CONSTRAINT chk_recomendacao_duracao CHECK (duracao_minutos > 0),
    CONSTRAINT chk_recomendacao_intervalo CHECK (intervalo_minutos > 0),
    CONSTRAINT chk_recomendacao_prioridade_padrao CHECK (
        prioridade_padrao IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')
    )
);

COMMENT ON TABLE recomendacao IS 'Catalogo de boas praticas e orientacoes validadas, reutilizaveis entre riscos.';

-- ---------------------------------------------------------------------
-- 28. RISCO_RECOMENDACAO (associativa N:N)
-- ---------------------------------------------------------------------
CREATE TABLE risco_recomendacao (
    id_risco_recomendacao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_risco                 BIGINT NOT NULL,
    id_recomendacao          BIGINT NOT NULL,
    prioridade_sugerida       VARCHAR(12) NOT NULL,
    ativo                     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_risco_recomendacao_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_risco_recomendacao_recomendacao FOREIGN KEY (id_recomendacao)
        REFERENCES recomendacao (id_recomendacao) ON DELETE RESTRICT,
    CONSTRAINT uq_risco_recomendacao UNIQUE (id_risco, id_recomendacao),
    CONSTRAINT chk_risco_recomendacao_prioridade CHECK (
        prioridade_sugerida IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')
    )
);

COMMENT ON TABLE risco_recomendacao IS 'Relaciona cada risco as recomendacoes possiveis.';

-- ---------------------------------------------------------------------
-- 29. AVALIACAO_RECOMENDACAO (snapshot historico)
-- ---------------------------------------------------------------------
-- Pendencia de decisao: "se status = ACEITA/CONCLUIDA e
-- recomendacao.requer_validacao = TRUE, entao validada_por e
-- validada_em devem estar preenchidos" depende de coluna de OUTRA
-- tabela (recomendacao). CHECK constraints do PostgreSQL nao podem
-- referenciar outras tabelas; a regra precisa ficar na aplicacao
-- (ou em um trigger, fora do escopo desta revisao). Ver relatorio final.
CREATE TABLE avaliacao_recomendacao (
    id_avaliacao_recomendacao   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao                 BIGINT NOT NULL,
    id_avaliacao_risco            BIGINT NOT NULL,
    id_recomendacao               BIGINT NOT NULL,
    descricao_personalizada       TEXT,
    prioridade                    VARCHAR(12) NOT NULL,
    origem                        VARCHAR(20) NOT NULL,
    status                        VARCHAR(15) NOT NULL,
    validada_por                  BIGINT,
    validada_em                   TIMESTAMPTZ,
    gerada_em                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_avaliacao_recomendacao_avaliacao FOREIGN KEY (id_avaliacao)
        REFERENCES avaliacao_ergonomica (id_avaliacao) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_recomendacao_avaliacao_risco FOREIGN KEY (id_avaliacao_risco)
        REFERENCES avaliacao_risco (id_avaliacao_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_recomendacao_recomendacao FOREIGN KEY (id_recomendacao)
        REFERENCES recomendacao (id_recomendacao) ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacao_recomendacao_validada_por FOREIGN KEY (validada_por)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT uq_avaliacao_recomendacao UNIQUE (id_avaliacao_risco, id_recomendacao),
    CONSTRAINT chk_avaliacao_recomendacao_prioridade CHECK (
        prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')
    ),
    CONSTRAINT chk_avaliacao_recomendacao_origem CHECK (
        origem IN ('REGRA', 'PROFISSIONAL', 'LLM_ASSISTIDA')
    ),
    CONSTRAINT chk_avaliacao_recomendacao_status CHECK (
        status IN ('SUGERIDA', 'ACEITA', 'REJEITADA', 'CONCLUIDA')
    )
);

COMMENT ON TABLE avaliacao_recomendacao IS 'Snapshot das recomendacoes geradas para um risco especifico da avaliacao, preservando historico.';

-- =====================================================================
-- BLOCO 5 - FECHAMENTO DO CICLO DE INTERVENCAO
-- =====================================================================
-- Modeladas nesta versao do schema, mas a implementacao funcional pode
-- ficar para a sprint seguinte, conforme o modelo logico.

-- ---------------------------------------------------------------------
-- 30. PLANO_ACAO
-- ---------------------------------------------------------------------
CREATE TABLE plano_acao (
    id_plano         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao     BIGINT NOT NULL,
    titulo            VARCHAR(180) NOT NULL,
    descricao         TEXT,
    status            VARCHAR(20) NOT NULL,
    criado_por        BIGINT NOT NULL,
    data_inicio       DATE NOT NULL,
    data_alvo         DATE,
    data_conclusao    DATE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_plano_acao_avaliacao FOREIGN KEY (id_avaliacao)
        REFERENCES avaliacao_ergonomica (id_avaliacao) ON DELETE RESTRICT,
    CONSTRAINT fk_plano_acao_criado_por FOREIGN KEY (criado_por)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_plano_acao_status CHECK (
        status IN ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')
    ),
    CONSTRAINT chk_plano_acao_data_alvo CHECK (data_alvo IS NULL OR data_alvo >= data_inicio),
    CONSTRAINT chk_plano_acao_data_conclusao CHECK (data_conclusao IS NULL OR data_conclusao >= data_inicio)
);

COMMENT ON TABLE plano_acao IS 'Agrupa acoes de intervencao vinculadas a uma avaliacao.';

-- ---------------------------------------------------------------------
-- 31. ACAO_PLANO
-- ---------------------------------------------------------------------
CREATE TABLE acao_plano (
    id_acao                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_plano                     BIGINT NOT NULL,
    id_avaliacao_recomendacao    BIGINT,
    id_responsavel                BIGINT NOT NULL,
    descricao                     TEXT NOT NULL,
    prioridade                    VARCHAR(12) NOT NULL,
    prazo                         DATE NOT NULL,
    status                        VARCHAR(20) NOT NULL,
    data_conclusao                DATE,
    evidencia_texto                TEXT,
    criado_em                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_acao_plano_plano FOREIGN KEY (id_plano)
        REFERENCES plano_acao (id_plano) ON DELETE RESTRICT,
    CONSTRAINT fk_acao_plano_avaliacao_recomendacao FOREIGN KEY (id_avaliacao_recomendacao)
        REFERENCES avaliacao_recomendacao (id_avaliacao_recomendacao) ON DELETE RESTRICT,
    CONSTRAINT fk_acao_plano_responsavel FOREIGN KEY (id_responsavel)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_acao_plano_prioridade CHECK (
        prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')
    ),
    CONSTRAINT chk_acao_plano_status CHECK (
        status IN ('ABERTA', 'EM_ANDAMENTO', 'BLOQUEADA', 'CONCLUIDA', 'CANCELADA')
    ),
    CONSTRAINT chk_acao_plano_conclusao CHECK (
        status <> 'CONCLUIDA' OR data_conclusao IS NOT NULL
    )
);

COMMENT ON TABLE acao_plano IS 'Acao executavel com responsavel, prazo e evidencia.';

-- =====================================================================
-- FK ADIADA (dependencia cruzada entre Bloco 2 e Bloco 3)
-- =====================================================================
-- avaliacao_ergonomica.id_classificacao_geral so pode ser ligada a
-- classificacao_risco depois que essa tabela existe (criada no Bloco 3).
ALTER TABLE avaliacao_ergonomica
    ADD CONSTRAINT fk_avaliacao_ergonomica_classificacao_geral
    FOREIGN KEY (id_classificacao_geral)
    REFERENCES classificacao_risco (id_classificacao) ON DELETE RESTRICT;

-- =====================================================================
-- INDICES
-- =====================================================================
-- Indices em FKs usadas em JOIN/filtro que ainda nao possuem indice
-- implicito (colunas UNIQUE/PK ja sao indexadas automaticamente pelo
-- PostgreSQL e nao sao repetidas aqui).

-- Bloco 1
CREATE INDEX ix_setor_id_empresa ON setor (id_empresa);
CREATE INDEX ix_cargo_id_empresa ON cargo (id_empresa);
CREATE INDEX ix_funcao_id_empresa ON funcao (id_empresa);
CREATE INDEX ix_cargo_funcao_id_funcao ON cargo_funcao (id_funcao);
CREATE INDEX ix_colaborador_id_empresa ON colaborador (id_empresa);
CREATE INDEX ix_usuario_id_empresa ON usuario (id_empresa);
CREATE INDEX ix_perfil_antropometrico_id_colaborador ON perfil_antropometrico (id_colaborador);
CREATE INDEX ix_colaborador_vinculo_id_colaborador ON colaborador_vinculo (id_colaborador);
CREATE INDEX ix_colaborador_vinculo_id_setor ON colaborador_vinculo (id_setor);
CREATE INDEX ix_colaborador_vinculo_id_cargo ON colaborador_vinculo (id_cargo);
CREATE INDEX ix_vinculo_funcao_id_vinculo ON vinculo_funcao (id_vinculo);
CREATE INDEX ix_vinculo_funcao_id_funcao ON vinculo_funcao (id_funcao);
CREATE INDEX ix_ambiente_trabalho_id_setor ON ambiente_trabalho (id_setor);
CREATE INDEX ix_posto_trabalho_id_ambiente ON posto_trabalho (id_ambiente);
CREATE INDEX ix_atividade_id_empresa ON atividade (id_empresa);
CREATE INDEX ix_funcao_atividade_id_atividade ON funcao_atividade (id_atividade);

-- Bloco 2
CREATE INDEX ix_avaliacao_ergonomica_id_empresa ON avaliacao_ergonomica (id_empresa);
CREATE INDEX ix_avaliacao_ergonomica_id_vinculo_funcao ON avaliacao_ergonomica (id_vinculo_funcao);
CREATE INDEX ix_avaliacao_ergonomica_id_ambiente ON avaliacao_ergonomica (id_ambiente);
CREATE INDEX ix_avaliacao_ergonomica_id_posto ON avaliacao_ergonomica (id_posto);
CREATE INDEX ix_avaliacao_ergonomica_id_perfil_antropometrico ON avaliacao_ergonomica (id_perfil_antropometrico);
CREATE INDEX ix_avaliacao_ergonomica_id_avaliador ON avaliacao_ergonomica (id_avaliador);
CREATE INDEX ix_avaliacao_ergonomica_id_classificacao_geral ON avaliacao_ergonomica (id_classificacao_geral);
CREATE INDEX ix_avaliacao_atividade_id_atividade ON avaliacao_atividade (id_atividade);
CREATE INDEX ix_opcao_resposta_id_pergunta ON opcao_resposta (id_pergunta);
CREATE INDEX ix_resposta_avaliacao_id_pergunta ON resposta_avaliacao (id_pergunta);
CREATE INDEX ix_resposta_opcao_id_opcao ON resposta_opcao (id_opcao);

-- Bloco 3
CREATE INDEX ix_regra_risco_id_risco ON regra_risco (id_risco);
CREATE INDEX ix_regra_condicao_id_regra ON regra_condicao (id_regra);
CREATE INDEX ix_regra_condicao_id_pergunta ON regra_condicao (id_pergunta);
CREATE INDEX ix_regra_condicao_id_opcao ON regra_condicao (id_opcao);
CREATE INDEX ix_avaliacao_risco_id_avaliacao ON avaliacao_risco (id_avaliacao);
CREATE INDEX ix_avaliacao_risco_regra_id_regra ON avaliacao_risco_regra (id_regra);

-- Bloco 4
CREATE INDEX ix_risco_recomendacao_id_recomendacao ON risco_recomendacao (id_recomendacao);
CREATE INDEX ix_avaliacao_recomendacao_id_avaliacao ON avaliacao_recomendacao (id_avaliacao);
CREATE INDEX ix_avaliacao_recomendacao_validada_por ON avaliacao_recomendacao (validada_por);

-- Bloco 5
CREATE INDEX ix_plano_acao_criado_por ON plano_acao (criado_por);
CREATE INDEX ix_acao_plano_id_plano ON acao_plano (id_plano);
CREATE INDEX ix_acao_plano_id_avaliacao_recomendacao ON acao_plano (id_avaliacao_recomendacao);
CREATE INDEX ix_acao_plano_id_responsavel ON acao_plano (id_responsavel);

-- Indices compostos recomendados explicitamente pelo modelo logico (Secao F)
CREATE INDEX ix_avaliacao_ergonomica_vinculo_data
    ON avaliacao_ergonomica (id_vinculo, data_avaliacao DESC);

CREATE INDEX ix_avaliacao_risco_risco_classificacao_calculo
    ON avaliacao_risco (id_risco, id_classificacao, calculado_em);

CREATE INDEX ix_acao_plano_status_prazo
    ON acao_plano (status, prazo);

COMMIT;

