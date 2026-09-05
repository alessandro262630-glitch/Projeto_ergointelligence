-- =====================================================================
-- ErgoIntelligence | Preflight do Ambiente Demo
-- =====================================================================
-- SOMENTE LEITURA. Nao modifica nenhum dado.
--
-- Objetivo: registrar o estado do ambiente ANTES de qualquer reset
-- (database/demo/01_reset_demo.sql), para que seja possivel comparar
-- "antes x depois" e confirmar que nada importante foi perdido.
--
-- Rodar no SQL Editor do Supabase e guardar o resultado (print/export)
-- antes de decidir executar o reset.
-- =====================================================================

SELECT 'empresa' AS tabela, COUNT(*) AS total FROM empresa
UNION ALL SELECT 'setor', COUNT(*) FROM setor
UNION ALL SELECT 'cargo', COUNT(*) FROM cargo
UNION ALL SELECT 'colaborador', COUNT(*) FROM colaborador
UNION ALL SELECT 'colaborador_vinculo', COUNT(*) FROM colaborador_vinculo
UNION ALL SELECT 'usuario', COUNT(*) FROM usuario
UNION ALL SELECT 'ghe', COUNT(*) FROM ghe
UNION ALL SELECT 'ghe_cargo', COUNT(*) FROM ghe_cargo
UNION ALL SELECT 'plano_amostragem', COUNT(*) FROM plano_amostragem
UNION ALL SELECT 'amostra_participante', COUNT(*) FROM amostra_participante
UNION ALL SELECT 'avaliacao_ghe', COUNT(*) FROM avaliacao_ghe
UNION ALL SELECT 'coleta_ghe', COUNT(*) FROM coleta_ghe
UNION ALL SELECT 'resposta_coleta', COUNT(*) FROM resposta_coleta
UNION ALL SELECT 'avaliacao_ergonomica', COUNT(*) FROM avaliacao_ergonomica
UNION ALL SELECT 'avaliacao_ergonomica (FINALIZADA)', COUNT(*) FROM avaliacao_ergonomica WHERE status = 'FINALIZADA'
UNION ALL SELECT 'resposta_avaliacao', COUNT(*) FROM resposta_avaliacao
UNION ALL SELECT 'avaliacao_risco', COUNT(*) FROM avaliacao_risco
UNION ALL SELECT 'avaliacao_risco_regra', COUNT(*) FROM avaliacao_risco_regra
UNION ALL SELECT 'avaliacao_recomendacao', COUNT(*) FROM avaliacao_recomendacao
UNION ALL SELECT 'plano_acao', COUNT(*) FROM plano_acao
UNION ALL SELECT 'acao_plano', COUNT(*) FROM acao_plano
ORDER BY tabela;

-- Detalhe dos GHEs e planos de amostragem (a parte mais nova do cenario).
SELECT
    g.id_ghe, g.codigo, g.nome, g.universo, g.ativo,
    pa.id_plano_amostragem, pa.universo_snapshot, pa.amostra_planejada, pa.status AS status_plano,
    (SELECT COUNT(*) FROM amostra_participante ap WHERE ap.id_plano_amostragem = pa.id_plano_amostragem) AS participantes_registrados
FROM ghe g
LEFT JOIN plano_amostragem pa ON pa.id_ghe = g.id_ghe
ORDER BY g.id_ghe, pa.criado_em DESC;

-- Catalogos tecnicos que NUNCA devem ser afetados por um reset de dados
-- demonstrativos (ver database/demo/01_reset_demo.sql).
SELECT 'pergunta_avaliacao' AS catalogo, COUNT(*) AS total FROM pergunta_avaliacao
UNION ALL SELECT 'opcao_resposta', COUNT(*) FROM opcao_resposta
UNION ALL SELECT 'risco_ergonomico', COUNT(*) FROM risco_ergonomico
UNION ALL SELECT 'classificacao_risco', COUNT(*) FROM classificacao_risco
UNION ALL SELECT 'regra_risco', COUNT(*) FROM regra_risco
UNION ALL SELECT 'regra_condicao', COUNT(*) FROM regra_condicao
UNION ALL SELECT 'recomendacao', COUNT(*) FROM recomendacao
UNION ALL SELECT 'risco_recomendacao', COUNT(*) FROM risco_recomendacao
ORDER BY catalogo;
