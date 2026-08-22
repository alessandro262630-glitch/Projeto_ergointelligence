-- empresa
CREATE TABLE empresa (
  id_empresa BIGINT,
  razao_social VARCHAR(160) NOT NULL,
  nome_fantasia VARCHAR(160) NOT NULL,
  cnpj VARCHAR(14) NOT NULL,
  email VARCHAR(254),
  telefone VARCHAR(20),
  criando_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT empresa_pkey PRIMARY KEY (id_empresa)
);

COMMENT ON TABLE empresa IS 'Tabela para armazenar o dados de empresa.';

-- setor
CREATE TABLE setor (
  id_setor BIGINT,
  cod_interno VARCHAR(30) NOT NULL,
  nome_setor VARCHAR(120) NOT NULL,
  descricao_setor TEXT,
  setor_ativo BOOLEAN NOT NULL,
  criando_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  CONSTRAINT setor_pkey PRIMARY KEY (id_setor)
);

ALTER TABLE setor ADD CONSTRAINT fk_setor_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
COMMENT ON TABLE setor IS 'Tabela para armazenar os dados do setor.';
COMMENT ON COLUMN setor.id_empresa IS 'FK to empresa';

-- usuario_sistema
CREATE TABLE usuario_sistema (
  id_usuario BIGINT NOT NULL,
  nome VARCHAR(160) NOT NULL,  -- Nome de exibição
  email VARCHAR(254) NOT NULL UNIQUE,  -- Login
  senha_hash VARCHAR(255) NOT NULL,  -- Somente hash seguro; nunca senha em texto.
  pefil_usuario VARCHAR(30) NOT NULL CHECK (CHECK IN (ADMIN,SST,GESTOR,COLABORADOR)),
  ativo_usuario BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ NOT NULL,  -- Auditoria de acesso.
  criando_em TIMESTAMPTZ NOT NULL CHECK (DEFAULT NOW()),
  atualizado_em TIMESTAMPTZ NOT NULL CHECK (DEFAULT NOW()),  -- Auditoria
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  id_colaborador BIGINT NOT NULL UNIQUE,  -- FK to c960650e-736b-4563-9b9f-2ce584e353e4
  CONSTRAINT usuario_sistema_pkey PRIMARY KEY (id_usuario)
);

ALTER TABLE usuario_sistema ADD CONSTRAINT fk_usuario_sistema_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
ALTER TABLE usuario_sistema ADD CONSTRAINT fk_usuario_sistema_id_colaborador FOREIGN KEY (id_colaborador) REFERENCES colaborador (id);
COMMENT ON TABLE usuario_sistema IS 'Conta de acesso e referência para avaliador, responsável e validações.';
COMMENT ON COLUMN usuario_sistema.nome IS 'Nome de exibição';
COMMENT ON COLUMN usuario_sistema.email IS 'Login';
COMMENT ON COLUMN usuario_sistema.senha_hash IS 'Somente hash seguro; nunca
senha em texto.';
COMMENT ON COLUMN usuario_sistema.ultimo_acesso IS 'Auditoria de acesso.';
COMMENT ON COLUMN usuario_sistema.atualizado_em IS 'Auditoria';
COMMENT ON COLUMN usuario_sistema.id_empresa IS 'FK to empresa';
COMMENT ON COLUMN usuario_sistema.id_colaborador IS 'FK to c960650e-736b-4563-9b9f-2ce584e353e4';

-- cargo
CREATE TABLE cargo (
  id_cargo BIGINT NOT NULL,
  cod_setor VARCHAR(30) NOT NULL UNIQUE,
  nome_cargo VARCHAR(120) NOT NULL UNIQUE,
  descricao_cargo TEXT,  -- Descrição de cargo.
  ativo BOOLEAN NOT NULL,
  criando_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  CONSTRAINT cargo_pkey PRIMARY KEY (id_cargo)
);

ALTER TABLE cargo ADD CONSTRAINT fk_cargo_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
COMMENT ON TABLE cargo IS 'Cargo formal/organizacional do colaborado';
COMMENT ON COLUMN cargo.descricao_cargo IS 'Descrição de cargo.';
COMMENT ON COLUMN cargo.id_empresa IS 'FK to empresa';

-- funcao
CREATE TABLE funcao (
  id_funcao BIGINT NOT NULL,
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  cod_funcao VARCHAR(30) NOT NULL UNIQUE,  -- Código interno.
  nome_funcao VARCHAR(140) NOT NULL,
  descricao_funcao TEXT NOT NULL,
  ativo_funcao BOOLEAN NOT NULL,
  criando_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT funcao_pkey PRIMARY KEY (id_funcao)
);

ALTER TABLE funcao ADD CONSTRAINT fk_funcao_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
COMMENT ON TABLE funcao IS 'Função executada dentro de um ou mais cargos.';
COMMENT ON COLUMN funcao.id_empresa IS 'FK to empresa';
COMMENT ON COLUMN funcao.cod_funcao IS 'Código interno.';

-- colaborador
CREATE TABLE colaborador (
  id_colaborador BIGINT,
  matricula_colaborador VARCHAR(50) NOT NULL UNIQUE,
  nome_colaborador VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  data_admissao DATE NOT NULL,
  ativo_colaborador BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  CONSTRAINT colaborador_pkey PRIMARY KEY (id_colaborador)
);

ALTER TABLE colaborador ADD CONSTRAINT fk_colaborador_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
COMMENT ON TABLE colaborador IS 'Identificação do trabalhador avaliado. Não concentra dados que mudam com o tempo.';
COMMENT ON COLUMN colaborador.id_empresa IS 'FK to empresa';

-- perfil_antropometrico
CREATE TABLE perfil_antropometrico (
  id_perfil_antropometrico BIGINT NOT NULL,
  altura_cm NUMERIC(5,2) NOT NULL CHECK (CHECK > 0),  -- Altura, se necessária ao protocolo
  peso_kg NUMERIC(10,2),
  mao_dominante VARCHAR(12) NOT NULL CHECK (CHECK IN (DIREITA,ESQUERDA,AMBIDEST RO)),  -- Preferência manual.
  data_medicao DATE NOT NULL CHECK (NOT NULL; CHECK <= CURRENT_DATE),  -- Data da medição/declaração
  origem VARCHAR(20) NOT NULL CHECK (CHECK IN (MEDIDO,AUTODECLARADO)),  -- Origem do dado
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  id_colaborador BIGINT NOT NULL,  -- FK to c960650e-736b-4563-9b9f-2ce584e353e4
  CONSTRAINT perfil_antropometrico_pkey PRIMARY KEY (id_perfil_antropometrico)
);

ALTER TABLE perfil_antropometrico ADD CONSTRAINT fk_perfil_antropometrico_id_colaborador FOREIGN KEY (id_colaborador) REFERENCES colaborador (id);
COMMENT ON TABLE perfil_antropometrico IS 'Mantém histórico de dados físicos usados como contexto da avaliação.';
COMMENT ON COLUMN perfil_antropometrico.altura_cm IS 'Altura, se necessária ao protocolo';
COMMENT ON COLUMN perfil_antropometrico.mao_dominante IS 'Preferência manual.';
COMMENT ON COLUMN perfil_antropometrico.data_medicao IS 'Data da medição/declaração';
COMMENT ON COLUMN perfil_antropometrico.origem IS 'Origem do dado';
COMMENT ON COLUMN perfil_antropometrico.id_colaborador IS 'FK to c960650e-736b-4563-9b9f-2ce584e353e4';

-- colaborador_vinculo
CREATE TABLE colaborador_vinculo (
  id_vinculo BIGINT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  principal BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  id_setor BIGINT NOT NULL,  -- FK to setor
  id_colaborador BIGINT NOT NULL,  -- FK to c960650e-736b-4563-9b9f-2ce584e353e4
  id_cargo BIGINT NOT NULL,  -- FK to e61bf65e-5f8b-4345-8c7d-67bbfb2b6a30
  CONSTRAINT colaborador_vinculo_pkey PRIMARY KEY (id_vinculo)
);

ALTER TABLE colaborador_vinculo ADD CONSTRAINT fk_colaborador_vinculo_id_setor FOREIGN KEY (id_setor) REFERENCES setor (id);
ALTER TABLE colaborador_vinculo ADD CONSTRAINT fk_colaborador_vinculo_id_colaborador FOREIGN KEY (id_colaborador) REFERENCES colaborador (id);
ALTER TABLE colaborador_vinculo ADD CONSTRAINT fk_colaborador_vinculo_id_cargo FOREIGN KEY (id_cargo) REFERENCES cargo (id);
COMMENT ON TABLE colaborador_vinculo IS 'Histórico de lotação do colaborador, ligando setor e cargo no período.';
COMMENT ON COLUMN colaborador_vinculo.id_setor IS 'FK to setor';
COMMENT ON COLUMN colaborador_vinculo.id_colaborador IS 'FK to c960650e-736b-4563-9b9f-2ce584e353e4';
COMMENT ON COLUMN colaborador_vinculo.id_cargo IS 'FK to e61bf65e-5f8b-4345-8c7d-67bbfb2b6a30';

-- vinculo_funcao
CREATE TABLE vinculo_funcao (
  id_vinculo_funcao BIGINT NOT NULL,
  id_colaborador_vinculo BIGINT NOT NULL,  -- FK to colaborador_vinculo
  id_funcao BIGINT NOT NULL,  -- FK to funcao
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  principal BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT vinculo_funcao_pkey PRIMARY KEY (id_vinculo_funcao)
);

ALTER TABLE vinculo_funcao ADD CONSTRAINT fk_vinculo_funcao_id_colaborador_vinculo FOREIGN KEY (id_colaborador_vinculo) REFERENCES colaborador_vinculo (id);
ALTER TABLE vinculo_funcao ADD CONSTRAINT fk_vinculo_funcao_id_funcao FOREIGN KEY (id_funcao) REFERENCES funcao (id);
COMMENT ON TABLE vinculo_funcao IS 'Tabela associativa das funções exercidas dentro de um vínculo.';
COMMENT ON COLUMN vinculo_funcao.id_colaborador_vinculo IS 'FK to colaborador_vinculo';
COMMENT ON COLUMN vinculo_funcao.id_funcao IS 'FK to funcao';

-- ambiente_trabalho
CREATE TABLE ambiente_trabalho (
  id_ambiente BIGINT NOT NULL,
  id_setor BIGINT NOT NULL,  -- FK to setor
  codigo VARCHAR(30) NOT NULL,
  nome VARCHAR(140) NOT NULL UNIQUE,
  tipo_ambiente VARCHAR(40) NOT NULL,
  localizacao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT ambiente_trabalho_pkey PRIMARY KEY (id_ambiente)
);

ALTER TABLE ambiente_trabalho ADD CONSTRAINT fk_ambiente_trabalho_id_setor FOREIGN KEY (id_setor) REFERENCES setor (id);
COMMENT ON TABLE ambiente_trabalho IS 'Área física/organizacional onde existem um ou mais postos.';
COMMENT ON COLUMN ambiente_trabalho.id_setor IS 'FK to setor';

-- posto_trabalho
CREATE TABLE posto_trabalho (
  id_posto BIGINT,
  id_ambiente_trabalho BIGINT NOT NULL,  -- FK to ambiente_trabalho
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome_posto_trabalho VARCHAR(140) NOT NULL,
  tipo_posto VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT posto_trabalho_pkey PRIMARY KEY (id_posto)
);

ALTER TABLE posto_trabalho ADD CONSTRAINT fk_posto_trabalho_id_ambiente_trabalho FOREIGN KEY (id_ambiente_trabalho) REFERENCES ambiente_trabalho (id);
COMMENT ON TABLE posto_trabalho IS 'Ponto específico do trabalho (mesa, máquina, estação), dentro de um ambiente';
COMMENT ON COLUMN posto_trabalho.id_ambiente_trabalho IS 'FK to ambiente_trabalho';

-- atividade
CREATE TABLE atividade (
  id_atividade BIGINT,
  id_empresa BIGINT CHECK (FK -> EMPRESA; ON DELETE RESTRICT),
  codigo VARCHAR(40) NOT NULL,
  nome VARCHAR(40) NOT NULL,
  descricao TEXT NOT NULL,
  postura_predominante VARCHAR(25) NOT NULL CHECK (CHECK IN (SENTADO,EM_PE,ALTERNADO, MOVIMENTO,OUTRO)),
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Auditoria
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Auditoria
  CONSTRAINT atividade_pkey PRIMARY KEY (id_atividade)
);

COMMENT ON TABLE atividade IS 'Atividade observável executada no trabalho e sujeita à avaliação ergonômica.';
COMMENT ON COLUMN atividade.criado_em IS 'Auditoria';
COMMENT ON COLUMN atividade.atualizado_em IS 'Auditoria';

-- avaliacao_ergomica
CREATE TABLE avaliacao_ergomica (
  id_avaliacao BIGINT,
  id_empresa BIGINT NOT NULL,  -- FK to empresa
  id_colaborador_vinculo BIGINT NOT NULL,  -- FK to colaborador_vinculo
  id_vinculo_funcao BIGINT NOT NULL,  -- FK to vinculo_funcao
  id_ambiente_trabalho BIGINT NOT NULL,  -- FK to ambiente_trabalho
  id_posto_trabalho BIGINT NOT NULL,  -- FK to posto_trabalho
  id_perfil_antropometrico BIGINT NOT NULL,  -- FK to perfil_antropometrico
  id_usuario_sistema BIGINT NOT NULL,  -- FK to usuario_sistema
  tipo_avaliacao VARCHAR(30) NOT NULL CHECK (CHECK IN (INICIAL,ACOMPANHAMENTO,P OS_INTERVENCAO,AEP),
  status VARCHAR(20) NOT NULL,
  data_avaliacao TIMESTAMPTZ NOT NULL,
  data_finalizacao TIMESTAMPTZ NOT NULL,
  pontuacao_total NUMERIC(10,2) NOT NULL,
  id_classificacao_geral BIGINT,
  versao_motor_regras VARCHAR(30) NOT NULL,
  observacoes TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT avaliacao_ergomica_pkey PRIMARY KEY (id_avaliacao)
);

ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_colaborador_vinculo FOREIGN KEY (id_colaborador_vinculo) REFERENCES colaborador_vinculo (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_vinculo_funcao FOREIGN KEY (id_vinculo_funcao) REFERENCES vinculo_funcao (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_ambiente_trabalho FOREIGN KEY (id_ambiente_trabalho) REFERENCES ambiente_trabalho (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_posto_trabalho FOREIGN KEY (id_posto_trabalho) REFERENCES posto_trabalho (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_perfil_antropometrico FOREIGN KEY (id_perfil_antropometrico) REFERENCES perfil_antropometrico (id);
ALTER TABLE avaliacao_ergomica ADD CONSTRAINT fk_avaliacao_ergomica_id_usuario_sistema FOREIGN KEY (id_usuario_sistema) REFERENCES usuario_sistema (id);
COMMENT ON TABLE avaliacao_ergomica IS 'Evento central do domínio; registra o contexto avaliado e preserva o histórico.';
COMMENT ON COLUMN avaliacao_ergomica.id_empresa IS 'FK to empresa';
COMMENT ON COLUMN avaliacao_ergomica.id_colaborador_vinculo IS 'FK to colaborador_vinculo';
COMMENT ON COLUMN avaliacao_ergomica.id_vinculo_funcao IS 'FK to vinculo_funcao';
COMMENT ON COLUMN avaliacao_ergomica.id_ambiente_trabalho IS 'FK to ambiente_trabalho';
COMMENT ON COLUMN avaliacao_ergomica.id_posto_trabalho IS 'FK to posto_trabalho';
COMMENT ON COLUMN avaliacao_ergomica.id_perfil_antropometrico IS 'FK to perfil_antropometrico';
COMMENT ON COLUMN avaliacao_ergomica.id_usuario_sistema IS 'FK to usuario_sistema';

-- avaliacao_atividade
CREATE TABLE avaliacao_atividade (
  id_avaliacao_atividade BIGINT NOT NULL,
  id_avaliacao_ergomica BIGINT NOT NULL,  -- FK to avaliacao_ergomica
  id_atividade BIGINT NOT NULL,  -- FK to atividade
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  tempo_exposicao_minutos INTEGER NOT NULL CHECK (CHECK > 0),
  frequencia_diaria INTEGER NOT NULL CHECK (CHECK >= 0),
  observacao TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT avaliacao_atividade_pkey PRIMARY KEY (id_avaliacao_atividade)
);

ALTER TABLE avaliacao_atividade ADD CONSTRAINT fk_avaliacao_atividade_id_avaliacao_ergomica FOREIGN KEY (id_avaliacao_ergomica) REFERENCES avaliacao_ergomica (id);
ALTER TABLE avaliacao_atividade ADD CONSTRAINT fk_avaliacao_atividade_id_atividade FOREIGN KEY (id_atividade) REFERENCES atividade (id);
COMMENT ON TABLE avaliacao_atividade IS 'Associa uma avaliação a uma ou mais atividades efetivamente executadas.';
COMMENT ON COLUMN avaliacao_atividade.id_avaliacao_ergomica IS 'FK to avaliacao_ergomica';
COMMENT ON COLUMN avaliacao_atividade.id_atividade IS 'FK to atividade';

-- pergunta_avaliacao
CREATE TABLE pergunta_avaliacao (
  id_pergunta BIGINT,
  codigo VARCHAR(50) UNIQUE,
  categoria VARCHAR(35) CHECK (CHECK IN (POSTURA,REPETITIVIDADE,ES FORCO,MOBILIARIO,AMBIENTE, FADIGA,ORGANIZACAO,OUTRO)),
  texto_pergunta TEXT NOT NULL,
  tipo_resposta VARCHAR(25) NOT NULL,
  unidade VARCHAR(30),
  obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL CHECK (CHECK > 0),
  versao INTEGER CHECK (DEFAULT 1; CHECK >= 1),
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT pergunta_avaliacao_pkey PRIMARY KEY (id_pergunta)
);

COMMENT ON TABLE pergunta_avaliacao IS 'Catálogo versionado de perguntas do instrumento ergonômico.';

-- opcao_resposta
CREATE TABLE opcao_resposta (
  id_opcao BIGINT,
  id_pergunta_avaliacao BIGINT NOT NULL,  -- FK to pergunta_avaliacao
  codigo VARCHAR(30) NOT NULL,
  rotulo VARCHAR(160) NOT NULL,
  valor_numero NUMERIC(10,2) NOT NULL,
  pontuacao_base NUMERIC(10,2) NOT NULL,
  ordem INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT opcao_resposta_pkey PRIMARY KEY (id_opcao)
);

ALTER TABLE opcao_resposta ADD CONSTRAINT fk_opcao_resposta_id_pergunta_avaliacao FOREIGN KEY (id_pergunta_avaliacao) REFERENCES pergunta_avaliacao (id);
COMMENT ON TABLE opcao_resposta IS 'Opções disponíveis para perguntas de escolha única/múltipla e escalas catalogadas.';
COMMENT ON COLUMN opcao_resposta.id_pergunta_avaliacao IS 'FK to pergunta_avaliacao';

-- resposta_avaliacao
CREATE TABLE resposta_avaliacao (
  id_resposta BIGINT,
  id_avaliacao_ergomica BIGINT NOT NULL,  -- FK to avaliacao_ergomica
  id_pergunta_avaliacao BIGINT NOT NULL,  -- FK to pergunta_avaliacao
  resposta_texto TEXT NOT NULL,
  resposta_numero NUMERIC(10,2) NOT NULL,
  resposta_booleano BOOLEAN NOT NULL,
  pontuacao_calculada NUMERIC(10,2) NOT NULL,
  observacao TEXT NOT NULL,
  respondido_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT resposta_avaliacao_pkey PRIMARY KEY (id_resposta)
);

ALTER TABLE resposta_avaliacao ADD CONSTRAINT fk_resposta_avaliacao_id_avaliacao_ergomica FOREIGN KEY (id_avaliacao_ergomica) REFERENCES avaliacao_ergomica (id);
ALTER TABLE resposta_avaliacao ADD CONSTRAINT fk_resposta_avaliacao_id_pergunta_avaliacao FOREIGN KEY (id_pergunta_avaliacao) REFERENCES pergunta_avaliacao (id);
COMMENT ON TABLE resposta_avaliacao IS 'Resposta única por pergunta/avaliação; valores de escolha ficam na associativa RESPOSTA_OPCAO.';
COMMENT ON COLUMN resposta_avaliacao.id_avaliacao_ergomica IS 'FK to avaliacao_ergomica';
COMMENT ON COLUMN resposta_avaliacao.id_pergunta_avaliacao IS 'FK to pergunta_avaliacao';

-- risco_ergonomico
CREATE TABLE risco_ergonomico (
  id_risco BIGINT,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT NOT NULL,
  categoria VARCHAR(35),
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT risco_ergonomico_pkey PRIMARY KEY (id_risco)
);

COMMENT ON TABLE risco_ergonomico IS 'Catálogo de fatores/riscos que o sistema pode identificar.';

-- classicacao_risco
CREATE TABLE classicacao_risco (
  id_classificacao BIGINT,
  codigo VARCHAR(30) NOT NULL,
  nome VARCHAR(60) NOT NULL,
  pontuacao_min NUMERIC(10,2) NOT NULL CHECK (CHECK >= 0),
  pontuacao_max NUMERIC(10,2) NOT NULL CHECK (CHECK >= pontuacao_min),
  prioridade INTEGER NOT NULL,
  cor_hex CHAR(7) NOT NULL,
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL,
  CONSTRAINT classicacao_risco_pkey PRIMARY KEY (id_classificacao)
);

COMMENT ON TABLE classicacao_risco IS 'Faixas configuráveis para Baixo/Moderado/Alto/Crítico.';

-- regra_risco
CREATE TABLE regra_risco (
  id_regra BIGINT NOT NULL,
  id_risco_ergonomico BIGINT NOT NULL,  -- FK to risco_ergonomico
  codigo VARCHAR(60) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT NOT NULL,
  operador_agregacao VARCHAR(5) NOT NULL,
  pontuacao_resultado NUMERIC(10,2) NOT NULL,
  versao INTEGER NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE NOT NULL,
  fonte_tecnica TEXT NOT NULL,
  ativo BOOLEAN,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT regra_risco_pkey PRIMARY KEY (id_regra)
);

ALTER TABLE regra_risco ADD CONSTRAINT fk_regra_risco_id_risco_ergonomico FOREIGN KEY (id_risco_ergonomico) REFERENCES risco_ergonomico (id);
COMMENT ON TABLE regra_risco IS 'Regra versionada que relaciona condições a um risco e pontuação.';
COMMENT ON COLUMN regra_risco.id_risco_ergonomico IS 'FK to risco_ergonomico';

-- regra_condicao
CREATE TABLE regra_condicao (
  id_condicao BIGINT,
  id_regra_risco BIGINT NOT NULL,  -- FK to regra_risco
  id_pergunta_avaliacao BIGINT NOT NULL,  -- FK to pergunta_avaliacao
  operador VARCHAR(12) NOT NULL CHECK (CHECK IN (EQ,NE,GT,GTE,LT,LTE,IN,CONT AINS),
  id_opcao BIGINT NOT NULL CHECK (FK -> OPCAO_RESPOSTA; ON DELETE RESTRICT),
  valor_texto TEXT NOT NULL,
  valor_numero NUMERIC(12,3) NOT NULL,
  valor_booleano BOOLEAN NOT NULL,
  ordem INTEGER NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT regra_condicao_pkey PRIMARY KEY (id_condicao)
);

ALTER TABLE regra_condicao ADD CONSTRAINT fk_regra_condicao_id_regra_risco FOREIGN KEY (id_regra_risco) REFERENCES regra_risco (id);
ALTER TABLE regra_condicao ADD CONSTRAINT fk_regra_condicao_id_pergunta_avaliacao FOREIGN KEY (id_pergunta_avaliacao) REFERENCES pergunta_avaliacao (id);
COMMENT ON COLUMN regra_condicao.id_regra_risco IS 'FK to regra_risco';
COMMENT ON COLUMN regra_condicao.id_pergunta_avaliacao IS 'FK to pergunta_avaliacao';

-- avaliacao_risco
CREATE TABLE avaliacao_risco (
  id_avaliacao_risco BIGINT NOT NULL,
  id_avaliacao_ergomica BIGINT NOT NULL,  -- FK to avaliacao_ergomica
  id_risco_ergonomico BIGINT NOT NULL,  -- FK to risco_ergonomico
  id_classicacao_risco BIGINT NOT NULL,  -- FK to classicacao_risco
  pontuacao NUMERIC(10,2) NOT NULL,
  justificativa TEXT NOT NULL,
  calculado_em TIMESTAMPTZ NOT NULL,
  versao_motor_regras VARCHAR(30) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT avaliacao_risco_pkey PRIMARY KEY (id_avaliacao_risco)
);

ALTER TABLE avaliacao_risco ADD CONSTRAINT fk_avaliacao_risco_id_avaliacao_ergomica FOREIGN KEY (id_avaliacao_ergomica) REFERENCES avaliacao_ergomica (id);
ALTER TABLE avaliacao_risco ADD CONSTRAINT fk_avaliacao_risco_id_risco_ergonomico FOREIGN KEY (id_risco_ergonomico) REFERENCES risco_ergonomico (id);
ALTER TABLE avaliacao_risco ADD CONSTRAINT fk_avaliacao_risco_id_classicacao_risco FOREIGN KEY (id_classicacao_risco) REFERENCES classicacao_risco (id);
COMMENT ON TABLE avaliacao_risco IS 'Resultado consolidado de cada risco encontrado em uma avaliação.';
COMMENT ON COLUMN avaliacao_risco.id_avaliacao_ergomica IS 'FK to avaliacao_ergomica';
COMMENT ON COLUMN avaliacao_risco.id_risco_ergonomico IS 'FK to risco_ergonomico';
COMMENT ON COLUMN avaliacao_risco.id_classicacao_risco IS 'FK to classicacao_risco';

-- recomemdacao
CREATE TABLE recomemdacao (
  id_recomendacao BIGINT NOT NULL,
  codigo VARCHAR(60) NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  intervalo_minutos INTEGER NOT NULL,
  prioridade_padrao VARCHAR(12) NOT NULL,
  fonte_tecnica TEXT NOT NULL,
  requer_validacao BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT recomemdacao_pkey PRIMARY KEY (id_recomendacao)
);

COMMENT ON TABLE recomemdacao IS 'Catálogo de boas práticas e orientações validadas, reutilizáveis entre riscos';

-- avaliacao_recomendacao
CREATE TABLE avaliacao_recomendacao (
  id_avaliacao_recomendacao BIGINT,
  id_avaliacao_ergomica BIGINT NOT NULL,  -- FK to avaliacao_ergomica
  id_avaliacao_risco BIGINT NOT NULL,  -- FK to avaliacao_risco
  id_recomemdacao BIGINT NOT NULL,  -- FK to recomemdacao
  descricao_personalizada TEXT NOT NULL,
  prioridade VARCHAR(12) NOT NULL,
  origem VARCHAR(20) NOT NULL,
  status VARCHAR(15) NOT NULL,
  validada_por BIGINT NOT NULL,
  validada_em TIMESTAMPTZ NOT NULL,
  gerada_em TIMESTAMPTZ,
  CONSTRAINT avaliacao_recomendacao_pkey PRIMARY KEY (id_avaliacao_recomendacao)
);

ALTER TABLE avaliacao_recomendacao ADD CONSTRAINT fk_avaliacao_recomendacao_id_avaliacao_ergomica FOREIGN KEY (id_avaliacao_ergomica) REFERENCES avaliacao_ergomica (id);
ALTER TABLE avaliacao_recomendacao ADD CONSTRAINT fk_avaliacao_recomendacao_id_avaliacao_risco FOREIGN KEY (id_avaliacao_risco) REFERENCES avaliacao_risco (id);
ALTER TABLE avaliacao_recomendacao ADD CONSTRAINT fk_avaliacao_recomendacao_id_recomemdacao FOREIGN KEY (id_recomemdacao) REFERENCES recomemdacao (id);
COMMENT ON TABLE avaliacao_recomendacao IS 'Snapshot das recomendações geradas para um risco específico da avaliação.';
COMMENT ON COLUMN avaliacao_recomendacao.id_avaliacao_ergomica IS 'FK to avaliacao_ergomica';
COMMENT ON COLUMN avaliacao_recomendacao.id_avaliacao_risco IS 'FK to avaliacao_risco';
COMMENT ON COLUMN avaliacao_recomendacao.id_recomemdacao IS 'FK to recomemdacao';

-- plano_acao
CREATE TABLE plano_acao (
  id_plano BIGINT,
  id_avaliacao_ergomica BIGINT NOT NULL,  -- FK to avaliacao_ergomica
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  criado_por BIGINT,
  data_inicio DATE NOT NULL,
  data_alvo DATE NOT NULL,
  data_conclusao DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT plano_acao_pkey PRIMARY KEY (id_plano)
);

ALTER TABLE plano_acao ADD CONSTRAINT fk_plano_acao_id_avaliacao_ergomica FOREIGN KEY (id_avaliacao_ergomica) REFERENCES avaliacao_ergomica (id);
COMMENT ON TABLE plano_acao IS 'Agrupa ações de intervenção vinculadas a uma avaliação.';
COMMENT ON COLUMN plano_acao.id_avaliacao_ergomica IS 'FK to avaliacao_ergomica';

-- acao_plano
CREATE TABLE acao_plano (
  id_acao BIGINT NOT NULL,
  id_plano_acao BIGINT NOT NULL,  -- FK to plano_acao
  id_avaliacao_recomendacao BIGINT NOT NULL,  -- FK to avaliacao_recomendacao
  id_usuario_sistema BIGINT NOT NULL,  -- FK to usuario_sistema
  descricao TEXT NOT NULL,
  prioridade VARCHAR(12) NOT NULL,
  prazo DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  data_conclusao DATE NOT NULL,
  evidencia_texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT acao_plano_pkey PRIMARY KEY (id_acao)
);

ALTER TABLE acao_plano ADD CONSTRAINT fk_acao_plano_id_plano_acao FOREIGN KEY (id_plano_acao) REFERENCES plano_acao (id);
ALTER TABLE acao_plano ADD CONSTRAINT fk_acao_plano_id_avaliacao_recomendacao FOREIGN KEY (id_avaliacao_recomendacao) REFERENCES avaliacao_recomendacao (id);
ALTER TABLE acao_plano ADD CONSTRAINT fk_acao_plano_id_usuario_sistema FOREIGN KEY (id_usuario_sistema) REFERENCES usuario_sistema (id);
COMMENT ON TABLE acao_plano IS 'Ação executável com responsável, prazo e evidência';
COMMENT ON COLUMN acao_plano.id_plano_acao IS 'FK to plano_acao';
COMMENT ON COLUMN acao_plano.id_avaliacao_recomendacao IS 'FK to avaliacao_recomendacao';
COMMENT ON COLUMN acao_plano.id_usuario_sistema IS 'FK to usuario_sistema';

-- funcao_cargo
CREATE TABLE funcao_cargo (
  id_funcao BIGINT NOT NULL,  -- FK funcao
  id_cargo BIGINT NOT NULL,  -- FK cargo
  principal_padrao BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL,
  criando_em TIMESTAMPTZ NOT NULL
);

ALTER TABLE funcao_cargo ADD CONSTRAINT fk_funcao_cargo_id_funcao FOREIGN KEY (id_funcao) REFERENCES funcao (id);
ALTER TABLE funcao_cargo ADD CONSTRAINT fk_funcao_cargo_id_cargo FOREIGN KEY (id_cargo) REFERENCES cargo (id);
COMMENT ON COLUMN funcao_cargo.id_funcao IS 'FK funcao';
COMMENT ON COLUMN funcao_cargo.id_cargo IS 'FK cargo';

-- funcao_atividade
CREATE TABLE funcao_atividade (
  id_funcao_atividade BIGINT,
  id_funcao BIGINT NOT NULL,  -- FK funcao
  id_atividade BIGINT NOT NULL,  -- FK atividade
  principal BOOLEAN NOT NULL,
  tempo_medio_minutos INTEGER NOT NULL,
  frequencia_diaria INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT funcao_atividade_pkey PRIMARY KEY (id_funcao_atividade)
);

ALTER TABLE funcao_atividade ADD CONSTRAINT fk_funcao_atividade_id_funcao FOREIGN KEY (id_funcao) REFERENCES funcao (id);
ALTER TABLE funcao_atividade ADD CONSTRAINT fk_funcao_atividade_id_atividade FOREIGN KEY (id_atividade) REFERENCES atividade (id);
COMMENT ON COLUMN funcao_atividade.id_funcao IS 'FK funcao';
COMMENT ON COLUMN funcao_atividade.id_atividade IS 'FK atividade';

-- resposta_avaliacao_opcao_resposta
CREATE TABLE resposta_avaliacao_opcao_resposta (
  id_resposta_opcao BIGINT,
  id_opcao_resposta BIGINT NOT NULL,  -- FK opcao_resposta
  id_resposta_avaliacao BIGINT NOT NULL,  -- FK to 51609f99-9f0b-4ca0-a918-2ae9834c7da5
  criando_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT resposta_avaliacao_opcao_resposta_pkey PRIMARY KEY (id_resposta_opcao)
);

ALTER TABLE resposta_avaliacao_opcao_resposta ADD CONSTRAINT fk_resposta_avaliacao_opcao_resposta_id_opcao_resposta FOREIGN KEY (id_opcao_resposta) REFERENCES opcao_resposta (id);
ALTER TABLE resposta_avaliacao_opcao_resposta ADD CONSTRAINT fk_resposta_avaliacao_opcao_resposta_id_resposta_avaliacao FOREIGN KEY (id_resposta_avaliacao) REFERENCES resposta_avaliacao (id);
COMMENT ON COLUMN resposta_avaliacao_opcao_resposta.id_opcao_resposta IS 'FK opcao_resposta';
COMMENT ON COLUMN resposta_avaliacao_opcao_resposta.id_resposta_avaliacao IS 'FK to 51609f99-9f0b-4ca0-a918-2ae9834c7da5';

-- avaliacao_risco_regra_risco
CREATE TABLE avaliacao_risco_regra_risco (
  id_avaliacao_risco_regra BIGINT,
  id_avaliacao_risco BIGINT NOT NULL,  -- FK avaliacao_risco
  id_regra_risco BIGINT NOT NULL,  -- FK regra_risco
  satisfeita BOOLEAN NOT NULL,
  pontuacao_aplicada NUMERIC(10,2) NOT NULL,
  detalhe TEXT NOT NULL,
  avaliado_em TIMESTAMPTZ NOT NULL,
  CONSTRAINT avaliacao_risco_regra_risco_pkey PRIMARY KEY (id_avaliacao_risco_regra)
);

ALTER TABLE avaliacao_risco_regra_risco ADD CONSTRAINT fk_avaliacao_risco_regra_risco_id_avaliacao_risco FOREIGN KEY (id_avaliacao_risco) REFERENCES avaliacao_risco (id);
ALTER TABLE avaliacao_risco_regra_risco ADD CONSTRAINT fk_avaliacao_risco_regra_risco_id_regra_risco FOREIGN KEY (id_regra_risco) REFERENCES regra_risco (id);
COMMENT ON COLUMN avaliacao_risco_regra_risco.id_avaliacao_risco IS 'FK avaliacao_risco';
COMMENT ON COLUMN avaliacao_risco_regra_risco.id_regra_risco IS 'FK regra_risco';

-- risco_ergonomico_recomemdacao
CREATE TABLE risco_ergonomico_recomemdacao (
  id_risco_recomendacao BIGINT NOT NULL,
  id_risco_ergonomico BIGINT NOT NULL,  -- FK risco_ergonomico
  id_recomemdacao BIGINT NOT NULL,  -- FK recomemdacao
  prioridade_sugerida VARCHAR(12) NOT NULL,
  ativo BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL
);

ALTER TABLE risco_ergonomico_recomemdacao ADD CONSTRAINT fk_risco_ergonomico_recomemdacao_id_risco_ergonomico FOREIGN KEY (id_risco_ergonomico) REFERENCES risco_ergonomico (id);
ALTER TABLE risco_ergonomico_recomemdacao ADD CONSTRAINT fk_risco_ergonomico_recomemdacao_id_recomemdacao FOREIGN KEY (id_recomemdacao) REFERENCES recomemdacao (id);
COMMENT ON COLUMN risco_ergonomico_recomemdacao.id_risco_ergonomico IS 'FK risco_ergonomico';
COMMENT ON COLUMN risco_ergonomico_recomemdacao.id_recomemdacao IS 'FK recomemdacao';