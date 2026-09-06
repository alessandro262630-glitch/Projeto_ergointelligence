-- =====================================================================
-- ErgoIntelligence | Migration 005 - Fundacao Fisica do Inventario de
-- Riscos Ocupacionais (MVP-09B)
-- =====================================================================
-- Cria a infraestrutura fisica do Inventario de Riscos, aprovada na
-- arquitetura do MVP-09A (ver docs/mvp09a-arquitetura-inventario-riscos.md).
--
-- NENHUMA tabela existente e alterada por esta migration. Em particular:
--
--   risco_ergonomico, avaliacao_ghe_risco, processamento_risco_ghe, ghe,
--   atividade, ambiente_trabalho, posto_trabalho, usuario, empresa,
--   plano_acao, acao_plano
--
-- permanecem exatamente como estao. O Inventario e CONSUMIDOR de
-- resultados do Motor GHE, nunca produtor de calculo - nenhuma logica de
-- pontuacao/classificacao e criada aqui.
--
-- Esta migration cria SOMENTE estrutura (5 tabelas novas). A importacao
-- automatica de resultados do Motor GHE para o Inventario e MVP-09C -
-- aqui o banco/service ficam preparados (FKs e snapshots existem), mas
-- nenhum fluxo de importacao e implementado.
--
-- Pre-requisitos: 001, 002, 003 e 004 ja aplicadas.
-- Execucao transacional: se qualquer instrucao falhar, nada e criado.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. PERIGO_OCUPACIONAL (catalogo global, agnostico de motor)
-- ---------------------------------------------------------------------
-- Perigo = fonte/situacao com potencial de causar dano (catalogo,
-- atemporal). Risco = resultado da avaliacao de um perigo dentro de um
-- contexto de exposicao (o que avaliacao_ghe_risco ja produz para o
-- dominio ergonomico). risco_ergonomico continua sendo vocabulario
-- proprio do Motor (acoplado a pontuacao/regras) - NAO e o catalogo do
-- Inventario. perigo_ocupacional e mais amplo e cobre categorias que o
-- sistema ainda nao processa automaticamente (MVP-09A, secoes 3/4/8).
--
-- Uma unica tabela generica com coluna `categoria` (nao uma tabela por
-- categoria) - os campos sao identicos para qualquer perigo, so o
-- vocabulario muda. Uso automatico hoje se limita a ERGONOMICO; as
-- demais categorias existem na estrutura, sem nenhum motor que as
-- calcule (nao implementado nesta feature).
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
-- 2. RISCO_ERGONOMICO_PERIGO (ponte N:1, risco_ergonomico intacto)
-- ---------------------------------------------------------------------
-- Liga o vocabulario do Motor (risco_ergonomico) ao catalogo do
-- Inventario (perigo_ocupacional) sem o Motor conhecer o Inventario.
-- Cardinalidade aprovada no MVP-09A: N:1 - varios risco_ergonomico podem
-- apontar para o mesmo perigo_ocupacional, mas cada risco_ergonomico
-- mapeia para no maximo UM perigo (UNIQUE(id_risco) abaixo). Nenhuma
-- linha de risco_ergonomico e alterada por esta migration.
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
-- 3. INVENTARIO_RISCO (cabecalho/versao do documento)
-- ---------------------------------------------------------------------
-- Cada versao do Inventario de uma empresa e uma linha propria - nunca
-- um UPDATE para representar uma nova revisao. id_inventario_anterior
-- forma a cadeia de versoes (v1 <- v2 <- v3), nunca ramificada.
--
-- publicado_por foi acrescentado alem da lista literal do MVP-09B
-- (secao 15 do prompt) porque a secao 59 do MVP-09A exige explicitamente
-- responder "quem publicou?" - sem esta coluna essa pergunta nao tem
-- resposta (criado_por so responde "quem criou").
--
-- status: RASCUNHO/PUBLICADO/CANCELADO (MVP-09A, secao 19) - conjunto
-- minimo aprovado, sem estado intermediario. Uma vez PUBLICADO, o
-- CHECK abaixo exige publicado_por/publicado_em preenchidos; em
-- qualquer outro status, exige os dois NULOS - a consistencia e
-- garantida pelo banco, nao so pela aplicacao (MVP-09B, secao 21).
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
-- 4. INVENTARIO_RISCO_ITEM (o risco contextualizado)
-- ---------------------------------------------------------------------
-- Cada item = UM perigo, em UM GHE, dentro de UMA versao do Inventario -
-- nunca varios GHEs numa unica linha (MVP-09A, secao 8/18).
--
-- Campos de conteudo (fonte_circunstancia, possiveis_lesoes_agravos,
-- trabalhadores_expostos_snapshot, medidas_existentes, caracterizacao
-- de exposicao) sao NULOS no banco - a completude e responsabilidade da
-- camada de aplicacao (validarItemInventarioCompleto), nao de NOT NULL:
-- um item incompleto precisa poder existir livremente em RASCUNHO
-- (MVP-09A, secao 40; MVP-09B, secao 73). So os tres campos que definem
-- a IDENTIDADE estrutural do item (inventario, GHE, perigo) sao
-- obrigatorios no banco.
--
-- id_ambiente/id_posto reaproveitam os catalogos existentes (nunca
-- duplicados); processo_descricao e o fallback textual para quando a
-- estrutura de ambiente/posto nao representar bem o "processo"
-- (MVP-09A, secao 20).
--
-- origem_tipo distingue item importado do Motor GHE (MOTOR_GHE) de item
-- registrado manualmente (MANUAL). O CHECK abaixo garante, no banco -
-- nao so na aplicacao -, que um item MANUAL nunca carrega uma
-- classificacao "oficial" inventada (MVP-09A/MVP-09B, secao 35/37): os
-- snapshots de avaliacao so podem existir quando origem_tipo=MOTOR_GHE.
--
-- id_avaliacao_ghe_risco e o UNICO ponteiro de origem necessario -
-- processamento/avaliacao/GHE/classificacao ja sao alcancaveis por join
-- a partir dele (avaliacao_ghe_risco -> processamento_risco_ghe ->
-- avaliacao_ghe -> ghe; avaliacao_ghe_risco -> classificacao_risco_ghe).
-- Nao ha FKs redundantes para processamento/avaliacao diretamente no
-- item (MVP-09A, secao 11).
--
-- Os snapshots (pontuacao/classificacao/metodologia) protegem o
-- historico publicado mesmo que classificacao_risco_ghe.nome/cor_hex
-- seja editado depois, ja que aquela tabela nao e versionada por linha
-- como metodologia_risco (MVP-09A, secao 12).
--
-- UNIQUE(id_inventario, id_avaliacao_ghe_risco) impede reimportar o
-- mesmo resultado do Motor duas vezes no MESMO inventario, sem impedir
-- cenarios legitimos de mesmo perigo+GHE com atividade/fonte diferentes
-- (MVP-09A, secao 22/34) - Postgres permite multiplos NULOS numa coluna
-- UNIQUE, entao itens MANUAL (sem id_avaliacao_ghe_risco) nunca colidem
-- entre si por causa desta constraint.
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

-- ---------------------------------------------------------------------
-- 5. INVENTARIO_RISCO_ITEM_ATIVIDADE (N:N com atividade, reutilizada)
-- ---------------------------------------------------------------------
-- Um item pode abranger mais de uma atividade. atividade (catalogo por
-- empresa, ja existente) nunca e duplicada aqui - apenas associada.
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

-- ---------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------
-- Colunas UNIQUE/PK ja sao indexadas automaticamente pelo PostgreSQL
-- (inclusive como prefixo de indice composto) e nao sao repetidas aqui -
-- mesmo criterio ja usado no restante do schema (migrations 001-004).
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

COMMIT;
