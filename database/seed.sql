-- =====================================================================
-- ErgoIntelligence | Seed de Demonstracao - Fundacao do MVP
-- =====================================================================
-- Fonte da verdade: database/schema.sql (ja validado e aprovado no Supabase)
-- Alvo: PostgreSQL (Supabase)
--
-- Todos os dados sao FICTICIOS, criados exclusivamente para desenvolvimento,
-- testes e demonstracao do MVP do ErgoIntelligence. Nenhum dado real de
-- pessoas, empresas ou diagnosticos e utilizado.
--
-- Este arquivo NAO cria avaliacoes prontas. As tabelas avaliacao_ergonomica,
-- avaliacao_atividade, resposta_avaliacao, resposta_opcao, avaliacao_risco,
-- avaliacao_risco_regra, avaliacao_recomendacao, plano_acao e acao_plano
-- permanecem vazias apos este seed: a primeira avaliacao devera ser criada
-- pelo fluxo real da aplicacao (colaborador -> avaliacao -> questionario ->
-- motor de risco -> classificacao -> recomendacoes -> plano de acao).
--
-- Resolucao de FK: em vez de IDs fixos frageis, cada INSERT que precisa de
-- uma chave estrangeira usa uma subquery pela chave natural (codigo,
-- codigo_interno, matricula ou nome) do registro ja inserido acima.
--
-- Execucao transacional: se qualquer INSERT falhar, nada e gravado.
-- Nao utiliza ON CONFLICT: o objetivo e detectar inconsistencias, nao
-- ocultar erros. Reexecutar este script em um banco ja populado deve
-- falhar por violacao de UNIQUE (comportamento esperado).
-- =====================================================================

BEGIN;

-- =====================================================================
-- BLOCO 1 - ESTRUTURA ORGANIZACIONAL
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EMPRESA
-- ---------------------------------------------------------------------
INSERT INTO empresa (razao_social, nome_fantasia, cnpj, email, telefone, ativo)
VALUES (
    'ErgoTech Solucoes Industriais Ltda.',
    'ErgoTech Demo',
    '12345678000190',
    'contato@ergotech.demo',
    '(11) 4002-8922',
    TRUE
);

-- ---------------------------------------------------------------------
-- 2. SETOR (4)
-- ---------------------------------------------------------------------
INSERT INTO setor (id_empresa, codigo_interno, nome, descricao, ativo) VALUES
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ADM',  'Administrativo', 'Setor responsavel pelas atividades administrativas e de apoio.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'TEC',  'Tecnologia', 'Setor responsavel pelo desenvolvimento e suporte de sistemas.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'PROD', 'Producao', 'Setor responsavel pelas atividades de producao industrial.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'LOG',  'Logistica', 'Setor responsavel pela separacao, movimentacao e expedicao de materiais.', TRUE);

-- ---------------------------------------------------------------------
-- 3. CARGO (6)
-- ---------------------------------------------------------------------
INSERT INTO cargo (id_empresa, codigo_interno, nome, descricao, ativo) VALUES
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-ASSIST-ADM', 'Assistente Administrativo', 'Cargo de apoio administrativo geral.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-ANL-ADM',    'Analista Administrativo', 'Cargo responsavel por analises e processos administrativos.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-ANL-SIS',    'Analista de Sistemas', 'Cargo responsavel pelo desenvolvimento e manutencao de sistemas.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-OP-PROD',    'Operador de Producao', 'Cargo responsavel pela operacao de equipamentos de producao.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-AUX-LOG',    'Auxiliar de Logistica', 'Cargo responsavel pelo apoio as atividades logisticas.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'CARGO-SUP-PROD',   'Supervisor de Producao', 'Cargo responsavel pela supervisao das atividades de producao.', TRUE);

-- ---------------------------------------------------------------------
-- 4. FUNCAO (8)
-- ---------------------------------------------------------------------
-- Cargo e funcao sao conceitos distintos: cargo e a posicao formal,
-- funcao e o trabalho efetivamente executado (ver cargo_funcao a seguir).
INSERT INTO funcao (id_empresa, codigo, nome, descricao, ativo) VALUES
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-ATEND',    'Atendimento administrativo', 'Atendimento a clientes e colaboradores, presencial ou por telefone.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-DIGIT',    'Digitacao e lancamento de dados', 'Digitacao e lancamento de informacoes em sistemas administrativos.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-DEV',      'Desenvolvimento de software', 'Desenvolvimento e manutencao de sistemas de software.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-MONIT',    'Monitoramento em estacao de trabalho', 'Monitoramento e inspecao de processos a partir de uma estacao fixa.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-OPMAQ',    'Operacao de maquina', 'Operacao de equipamento industrial em linha de producao.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-SEPAR',    'Separacao de materiais', 'Separacao e conferencia de materiais para expedicao.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-MOVCARGA', 'Movimentacao manual de cargas', 'Movimentacao e transporte manual de materiais e volumes.', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'FN-SUPERV',   'Supervisao operacional', 'Supervisao e acompanhamento das atividades operacionais.', TRUE);

-- ---------------------------------------------------------------------
-- 5. CARGO_FUNCAO (12) - quais funcoes cada cargo pode exercer
-- ---------------------------------------------------------------------
INSERT INTO cargo_funcao (id_cargo, id_funcao, principal_padrao, ativo) VALUES
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ASSIST-ADM'), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-ATEND'),    TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ASSIST-ADM'), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    FALSE, TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-ADM'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-ADM'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-ATEND'),    FALSE, TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-SIS'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DEV'),      TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-SIS'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-MONIT'),    FALSE, TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-OP-PROD'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-OPMAQ'),    TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-OP-PROD'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-MONIT'),    FALSE, TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-AUX-LOG'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-SEPAR'),    TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-AUX-LOG'),    (SELECT id_funcao FROM funcao WHERE codigo = 'FN-MOVCARGA'), FALSE, TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-SUP-PROD'),   (SELECT id_funcao FROM funcao WHERE codigo = 'FN-SUPERV'),   TRUE,  TRUE),
((SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-SUP-PROD'),   (SELECT id_funcao FROM funcao WHERE codigo = 'FN-OPMAQ'),    FALSE, TRUE);

-- ---------------------------------------------------------------------
-- 6. COLABORADOR (6)
-- ---------------------------------------------------------------------
INSERT INTO colaborador (id_empresa, matricula, nome, email, data_admissao, ativo) VALUES
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM001', 'Marina Alves Demo',    'marina.alves@ergotech.demo',    (CURRENT_DATE - INTERVAL '3 years')::date,  TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM002', 'Carlos Mendes Demo',   'carlos.mendes@ergotech.demo',   (CURRENT_DATE - INTERVAL '2 years')::date,  TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM003', 'Juliana Ribeiro Demo', 'juliana.ribeiro@ergotech.demo', (CURRENT_DATE - INTERVAL '18 months')::date, TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM004', 'Rafael Lima Demo',     'rafael.lima@ergotech.demo',     (CURRENT_DATE - INTERVAL '1 year')::date,   TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM005', 'Fernanda Costa Demo',  'fernanda.costa@ergotech.demo',  (CURRENT_DATE - INTERVAL '4 years')::date,  TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'DEM006', 'Bruno Martins Demo',   'bruno.martins@ergotech.demo',   (CURRENT_DATE - INTERVAL '5 years')::date,  TRUE);

-- ---------------------------------------------------------------------
-- 7. USUARIO (1) - conta exclusivamente ficticia.
-- ---------------------------------------------------------------------
-- Autenticacao real (Supabase Auth ou equivalente) sera implementada
-- posteriormente. senha_hash abaixo e um placeholder que nao corresponde
-- a nenhuma senha real e nao deve ser usado em producao.
INSERT INTO usuario (id_empresa, id_colaborador, nome, email, senha_hash, perfil, ativo) VALUES
(
    (SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'),
    NULL,
    'Avaliador SST Demo',
    'sst@ergotech.demo',
    'DEMO_HASH_NAO_UTILIZAR_EM_PRODUCAO',
    'SST',
    TRUE
);

-- ---------------------------------------------------------------------
-- 8. PERFIL_ANTROPOMETRICO (4 de 6 colaboradores)
-- ---------------------------------------------------------------------
-- Dados de contexto para o MVP; nao representam interpretacao clinica.
INSERT INTO perfil_antropometrico (id_colaborador, altura_cm, peso_kg, mao_dominante, data_medicao, origem, ativo) VALUES
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM001'), 162.50, 61.00, 'DIREITA',    (CURRENT_DATE - INTERVAL '2 months')::date, 'AUTODECLARADO', TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM002'), 178.00, 82.50, 'DIREITA',    (CURRENT_DATE - INTERVAL '1 month')::date,  'AUTODECLARADO', TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM003'), 168.00, 70.00, 'ESQUERDA',   (CURRENT_DATE - INTERVAL '3 months')::date, 'MEDIDO',         TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM006'), 180.00, 90.00, 'AMBIDESTRO', (CURRENT_DATE - INTERVAL '2 months')::date, 'AUTODECLARADO', TRUE);

-- ---------------------------------------------------------------------
-- 9. COLABORADOR_VINCULO (6) - um vinculo principal vigente por pessoa
-- ---------------------------------------------------------------------
INSERT INTO colaborador_vinculo (id_colaborador, id_setor, id_cargo, data_inicio, data_fim, principal, ativo) VALUES
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM001'), (SELECT id_setor FROM setor WHERE codigo_interno = 'ADM'),  (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ASSIST-ADM'), (CURRENT_DATE - INTERVAL '3 years')::date,   NULL, TRUE, TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM002'), (SELECT id_setor FROM setor WHERE codigo_interno = 'TEC'),  (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-SIS'),    (CURRENT_DATE - INTERVAL '2 years')::date,   NULL, TRUE, TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM003'), (SELECT id_setor FROM setor WHERE codigo_interno = 'PROD'), (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-OP-PROD'),   (CURRENT_DATE - INTERVAL '18 months')::date, NULL, TRUE, TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM004'), (SELECT id_setor FROM setor WHERE codigo_interno = 'LOG'),  (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-AUX-LOG'),   (CURRENT_DATE - INTERVAL '1 year')::date,    NULL, TRUE, TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM005'), (SELECT id_setor FROM setor WHERE codigo_interno = 'ADM'),  (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-ANL-ADM'),   (CURRENT_DATE - INTERVAL '4 years')::date,   NULL, TRUE, TRUE),
((SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM006'), (SELECT id_setor FROM setor WHERE codigo_interno = 'PROD'), (SELECT id_cargo FROM cargo WHERE codigo_interno = 'CARGO-SUP-PROD'),  (CURRENT_DATE - INTERVAL '5 years')::date,   NULL, TRUE, TRUE);

-- ---------------------------------------------------------------------
-- 10. VINCULO_FUNCAO (7) - uma funcao principal vigente por vinculo
-- ---------------------------------------------------------------------
-- Marina recebe uma segunda funcao (nao principal) para demonstrar que um
-- vinculo pode exercer mais de uma funcao ao longo do tempo.
INSERT INTO vinculo_funcao (id_vinculo, id_funcao, data_inicio, data_fim, principal, ativo) VALUES
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM001') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-ATEND'),    (CURRENT_DATE - INTERVAL '3 years')::date,   NULL, TRUE,  TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM001') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    (CURRENT_DATE - INTERVAL '1 year')::date,    NULL, FALSE, TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM002') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DEV'),      (CURRENT_DATE - INTERVAL '2 years')::date,   NULL, TRUE,  TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM003') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-OPMAQ'),    (CURRENT_DATE - INTERVAL '18 months')::date, NULL, TRUE,  TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM004') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-SEPAR'),    (CURRENT_DATE - INTERVAL '1 year')::date,    NULL, TRUE,  TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM005') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    (CURRENT_DATE - INTERVAL '4 years')::date,   NULL, TRUE,  TRUE),
((SELECT id_vinculo FROM colaborador_vinculo WHERE id_colaborador = (SELECT id_colaborador FROM colaborador WHERE matricula = 'DEM006') AND principal = TRUE AND ativo = TRUE AND data_fim IS NULL), (SELECT id_funcao FROM funcao WHERE codigo = 'FN-SUPERV'),   (CURRENT_DATE - INTERVAL '5 years')::date,   NULL, TRUE,  TRUE);

-- ---------------------------------------------------------------------
-- 11. AMBIENTE_TRABALHO (4)
-- ---------------------------------------------------------------------
INSERT INTO ambiente_trabalho (id_setor, codigo, nome, tipo_ambiente, localizacao, descricao, ativo) VALUES
((SELECT id_setor FROM setor WHERE codigo_interno = 'ADM'),  'AMB-ADM-01',  'Escritorio Administrativo', 'Escritorio', 'Predio Administrativo, 1o andar', 'Ambiente de escritorio com estacoes de trabalho administrativas.', TRUE),
((SELECT id_setor FROM setor WHERE codigo_interno = 'TEC'),  'AMB-TEC-01',  'Sala de Tecnologia',        'Escritorio', 'Predio Administrativo, 2o andar', 'Sala destinada as atividades de desenvolvimento e suporte de sistemas.', TRUE),
((SELECT id_setor FROM setor WHERE codigo_interno = 'PROD'), 'AMB-PROD-01', 'Area de Producao',          'Industrial', 'Galpao 1',                        'Area fabril onde ocorrem as atividades de producao.', TRUE),
((SELECT id_setor FROM setor WHERE codigo_interno = 'LOG'),  'AMB-LOG-01',  'Area de Expedicao',         'Industrial', 'Galpao 2',                        'Area destinada a separacao e expedicao de materiais.', TRUE);

-- ---------------------------------------------------------------------
-- 12. POSTO_TRABALHO (7)
-- ---------------------------------------------------------------------
INSERT INTO posto_trabalho (id_ambiente, codigo, nome, tipo_posto, descricao, ativo) VALUES
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Escritorio Administrativo'), 'POSTO-ADM-01',  'Estacao Administrativa 01', 'Estacao de trabalho', 'Estacao com computador para atividades administrativas.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Escritorio Administrativo'), 'POSTO-ADM-02',  'Estacao Administrativa 02', 'Estacao de trabalho', 'Estacao com computador para atividades administrativas.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Sala de Tecnologia'),        'POSTO-TEC-01',  'Estacao Desenvolvimento 01', 'Estacao de trabalho', 'Estacao com dois monitores para desenvolvimento de sistemas.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Area de Producao'),          'POSTO-PROD-01', 'Posto Maquina 01', 'Posto de maquina', 'Posto de operacao de maquina industrial.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Area de Producao'),          'POSTO-PROD-02', 'Posto Inspecao 01', 'Posto de inspecao', 'Posto destinado a inspecao visual de itens produzidos.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Area de Expedicao'),         'POSTO-LOG-01',  'Posto Separacao', 'Posto de separacao', 'Posto destinado a separacao de materiais.', TRUE),
((SELECT id_ambiente FROM ambiente_trabalho WHERE nome = 'Area de Expedicao'),         'POSTO-LOG-02',  'Posto Expedicao', 'Posto de expedicao', 'Posto destinado a conferencia e expedicao de materiais.', TRUE);

-- ---------------------------------------------------------------------
-- 13. ATIVIDADE (10)
-- ---------------------------------------------------------------------
INSERT INTO atividade (id_empresa, codigo, nome, descricao, postura_predominante, ativo) VALUES
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-DIGIT-01',   'Digitacao prolongada',           'Atividade de digitacao continua em computador, executada majoritariamente sentado.', 'SENTADO',   TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-ATEND-01',   'Atendimento ao publico',         'Atendimento presencial ou por telefone a clientes e colaboradores.', 'SENTADO',   TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-DOC-01',     'Analise de documentos',          'Leitura, conferencia e lancamento de informacoes a partir de documentos.', 'SENTADO',   TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-DEV-01',     'Desenvolvimento em computador',  'Desenvolvimento e manutencao de sistemas, com uso intensivo de teclado e mouse.', 'SENTADO',   TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-MAQ-01',     'Operacao de maquina',            'Operacao de equipamento industrial em pe, com uso de comandos manuais.', 'EM_PE',     TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-INSP-01',    'Inspecao visual',                'Inspecao visual de itens produzidos para verificacao de qualidade.', 'EM_PE',     TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-SEP-01',     'Separacao de materiais',         'Separacao e conferencia de materiais para expedicao.', 'EM_PE',     TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-LEV-01',     'Levantamento manual de caixas',  'Levantamento manual de caixas e volumes para movimentacao interna.', 'MOVIMENTO', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-TRANSP-01',  'Transporte manual de materiais', 'Transporte manual de materiais entre pontos do setor de logistica.', 'MOVIMENTO', TRUE),
((SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190'), 'ATV-SUPERV-01',  'Supervisao da operacao',         'Acompanhamento e supervisao das atividades operacionais do setor.', 'ALTERNADO', TRUE);

-- ---------------------------------------------------------------------
-- 14. FUNCAO_ATIVIDADE (12)
-- ---------------------------------------------------------------------
-- tempo_medio_minutos e frequencia_diaria sao valores ficticios de
-- demonstracao, apenas para exercitar os campos do MVP.
INSERT INTO funcao_atividade (id_funcao, id_atividade, principal, tempo_medio_minutos, frequencia_diaria, ativo) VALUES
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-ATEND'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-ATEND-01'),  TRUE,  240, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-DIGIT-01'),  TRUE,  300, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-DIGIT'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-DOC-01'),    FALSE, 90,  1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-DEV'),      (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-DEV-01'),    TRUE,  420, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-MONIT'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-INSP-01'),   TRUE,  120, 4,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-MONIT'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-SUPERV-01'), FALSE, 60,  2,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-OPMAQ'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-MAQ-01'),    TRUE,  360, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-SEPAR'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-SEP-01'),    TRUE,  240, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-SEPAR'),    (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-LEV-01'),    FALSE, 60,  8,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-MOVCARGA'), (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-TRANSP-01'), TRUE,  180, 1,  TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-MOVCARGA'), (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-LEV-01'),    FALSE, 90,  10, TRUE),
((SELECT id_funcao FROM funcao WHERE codigo = 'FN-SUPERV'),   (SELECT id_atividade FROM atividade WHERE codigo = 'ATV-SUPERV-01'), TRUE,  240, 1,  TRUE);

-- =====================================================================
-- BLOCO 2 - QUESTIONARIO DE AVALIACAO
-- =====================================================================
-- As tabelas avaliacao_ergonomica, avaliacao_atividade, resposta_avaliacao
-- e resposta_opcao permanecem vazias: serao preenchidas pelo fluxo real
-- da aplicacao quando uma avaliacao for respondida.
--
-- As perguntas abaixo formam um instrumento introdutorio do MVP. Elas nao
-- diagnosticam doenca, nao afirmam causalidade medica e nao substituem
-- avaliacao profissional de SST.

-- ---------------------------------------------------------------------
-- 15. PERGUNTA_AVALIACAO (20)
-- ---------------------------------------------------------------------
INSERT INTO pergunta_avaliacao (codigo, categoria, texto_pergunta, tipo_resposta, unidade, obrigatoria, ordem, versao, ativo) VALUES
('Q01', 'POSTURA',         'Permanece sentado por periodos prolongados sem se levantar?',                              'BOOLEANO',      NULL, TRUE,  1,  1, TRUE),
('Q02', 'POSTURA',         'E necessario inclinar o tronco com frequencia durante a atividade?',                       'BOOLEANO',      NULL, TRUE,  2,  1, TRUE),
('Q03', 'POSTURA',         'Ha necessidade de manter os bracos elevados acima da linha dos ombros?',                   'BOOLEANO',      NULL, TRUE,  3,  1, TRUE),
('Q04', 'REPETITIVIDADE',  'A atividade exige movimentos repetitivos das maos ou bracos?',                             'BOOLEANO',      NULL, TRUE,  4,  1, TRUE),
('Q05', 'REPETITIVIDADE',  'Com que frequencia os mesmos movimentos sao repetidos ao longo da jornada?',               'ESCALA',        NULL, TRUE,  5,  1, TRUE),
('Q06', 'ESFORCO',         'A atividade exige levantamento manual de cargas?',                                         'BOOLEANO',      NULL, TRUE,  6,  1, TRUE),
('Q07', 'ESFORCO',         'Ha necessidade de aplicacao frequente de forca com as maos ou bracos?',                    'BOOLEANO',      NULL, TRUE,  7,  1, TRUE),
('Q08', 'ESFORCO',         'Com que frequencia voce realiza esforco fisico intenso durante a jornada?',                'ESCALA',        NULL, TRUE,  8,  1, TRUE),
('Q09', 'MOBILIARIO',      'A cadeira utilizada permite ajuste de altura?',                                            'BOOLEANO',      NULL, TRUE,  9,  1, TRUE),
('Q10', 'MOBILIARIO',      'A superficie de trabalho esta em altura adequada para voce?',                              'BOOLEANO',      NULL, TRUE,  10, 1, TRUE),
('Q11', 'MOBILIARIO',      'Como voce avalia o conforto geral do mobiliario utilizado?',                               'ESCOLHA_UNICA', NULL, TRUE,  11, 1, TRUE),
('Q12', 'AMBIENTE',        'O ambiente apresenta condicoes que dificultam a execucao confortavel da atividade (ruido, iluminacao, temperatura)?', 'BOOLEANO', NULL, TRUE, 12, 1, TRUE),
('Q13', 'AMBIENTE',        'Como voce avalia a iluminacao do ambiente de trabalho?',                                   'ESCOLHA_UNICA', NULL, TRUE,  13, 1, TRUE),
('Q14', 'FADIGA',          'Voce percebe aumento de fadiga ao longo da jornada de trabalho?',                          'BOOLEANO',      NULL, TRUE,  14, 1, TRUE),
('Q15', 'FADIGA',          'Com que frequencia sente desconforto apos periodos prolongados de atividade?',             'ESCALA',        NULL, TRUE,  15, 1, TRUE),
('Q16', 'FADIGA',          'Qual a intensidade do desconforto percebido ao final da jornada?',                        'ESCOLHA_UNICA', NULL, TRUE,  16, 1, TRUE),
('Q17', 'ORGANIZACAO',     'Existem pausas programadas durante a jornada de trabalho?',                                'BOOLEANO',      NULL, TRUE,  17, 1, TRUE),
('Q18', 'ORGANIZACAO',     'Ha possibilidade de alternar entre diferentes tarefas ao longo do dia?',                   'BOOLEANO',      NULL, TRUE,  18, 1, TRUE),
('Q19', 'OUTRO',           'Voce ja recebeu orientacao sobre postura adequada para a atividade?',                      'BOOLEANO',      NULL, TRUE,  19, 1, TRUE),
('Q20', 'OUTRO',           'Deseja registrar alguma observacao adicional sobre sua condicao de trabalho?',             'TEXTO',         NULL, FALSE, 20, 1, TRUE);

-- ---------------------------------------------------------------------
-- 16. OPCAO_RESPOSTA (29) - apenas para perguntas ESCALA/ESCOLHA_UNICA
-- ---------------------------------------------------------------------
-- pontuacao_base permanece 0 em todas as opcoes: a pontuacao oficial do
-- risco vem de regra_risco.pontuacao_resultado, evitando dupla contagem.
-- valor_numero registra a posicao ordinal da opcao na escala (0 a N-1).
INSERT INTO opcao_resposta (id_pergunta, codigo, rotulo, valor_numero, pontuacao_base, ordem, ativo) VALUES
-- Q05 - frequencia de movimentos repetitivos
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'NUNCA',          'Nunca',           0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'RARAMENTE',      'Raramente',       1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'AS_VEZES',       'As vezes',        2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'FREQUENTEMENTE', 'Frequentemente',  3, 0, 4, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'SEMPRE',         'Sempre',          4, 0, 5, TRUE),
-- Q08 - frequencia de esforco fisico intenso
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q08'), 'NUNCA',          'Nunca',           0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q08'), 'RARAMENTE',      'Raramente',       1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q08'), 'AS_VEZES',       'As vezes',        2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q08'), 'FREQUENTEMENTE', 'Frequentemente',  3, 0, 4, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q08'), 'SEMPRE',         'Sempre',          4, 0, 5, TRUE),
-- Q11 - conforto do mobiliario
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q11'), 'OTIMO',   'Otimo',   0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q11'), 'BOM',     'Bom',     1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q11'), 'REGULAR', 'Regular', 2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q11'), 'RUIM',    'Ruim',    3, 0, 4, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q11'), 'PESSIMO', 'Pessimo', 4, 0, 5, TRUE),
-- Q13 - iluminacao do ambiente
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'OTIMO',   'Otimo',   0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'BOM',     'Bom',     1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'REGULAR', 'Regular', 2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'RUIM',    'Ruim',    3, 0, 4, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'PESSIMO', 'Pessimo', 4, 0, 5, TRUE),
-- Q15 - frequencia de desconforto pos-atividade
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'NUNCA',          'Nunca',           0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'RARAMENTE',      'Raramente',       1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'AS_VEZES',       'As vezes',        2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'FREQUENTEMENTE', 'Frequentemente',  3, 0, 4, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'SEMPRE',         'Sempre',          4, 0, 5, TRUE),
-- Q16 - intensidade do desconforto ao final da jornada
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16'), 'NENHUM',   'Nenhum',   0, 0, 1, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16'), 'LEVE',     'Leve',     1, 0, 2, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16'), 'MODERADO', 'Moderado', 2, 0, 3, TRUE),
((SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16'), 'INTENSO',  'Intenso',  3, 0, 4, TRUE);

-- =====================================================================
-- BLOCO 3 - MOTOR DE CALCULO E CLASSIFICACAO DE RISCOS
-- =====================================================================
-- avaliacao_risco e avaliacao_risco_regra permanecem vazias: sao
-- preenchidas pelo motor de risco no momento em que uma avaliacao real e
-- calculada.

-- ---------------------------------------------------------------------
-- 17. CLASSIFICACAO_RISCO (4)
-- ---------------------------------------------------------------------
-- Faixas exclusivamente demonstrativas para o MVP.
-- Nao representam protocolo cientifico validado.
-- Devem ser revisadas por profissional de SST/ergonomia antes de uso real.
--
-- As faixas foram calibradas para as pontuacoes maximas efetivamente
-- alcancaveis pelas regras demonstrativas deste seed (ver Bloco 3): a
-- maioria dos riscos atinge no maximo 2 a 4 pontos, e apenas o risco de
-- fadiga ocupacional (RISCO-FAD-01, maximo 5) alcanca a faixa CRITICO.
INSERT INTO classificacao_risco (codigo, nome, pontuacao_min, pontuacao_max, prioridade, cor_hex, descricao, ativo) VALUES
('BAIXO',    'Baixo',    0, 1,    1, '#2ECC71', 'Faixa demonstrativa de risco baixo. Uso exclusivo para o MVP.',    TRUE),
('MODERADO', 'Moderado', 2, 3,    2, '#F1C40F', 'Faixa demonstrativa de risco moderado. Uso exclusivo para o MVP.', TRUE),
('ALTO',     'Alto',     4, 4,    3, '#E67E22', 'Faixa demonstrativa de risco alto. Uso exclusivo para o MVP.',     TRUE),
('CRITICO',  'Critico',  5, NULL, 4, '#E74C3C', 'Faixa demonstrativa de risco critico, sem limite superior. Uso exclusivo para o MVP.', TRUE);

-- ---------------------------------------------------------------------
-- 18. RISCO_ERGONOMICO (7) - fatores de risco, nao diagnosticos
-- ---------------------------------------------------------------------
INSERT INTO risco_ergonomico (codigo, nome, descricao, categoria, ativo) VALUES
('RISCO-POST-01', 'Permanencia prolongada em postura estatica', 'Fator de risco associado a manutencao prolongada da mesma postura durante a jornada de trabalho, sem alternancia ou pausas adequadas.', 'POSTURAL',        TRUE),
('RISCO-POST-02', 'Postura inadequada',                          'Fator de risco associado a adocao de posturas fora dos padroes recomendados, incluindo inclinacao de tronco, elevacao de bracos ou uso de mobiliario nao ajustavel.', 'POSTURAL', TRUE),
('RISCO-REP-01',  'Movimentos repetitivos',                      'Fator de risco associado a repeticao frequente dos mesmos movimentos ao longo da jornada, sem variacao de tarefas.', 'REPETITIVIDADE',   TRUE),
('RISCO-ESF-01',  'Esforco fisico excessivo',                    'Fator de risco associado ao levantamento manual de cargas ou aplicacao frequente de forca durante a atividade.', 'ESFORCO',            TRUE),
('RISCO-FAD-01',  'Fadiga ocupacional',                          'Fator de risco associado ao aumento percebido de cansaco e desconforto ao longo da jornada de trabalho.', 'FADIGA',              TRUE),
('RISCO-ORG-01',  'Organizacao inadequada das pausas',           'Fator de risco associado a ausencia de pausas programadas ou de possibilidade de alternancia entre tarefas ao longo da jornada.', 'ORGANIZACIONAL', TRUE),
('RISCO-AMB-01',  'Condicoes ambientais desfavoraveis',          'Fator de risco associado a condicoes ambientais percebidas como desfavoraveis ao conforto e a execucao da atividade, como iluminacao, ruido ou temperatura.', 'AMBIENTAL', TRUE);

-- ---------------------------------------------------------------------
-- 19. REGRA_RISCO (14)
-- ---------------------------------------------------------------------
-- Todas as regras abaixo sao REGRA DEMONSTRATIVA DO MVP: nao representam
-- metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Servem exclusivamente
-- para demonstrar o funcionamento do motor de calculo de risco.
INSERT INTO regra_risco (id_risco, codigo, nome, descricao, operador_agregacao, pontuacao_resultado, versao, vigencia_inicio, vigencia_fim, fonte_tecnica, ativo) VALUES
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-01'), 'REG-POST-01', 'Permanencia sentado prolongada',  'Regra demonstrativa: pontua o risco de postura estatica quando o colaborador informa permanencia prolongada sentado sem se levantar.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), 'REG-POST-02', 'Inclinacao frequente de tronco',  'Regra demonstrativa: pontua o risco de postura inadequada quando ha necessidade frequente de inclinar o tronco. Reclassificada de RISCO-POST-01 para RISCO-POST-02 por representar melhor um fator de postura inadequada do que de permanencia estatica.', 'AND', 1, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), 'REG-POST-03', 'Bracos elevados com frequencia',  'Regra demonstrativa: pontua o risco de postura inadequada quando ha necessidade de manter os bracos elevados acima da linha dos ombros.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), 'REG-POST-04', 'Cadeira sem ajuste de altura',    'Regra demonstrativa: pontua o risco de postura inadequada quando a cadeira utilizada nao permite ajuste de altura.', 'AND', 1, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-REP-01'),  'REG-REP-01',  'Movimentos repetitivos informados', 'Regra demonstrativa: pontua o risco de movimentos repetitivos quando a atividade exige movimentos repetitivos das maos ou bracos.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-REP-01'),  'REG-REP-02',  'Repeticao frequente ou constante de movimentos', 'Regra demonstrativa: pontua o risco de movimentos repetitivos quando a frequencia informada e FREQUENTEMENTE ou SEMPRE (limiar por valor_numero >= 3), evitando o erro logico de considerar apenas a opcao intermediaria.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ESF-01'),  'REG-ESF-01',  'Levantamento manual de cargas',    'Regra demonstrativa: pontua o risco de esforco fisico quando a atividade exige levantamento manual de cargas.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ESF-01'),  'REG-ESF-02',  'Aplicacao frequente de forca',     'Regra demonstrativa: pontua o risco de esforco fisico quando ha necessidade de aplicacao frequente de forca com as maos ou bracos.', 'AND', 1, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-FAD-01'),  'REG-FAD-01',  'Percepcao de aumento de fadiga',   'Regra demonstrativa: pontua o risco de fadiga ocupacional quando o colaborador percebe aumento de fadiga ao longo da jornada.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-FAD-01'),  'REG-FAD-02',  'Desconforto frequente e intenso',  'Regra demonstrativa: pontua o risco de fadiga ocupacional quando o desconforto pos-atividade e FREQUENTEMENTE ou SEMPRE (limiar por valor_numero >= 3) combinado com intensidade INTENSO (combinacao de duas condicoes por AND).', 'AND', 3, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ORG-01'),  'REG-ORG-01',  'Ausencia de pausas programadas',   'Regra demonstrativa: pontua o risco de organizacao inadequada quando nao existem pausas programadas durante a jornada.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ORG-01'),  'REG-ORG-02',  'Impossibilidade de alternar tarefas', 'Regra demonstrativa: pontua o risco de organizacao inadequada quando nao ha possibilidade de alternar entre diferentes tarefas ao longo do dia.', 'AND', 1, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-AMB-01'),  'REG-AMB-01',  'Condicoes ambientais desfavoraveis percebidas', 'Regra demonstrativa: pontua o risco ambiental quando o colaborador informa que o ambiente apresenta condicoes que dificultam a execucao confortavel da atividade.', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-AMB-01'),  'REG-AMB-02',  'Iluminacao avaliada como inadequada', 'Regra demonstrativa: pontua o risco ambiental quando a iluminacao e avaliada como RUIM ou PESSIMO (limiar por valor_numero >= 3).', 'AND', 2, 1, (CURRENT_DATE - INTERVAL '6 months')::date, NULL, 'REGRA DEMONSTRATIVA DO MVP. Nao representa metodo cientifico validado (RULA/REBA/NIOSH/OCRA). Uso exclusivo para demonstrar o funcionamento do motor de calculo de risco.', TRUE);

-- ---------------------------------------------------------------------
-- 20. REGRA_CONDICAO (15) - id_opcao sempre da mesma id_pergunta da condicao
-- ---------------------------------------------------------------------
-- Cada condicao usa exatamente um valor (id_opcao OU valor_booleano),
-- conforme o tipo de resposta da pergunta associada.
INSERT INTO regra_condicao (id_regra, id_pergunta, operador, id_opcao, valor_texto, valor_numero, valor_booleano, ordem) VALUES
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-POST-01'), (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q01'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-POST-02'), (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q02'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-POST-03'), (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q03'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-POST-04'), (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q09'), 'EQ', NULL, NULL, NULL, FALSE, 1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-REP-01'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q04'), 'EQ', NULL, NULL, NULL, TRUE,  1),
-- GTE 3 cobre FREQUENTEMENTE (valor_numero=3) e SEMPRE (valor_numero=4).
-- usar apenas EQ = FREQUENTEMENTE deixaria SEMPRE fora da regra, o que
-- seria logicamente incoerente (frequencia maxima nao acionando o risco).
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-REP-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q05'), 'GTE', NULL, NULL, 3, NULL, 1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-ESF-01'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q06'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-ESF-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q07'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-FAD-01'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q14'), 'EQ', NULL, NULL, NULL, TRUE,  1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-FAD-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q15'), 'GTE', NULL, NULL, 3, NULL, 1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-FAD-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16'), 'EQ',
    (SELECT id_opcao FROM opcao_resposta WHERE id_pergunta = (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q16') AND codigo = 'INTENSO'), NULL, NULL, NULL, 2),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-ORG-01'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q17'), 'EQ', NULL, NULL, NULL, FALSE, 1);

-- As condicoes de REG-ORG-02 e REG-AMB-01/REG-AMB-02 sao inseridas em
-- separado por clareza, fechando o conjunto de 15 condicoes previsto.
INSERT INTO regra_condicao (id_regra, id_pergunta, operador, id_opcao, valor_texto, valor_numero, valor_booleano, ordem) VALUES
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-ORG-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q18'), 'EQ', NULL, NULL, NULL, FALSE, 1),
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-AMB-01'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q12'), 'EQ', NULL, NULL, NULL, TRUE, 1),
-- GTE 3 cobre RUIM (valor_numero=3) e PESSIMO (valor_numero=4).
((SELECT id_regra FROM regra_risco WHERE codigo = 'REG-AMB-02'),  (SELECT id_pergunta FROM pergunta_avaliacao WHERE codigo = 'Q13'), 'GTE', NULL, NULL, 3, NULL, 1);

-- =====================================================================
-- BLOCO 4 - RECOMENDACOES
-- =====================================================================
-- avaliacao_recomendacao permanece vazia: e um snapshot gerado pela
-- aplicacao no momento em que uma avaliacao real produz recomendacoes.

-- ---------------------------------------------------------------------
-- 21. RECOMENDACAO (10)
-- ---------------------------------------------------------------------
-- Recomendacoes conservadoras e profissionais. Nao sao prescritos tempos
-- fixos de pausa sem protocolo tecnico validado (duracao_minutos e
-- intervalo_minutos permanecem NULL onde essa decisao ainda nao existe).
INSERT INTO recomendacao (codigo, titulo, descricao, tipo, duracao_minutos, intervalo_minutos, prioridade_padrao, fonte_tecnica, requer_validacao, ativo) VALUES
('REC-POST-01',   'Avaliar possibilidade de alternancia postural',                       'Recomenda-se avaliar a possibilidade de alternar a postura ao longo da jornada, conforme viabilidade da atividade e orientacao do profissional responsavel.', 'POSTURA',      NULL, NULL, 'MEDIA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-MOB-01',    'Revisar adequacao do mobiliario ao usuario',                          'Recomenda-se revisar a adequacao do mobiliario (cadeira e superficie de trabalho) as caracteristicas do usuario e da atividade.', 'MOBILIARIO',   NULL, NULL, 'MEDIA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-ORG-01',    'Avaliar organizacao das pausas ao longo da jornada',                  'Recomenda-se avaliar a organizacao das pausas durante a jornada de trabalho, respeitando a legislacao e as normas internas aplicaveis.', 'ORGANIZACAO', NULL, NULL, 'MEDIA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-AJUSTE-01', 'Orientar ajuste da estacao de trabalho',                              'Recomenda-se orientar o colaborador sobre o ajuste adequado da estacao de trabalho, incluindo altura de cadeira e posicionamento de equipamentos.', 'ORIENTACAO', NULL, NULL, 'MEDIA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-REP-01',    'Avaliar redistribuicao de tarefas repetitivas',                       'Recomenda-se avaliar a possibilidade de redistribuir ou alternar tarefas que envolvam movimentos repetitivos ao longo da jornada.', 'ORGANIZACAO', NULL, NULL, 'ALTA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-PROF-01',   'Realizar analise profissional do posto quando identificado risco elevado', 'Recomenda-se que um profissional de SST realize analise presencial do posto de trabalho quando o risco identificado for classificado como Alto ou Critico.', 'ORIENTACAO', NULL, NULL, 'ALTA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-PAUSA-01',  'Avaliar insercao de pausas adicionais conforme protocolo institucional', 'Recomenda-se avaliar, junto ao profissional responsavel, a insercao de pausas adicionais conforme protocolo tecnico validado pela organizacao. Este MVP nao prescreve tempos fixos de pausa.', 'PAUSA', NULL, NULL, 'MEDIA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-MOV-01',    'Avaliar tecnica de movimentacao manual de cargas',                    'Recomenda-se avaliar a tecnica utilizada na movimentacao manual de cargas e a possibilidade de uso de equipamentos auxiliares.', 'MOVIMENTO', NULL, NULL, 'ALTA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE),
('REC-POST-02',   'Orientar sobre postura adequada durante a atividade',                 'Recomenda-se orientacao geral sobre postura adequada durante a execucao da atividade, como reforco educativo.', 'POSTURA', NULL, NULL, 'BAIXA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', FALSE, TRUE),
('REC-AMB-01',    'Avaliar condicoes ambientais do posto de trabalho',                   'Recomenda-se avaliar as condicoes ambientais do posto de trabalho, como iluminacao, ruido e temperatura, quanto ao conforto para a atividade.', 'AMBIENTE', NULL, NULL, 'BAIXA', 'Recomendacao demonstrativa do MVP. Validacao tecnica formal pendente.', TRUE,  TRUE);

-- ---------------------------------------------------------------------
-- 22. RISCO_RECOMENDACAO (17) - relacoes coerentes com cada risco
-- ---------------------------------------------------------------------
-- REGRA DE APLICACAO:
-- REC-PROF-01 somente deve ser apresentada automaticamente quando a
-- classificacao final do risco for ALTO ou CRITICO. A tabela
-- risco_recomendacao nao possui campo para classificacao minima (nao
-- alterado no schema para esta correcao); a filtragem por classificacao
-- sera implementada em recomendacaoService.js.
INSERT INTO risco_recomendacao (id_risco, id_recomendacao, prioridade_sugerida, ativo) VALUES
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-01'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-POST-01'),   'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-01'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-MOB-01'),    'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-01'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-ORG-01'),    'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-POST-02'),   'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-MOB-01'),    'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PROF-01'),   'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-POST-02'), (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-AJUSTE-01'), 'BAIXA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-REP-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-REP-01'),    'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-REP-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PAUSA-01'),  'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ESF-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-MOV-01'),    'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ESF-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PROF-01'),   'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-FAD-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PAUSA-01'),  'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-FAD-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-ORG-01'),    'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ORG-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-ORG-01'),    'ALTA',  TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-ORG-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PAUSA-01'),  'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-AMB-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-AMB-01'),    'MEDIA', TRUE),
((SELECT id_risco FROM risco_ergonomico WHERE codigo = 'RISCO-AMB-01'),  (SELECT id_recomendacao FROM recomendacao WHERE codigo = 'REC-PROF-01'),   'ALTA',  TRUE);

-- =====================================================================
-- BLOCO 5 - FECHAMENTO DO CICLO DE INTERVENCAO
-- =====================================================================
-- plano_acao e acao_plano permanecem vazias nesta versao do seed: serao
-- criadas pela aplicacao a partir de avaliacoes e recomendacoes reais.

-- =====================================================================
-- VALIDACAO CRITICA (RAISE EXCEPTION -> ROLLBACK se falhar)
-- =====================================================================
-- Verifica invariantes estruturais do seed. Qualquer falha aqui aborta a
-- transacao inteira (nada e gravado), evitando que o banco fique em um
-- estado parcialmente populado ou logicamente inconsistente.
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- 1. Exatamente 1 empresa ficticia do seed
    SELECT COUNT(*) INTO v_count FROM empresa WHERE cnpj = '12345678000190';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperada 1 empresa (cnpj 12345678000190), encontrada(s) %', v_count;
    END IF;

    -- 2. Exatamente 4 setores dessa empresa
    SELECT COUNT(*) INTO v_count FROM setor
    WHERE id_empresa = (SELECT id_empresa FROM empresa WHERE cnpj = '12345678000190');
    IF v_count <> 4 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperados 4 setores, encontrado(s) %', v_count;
    END IF;

    -- 3. Exatamente 6 colaboradores do seed
    SELECT COUNT(*) INTO v_count FROM colaborador WHERE matricula LIKE 'DEM%';
    IF v_count <> 6 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperados 6 colaboradores DEM*, encontrado(s) %', v_count;
    END IF;

    -- 4 e 5. Todos os 6 colaboradores possuem exatamente um vinculo
    -- principal ativo e vigente (cobre "nenhum" e "mais de um" ao mesmo
    -- tempo, pois o count esperado e exatamente 1).
    SELECT COUNT(*) INTO v_count
    FROM colaborador c
    WHERE c.matricula LIKE 'DEM%'
      AND (
            SELECT COUNT(*) FROM colaborador_vinculo cv
            WHERE cv.id_colaborador = c.id_colaborador
              AND cv.principal = TRUE AND cv.ativo = TRUE AND cv.data_fim IS NULL
          ) <> 1;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: % colaborador(es) sem exatamente um vinculo principal ativo e vigente', v_count;
    END IF;

    -- 6. Nenhum vinculo possui mais de uma funcao principal ativa e vigente
    SELECT COUNT(*) INTO v_count FROM (
        SELECT id_vinculo FROM vinculo_funcao
        WHERE principal = TRUE AND ativo = TRUE AND data_fim IS NULL
        GROUP BY id_vinculo HAVING COUNT(*) > 1
    ) t;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: % vinculo(s) com mais de uma funcao principal vigente', v_count;
    END IF;

    -- 7. Exatamente 20 perguntas
    SELECT COUNT(*) INTO v_count FROM pergunta_avaliacao;
    IF v_count <> 20 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperadas 20 perguntas, encontrada(s) %', v_count;
    END IF;

    -- 8. pontuacao_base de todas as opcoes do seed = 0 (evita dupla contagem)
    SELECT COUNT(*) INTO v_count FROM opcao_resposta WHERE pontuacao_base <> 0;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: % opcao(oes) com pontuacao_base diferente de 0', v_count;
    END IF;

    -- 9. Existem as 4 classificacoes esperadas
    SELECT COUNT(*) INTO v_count FROM classificacao_risco
    WHERE codigo IN ('BAIXO', 'MODERADO', 'ALTO', 'CRITICO');
    IF v_count <> 4 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperadas 4 classificacoes (BAIXO/MODERADO/ALTO/CRITICO), encontrada(s) %', v_count;
    END IF;

    -- 10. Faixas de classificacao correspondem exatamente ao ajuste desta
    -- correcao, sem sobreposicao: BAIXO 0-1, MODERADO 2-3, ALTO 4-4, CRITICO 5+.
    IF NOT EXISTS (SELECT 1 FROM classificacao_risco WHERE codigo = 'BAIXO'    AND pontuacao_min = 0 AND pontuacao_max = 1)
    OR NOT EXISTS (SELECT 1 FROM classificacao_risco WHERE codigo = 'MODERADO' AND pontuacao_min = 2 AND pontuacao_max = 3)
    OR NOT EXISTS (SELECT 1 FROM classificacao_risco WHERE codigo = 'ALTO'     AND pontuacao_min = 4 AND pontuacao_max = 4)
    OR NOT EXISTS (SELECT 1 FROM classificacao_risco WHERE codigo = 'CRITICO'  AND pontuacao_min = 5 AND pontuacao_max IS NULL)
    THEN
        RAISE EXCEPTION 'Falha na validacao do seed: faixas de classificacao_risco nao correspondem ao esperado (BAIXO 0-1, MODERADO 2-3, ALTO 4-4, CRITICO 5+)';
    END IF;

    -- 11. Exatamente 7 riscos ergonomicos do seed
    SELECT COUNT(*) INTO v_count FROM risco_ergonomico WHERE codigo LIKE 'RISCO-%';
    IF v_count <> 7 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperados 7 riscos ergonomicos, encontrado(s) %', v_count;
    END IF;

    -- 12. RISCO-AMB-01 existe
    IF NOT EXISTS (SELECT 1 FROM risco_ergonomico WHERE codigo = 'RISCO-AMB-01') THEN
        RAISE EXCEPTION 'Falha na validacao do seed: risco RISCO-AMB-01 nao encontrado';
    END IF;

    -- 13. Exatamente 14 regras
    SELECT COUNT(*) INTO v_count FROM regra_risco WHERE codigo LIKE 'REG-%';
    IF v_count <> 14 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperadas 14 regras, encontrada(s) %', v_count;
    END IF;

    -- 14. Exatamente 15 condicoes
    SELECT COUNT(*) INTO v_count FROM regra_condicao;
    IF v_count <> 15 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: esperadas 15 condicoes, encontrada(s) %', v_count;
    END IF;

    -- 15. Toda condicao que usa id_opcao aponta para uma opcao pertencente
    -- a mesma id_pergunta informada na propria condicao.
    SELECT COUNT(*) INTO v_count
    FROM regra_condicao rc
    JOIN opcao_resposta o ON o.id_opcao = rc.id_opcao
    WHERE rc.id_opcao IS NOT NULL AND o.id_pergunta <> rc.id_pergunta;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: % condicao(oes) com id_opcao de pergunta diferente da id_pergunta informada', v_count;
    END IF;

    -- Reforco da correcao 3: nenhuma condicao de escala usa EQ = FREQUENTEMENTE
    -- isoladamente (o erro logico corrigido nesta versao: SEMPRE deve
    -- acionar a mesma regra que FREQUENTEMENTE via GTE >= 3).
    SELECT COUNT(*) INTO v_count
    FROM regra_condicao rc
    JOIN opcao_resposta o ON o.id_opcao = rc.id_opcao
    WHERE rc.operador = 'EQ' AND o.codigo = 'FREQUENTEMENTE';
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Falha na validacao do seed: % condicao(oes) usando EQ = FREQUENTEMENTE isoladamente (deveria usar GTE >= 3 para incluir SEMPRE)', v_count;
    END IF;

    -- 16. REC-AMB-01 associada ao RISCO-AMB-01
    IF NOT EXISTS (
        SELECT 1 FROM risco_recomendacao rr
        JOIN risco_ergonomico r ON r.id_risco = rr.id_risco
        JOIN recomendacao rec ON rec.id_recomendacao = rr.id_recomendacao
        WHERE r.codigo = 'RISCO-AMB-01' AND rec.codigo = 'REC-AMB-01'
    ) THEN
        RAISE EXCEPTION 'Falha na validacao do seed: REC-AMB-01 nao esta associada ao RISCO-AMB-01';
    END IF;

    -- 17. Nenhuma tabela do fluxo real de avaliacao possui registros.
    -- Esta validacao assume banco de desenvolvimento limpo para o seed
    -- inicial; reexecutar este script em um banco ja populado por uma
    -- avaliacao real deve falhar aqui (comportamento esperado).
    IF (SELECT COUNT(*) FROM avaliacao_ergonomica)   <> 0
    OR (SELECT COUNT(*) FROM avaliacao_atividade)    <> 0
    OR (SELECT COUNT(*) FROM resposta_avaliacao)     <> 0
    OR (SELECT COUNT(*) FROM resposta_opcao)         <> 0
    OR (SELECT COUNT(*) FROM avaliacao_risco)        <> 0
    OR (SELECT COUNT(*) FROM avaliacao_risco_regra)  <> 0
    OR (SELECT COUNT(*) FROM avaliacao_recomendacao) <> 0
    OR (SELECT COUNT(*) FROM plano_acao)             <> 0
    OR (SELECT COUNT(*) FROM acao_plano)             <> 0
    THEN
        RAISE EXCEPTION 'Falha na validacao do seed: alguma tabela do fluxo real de avaliacao contem registros (esperado: todas vazias)';
    END IF;

    RAISE NOTICE 'Validacao critica do seed concluida com sucesso: todas as verificacoes passaram.';
END $$;

-- =====================================================================
-- VALIDACAO POS-SEED
-- =====================================================================
-- Conferencia consolidada de volumetria. As tabelas do fluxo real de
-- avaliacao devem aparecer com total 0 (serao preenchidas pela aplicacao).
SELECT * FROM (
    VALUES
        (1,  'empresa',               (SELECT COUNT(*) FROM empresa)),
        (2,  'setor',                 (SELECT COUNT(*) FROM setor)),
        (3,  'cargo',                 (SELECT COUNT(*) FROM cargo)),
        (4,  'funcao',                (SELECT COUNT(*) FROM funcao)),
        (5,  'cargo_funcao',          (SELECT COUNT(*) FROM cargo_funcao)),
        (6,  'colaborador',           (SELECT COUNT(*) FROM colaborador)),
        (7,  'usuario',               (SELECT COUNT(*) FROM usuario)),
        (8,  'perfil_antropometrico', (SELECT COUNT(*) FROM perfil_antropometrico)),
        (9,  'colaborador_vinculo',   (SELECT COUNT(*) FROM colaborador_vinculo)),
        (10, 'vinculo_funcao',        (SELECT COUNT(*) FROM vinculo_funcao)),
        (11, 'ambiente_trabalho',     (SELECT COUNT(*) FROM ambiente_trabalho)),
        (12, 'posto_trabalho',        (SELECT COUNT(*) FROM posto_trabalho)),
        (13, 'atividade',             (SELECT COUNT(*) FROM atividade)),
        (14, 'funcao_atividade',      (SELECT COUNT(*) FROM funcao_atividade)),
        (15, 'pergunta_avaliacao',    (SELECT COUNT(*) FROM pergunta_avaliacao)),
        (16, 'opcao_resposta',        (SELECT COUNT(*) FROM opcao_resposta)),
        (17, 'classificacao_risco',   (SELECT COUNT(*) FROM classificacao_risco)),
        (18, 'risco_ergonomico',      (SELECT COUNT(*) FROM risco_ergonomico)),
        (19, 'regra_risco',           (SELECT COUNT(*) FROM regra_risco)),
        (20, 'regra_condicao',        (SELECT COUNT(*) FROM regra_condicao)),
        (21, 'recomendacao',          (SELECT COUNT(*) FROM recomendacao)),
        (22, 'risco_recomendacao',    (SELECT COUNT(*) FROM risco_recomendacao)),
        (23, 'avaliacao_ergonomica (deve ser 0)',    (SELECT COUNT(*) FROM avaliacao_ergonomica)),
        (24, 'avaliacao_atividade (deve ser 0)',     (SELECT COUNT(*) FROM avaliacao_atividade)),
        (25, 'resposta_avaliacao (deve ser 0)',      (SELECT COUNT(*) FROM resposta_avaliacao)),
        (26, 'resposta_opcao (deve ser 0)',          (SELECT COUNT(*) FROM resposta_opcao)),
        (27, 'avaliacao_risco (deve ser 0)',         (SELECT COUNT(*) FROM avaliacao_risco)),
        (28, 'avaliacao_risco_regra (deve ser 0)',   (SELECT COUNT(*) FROM avaliacao_risco_regra)),
        (29, 'avaliacao_recomendacao (deve ser 0)',  (SELECT COUNT(*) FROM avaliacao_recomendacao)),
        (30, 'plano_acao (deve ser 0)',              (SELECT COUNT(*) FROM plano_acao)),
        (31, 'acao_plano (deve ser 0)',               (SELECT COUNT(*) FROM acao_plano))
) AS resumo_seed (ordem, tabela, total)
ORDER BY ordem;

COMMIT;

