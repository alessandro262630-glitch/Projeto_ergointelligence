-- =====================================================================
-- ErgoIntelligence | Testes de Integridade do Banco - Fundação do MVP
-- Alvo: PostgreSQL / Supabase
-- IMPORTANTE: este script termina com ROLLBACK e NÃO preserva dados de teste.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE teste_integridade_resultado (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria   VARCHAR(30) NOT NULL,
    teste       TEXT NOT NULL,
    esperado    TEXT NOT NULL,
    resultado   VARCHAR(10) NOT NULL,
    detalhe     TEXT
) ON COMMIT DROP;

DO $$
DECLARE
    v_ok        INTEGER := 0;
    v_falha     INTEGER := 0;
    v_info      INTEGER := 0;
    v_count     INTEGER;
    v_missing   TEXT;

    v_tabelas_esperadas TEXT[] := ARRAY[
        'empresa','setor','cargo','funcao','cargo_funcao','colaborador','usuario',
        'perfil_antropometrico','colaborador_vinculo','vinculo_funcao',
        'ambiente_trabalho','posto_trabalho','atividade','funcao_atividade',
        'avaliacao_ergonomica','avaliacao_atividade','pergunta_avaliacao',
        'opcao_resposta','resposta_avaliacao','resposta_opcao',
        'risco_ergonomico','classificacao_risco','regra_risco','regra_condicao',
        'avaliacao_risco','avaliacao_risco_regra','recomendacao',
        'risco_recomendacao','avaliacao_recomendacao','plano_acao','acao_plano'
    ];

    v_empresa1 BIGINT;
    v_empresa2 BIGINT;
    v_setor1 BIGINT;
    v_setor2 BIGINT;
    v_setor_empresa2 BIGINT;
    v_cargo1 BIGINT;
    v_cargo2 BIGINT;
    v_cargo_empresa2 BIGINT;
    v_funcao1 BIGINT;
    v_funcao2 BIGINT;
    v_funcao_empresa2 BIGINT;
    v_colab1 BIGINT;
    v_colab2 BIGINT;
    v_usuario1 BIGINT;
    v_perfil1 BIGINT;
    v_vinculo1 BIGINT;
    v_vinculo2 BIGINT;
    v_vinculo_funcao1 BIGINT;
    v_vinculo_funcao2 BIGINT;
    v_ambiente1 BIGINT;
    v_ambiente2 BIGINT;
    v_posto1 BIGINT;
    v_posto2 BIGINT;
    v_atividade1 BIGINT;
    v_classificacao1 BIGINT;
    v_avaliacao1 BIGINT;
    v_avaliacao2 BIGINT;
    v_pergunta_bool BIGINT;
    v_pergunta_escolha1 BIGINT;
    v_pergunta_escolha2 BIGINT;
    v_opcao1 BIGINT;
    v_opcao2 BIGINT;
    v_opcao_outra_pergunta BIGINT;
    v_resposta_bool BIGINT;
    v_resposta_escolha BIGINT;
    v_risco1 BIGINT;
    v_risco2 BIGINT;
    v_regra1 BIGINT;
    v_regra2 BIGINT;
    v_avaliacao_risco1 BIGINT;
    v_recomendacao1 BIGINT;
    v_recomendacao2 BIGINT;
    v_avaliacao_recomendacao1 BIGINT;
    v_plano1 BIGINT;
    v_tmp BIGINT;
BEGIN
    -- ================================================================
    -- 0. AUDITORIA ESTRUTURAL
    -- ================================================================

    SELECT COUNT(*)
      INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY(v_tabelas_esperadas);

    SELECT string_agg(t.nome, ', ' ORDER BY t.nome)
      INTO v_missing
      FROM unnest(v_tabelas_esperadas) AS t(nome)
     WHERE NOT EXISTS (
         SELECT 1
           FROM information_schema.tables it
          WHERE it.table_schema = 'public'
            AND it.table_name = t.nome
     );

    IF v_count = 31 THEN
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', '31 tabelas oficiais presentes',
                '31 tabelas encontradas', 'OK', 'Todas as tabelas esperadas existem no schema public.');
        v_ok := v_ok + 1;
    ELSE
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', '31 tabelas oficiais presentes',
                '31 tabelas encontradas', 'FALHA',
                'Encontradas: ' || v_count || '. Ausentes: ' || COALESCE(v_missing, 'nenhuma identificada'));
        v_falha := v_falha + 1;
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND c.contype = 'p'
       AND r.relname = ANY(v_tabelas_esperadas);

    IF v_count = 31 THEN
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', 'Primary Keys',
                '31 PKs', 'OK', 'Todas as tabelas oficiais possuem PK.');
        v_ok := v_ok + 1;
    ELSE
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', 'Primary Keys',
                '31 PKs', 'FALHA', 'Quantidade encontrada: ' || v_count);
        v_falha := v_falha + 1;
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND c.contype = 'f'
       AND r.relname = ANY(v_tabelas_esperadas);

    IF v_count = 54 THEN
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', 'Foreign Keys',
                '54 FKs', 'OK', 'Quantidade de FKs conforme schema aprovado.');
        v_ok := v_ok + 1;
    ELSE
        INSERT INTO teste_integridade_resultado
        VALUES (DEFAULT, 'ESTRUTURA', 'Foreign Keys',
                '54 FKs', 'FALHA', 'Quantidade encontrada: ' || v_count);
        v_falha := v_falha + 1;
    END IF;

    -- ================================================================
    -- 1. CENÁRIO VÁLIDO COMPLETO
    -- Se este bloco falhar, há problema crítico no fluxo principal.
    -- ================================================================

    INSERT INTO empresa
        (razao_social, nome_fantasia, cnpj, email, telefone)
    VALUES
        ('Empresa Teste Integridade A Ltda', 'Empresa Teste A',
         '11111111111111', 'empresa-a@teste.local', '92999990001')
    RETURNING id_empresa INTO v_empresa1;

    INSERT INTO empresa
        (razao_social, nome_fantasia, cnpj, email)
    VALUES
        ('Empresa Teste Integridade B Ltda', 'Empresa Teste B',
         '22222222222222', 'empresa-b@teste.local')
    RETURNING id_empresa INTO v_empresa2;

    INSERT INTO setor (id_empresa, codigo_interno, nome)
    VALUES (v_empresa1, 'TST-ADM', 'Administrativo Teste')
    RETURNING id_setor INTO v_setor1;

    INSERT INTO setor (id_empresa, codigo_interno, nome)
    VALUES (v_empresa1, 'TST-PROD', 'Produção Teste')
    RETURNING id_setor INTO v_setor2;

    INSERT INTO setor (id_empresa, codigo_interno, nome)
    VALUES (v_empresa2, 'TST-B-ADM', 'Administrativo Empresa B')
    RETURNING id_setor INTO v_setor_empresa2;

    INSERT INTO cargo (id_empresa, codigo_interno, nome)
    VALUES (v_empresa1, 'TST-CARGO-1', 'Analista Teste')
    RETURNING id_cargo INTO v_cargo1;

    INSERT INTO cargo (id_empresa, codigo_interno, nome)
    VALUES (v_empresa1, 'TST-CARGO-2', 'Supervisor Teste')
    RETURNING id_cargo INTO v_cargo2;

    INSERT INTO cargo (id_empresa, codigo_interno, nome)
    VALUES (v_empresa2, 'TST-B-CARGO', 'Cargo Empresa B')
    RETURNING id_cargo INTO v_cargo_empresa2;

    INSERT INTO funcao (id_empresa, codigo, nome)
    VALUES (v_empresa1, 'TST-F1', 'Atividade Administrativa Teste')
    RETURNING id_funcao INTO v_funcao1;

    INSERT INTO funcao (id_empresa, codigo, nome)
    VALUES (v_empresa1, 'TST-F2', 'Função Alternativa Teste')
    RETURNING id_funcao INTO v_funcao2;

    INSERT INTO funcao (id_empresa, codigo, nome)
    VALUES (v_empresa2, 'TST-B-F1', 'Função Empresa B')
    RETURNING id_funcao INTO v_funcao_empresa2;

    INSERT INTO cargo_funcao (id_cargo, id_funcao, principal_padrao)
    VALUES (v_cargo1, v_funcao1, TRUE);

    INSERT INTO cargo_funcao (id_cargo, id_funcao, principal_padrao)
    VALUES (v_cargo1, v_funcao2, FALSE);

    INSERT INTO colaborador
        (id_empresa, matricula, nome, email, data_admissao)
    VALUES
        (v_empresa1, 'TST-COL-001', 'Colaborador Teste 1',
         'colab1@teste.local', CURRENT_DATE - 100)
    RETURNING id_colaborador INTO v_colab1;

    INSERT INTO colaborador
        (id_empresa, matricula, nome, email, data_admissao)
    VALUES
        (v_empresa1, 'TST-COL-002', 'Colaborador Teste 2',
         'colab2@teste.local', CURRENT_DATE - 50)
    RETURNING id_colaborador INTO v_colab2;

    INSERT INTO usuario
        (id_empresa, id_colaborador, nome, email, senha_hash, perfil)
    VALUES
        (v_empresa1, v_colab1, 'Avaliador Teste',
         'avaliador@teste.local', 'hash_teste_nao_real', 'SST')
    RETURNING id_usuario INTO v_usuario1;

    INSERT INTO perfil_antropometrico
        (id_colaborador, altura_cm, peso_kg, mao_dominante, data_medicao, origem)
    VALUES
        (v_colab1, 175.00, 78.50, 'DIREITA', CURRENT_DATE, 'AUTODECLARADO')
    RETURNING id_perfil_antropometrico INTO v_perfil1;

    INSERT INTO colaborador_vinculo
        (id_colaborador, id_setor, id_cargo, data_inicio, principal)
    VALUES
        (v_colab1, v_setor1, v_cargo1, CURRENT_DATE - 100, TRUE)
    RETURNING id_vinculo INTO v_vinculo1;

    INSERT INTO colaborador_vinculo
        (id_colaborador, id_setor, id_cargo, data_inicio, principal)
    VALUES
        (v_colab2, v_setor1, v_cargo1, CURRENT_DATE - 50, TRUE)
    RETURNING id_vinculo INTO v_vinculo2;

    INSERT INTO vinculo_funcao
        (id_vinculo, id_funcao, data_inicio, principal)
    VALUES
        (v_vinculo1, v_funcao1, CURRENT_DATE - 100, TRUE)
    RETURNING id_vinculo_funcao INTO v_vinculo_funcao1;

    INSERT INTO vinculo_funcao
        (id_vinculo, id_funcao, data_inicio, principal)
    VALUES
        (v_vinculo2, v_funcao1, CURRENT_DATE - 50, TRUE)
    RETURNING id_vinculo_funcao INTO v_vinculo_funcao2;

    INSERT INTO ambiente_trabalho
        (id_setor, codigo, nome, tipo_ambiente)
    VALUES
        (v_setor1, 'TST-AMB-1', 'Escritório Teste 1', 'ESCRITORIO')
    RETURNING id_ambiente INTO v_ambiente1;

    INSERT INTO ambiente_trabalho
        (id_setor, codigo, nome, tipo_ambiente)
    VALUES
        (v_setor1, 'TST-AMB-2', 'Escritório Teste 2', 'ESCRITORIO')
    RETURNING id_ambiente INTO v_ambiente2;

    INSERT INTO posto_trabalho
        (id_ambiente, codigo, nome, tipo_posto)
    VALUES
        (v_ambiente1, 'TST-POSTO-1', 'Estação Teste 1', 'ESTACAO')
    RETURNING id_posto INTO v_posto1;

    INSERT INTO posto_trabalho
        (id_ambiente, codigo, nome, tipo_posto)
    VALUES
        (v_ambiente2, 'TST-POSTO-2', 'Estação Teste 2', 'ESTACAO')
    RETURNING id_posto INTO v_posto2;

    INSERT INTO atividade
        (id_empresa, codigo, nome, descricao, postura_predominante)
    VALUES
        (v_empresa1, 'TST-ATV-1', 'Digitação Teste',
         'Atividade fictícia utilizada no teste de integridade.', 'SENTADO')
    RETURNING id_atividade INTO v_atividade1;

    INSERT INTO funcao_atividade
        (id_funcao, id_atividade, principal, tempo_medio_minutos, frequencia_diaria)
    VALUES
        (v_funcao1, v_atividade1, TRUE, 120, 2);

    INSERT INTO classificacao_risco
        (codigo, nome, pontuacao_min, pontuacao_max, prioridade, cor_hex, descricao)
    VALUES
        ('TST-BAIXO', 'Baixo Teste', 0, 3, 1, '#00AA00', 'Classificação fictícia para teste.')
    RETURNING id_classificacao INTO v_classificacao1;

    INSERT INTO pergunta_avaliacao
        (codigo, categoria, texto_pergunta, tipo_resposta, obrigatoria, ordem)
    VALUES
        ('TST-P-BOL', 'POSTURA', 'Pergunta booleana de teste?', 'BOOLEANO', TRUE, 1)
    RETURNING id_pergunta INTO v_pergunta_bool;

    INSERT INTO pergunta_avaliacao
        (codigo, categoria, texto_pergunta, tipo_resposta, obrigatoria, ordem)
    VALUES
        ('TST-P-ESC-1', 'POSTURA', 'Pergunta de escolha 1?', 'ESCOLHA_UNICA', TRUE, 2)
    RETURNING id_pergunta INTO v_pergunta_escolha1;

    INSERT INTO pergunta_avaliacao
        (codigo, categoria, texto_pergunta, tipo_resposta, obrigatoria, ordem)
    VALUES
        ('TST-P-ESC-2', 'FADIGA', 'Pergunta de escolha 2?', 'ESCOLHA_UNICA', TRUE, 3)
    RETURNING id_pergunta INTO v_pergunta_escolha2;

    INSERT INTO opcao_resposta
        (id_pergunta, codigo, rotulo, valor_numero, pontuacao_base, ordem)
    VALUES
        (v_pergunta_escolha1, 'SIM', 'Sim', 1, 0, 1)
    RETURNING id_opcao INTO v_opcao1;

    INSERT INTO opcao_resposta
        (id_pergunta, codigo, rotulo, valor_numero, pontuacao_base, ordem)
    VALUES
        (v_pergunta_escolha1, 'NAO', 'Não', 0, 0, 2)
    RETURNING id_opcao INTO v_opcao2;

    INSERT INTO opcao_resposta
        (id_pergunta, codigo, rotulo, valor_numero, pontuacao_base, ordem)
    VALUES
        (v_pergunta_escolha2, 'ALTO', 'Alto', 3, 0, 1)
    RETURNING id_opcao INTO v_opcao_outra_pergunta;

    INSERT INTO avaliacao_ergonomica
        (id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente, id_posto,
         id_perfil_antropometrico, id_avaliador, tipo_avaliacao, status,
         data_avaliacao, id_classificacao_geral, versao_motor_regras)
    VALUES
        (v_empresa1, v_vinculo1, v_vinculo_funcao1, v_ambiente1, v_posto1,
         v_perfil1, v_usuario1, 'INICIAL', 'EM_ANDAMENTO',
         NOW(), v_classificacao1, 'TST-1.0')
    RETURNING id_avaliacao INTO v_avaliacao1;

    INSERT INTO avaliacao_ergonomica
        (id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente, id_posto,
         id_avaliador, tipo_avaliacao, status, data_avaliacao)
    VALUES
        (v_empresa1, v_vinculo2, v_vinculo_funcao2, v_ambiente1, v_posto1,
         v_usuario1, 'INICIAL', 'RASCUNHO', NOW())
    RETURNING id_avaliacao INTO v_avaliacao2;

    INSERT INTO avaliacao_atividade
        (id_avaliacao, id_atividade, principal, tempo_exposicao_minutos, frequencia_diaria)
    VALUES
        (v_avaliacao1, v_atividade1, TRUE, 120, 2);

    INSERT INTO resposta_avaliacao
        (id_avaliacao, id_pergunta, resposta_booleano, pontuacao_calculada)
    VALUES
        (v_avaliacao1, v_pergunta_bool, TRUE, 0)
    RETURNING id_resposta INTO v_resposta_bool;

    INSERT INTO resposta_avaliacao
        (id_avaliacao, id_pergunta, pontuacao_calculada)
    VALUES
        (v_avaliacao1, v_pergunta_escolha1, 0)
    RETURNING id_resposta INTO v_resposta_escolha;

    INSERT INTO resposta_opcao (id_resposta, id_opcao)
    VALUES (v_resposta_escolha, v_opcao1);

    INSERT INTO risco_ergonomico
        (codigo, nome, descricao, categoria)
    VALUES
        ('TST-RISCO-1', 'Risco Postural Teste',
         'Risco fictício para teste.', 'POSTURAL')
    RETURNING id_risco INTO v_risco1;

    INSERT INTO risco_ergonomico
        (codigo, nome, descricao, categoria)
    VALUES
        ('TST-RISCO-2', 'Risco Fadiga Teste',
         'Segundo risco fictício para teste.', 'FADIGA')
    RETURNING id_risco INTO v_risco2;

    INSERT INTO regra_risco
        (id_risco, codigo, nome, descricao, operador_agregacao,
         pontuacao_resultado, versao, vigencia_inicio)
    VALUES
        (v_risco1, 'TST-REGRA-1', 'Regra Teste 1',
         'Regra fictícia para teste.', 'AND', 2, 1, CURRENT_DATE)
    RETURNING id_regra INTO v_regra1;

    INSERT INTO regra_risco
        (id_risco, codigo, nome, descricao, operador_agregacao,
         pontuacao_resultado, versao, vigencia_inicio)
    VALUES
        (v_risco2, 'TST-REGRA-2', 'Regra Teste 2',
         'Regra fictícia para teste.', 'AND', 1, 1, CURRENT_DATE)
    RETURNING id_regra INTO v_regra2;

    INSERT INTO regra_condicao
        (id_regra, id_pergunta, operador, id_opcao, ordem)
    VALUES
        (v_regra1, v_pergunta_escolha1, 'EQ', v_opcao1, 1);

    INSERT INTO avaliacao_risco
        (id_avaliacao, id_risco, id_classificacao, pontuacao, justificativa, versao_motor_regras)
    VALUES
        (v_avaliacao1, v_risco1, v_classificacao1, 2,
         'Resultado fictício para teste.', 'TST-1.0')
    RETURNING id_avaliacao_risco INTO v_avaliacao_risco1;

    INSERT INTO avaliacao_risco_regra
        (id_avaliacao_risco, id_regra, satisfeita, pontuacao_aplicada)
    VALUES
        (v_avaliacao_risco1, v_regra1, TRUE, 2);

    INSERT INTO recomendacao
        (codigo, titulo, descricao, tipo, prioridade_padrao, requer_validacao)
    VALUES
        ('TST-REC-1', 'Alternar postura - teste',
         'Recomendação fictícia para teste.', 'POSTURA', 'MEDIA', TRUE)
    RETURNING id_recomendacao INTO v_recomendacao1;

    INSERT INTO recomendacao
        (codigo, titulo, descricao, tipo, prioridade_padrao, requer_validacao)
    VALUES
        ('TST-REC-2', 'Recomendação secundária - teste',
         'Segunda recomendação fictícia.', 'ORIENTACAO', 'BAIXA', FALSE)
    RETURNING id_recomendacao INTO v_recomendacao2;

    INSERT INTO risco_recomendacao
        (id_risco, id_recomendacao, prioridade_sugerida)
    VALUES
        (v_risco1, v_recomendacao1, 'MEDIA');

    INSERT INTO avaliacao_recomendacao
        (id_avaliacao, id_avaliacao_risco, id_recomendacao,
         prioridade, origem, status)
    VALUES
        (v_avaliacao1, v_avaliacao_risco1, v_recomendacao1,
         'MEDIA', 'REGRA', 'SUGERIDA')
    RETURNING id_avaliacao_recomendacao INTO v_avaliacao_recomendacao1;

    INSERT INTO plano_acao
        (id_avaliacao, titulo, descricao, status, criado_por, data_inicio, data_alvo)
    VALUES
        (v_avaliacao1, 'Plano Teste', 'Plano fictício para teste.',
         'ABERTO', v_usuario1, CURRENT_DATE, CURRENT_DATE + 30)
    RETURNING id_plano INTO v_plano1;

    INSERT INTO acao_plano
        (id_plano, id_avaliacao_recomendacao, id_responsavel,
         descricao, prioridade, prazo, status)
    VALUES
        (v_plano1, v_avaliacao_recomendacao1, v_usuario1,
         'Executar ação fictícia.', 'MEDIA', CURRENT_DATE + 10, 'ABERTA');

    INSERT INTO teste_integridade_resultado
    VALUES (DEFAULT, 'FLUXO_VALIDO', 'Cenário válido ponta a ponta',
            'Todos os INSERTs devem funcionar', 'OK',
            'Empresa → estrutura → colaborador → avaliação → respostas → risco → recomendação → plano.');
    v_ok := v_ok + 1;

    -- ================================================================
    -- 2. TESTES DE CONSTRAINTS / INTEGRIDADE
    -- Cada erro abaixo é ESPERADO e é capturado individualmente.
    -- ================================================================

    -- 2.1 NOT NULL
    BEGIN
        INSERT INTO empresa (razao_social, cnpj)
        VALUES (NULL, '33333333333333');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'NOT_NULL', 'empresa.razao_social obrigatório', 'not_null_violation', 'FALHA', 'Banco aceitou NULL.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN not_null_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'NOT_NULL', 'empresa.razao_social obrigatório', 'not_null_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'NOT_NULL', 'empresa.razao_social obrigatório', 'not_null_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.2 CNPJ formato
    BEGIN
        INSERT INTO empresa (razao_social, cnpj)
        VALUES ('Empresa CNPJ Inválido', '123');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Formato do CNPJ', 'check_violation', 'FALHA', 'Banco aceitou CNPJ fora de 14 dígitos.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Formato do CNPJ', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Formato do CNPJ', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.3 CNPJ duplicado
    BEGIN
        INSERT INTO empresa (razao_social, cnpj)
        VALUES ('Empresa Duplicada', '11111111111111');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'CNPJ único', 'unique_violation', 'FALHA', 'Banco aceitou CNPJ duplicado.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'CNPJ único', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'CNPJ único', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.4 FK setor -> empresa
    BEGIN
        INSERT INTO setor (id_empresa, codigo_interno, nome)
        VALUES (999999999999, 'TST-FK', 'Setor FK Inválida');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'FK', 'setor.id_empresa', 'foreign_key_violation', 'FALHA', 'Banco aceitou empresa inexistente.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN foreign_key_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'FK', 'setor.id_empresa', 'foreign_key_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'FK', 'setor.id_empresa', 'foreign_key_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.5 Setor código duplicado na mesma empresa
    BEGIN
        INSERT INTO setor (id_empresa, codigo_interno, nome)
        VALUES (v_empresa1, 'TST-ADM', 'Outro Administrativo');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'Código interno do setor por empresa', 'unique_violation', 'FALHA', 'Banco aceitou código duplicado.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Código interno do setor por empresa', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Código interno do setor por empresa', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.6 Associativa cargo_funcao duplicada
    BEGIN
        INSERT INTO cargo_funcao (id_cargo, id_funcao)
        VALUES (v_cargo1, v_funcao1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'cargo_funcao sem duplicidade', 'unique_violation', 'FALHA', 'Banco aceitou associação duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'cargo_funcao sem duplicidade', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'cargo_funcao sem duplicidade', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.7 Matrícula duplicada na mesma empresa
    BEGIN
        INSERT INTO colaborador (id_empresa, matricula, nome)
        VALUES (v_empresa1, 'TST-COL-001', 'Duplicado');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'Matrícula por empresa', 'unique_violation', 'FALHA', 'Banco aceitou matrícula duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Matrícula por empresa', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Matrícula por empresa', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.8 Data de admissão futura
    BEGIN
        INSERT INTO colaborador (id_empresa, matricula, nome, data_admissao)
        VALUES (v_empresa1, 'TST-COL-FUT', 'Data futura', CURRENT_DATE + 1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Data de admissão', 'check_violation', 'FALHA', 'Banco aceitou data de admissão futura.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Data de admissão', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Data de admissão', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.9 Altura negativa
    BEGIN
        INSERT INTO perfil_antropometrico
            (id_colaborador, altura_cm, data_medicao, origem)
        VALUES
            (v_colab1, -10, CURRENT_DATE, 'MEDIDO');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Altura > 0', 'check_violation', 'FALHA', 'Banco aceitou altura negativa.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Altura > 0', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Altura > 0', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.10 Mão dominante inválida
    BEGIN
        INSERT INTO perfil_antropometrico
            (id_colaborador, mao_dominante, data_medicao, origem)
        VALUES
            (v_colab1, 'INVALIDA', CURRENT_DATE, 'MEDIDO');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Domínio mao_dominante', 'check_violation', 'FALHA', 'Banco aceitou valor inválido.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio mao_dominante', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio mao_dominante', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.11 Datas de vínculo inválidas
    BEGIN
        INSERT INTO colaborador_vinculo
            (id_colaborador, id_setor, id_cargo, data_inicio, data_fim, principal)
        VALUES
            (v_colab2, v_setor2, v_cargo2, CURRENT_DATE, CURRENT_DATE - 1, FALSE);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Período colaborador_vinculo', 'check_violation', 'FALHA', 'Banco aceitou data_fim < data_inicio.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Período colaborador_vinculo', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Período colaborador_vinculo', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.12 Apenas um vínculo principal vigente por colaborador
    BEGIN
        INSERT INTO colaborador_vinculo
            (id_colaborador, id_setor, id_cargo, data_inicio, principal, ativo)
        VALUES
            (v_colab1, v_setor2, v_cargo2, CURRENT_DATE, TRUE, TRUE);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE_PARCIAL', 'Um vínculo principal vigente', 'unique_violation', 'FALHA', 'Banco aceitou segundo vínculo principal ativo.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE_PARCIAL', 'Um vínculo principal vigente', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE_PARCIAL', 'Um vínculo principal vigente', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.13 Apenas uma função principal vigente por vínculo
    BEGIN
        INSERT INTO vinculo_funcao
            (id_vinculo, id_funcao, data_inicio, principal, ativo)
        VALUES
            (v_vinculo1, v_funcao2, CURRENT_DATE, TRUE, TRUE);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE_PARCIAL', 'Uma função principal vigente', 'unique_violation', 'FALHA', 'Banco aceitou segunda função principal ativa.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE_PARCIAL', 'Uma função principal vigente', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE_PARCIAL', 'Uma função principal vigente', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.14 Postura predominante inválida
    BEGIN
        INSERT INTO atividade
            (id_empresa, codigo, nome, descricao, postura_predominante)
        VALUES
            (v_empresa1, 'TST-ATV-INV', 'Atividade Inválida', 'Teste', 'DEITADO');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Domínio postura_predominante', 'check_violation', 'FALHA', 'Banco aceitou postura inválida.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio postura_predominante', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio postura_predominante', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.15 funcao_atividade duplicada
    BEGIN
        INSERT INTO funcao_atividade (id_funcao, id_atividade)
        VALUES (v_funcao1, v_atividade1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'funcao_atividade sem duplicidade', 'unique_violation', 'FALHA', 'Banco aceitou associação duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'funcao_atividade sem duplicidade', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'funcao_atividade sem duplicidade', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.16 Tipo de avaliação inválido
    BEGIN
        INSERT INTO avaliacao_ergonomica
            (id_empresa, id_vinculo, id_ambiente, id_avaliador,
             tipo_avaliacao, status, data_avaliacao)
        VALUES
            (v_empresa1, v_vinculo1, v_ambiente1, v_usuario1,
             'TIPO_INVALIDO', 'RASCUNHO', NOW());
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Domínio tipo_avaliacao', 'check_violation', 'FALHA', 'Banco aceitou tipo inválido.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio tipo_avaliacao', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio tipo_avaliacao', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.17 FINALIZADA exige data_finalizacao
    BEGIN
        INSERT INTO avaliacao_ergonomica
            (id_empresa, id_vinculo, id_ambiente, id_avaliador,
             tipo_avaliacao, status, data_avaliacao)
        VALUES
            (v_empresa1, v_vinculo1, v_ambiente1, v_usuario1,
             'INICIAL', 'FINALIZADA', NOW());
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'FINALIZADA exige data_finalizacao', 'check_violation', 'FALHA', 'Banco aceitou finalizada sem data.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'FINALIZADA exige data_finalizacao', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'FINALIZADA exige data_finalizacao', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.18 Resposta não pode preencher dois escalares simultaneamente
    BEGIN
        INSERT INTO resposta_avaliacao
            (id_avaliacao, id_pergunta, resposta_texto, resposta_numero)
        VALUES
            (v_avaliacao2, v_pergunta_bool, 'sim', 1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Resposta escalar única', 'check_violation', 'FALHA', 'Banco aceitou texto + número simultaneamente.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Resposta escalar única', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Resposta escalar única', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.19 Uma resposta por avaliação/pergunta
    BEGIN
        INSERT INTO resposta_avaliacao
            (id_avaliacao, id_pergunta, resposta_booleano)
        VALUES
            (v_avaliacao1, v_pergunta_bool, FALSE);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'Uma resposta por avaliação/pergunta', 'unique_violation', 'FALHA', 'Banco aceitou resposta duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Uma resposta por avaliação/pergunta', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Uma resposta por avaliação/pergunta', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.20 resposta_opcao duplicada
    BEGIN
        INSERT INTO resposta_opcao (id_resposta, id_opcao)
        VALUES (v_resposta_escolha, v_opcao1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'resposta_opcao sem duplicidade', 'unique_violation', 'FALHA', 'Banco aceitou opção repetida.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'resposta_opcao sem duplicidade', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'resposta_opcao sem duplicidade', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.21 Categoria de risco inválida
    BEGIN
        INSERT INTO risco_ergonomico (codigo, nome, descricao, categoria)
        VALUES ('TST-R-INV', 'Inválido', 'Teste', 'INVALIDA');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Domínio categoria de risco', 'check_violation', 'FALHA', 'Banco aceitou categoria inválida.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio categoria de risco', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio categoria de risco', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.22 Faixa de classificação inválida
    BEGIN
        INSERT INTO classificacao_risco
            (codigo, nome, pontuacao_min, pontuacao_max, prioridade)
        VALUES
            ('TST-CLASS-INV', 'Class Inválida', 10, 5, 1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'pontuacao_max >= pontuacao_min', 'check_violation', 'FALHA', 'Banco aceitou faixa invertida.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'pontuacao_max >= pontuacao_min', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'pontuacao_max >= pontuacao_min', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.23 Cor hexadecimal inválida
    BEGIN
        INSERT INTO classificacao_risco
            (codigo, nome, pontuacao_min, pontuacao_max, prioridade, cor_hex)
        VALUES
            ('TST-COR-INV', 'Cor Inválida', 20, 30, 9, 'VERDE!!');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Formato cor_hex', 'check_violation', 'FALHA', 'Banco aceitou cor inválida.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Formato cor_hex', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Formato cor_hex', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.24 Operador de agregação inválido
    BEGIN
        INSERT INTO regra_risco
            (id_risco, codigo, nome, descricao, operador_agregacao,
             pontuacao_resultado, versao, vigencia_inicio)
        VALUES
            (v_risco1, 'TST-REGRA-INV', 'Inválida', 'Teste', 'XOR', 1, 1, CURRENT_DATE);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'operador_agregacao AND/OR', 'check_violation', 'FALHA', 'Banco aceitou XOR.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'operador_agregacao AND/OR', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'operador_agregacao AND/OR', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.25 regra_condicao exige exatamente um valor
    BEGIN
        INSERT INTO regra_condicao
            (id_regra, id_pergunta, operador, ordem)
        VALUES
            (v_regra1, v_pergunta_escolha1, 'EQ', 90);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'regra_condicao com exatamente um valor', 'check_violation', 'FALHA', 'Banco aceitou condição sem valor.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'regra_condicao com exatamente um valor', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'regra_condicao com exatamente um valor', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.26 regra_condicao não aceita dois valores ao mesmo tempo
    BEGIN
        INSERT INTO regra_condicao
            (id_regra, id_pergunta, operador, id_opcao, valor_numero, ordem)
        VALUES
            (v_regra1, v_pergunta_escolha1, 'EQ', v_opcao1, 1, 91);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'regra_condicao não aceita dois valores', 'check_violation', 'FALHA', 'Banco aceitou id_opcao + valor_numero.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'regra_condicao não aceita dois valores', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'regra_condicao não aceita dois valores', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.27 Pontuação de avaliação de risco não pode ser negativa
    BEGIN
        INSERT INTO avaliacao_risco
            (id_avaliacao, id_risco, id_classificacao, pontuacao, versao_motor_regras)
        VALUES
            (v_avaliacao2, v_risco1, v_classificacao1, -1, 'TST-1.0');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'avaliacao_risco.pontuacao >= 0', 'check_violation', 'FALHA', 'Banco aceitou pontuação negativa.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'avaliacao_risco.pontuacao >= 0', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'avaliacao_risco.pontuacao >= 0', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.28 Mesmo risco não pode repetir na mesma avaliação
    BEGIN
        INSERT INTO avaliacao_risco
            (id_avaliacao, id_risco, id_classificacao, pontuacao, versao_motor_regras)
        VALUES
            (v_avaliacao1, v_risco1, v_classificacao1, 2, 'TST-1.0');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'Um resultado por avaliação/risco', 'unique_violation', 'FALHA', 'Banco aceitou risco duplicado.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Um resultado por avaliação/risco', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Um resultado por avaliação/risco', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.29 Mesma regra não repete para o mesmo avaliacao_risco
    BEGIN
        INSERT INTO avaliacao_risco_regra
            (id_avaliacao_risco, id_regra, satisfeita, pontuacao_aplicada)
        VALUES
            (v_avaliacao_risco1, v_regra1, TRUE, 2);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'Rastreabilidade avaliação_risco/regra', 'unique_violation', 'FALHA', 'Banco aceitou regra duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Rastreabilidade avaliação_risco/regra', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'Rastreabilidade avaliação_risco/regra', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.30 Duração de recomendação, quando informada, deve ser > 0
    BEGIN
        INSERT INTO recomendacao
            (codigo, titulo, descricao, tipo, duracao_minutos, prioridade_padrao)
        VALUES
            ('TST-REC-INV', 'Recomendação inválida', 'Teste', 'PAUSA', 0, 'BAIXA');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'recomendacao.duracao_minutos > 0', 'check_violation', 'FALHA', 'Banco aceitou duração zero.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'recomendacao.duracao_minutos > 0', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'recomendacao.duracao_minutos > 0', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.31 risco_recomendacao sem duplicidade
    BEGIN
        INSERT INTO risco_recomendacao
            (id_risco, id_recomendacao, prioridade_sugerida)
        VALUES
            (v_risco1, v_recomendacao1, 'ALTA');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'UNIQUE', 'risco_recomendacao sem duplicidade', 'unique_violation', 'FALHA', 'Banco aceitou associação duplicada.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'risco_recomendacao sem duplicidade', 'unique_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'UNIQUE', 'risco_recomendacao sem duplicidade', 'unique_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.32 Status de avaliação_recomendacao inválido
    BEGIN
        INSERT INTO avaliacao_recomendacao
            (id_avaliacao, id_avaliacao_risco, id_recomendacao,
             prioridade, origem, status)
        VALUES
            (v_avaliacao1, v_avaliacao_risco1, v_recomendacao2,
             'BAIXA', 'REGRA', 'INVALIDO');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'Domínio status avaliacao_recomendacao', 'check_violation', 'FALHA', 'Banco aceitou status inválido.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio status avaliacao_recomendacao', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'Domínio status avaliacao_recomendacao', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.33 Plano com data alvo anterior ao início
    BEGIN
        INSERT INTO plano_acao
            (id_avaliacao, titulo, status, criado_por, data_inicio, data_alvo)
        VALUES
            (v_avaliacao1, 'Plano inválido', 'ABERTO', v_usuario1,
             CURRENT_DATE, CURRENT_DATE - 1);
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'plano_acao.data_alvo >= data_inicio', 'check_violation', 'FALHA', 'Banco aceitou prazo anterior.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'plano_acao.data_alvo >= data_inicio', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'plano_acao.data_alvo >= data_inicio', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- 2.34 Ação CONCLUIDA exige data_conclusao
    BEGIN
        INSERT INTO acao_plano
            (id_plano, id_responsavel, descricao, prioridade, prazo, status)
        VALUES
            (v_plano1, v_usuario1, 'Ação inválida',
             'MEDIA', CURRENT_DATE + 1, 'CONCLUIDA');
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'CHECK', 'ACAO_PLANO concluída exige data', 'check_violation', 'FALHA', 'Banco aceitou conclusão sem data.');
        v_falha := v_falha + 1;
    EXCEPTION
        WHEN check_violation THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'ACAO_PLANO concluída exige data', 'check_violation', 'OK', SQLERRM);
            v_ok := v_ok + 1;
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'CHECK', 'ACAO_PLANO concluída exige data', 'check_violation', 'FALHA', SQLSTATE || ' - ' || SQLERRM);
            v_falha := v_falha + 1;
    END;

    -- ================================================================
    -- 3. REGRAS CONHECIDAS COMO "CAMADA DE APLICAÇÃO" NO MVP
    -- Estes testes NÃO contam como falha. Eles apenas documentam se o
    -- banco aceita hoje a inconsistência que o JavaScript deverá bloquear.
    -- ================================================================

    -- 3.1 Posto de outro ambiente
    BEGIN
        INSERT INTO avaliacao_ergonomica
            (id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente, id_posto,
             id_avaliador, tipo_avaliacao, status, data_avaliacao)
        VALUES
            (v_empresa1, v_vinculo1, v_vinculo_funcao1,
             v_ambiente1, v_posto2, v_usuario1, 'INICIAL', 'RASCUNHO', NOW())
        RETURNING id_avaliacao INTO v_tmp;

        DELETE FROM avaliacao_ergonomica WHERE id_avaliacao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'Posto deve pertencer ao ambiente',
             'Validação na aplicação', 'INFO',
             'Banco aceitou posto de outro ambiente, conforme esperado no MVP. Implementar no service/JavaScript.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'Posto deve pertencer ao ambiente',
                 'Validação na aplicação', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.2 vinculo_funcao deve pertencer ao vínculo da avaliação
    BEGIN
        INSERT INTO avaliacao_ergonomica
            (id_empresa, id_vinculo, id_vinculo_funcao, id_ambiente,
             id_avaliador, tipo_avaliacao, status, data_avaliacao)
        VALUES
            (v_empresa1, v_vinculo1, v_vinculo_funcao2, v_ambiente1,
             v_usuario1, 'INICIAL', 'RASCUNHO', NOW())
        RETURNING id_avaliacao INTO v_tmp;

        DELETE FROM avaliacao_ergonomica WHERE id_avaliacao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'vinculo_funcao deve pertencer ao vínculo',
             'Validação na aplicação', 'INFO',
             'Banco aceitou função de outro vínculo. Implementar validação no service.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'vinculo_funcao deve pertencer ao vínculo',
                 'Validação na aplicação', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.3 Cargo e função de empresas diferentes
    BEGIN
        INSERT INTO cargo_funcao (id_cargo, id_funcao)
        VALUES (v_cargo1, v_funcao_empresa2)
        RETURNING id_cargo_funcao INTO v_tmp;

        DELETE FROM cargo_funcao WHERE id_cargo_funcao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'Isolamento multiempresa em cargo_funcao',
             'Validação na aplicação no MVP', 'INFO',
             'Banco aceitou cargo e função de tenants diferentes. Revisar no pós-MVP e validar no service agora.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'Isolamento multiempresa em cargo_funcao',
                 'Validação na aplicação no MVP', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.4 id_opcao deve pertencer à id_pergunta em regra_condicao
    BEGIN
        INSERT INTO regra_condicao
            (id_regra, id_pergunta, operador, id_opcao, ordem)
        VALUES
            (v_regra1, v_pergunta_escolha1, 'EQ', v_opcao_outra_pergunta, 99)
        RETURNING id_condicao INTO v_tmp;

        DELETE FROM regra_condicao WHERE id_condicao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'regra_condicao: opção pertence à pergunta',
             'Validação na aplicação', 'INFO',
             'Banco aceitou opção de outra pergunta. Validar no motor/service.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'regra_condicao: opção pertence à pergunta',
                 'Validação na aplicação', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.5 resposta_opcao deve corresponder à pergunta da resposta
    BEGIN
        INSERT INTO resposta_opcao (id_resposta, id_opcao)
        VALUES (v_resposta_escolha, v_opcao_outra_pergunta)
        RETURNING id_resposta_opcao INTO v_tmp;

        DELETE FROM resposta_opcao WHERE id_resposta_opcao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'resposta_opcao: opção pertence à pergunta',
             'Validação na aplicação', 'INFO',
             'Banco aceitou opção de outra pergunta. Validar em avaliacaoService/perguntaService.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'resposta_opcao: opção pertence à pergunta',
                 'Validação na aplicação', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.6 avaliacao_recomendacao e avaliacao_risco devem ser da mesma avaliação
    BEGIN
        INSERT INTO avaliacao_recomendacao
            (id_avaliacao, id_avaliacao_risco, id_recomendacao,
             prioridade, origem, status)
        VALUES
            (v_avaliacao2, v_avaliacao_risco1, v_recomendacao2,
             'BAIXA', 'REGRA', 'SUGERIDA')
        RETURNING id_avaliacao_recomendacao INTO v_tmp;

        DELETE FROM avaliacao_recomendacao WHERE id_avaliacao_recomendacao = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'avaliacao_recomendacao coerente com avaliacao_risco',
             'Validação na aplicação', 'INFO',
             'Banco aceitou avaliação diferente do resultado de risco. Validar no service.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'avaliacao_recomendacao coerente com avaliacao_risco',
                 'Validação na aplicação', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- 3.7 regra aplicada deve produzir o mesmo risco do avaliacao_risco
    BEGIN
        INSERT INTO avaliacao_risco_regra
            (id_avaliacao_risco, id_regra, satisfeita, pontuacao_aplicada)
        VALUES
            (v_avaliacao_risco1, v_regra2, TRUE, 1)
        RETURNING id_avaliacao_risco_regra INTO v_tmp;

        DELETE FROM avaliacao_risco_regra WHERE id_avaliacao_risco_regra = v_tmp;

        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'REGRA_APLICACAO', 'Regra aplicada deve ser do mesmo risco',
             'Validação no motor de risco', 'INFO',
             'Banco aceitou regra vinculada a outro risco. Motor deve garantir coerência.');
        v_info := v_info + 1;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO teste_integridade_resultado VALUES
                (DEFAULT, 'REGRA_APLICACAO', 'Regra aplicada deve ser do mesmo risco',
                 'Validação no motor de risco', 'INFO',
                 'Banco já bloqueou a inconsistência: ' || SQLSTATE || ' - ' || SQLERRM);
            v_info := v_info + 1;
    END;

    -- ================================================================
    -- 4. ÍNDICES IMPORTANTES DO MODELO
    -- ================================================================

    SELECT COUNT(*)
      INTO v_count
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
           'uq_colaborador_vinculo_principal_vigente',
           'uq_vinculo_funcao_principal_vigente',
           'ix_avaliacao_ergonomica_vinculo_data',
           'ix_avaliacao_risco_risco_classificacao_calculo',
           'ix_acao_plano_status_prazo'
       );

    IF v_count = 5 THEN
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'INDICES', 'Índices críticos/recomendados',
             '5 índices encontrados', 'OK',
             'Índices parciais de vínculo/função e índices de histórico/dashboard/pendências estão presentes.');
        v_ok := v_ok + 1;
    ELSE
        INSERT INTO teste_integridade_resultado VALUES
            (DEFAULT, 'INDICES', 'Índices críticos/recomendados',
             '5 índices encontrados', 'FALHA',
             'Quantidade encontrada: ' || v_count);
        v_falha := v_falha + 1;
    END IF;

    INSERT INTO teste_integridade_resultado
    VALUES (
        DEFAULT,
        'RESUMO_INTERNO',
        'Resumo da execução',
        'Zero falhas',
        CASE WHEN v_falha = 0 THEN 'OK' ELSE 'FALHA' END,
        'OK=' || v_ok || ' | FALHA=' || v_falha || ' | INFO=' || v_info
    );
END $$;

-- =====================================================================
-- RESULTADOS
-- =====================================================================

SELECT
    id,
    categoria,
    teste,
    esperado,
    resultado,
    detalhe
FROM teste_integridade_resultado
ORDER BY id;

SELECT
    COUNT(*) FILTER (WHERE resultado = 'OK')    AS testes_ok,
    COUNT(*) FILTER (WHERE resultado = 'FALHA') AS testes_falha,
    COUNT(*) FILTER (WHERE resultado = 'INFO')  AS testes_info,
    CASE
        WHEN COUNT(*) FILTER (WHERE resultado = 'FALHA') = 0
        THEN 'APROVADO NOS TESTES DE INTEGRIDADE'
        ELSE 'NECESSITA AJUSTES'
    END AS status_final
FROM teste_integridade_resultado
WHERE categoria <> 'RESUMO_INTERNO';

-- Nenhum dado fictício permanece no banco.
ROLLBACK;
