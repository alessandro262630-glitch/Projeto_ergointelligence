-- =====================================================================
-- ErgoIntelligence | Reset do Ambiente Demo
-- =====================================================================
-- !!! DESTRUTIVO !!! Antes de rodar este arquivo:
--
--   1. Execute e GUARDE o resultado de 00_preflight_demo.sql.
--   2. Garanta que existe um BACKUP/SNAPSHOT do banco (Supabase Dashboard
--      > Database > Backups, ou export manual). Este script NAO cria
--      backup nenhum - so apaga dados.
--   3. Confirme com um humano responsavel que o reset e realmente
--      desejado. NAO existe confirmacao automatica aqui de proposito.
--
-- O que este script FAZ: apaga somente os dados TRANSACIONAIS da empresa
-- demo (avaliacoes individuais, GHEs, planos de amostragem, coletas,
-- planos de acao, colaboradores/vinculos/usuarios fictícios e a propria
-- empresa demo).
--
-- O que este script NUNCA FAZ: apagar catalogos/configuracao tecnica
-- (pergunta_avaliacao, opcao_resposta, risco_ergonomico,
-- classificacao_risco, regra_risco, regra_condicao, recomendacao,
-- risco_recomendacao) - essas tabelas sao compartilhadas por qualquer
-- empresa e nao pertencem a "dados demonstrativos". Tambem nunca usa
-- TRUNCATE ... CASCADE, nunca remove tabelas/constraints/indexes.
--
-- Identifica a empresa demo pela razao_social usada no seed atual
-- ('ErgoTech Solucoes Industriais Ltda.', CNPJ 12345678000190). Ajuste o
-- WHERE abaixo ANTES de rodar se sua empresa demo usar outro nome.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    v_id_empresa BIGINT;
BEGIN
    SELECT id_empresa INTO v_id_empresa
    FROM empresa
    WHERE razao_social = 'ErgoTech Solucoes Industriais Ltda.'
    LIMIT 1;

    IF v_id_empresa IS NULL THEN
        RAISE NOTICE 'Nenhuma empresa demo encontrada com esse identificador - nada foi apagado.';
        RETURN;
    END IF;

    -- MVP-07: coletas e respostas
    DELETE FROM resposta_coleta_opcao WHERE id_resposta_coleta IN (
        SELECT rc.id_resposta_coleta FROM resposta_coleta rc
        JOIN coleta_ghe cg ON cg.id_coleta = rc.id_coleta
        JOIN avaliacao_ghe ag ON ag.id_avaliacao_ghe = cg.id_avaliacao_ghe
        JOIN ghe g ON g.id_ghe = ag.id_ghe
        WHERE g.id_empresa = v_id_empresa
    );
    DELETE FROM resposta_coleta WHERE id_coleta IN (
        SELECT cg.id_coleta FROM coleta_ghe cg
        JOIN avaliacao_ghe ag ON ag.id_avaliacao_ghe = cg.id_avaliacao_ghe
        JOIN ghe g ON g.id_ghe = ag.id_ghe
        WHERE g.id_empresa = v_id_empresa
    );
    DELETE FROM coleta_ghe WHERE id_avaliacao_ghe IN (
        SELECT ag.id_avaliacao_ghe FROM avaliacao_ghe ag
        JOIN ghe g ON g.id_ghe = ag.id_ghe
        WHERE g.id_empresa = v_id_empresa
    );
    DELETE FROM avaliacao_ghe WHERE id_ghe IN (SELECT id_ghe FROM ghe WHERE id_empresa = v_id_empresa);

    -- MVP-06: amostragem e GHEs
    DELETE FROM amostra_participante WHERE id_plano_amostragem IN (
        SELECT pa.id_plano_amostragem FROM plano_amostragem pa
        JOIN ghe g ON g.id_ghe = pa.id_ghe
        WHERE g.id_empresa = v_id_empresa
    );
    DELETE FROM plano_amostragem WHERE id_ghe IN (SELECT id_ghe FROM ghe WHERE id_empresa = v_id_empresa);
    DELETE FROM ghe_cargo WHERE id_ghe IN (SELECT id_ghe FROM ghe WHERE id_empresa = v_id_empresa);
    DELETE FROM ghe WHERE id_empresa = v_id_empresa;

    -- Plano de Acao (FEIRA-04)
    DELETE FROM acao_plano WHERE id_plano IN (
        SELECT pl.id_plano FROM plano_acao pl
        JOIN avaliacao_ergonomica av ON av.id_avaliacao = pl.id_avaliacao
        WHERE av.id_empresa = v_id_empresa
    );
    DELETE FROM plano_acao WHERE id_avaliacao IN (
        SELECT id_avaliacao FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa
    );

    -- Fluxo individual (avaliacao/questionario/risco/recomendacao)
    DELETE FROM avaliacao_recomendacao WHERE id_avaliacao IN (
        SELECT id_avaliacao FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa
    );
    DELETE FROM avaliacao_risco_regra WHERE id_avaliacao_risco IN (
        SELECT ar.id_avaliacao_risco FROM avaliacao_risco ar
        JOIN avaliacao_ergonomica av ON av.id_avaliacao = ar.id_avaliacao
        WHERE av.id_empresa = v_id_empresa
    );
    DELETE FROM avaliacao_risco WHERE id_avaliacao IN (
        SELECT id_avaliacao FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa
    );
    DELETE FROM resposta_opcao WHERE id_resposta IN (
        SELECT ra.id_resposta FROM resposta_avaliacao ra
        JOIN avaliacao_ergonomica av ON av.id_avaliacao = ra.id_avaliacao
        WHERE av.id_empresa = v_id_empresa
    );
    DELETE FROM resposta_avaliacao WHERE id_avaliacao IN (
        SELECT id_avaliacao FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa
    );
    DELETE FROM avaliacao_atividade WHERE id_avaliacao IN (
        SELECT id_avaliacao FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa
    );
    DELETE FROM avaliacao_ergonomica WHERE id_empresa = v_id_empresa;

    -- Estrutura organizacional fictícia
    DELETE FROM vinculo_funcao WHERE id_vinculo IN (
        SELECT cv.id_vinculo FROM colaborador_vinculo cv
        JOIN colaborador c ON c.id_colaborador = cv.id_colaborador
        WHERE c.id_empresa = v_id_empresa
    );
    DELETE FROM colaborador_vinculo WHERE id_colaborador IN (
        SELECT id_colaborador FROM colaborador WHERE id_empresa = v_id_empresa
    );
    DELETE FROM perfil_antropometrico WHERE id_colaborador IN (
        SELECT id_colaborador FROM colaborador WHERE id_empresa = v_id_empresa
    );
    DELETE FROM usuario WHERE id_empresa = v_id_empresa;
    DELETE FROM colaborador WHERE id_empresa = v_id_empresa;
    DELETE FROM funcao_atividade WHERE id_atividade IN (SELECT id_atividade FROM atividade WHERE id_empresa = v_id_empresa);
    DELETE FROM atividade WHERE id_empresa = v_id_empresa;
    DELETE FROM posto_trabalho WHERE id_ambiente IN (SELECT id_ambiente FROM ambiente_trabalho WHERE id_setor IN (SELECT id_setor FROM setor WHERE id_empresa = v_id_empresa));
    DELETE FROM ambiente_trabalho WHERE id_setor IN (SELECT id_setor FROM setor WHERE id_empresa = v_id_empresa);
    DELETE FROM cargo_funcao WHERE id_cargo IN (SELECT id_cargo FROM cargo WHERE id_empresa = v_id_empresa);
    DELETE FROM cargo WHERE id_empresa = v_id_empresa;
    DELETE FROM funcao WHERE id_empresa = v_id_empresa;
    DELETE FROM setor WHERE id_empresa = v_id_empresa;
    DELETE FROM empresa WHERE id_empresa = v_id_empresa;

    RAISE NOTICE 'Reset concluido para id_empresa = %', v_id_empresa;
END $$;

COMMIT;
