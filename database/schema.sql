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
-- origem_tipo/id_inventario (FAIR-PA-01, migration 007): um plano agora
-- pode nascer de uma avaliacao individual OU de uma versao do Inventario
-- de Riscos - nunca as duas ao mesmo tempo (chk_plano_acao_origem_consistente).
-- fk_plano_acao_inventario e adicionada mais abaixo, via ALTER TABLE, pois
-- inventario_risco so e definida no Bloco 9 (Inventario de Riscos).
CREATE TABLE plano_acao (
    id_plano         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao     BIGINT,
    origem_tipo      VARCHAR(20) NOT NULL,
    id_inventario    BIGINT,
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
    CONSTRAINT chk_plano_acao_data_conclusao CHECK (data_conclusao IS NULL OR data_conclusao >= data_inicio),
    CONSTRAINT chk_plano_acao_origem_tipo CHECK (
        origem_tipo IN ('AVALIACAO_INDIVIDUAL', 'INVENTARIO_RISCOS')
    ),
    CONSTRAINT chk_plano_acao_origem_consistente CHECK (
        (origem_tipo = 'AVALIACAO_INDIVIDUAL' AND id_avaliacao IS NOT NULL AND id_inventario IS NULL)
        OR (origem_tipo = 'INVENTARIO_RISCOS' AND id_inventario IS NOT NULL AND id_avaliacao IS NULL)
    )
);

COMMENT ON TABLE plano_acao IS 'Agrupa acoes de intervencao vinculadas a uma avaliacao individual OU a uma versao do Inventario de Riscos (origem_tipo, FAIR-PA-01) - nunca as duas.';

-- ---------------------------------------------------------------------
-- 31. ACAO_PLANO
-- ---------------------------------------------------------------------
-- id_inventario_risco_item (FAIR-PA-01, migration 007): rastreia qual
-- item especifico do Inventario motivou a acao, no fluxo INVENTARIO_RISCOS
-- - opcional e mutuamente exclusiva com id_avaliacao_recomendacao
-- (chk_acao_plano_origem_unica). fk_acao_plano_inventario_risco_item e
-- adicionada mais abaixo, via ALTER TABLE (mesmo motivo do plano_acao acima).
CREATE TABLE acao_plano (
    id_acao                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_plano                     BIGINT NOT NULL,
    id_avaliacao_recomendacao    BIGINT,
    id_inventario_risco_item     BIGINT,
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
    ),
    CONSTRAINT chk_acao_plano_origem_unica CHECK (
        id_avaliacao_recomendacao IS NULL OR id_inventario_risco_item IS NULL
    )
);

COMMENT ON TABLE acao_plano IS 'Acao executavel com responsavel, prazo e evidencia. Pode rastrear uma recomendacao do fluxo individual OU um item do Inventario de Riscos (FAIR-PA-01), nunca as duas.';

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
-- BLOCO 6 - GHE E AMOSTRAGEM DEMONSTRATIVA (MVP-06)
-- =====================================================================
-- Fundacao organizacional do novo modelo (Empresa -> Setor -> GHE ->
-- Universo -> Plano de Amostragem -> Amostra -> Coletas -> Consolidacao).
-- Esta etapa implementa SOMENTE GHE + universo + plano de amostragem +
-- participantes. Consolidacao de coletas e risco do GHE ficam para o
-- MVP-07 (ver docs/ghe-amostragem-mvp.md).

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

-- =====================================================================
-- BLOCO 7 - AVALIACAO DO GHE E COLETAS DA AMOSTRA (MVP-07)
-- =====================================================================
-- Processo coletivo: Avaliacao do GHE agrupa Coletas (uma por
-- participante da amostra), reutilizando o catalogo existente de
-- perguntas/opcoes. Nao calcula risco/classificacao do GHE (MVP-08) e nao
-- altera o fluxo individual (Bloco 2) nem o MVP-06 (Bloco 6).

-- ---------------------------------------------------------------------
-- 36. AVALIACAO_GHE
-- ---------------------------------------------------------------------
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

-- =====================================================================
-- BLOCO 8 - MOTOR DE RISCO DO GHE (MVP-08B)
-- =====================================================================
-- Fundacao fisica do Motor de Risco do GHE (arquitetura aprovada em
-- docs/mvp08a-arquitetura-motor-risco-ghe.md). Modelo TOTALMENTE
-- PARALELO ao Motor individual - classificacao_risco, regra_risco,
-- regra_condicao, avaliacao_risco e avaliacao_risco_regra (Bloco 3)
-- permanecem exatamente como estao, sem nenhuma coluna nova. Nenhuma
-- metodologia, regra, classificacao ou pontuacao cientifica e inserida
-- aqui - somente estrutura (ver database/migrations/004_add_motor_risco_ghe.sql
-- para o detalhamento comentado de cada decisao).

-- ---------------------------------------------------------------------
-- 40. METODOLOGIA_RISCO (catalogo versionado)
-- ---------------------------------------------------------------------
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
    CONSTRAINT chk_regra_condicao_ghe_opcao_por_metrica CHECK (
        (tipo_metrica IN ('CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO') AND id_opcao IS NOT NULL)
        OR (tipo_metrica NOT IN ('CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO') AND id_opcao IS NULL)
    ),
    CONSTRAINT chk_regra_condicao_ghe_parametro_por_metrica CHECK (
        (tipo_metrica IN ('PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR') AND parametro_metrica IS NOT NULL)
        OR (tipo_metrica NOT IN ('PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR') AND parametro_metrica IS NULL)
    )
);

COMMENT ON TABLE regra_condicao_ghe IS 'Condicao elementar de uma regra do GHE: consulta UMA metrica de evidencia (calculada em memoria, nunca persistida como catalogo) e compara com um limiar. parametro_metrica (usado para calcular a metrica) e valor_comparacao (usado para avaliar o resultado calculado) sao colunas propositalmente separadas (MVP-08A, Ajuste 03) - nunca confundir. PERCENTUAL_ACIMA_DE_OPCAO nao e uma metrica valida ainda (pendencia metodologica).';

-- ---------------------------------------------------------------------
-- 44. PROCESSAMENTO_RISCO_GHE (uma linha = uma execucao do motor)
-- ---------------------------------------------------------------------
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

-- =====================================================================
-- BLOCO 9 - INVENTARIO DE RISCOS OCUPACIONAIS (MVP-09B)
-- =====================================================================
-- Fundacao fisica do Inventario de Riscos (arquitetura aprovada em
-- docs/mvp09a-arquitetura-inventario-riscos.md). Nenhuma tabela
-- existente e alterada - risco_ergonomico, avaliacao_ghe_risco,
-- processamento_risco_ghe, ghe, atividade, ambiente_trabalho,
-- posto_trabalho, usuario, empresa, plano_acao e acao_plano permanecem
-- exatamente como estao. O Inventario e consumidor de resultados do
-- Motor GHE, nunca produtor de calculo (ver
-- database/migrations/005_add_inventario_riscos.sql para o
-- detalhamento comentado de cada decisao).

-- ---------------------------------------------------------------------
-- 48. PERIGO_OCUPACIONAL (catalogo global, agnostico de motor)
-- ---------------------------------------------------------------------
CREATE TABLE perigo_ocupacional (
    id_perigo       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL,
    categoria       VARCHAR(20) NOT NULL,
    nome            VARCHAR(160) NOT NULL,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_perigo_ocupacional_codigo UNIQUE (codigo),
    CONSTRAINT chk_perigo_ocupacional_categoria CHECK (
        categoria IN ('FISICO', 'QUIMICO', 'BIOLOGICO', 'ERGONOMICO', 'ACIDENTE')
    )
);

COMMENT ON TABLE perigo_ocupacional IS 'Catalogo global de perigos ocupacionais, independente de motor de calculo. Nunca excluido fisicamente pelo fluxo comum (usar ativo=false) - um perigo ja referenciado por um item de inventario nao pode desaparecer do historico.';

-- ---------------------------------------------------------------------
-- 49. RISCO_ERGONOMICO_PERIGO (ponte N:1, risco_ergonomico intacto)
-- ---------------------------------------------------------------------
CREATE TABLE risco_ergonomico_perigo (
    id_mapeamento   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_risco        BIGINT NOT NULL,
    id_perigo       BIGINT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_risco_ergonomico_perigo_risco FOREIGN KEY (id_risco)
        REFERENCES risco_ergonomico (id_risco) ON DELETE RESTRICT,
    CONSTRAINT fk_risco_ergonomico_perigo_perigo FOREIGN KEY (id_perigo)
        REFERENCES perigo_ocupacional (id_perigo) ON DELETE RESTRICT,
    CONSTRAINT uq_risco_ergonomico_perigo_risco UNIQUE (id_risco)
);

COMMENT ON TABLE risco_ergonomico_perigo IS 'Ponte N:1 entre risco_ergonomico (vocabulario do Motor GHE, intocado) e perigo_ocupacional (catalogo do Inventario). UNIQUE(id_risco) garante que cada risco_ergonomico mapeia para no maximo um perigo - decisao MVP-09A, secao 5.';

-- ---------------------------------------------------------------------
-- 50. INVENTARIO_RISCO (cabecalho/versao do documento)
-- ---------------------------------------------------------------------
CREATE TABLE inventario_risco (
    id_inventario           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empresa              BIGINT NOT NULL,
    numero_versao           INTEGER NOT NULL,
    id_inventario_anterior  BIGINT,
    titulo                  VARCHAR(160) NOT NULL,
    descricao               TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    data_referencia         DATE NOT NULL,
    criado_por              BIGINT NOT NULL,
    publicado_por           BIGINT,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    publicado_em            TIMESTAMPTZ,
    CONSTRAINT fk_inventario_risco_empresa FOREIGN KEY (id_empresa)
        REFERENCES empresa (id_empresa) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_anterior FOREIGN KEY (id_inventario_anterior)
        REFERENCES inventario_risco (id_inventario) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_criado_por FOREIGN KEY (criado_por)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_publicado_por FOREIGN KEY (publicado_por)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT uq_inventario_risco_empresa_versao UNIQUE (id_empresa, numero_versao),
    CONSTRAINT chk_inventario_risco_status CHECK (status IN ('RASCUNHO', 'PUBLICADO', 'CANCELADO')),
    CONSTRAINT chk_inventario_risco_numero_versao CHECK (numero_versao > 0),
    CONSTRAINT chk_inventario_risco_publicacao_consistente CHECK (
        (status = 'PUBLICADO' AND publicado_por IS NOT NULL AND publicado_em IS NOT NULL)
        OR (status <> 'PUBLICADO' AND publicado_por IS NULL AND publicado_em IS NULL)
    )
);

COMMENT ON TABLE inventario_risco IS 'Cabecalho de UMA versao do Inventario de Riscos de uma empresa. Nova revisao = nova linha (id_inventario_anterior encadeia a versao anterior), nunca UPDATE de uma linha existente. PUBLICADO e imutavel pelo fluxo normal - qualquer mudanca exige nova versao (MVP-09A, secao 6/20).';

-- ---------------------------------------------------------------------
-- 51. INVENTARIO_RISCO_ITEM (o risco contextualizado)
-- ---------------------------------------------------------------------
CREATE TABLE inventario_risco_item (
    id_inventario_risco_item           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inventario                      BIGINT NOT NULL,
    id_ghe                             BIGINT NOT NULL,
    id_perigo                          BIGINT NOT NULL,
    id_ambiente                        BIGINT,
    id_posto                           BIGINT,
    processo_descricao                 TEXT,
    fonte_circunstancia                TEXT,
    possiveis_lesoes_agravos           TEXT,
    trabalhadores_expostos_snapshot    INTEGER,
    caracterizacao_exposicao           VARCHAR(20),
    caracterizacao_exposicao_descricao TEXT,
    medidas_existentes                 TEXT,
    medida_existente_categoria         VARCHAR(20),
    origem_tipo                        VARCHAR(10) NOT NULL,
    id_avaliacao_ghe_risco             BIGINT,
    pontuacao_snapshot                 NUMERIC(10,2),
    classificacao_codigo_snapshot      VARCHAR(30),
    classificacao_nome_snapshot        VARCHAR(60),
    metodologia_codigo_snapshot        VARCHAR(60),
    metodologia_versao_snapshot        VARCHAR(20),
    criado_em                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_inventario_risco_item_inventario FOREIGN KEY (id_inventario)
        REFERENCES inventario_risco (id_inventario) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_item_ghe FOREIGN KEY (id_ghe)
        REFERENCES ghe (id_ghe) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_item_perigo FOREIGN KEY (id_perigo)
        REFERENCES perigo_ocupacional (id_perigo) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_item_ambiente FOREIGN KEY (id_ambiente)
        REFERENCES ambiente_trabalho (id_ambiente) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_item_posto FOREIGN KEY (id_posto)
        REFERENCES posto_trabalho (id_posto) ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_risco_item_avaliacao_ghe_risco FOREIGN KEY (id_avaliacao_ghe_risco)
        REFERENCES avaliacao_ghe_risco (id_avaliacao_ghe_risco) ON DELETE RESTRICT,
    CONSTRAINT uq_inventario_risco_item_avaliacao_ghe_risco UNIQUE (id_inventario, id_avaliacao_ghe_risco),
    CONSTRAINT chk_inventario_risco_item_origem_tipo CHECK (origem_tipo IN ('MOTOR_GHE', 'MANUAL')),
    CONSTRAINT chk_inventario_risco_item_origem_consistente CHECK (
        (origem_tipo = 'MOTOR_GHE' AND id_avaliacao_ghe_risco IS NOT NULL)
        OR (
            origem_tipo = 'MANUAL'
            AND id_avaliacao_ghe_risco IS NULL
            AND pontuacao_snapshot IS NULL
            AND classificacao_codigo_snapshot IS NULL
            AND classificacao_nome_snapshot IS NULL
            AND metodologia_codigo_snapshot IS NULL
            AND metodologia_versao_snapshot IS NULL
        )
    ),
    CONSTRAINT chk_inventario_risco_item_expostos CHECK (
        trabalhadores_expostos_snapshot IS NULL OR trabalhadores_expostos_snapshot >= 0
    ),
    CONSTRAINT chk_inventario_risco_item_caracterizacao CHECK (
        caracterizacao_exposicao IS NULL
        OR caracterizacao_exposicao IN ('ROTINEIRA', 'NAO_ROTINEIRA', 'HABITUAL', 'INTERMITENTE')
    ),
    CONSTRAINT chk_inventario_risco_item_medida_categoria CHECK (
        medida_existente_categoria IS NULL
        OR medida_existente_categoria IN ('ELIMINACAO', 'SUBSTITUICAO', 'ENGENHARIA', 'ADMINISTRATIVA', 'EPI')
    )
);

COMMENT ON TABLE inventario_risco_item IS 'UM perigo, em UM GHE, dentro de UMA versao do Inventario. Campos de conteudo sao nulos no banco (completude e responsabilidade da aplicacao - validarItemInventarioCompleto); apenas inventario/GHE/perigo sao estruturalmente obrigatorios. origem_tipo=MANUAL nunca pode carregar snapshot de avaliacao (CHECK garante no banco) - MVP-09A, secao 35/37.';

-- =====================================================================
-- FKs ADIADAS (FAIR-PA-01, migration 007) - plano_acao/acao_plano sao
-- definidas no Bloco 5, antes de inventario_risco/inventario_risco_item
-- (Bloco 9) existirem. Mesmo padrao ja usado acima para
-- avaliacao_ergonomica.id_classificacao_geral.
-- =====================================================================
ALTER TABLE plano_acao
    ADD CONSTRAINT fk_plano_acao_inventario FOREIGN KEY (id_inventario)
    REFERENCES inventario_risco (id_inventario) ON DELETE RESTRICT;

ALTER TABLE acao_plano
    ADD CONSTRAINT fk_acao_plano_inventario_risco_item FOREIGN KEY (id_inventario_risco_item)
    REFERENCES inventario_risco_item (id_inventario_risco_item) ON DELETE RESTRICT;

CREATE INDEX idx_plano_acao_inventario ON plano_acao (id_inventario) WHERE id_inventario IS NOT NULL;
CREATE INDEX idx_acao_plano_inventario_risco_item ON acao_plano (id_inventario_risco_item) WHERE id_inventario_risco_item IS NOT NULL;

-- ---------------------------------------------------------------------
-- 52. INVENTARIO_RISCO_ITEM_ATIVIDADE (N:N com atividade, reutilizada)
-- ---------------------------------------------------------------------
CREATE TABLE inventario_risco_item_atividade (
    id_inventario_risco_item_atividade  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inventario_risco_item            BIGINT NOT NULL,
    id_atividade                        BIGINT NOT NULL,
    criado_em                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_inventario_risco_item_atividade_item FOREIGN KEY (id_inventario_risco_item)
        REFERENCES inventario_risco_item (id_inventario_risco_item) ON DELETE CASCADE,
    CONSTRAINT fk_inventario_risco_item_atividade_atividade FOREIGN KEY (id_atividade)
        REFERENCES atividade (id_atividade) ON DELETE RESTRICT,
    CONSTRAINT uq_inventario_risco_item_atividade UNIQUE (id_inventario_risco_item, id_atividade)
);

COMMENT ON TABLE inventario_risco_item_atividade IS 'Associacao N:N entre um item do Inventario e as atividades (catalogo existente, reutilizado sem duplicacao) onde a exposicao ocorre. ON DELETE CASCADE e relativo apenas ao item pai - a atividade em si nunca e removida por esta relacao (ON DELETE RESTRICT do lado de atividade).';

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

-- Bloco 6
CREATE INDEX ix_ghe_id_empresa ON ghe (id_empresa);
CREATE INDEX ix_ghe_id_setor ON ghe (id_setor);
CREATE INDEX ix_ghe_cargo_id_cargo ON ghe_cargo (id_cargo);
CREATE INDEX ix_plano_amostragem_id_ghe ON plano_amostragem (id_ghe);
CREATE INDEX ix_plano_amostragem_id_responsavel ON plano_amostragem (id_responsavel);
CREATE INDEX ix_amostra_participante_id_vinculo ON amostra_participante (id_vinculo);

-- Bloco 7
CREATE INDEX ix_avaliacao_ghe_id_ghe ON avaliacao_ghe (id_ghe);
CREATE INDEX ix_avaliacao_ghe_id_plano_amostragem ON avaliacao_ghe (id_plano_amostragem);
CREATE INDEX ix_avaliacao_ghe_id_avaliador ON avaliacao_ghe (id_avaliador);
CREATE INDEX ix_coleta_ghe_id_avaliacao_ghe ON coleta_ghe (id_avaliacao_ghe);
CREATE INDEX ix_coleta_ghe_id_amostra_participante ON coleta_ghe (id_amostra_participante);
CREATE INDEX ix_resposta_coleta_id_pergunta ON resposta_coleta (id_pergunta);
CREATE INDEX ix_resposta_coleta_opcao_id_opcao ON resposta_coleta_opcao (id_opcao);

-- Bloco 8
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

-- Bloco 9
CREATE INDEX ix_risco_ergonomico_perigo_id_perigo ON risco_ergonomico_perigo (id_perigo);
CREATE INDEX ix_inventario_risco_id_inventario_anterior ON inventario_risco (id_inventario_anterior);
CREATE INDEX ix_inventario_risco_criado_por ON inventario_risco (criado_por);
CREATE INDEX ix_inventario_risco_publicado_por ON inventario_risco (publicado_por);
CREATE INDEX ix_inventario_risco_item_id_inventario ON inventario_risco_item (id_inventario);
CREATE INDEX ix_inventario_risco_item_id_ghe ON inventario_risco_item (id_ghe);
CREATE INDEX ix_inventario_risco_item_id_perigo ON inventario_risco_item (id_perigo);
CREATE INDEX ix_inventario_risco_item_id_ambiente ON inventario_risco_item (id_ambiente);
CREATE INDEX ix_inventario_risco_item_id_posto ON inventario_risco_item (id_posto);
CREATE INDEX ix_inventario_risco_item_id_avaliacao_ghe_risco ON inventario_risco_item (id_avaliacao_ghe_risco);
CREATE INDEX ix_inventario_risco_item_atividade_id_atividade ON inventario_risco_item_atividade (id_atividade);

-- Indices compostos recomendados explicitamente pelo modelo logico (Secao F)
CREATE INDEX ix_avaliacao_ergonomica_vinculo_data
    ON avaliacao_ergonomica (id_vinculo, data_avaliacao DESC);

CREATE INDEX ix_avaliacao_risco_risco_classificacao_calculo
    ON avaliacao_risco (id_risco, id_classificacao, calculado_em);

CREATE INDEX ix_acao_plano_status_prazo
    ON acao_plano (status, prazo);

COMMIT;

