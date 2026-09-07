-- =====================================================================
-- ErgoIntelligence | Seed Demo - Metodologia ERGO-GHE-DEMO 1.0.0 (MVP-08C)
-- =====================================================================
-- Idempotente (INSERT ... WHERE NOT EXISTS). Depende das migrations
-- 001-004 ja aplicadas. NAO depende de nenhum dado de
-- database/demo/02-04 (usa apenas o catalogo tecnico global:
-- pergunta_avaliacao, opcao_resposta, risco_ergonomico - todos
-- resolvidos por CODIGO, nunca por ID hardcoded, para o script continuar
-- valido em qualquer ambiente onde os IDs numericos sejam diferentes).
--
-- !!! METODOLOGIA EXCLUSIVAMENTE DEMONSTRATIVA !!!
-- Os limiares (valor_comparacao), parametros e pontuacoes abaixo sao
-- FICTICIOS - escolhidos apenas para exercitar o pipeline completo do
-- Motor do GHE (metricas -> condicoes -> regras -> pontuacao ->
-- classificacao), nunca deduzidos de literatura cientifica (RULA/REBA/
-- NIOSH/OCRA) ou de qualquer criterio validado. NAO SUBSTITUEM
-- metodologia profissional (ver aviso obrigatorio em
-- docs/mvp08c-metodologia-demo-motor-ghe.md).
--
-- Nenhuma pergunta foi inventada: todas as condicoes abaixo referenciam
-- perguntas e opcoes REALMENTE existentes em pergunta_avaliacao/
-- opcao_resposta (catalogo compartilhado com a avaliacao individual e a
-- coleta do GHE, MVP-07). Nao ha pergunta NUMERICO ativa no catalogo
-- atual - por isso nenhuma regra usa MEDIA_NUMERICA/PERCENTUAL_ACIMA_DE_VALOR
-- nesta seed (ver secao 12/15 do prompt MVP-08C: "nao inventar pergunta
-- so para aumentar cobertura" - a ausencia de regra NUMERICO aqui e
-- deliberada e documentada, nao um esquecimento).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. METODOLOGIA
-- ---------------------------------------------------------------------
INSERT INTO metodologia_risco (codigo, nome, versao, descricao, tipo_contexto, status_validacao, ativo)
SELECT
    'ERGO-GHE-DEMO',
    'Metodologia Demonstrativa ErgoIntelligence — GHE',
    '1.0.0',
    'Configuracao ficticia utilizada exclusivamente para demonstracao das capacidades do Motor de Risco do ErgoIntelligence. Nao representa metodologia cientifica validada (RULA/REBA/NIOSH/OCRA ou equivalente). Limiares, pesos e pontuacoes sao arbitrarios e exigem validacao tecnica de um profissional habilitado antes de qualquer uso alem de demonstracao.',
    'GHE',
    'DEMONSTRATIVA',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM metodologia_risco WHERE codigo = 'ERGO-GHE-DEMO' AND versao = '1.0.0'
);

-- ---------------------------------------------------------------------
-- 2. CLASSIFICACOES (faixas demonstrativas, sem sobreposicao, cobrindo
--    toda a pontuacao possivel: 0-1 / 2-3 / 4-5 / 6+)
-- ---------------------------------------------------------------------
INSERT INTO classificacao_risco_ghe (id_metodologia, codigo, nome, descricao, pontuacao_minima, pontuacao_maxima, prioridade, cor_hex, ativo)
SELECT m.id_metodologia, v.codigo, v.nome, v.descricao, v.pontuacao_minima, v.pontuacao_maxima, v.prioridade, v.cor_hex, TRUE
FROM metodologia_risco m
JOIN (VALUES
    ('BAIXO',    'Baixo',    'Faixa demonstrativa. Uso exclusivo para apresentacao do sistema.', 0::numeric, 1::numeric,    1, '#2ECC71'),
    ('MODERADO', 'Moderado', 'Faixa demonstrativa. Uso exclusivo para apresentacao do sistema.', 2::numeric, 3::numeric,    2, '#F1C40F'),
    ('ALTO',     'Alto',     'Faixa demonstrativa. Uso exclusivo para apresentacao do sistema.', 4::numeric, 5::numeric,    3, '#E67E22'),
    ('CRITICO',  'Crítico',  'Faixa demonstrativa, sem limite superior. Uso exclusivo para apresentacao do sistema.', 6::numeric, NULL::numeric, 4, '#E74C3C')
) AS v(codigo, nome, descricao, pontuacao_minima, pontuacao_maxima, prioridade, cor_hex) ON TRUE
WHERE m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
  AND NOT EXISTS (
      SELECT 1 FROM classificacao_risco_ghe c WHERE c.id_metodologia = m.id_metodologia AND c.codigo = v.codigo
  );

-- ---------------------------------------------------------------------
-- 3. REGRAS (7 regras, 4 riscos, cobrindo BOOLEANO/ESCALA/ESCOLHA_UNICA,
--    AND e OR - ver docs/mvp08c-metodologia-demo-motor-ghe.md para a
--    tabela completa com a justificativa de cada limiar demonstrativo)
-- ---------------------------------------------------------------------
INSERT INTO regra_risco_ghe (id_metodologia, id_risco, codigo, nome, descricao, operador_agregacao, pontuacao_resultado, ativo)
SELECT m.id_metodologia, r.id_risco, v.codigo, v.nome, v.descricao, v.operador_agregacao, v.pontuacao_resultado, TRUE
FROM metodologia_risco m
JOIN (VALUES
    ('RISCO-FAD-01', 'R-DEMO-FAD-01', 'Fadiga percebida com repeticao de desconforto', 'Regra demonstrativa: combina percepcao de fadiga crescente com desconforto relatado como "sempre" presente ao longo da jornada.', 'AND', 4::numeric),
    ('RISCO-FAD-01', 'R-DEMO-FAD-02', 'Desconforto frequente ou intenso ao final da jornada', 'Regra demonstrativa: satisfeita quando o desconforto relatado e "sempre" OU quando a intensidade percebida ao final da jornada e "intenso".', 'OR',  3::numeric),
    ('RISCO-POST-02', 'R-DEMO-POST-01', 'Inclinacao frequente de tronco', 'Regra demonstrativa: pontua quando a maioria relata necessidade frequente de inclinar o tronco.', 'AND', 2::numeric),
    ('RISCO-POST-02', 'R-DEMO-POST-02', 'Mobiliario avaliado como pessimo', 'Regra demonstrativa: pontua quando parcela relevante avalia o conforto do mobiliario como "pessimo".', 'AND', 2::numeric),
    ('RISCO-REP-01',  'R-DEMO-REP-01',  'Movimentos repetitivos informados', 'Regra demonstrativa: pontua quando a maioria informa que a atividade exige movimentos repetitivos.', 'AND', 3::numeric),
    ('RISCO-REP-01',  'R-DEMO-REP-02',  'Repeticao de movimentos relatada como constante', 'Regra demonstrativa: pontua quando parcela relevante relata repetir os mesmos movimentos "sempre".', 'AND', 2::numeric),
    ('RISCO-ORG-01',  'R-DEMO-ORG-01',  'Ausencia de pausas programadas', 'Regra demonstrativa: pontua quando a maioria informa NAO existirem pausas programadas na jornada.', 'AND', 2::numeric)
) AS v(risco_codigo, codigo, nome, descricao, operador_agregacao, pontuacao_resultado) ON TRUE
JOIN risco_ergonomico r ON r.codigo = v.risco_codigo AND r.ativo = TRUE
WHERE m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
  AND NOT EXISTS (
      SELECT 1 FROM regra_risco_ghe x WHERE x.id_metodologia = m.id_metodologia AND x.codigo = v.codigo
  );

-- ---------------------------------------------------------------------
-- 4. CONDICOES (9 condicoes ao todo - todas referenciam perguntas/opcoes
--    REAIS do catalogo, resolvidas por codigo)
-- ---------------------------------------------------------------------

-- R-DEMO-FAD-01 (AND): Q14 PERCENTUAL_TRUE >= 50  AND  Q15 opcao "SEMPRE" PERCENTUAL_OPCAO >= 30
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, o.id_opcao, v.tipo_metrica, NULL, v.operador, v.valor_comparacao, v.ordem, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN (VALUES
    ('R-DEMO-FAD-01', 'Q14', NULL,      'PERCENTUAL_TRUE',  'GTE', 50::numeric, 1),
    ('R-DEMO-FAD-01', 'Q15', 'SEMPRE',  'PERCENTUAL_OPCAO', 'GTE', 30::numeric, 2)
) AS v(regra_codigo, pergunta_codigo, opcao_codigo, tipo_metrica, operador, valor_comparacao, ordem) ON v.regra_codigo = rg.codigo
JOIN pergunta_avaliacao p ON p.codigo = v.pergunta_codigo AND p.ativo = TRUE
LEFT JOIN opcao_resposta o ON o.id_pergunta = p.id_pergunta AND o.codigo = v.opcao_codigo AND o.ativo = TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = v.ordem
);

-- R-DEMO-FAD-02 (OR): Q15 opcao "SEMPRE" PERCENTUAL_OPCAO >= 50  OR  Q16 opcao "PESSIMO" PERCENTUAL_OPCAO >= 30
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, o.id_opcao, v.tipo_metrica, NULL, v.operador, v.valor_comparacao, v.ordem, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN (VALUES
    ('R-DEMO-FAD-02', 'Q15', 'SEMPRE',  'PERCENTUAL_OPCAO', 'GTE', 50::numeric, 1),
    ('R-DEMO-FAD-02', 'Q16', 'INTENSO', 'PERCENTUAL_OPCAO', 'GTE', 30::numeric, 2)
) AS v(regra_codigo, pergunta_codigo, opcao_codigo, tipo_metrica, operador, valor_comparacao, ordem) ON v.regra_codigo = rg.codigo
JOIN pergunta_avaliacao p ON p.codigo = v.pergunta_codigo AND p.ativo = TRUE
LEFT JOIN opcao_resposta o ON o.id_pergunta = p.id_pergunta AND o.codigo = v.opcao_codigo AND o.ativo = TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = v.ordem
);

-- R-DEMO-POST-01 (AND, 1 condicao): Q02 PERCENTUAL_TRUE >= 50
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, NULL, 'PERCENTUAL_TRUE', NULL, 'GTE', 50, 1, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN pergunta_avaliacao p ON p.codigo = 'Q02' AND p.ativo = TRUE
WHERE rg.codigo = 'R-DEMO-POST-01'
  AND NOT EXISTS (SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = 1);

-- R-DEMO-POST-02 (AND, 1 condicao): Q11 opcao "PESSIMO" PERCENTUAL_OPCAO >= 30
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, o.id_opcao, 'PERCENTUAL_OPCAO', NULL, 'GTE', 30, 1, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN pergunta_avaliacao p ON p.codigo = 'Q11' AND p.ativo = TRUE
JOIN opcao_resposta o ON o.id_pergunta = p.id_pergunta AND o.codigo = 'PESSIMO' AND o.ativo = TRUE
WHERE rg.codigo = 'R-DEMO-POST-02'
  AND NOT EXISTS (SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = 1);

-- R-DEMO-REP-01 (AND, 1 condicao): Q04 PERCENTUAL_TRUE >= 50
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, NULL, 'PERCENTUAL_TRUE', NULL, 'GTE', 50, 1, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN pergunta_avaliacao p ON p.codigo = 'Q04' AND p.ativo = TRUE
WHERE rg.codigo = 'R-DEMO-REP-01'
  AND NOT EXISTS (SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = 1);

-- R-DEMO-REP-02 (AND, 1 condicao): Q05 opcao "SEMPRE" PERCENTUAL_OPCAO >= 30
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, o.id_opcao, 'PERCENTUAL_OPCAO', NULL, 'GTE', 30, 1, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN pergunta_avaliacao p ON p.codigo = 'Q05' AND p.ativo = TRUE
JOIN opcao_resposta o ON o.id_pergunta = p.id_pergunta AND o.codigo = 'SEMPRE' AND o.ativo = TRUE
WHERE rg.codigo = 'R-DEMO-REP-02'
  AND NOT EXISTS (SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = 1);

-- R-DEMO-ORG-01 (AND, 1 condicao): Q17 PERCENTUAL_FALSE >= 50 (risco quando a
-- MAIORIA responde que NAO existem pausas programadas - Q17 e formulada
-- de forma positiva, entao o risco usa a metrica do lado FALSE).
INSERT INTO regra_condicao_ghe (id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo)
SELECT rg.id_regra_ghe, p.id_pergunta, NULL, 'PERCENTUAL_FALSE', NULL, 'GTE', 50, 1, TRUE
FROM regra_risco_ghe rg
JOIN metodologia_risco m ON m.id_metodologia = rg.id_metodologia AND m.codigo = 'ERGO-GHE-DEMO' AND m.versao = '1.0.0'
JOIN pergunta_avaliacao p ON p.codigo = 'Q17' AND p.ativo = TRUE
WHERE rg.codigo = 'R-DEMO-ORG-01'
  AND NOT EXISTS (SELECT 1 FROM regra_condicao_ghe c WHERE c.id_regra_ghe = rg.id_regra_ghe AND c.ordem = 1);

COMMIT;
