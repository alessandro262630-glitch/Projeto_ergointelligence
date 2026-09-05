-- =====================================================================
-- ErgoIntelligence | Seed Demo - GHEs, Cargos e Plano de Amostragem
-- =====================================================================
-- Idempotente (INSERT ... WHERE NOT EXISTS). Depende de
-- 02_seed_demo_base.sql ja executado.
--
-- Cenario: 4 GHEs cobrindo os 4 setores reais, universo total proximo de
-- 500 trabalhadores (secao 12/34 do prompt MVP-07/FEIRA-05) - SEM
-- cadastrar 500 colaboradores individualmente (secao 14/31): o universo
-- e um numero declarado em ghe.universo, independente de
-- COUNT(colaborador).
-- =====================================================================

BEGIN;

INSERT INTO ghe (id_empresa, id_setor, codigo, nome, descricao, universo)
SELECT e.id_empresa, s.id_setor, v.codigo, v.nome, v.descricao, v.universo
FROM empresa e
JOIN (VALUES
    ('GHE-01', 'Producao',      'Operadores de Producao', 'Trabalhadores expostos a condicoes semelhantes na linha de producao.', 180),
    ('GHE-02', 'Logistica',     'Equipe de Logistica',     'Separacao, conferencia e transporte manual de materiais.', 110),
    ('GHE-03', 'Administrativo','Equipe Administrativa',   'Atividades administrativas em escritorio.', 90),
    ('GHE-04', 'Tecnologia',    'Suporte de Tecnologia',   'Desenvolvimento e suporte tecnico em estacoes de trabalho.', 70)
) AS v(codigo, setor_nome, nome, descricao, universo) ON TRUE
JOIN setor s ON s.id_empresa = e.id_empresa AND s.nome = v.setor_nome
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM ghe g WHERE g.id_empresa = e.id_empresa AND g.nome = v.nome);

-- Cargos compativeis (N:N) - pelo menos 2 no GHE principal (Producao)
INSERT INTO ghe_cargo (id_ghe, id_cargo)
SELECT g.id_ghe, cg.id_cargo
FROM ghe g
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN (VALUES
    ('Operadores de Producao', 'Operador de Producao'),
    ('Operadores de Producao', 'Supervisor de Producao'),
    ('Equipe de Logistica', 'Auxiliar de Logistica'),
    ('Equipe Administrativa', 'Assistente Administrativo'),
    ('Equipe Administrativa', 'Analista Administrativo'),
    ('Suporte de Tecnologia', 'Analista de Sistemas')
) AS v(ghe_nome, cargo_nome) ON v.ghe_nome = g.nome
JOIN cargo cg ON cg.id_empresa = e.id_empresa AND cg.nome = v.cargo_nome
WHERE NOT EXISTS (SELECT 1 FROM ghe_cargo x WHERE x.id_ghe = g.id_ghe AND x.id_cargo = cg.id_cargo);

-- Plano de Amostragem de cada GHE (universo_snapshot = universo atual no
-- momento do seed - fica congelado dali em diante, ver secao 15).
INSERT INTO plano_amostragem (id_ghe, universo_snapshot, amostra_planejada, criterio, status, id_responsavel, data_plano)
SELECT g.id_ghe, g.universo, v.amostra,
       'Selecao de participantes considerando diferentes turnos, atividades e postos existentes no GHE.',
       'PLANEJADO', u.id_usuario, CURRENT_DATE
FROM ghe g
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN usuario u ON u.id_empresa = e.id_empresa AND u.email = 'avaliador.sst@ergotech.demo'
JOIN (VALUES
    ('Operadores de Producao', 20),
    ('Equipe de Logistica', 15),
    ('Equipe Administrativa', 12),
    ('Suporte de Tecnologia', 10)
) AS v(ghe_nome, amostra) ON v.ghe_nome = g.nome
WHERE NOT EXISTS (SELECT 1 FROM plano_amostragem pa WHERE pa.id_ghe = g.id_ghe);

-- Participantes do GHE principal (Operadores de Producao): 6 vinculos
-- registrados de um total de 20 planejados - demonstra deliberadamente
-- "6 de 20" (secao 3/53 do prompt MVP-07), sem exigir os 20.
INSERT INTO amostra_participante (id_plano_amostragem, id_vinculo)
SELECT pa.id_plano_amostragem, cv.id_vinculo
FROM plano_amostragem pa
JOIN ghe g ON g.id_ghe = pa.id_ghe AND g.nome = 'Operadores de Producao'
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN colaborador c ON c.id_empresa = e.id_empresa AND c.matricula IN ('DEM001','DEM002','DEM003','DEM004','DEM005','DEM006')
JOIN colaborador_vinculo cv ON cv.id_colaborador = c.id_colaborador AND cv.principal = TRUE AND cv.ativo = TRUE AND cv.data_fim IS NULL
WHERE NOT EXISTS (SELECT 1 FROM amostra_participante ap WHERE ap.id_plano_amostragem = pa.id_plano_amostragem AND ap.id_vinculo = cv.id_vinculo);

COMMIT;
