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
--
-- CORRECAO: a primeira versao deste arquivo casava GHEs pelo NOME
-- ('Operadores de Producao', sem acento) para checar duplicidade
-- (NOT EXISTS), mas os GHEs criados pelo fluxo real da interface no
-- MVP-06 foram digitados com acentuacao correta ('Operadores de
-- Produção', 'Equipe de Logística'). Como as strings nao sao iguais, a
-- checagem nao reconhecia o GHE existente e tentava inserir um duplicado,
-- que so falhava depois, na constraint uq_ghe_empresa_codigo. Corrigido
-- para casar por `codigo` (GHE-01..04) em todas as consultas deste
-- arquivo - codigo nunca tem variacao de acentuacao e e a mesma chave da
-- constraint UNIQUE real da tabela.
-- =====================================================================

BEGIN;

INSERT INTO ghe (id_empresa, id_setor, codigo, nome, descricao, universo)
SELECT e.id_empresa, s.id_setor, v.codigo, v.nome, v.descricao, v.universo
FROM empresa e
JOIN (VALUES
    ('GHE-01', 'Produção',      'Operadores de Produção', 'Trabalhadores expostos a condicoes semelhantes na linha de producao.', 180),
    ('GHE-02', 'Logística',     'Equipe de Logística',     'Separacao, conferencia e transporte manual de materiais.', 110),
    ('GHE-03', 'Administrativo','Equipe Administrativa',   'Atividades administrativas em escritorio.', 90),
    ('GHE-04', 'Tecnologia',    'Suporte de Tecnologia',   'Desenvolvimento e suporte tecnico em estacoes de trabalho.', 70)
) AS v(codigo, setor_nome, nome, descricao, universo) ON TRUE
JOIN setor s ON s.id_empresa = e.id_empresa AND s.nome = v.setor_nome
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM ghe g WHERE g.id_empresa = e.id_empresa AND g.codigo = v.codigo);

-- Cargos compativeis (N:N) - pelo menos 2 no GHE principal (Producao).
-- Casa o GHE por codigo (ver correcao acima), nunca por nome.
INSERT INTO ghe_cargo (id_ghe, id_cargo)
SELECT g.id_ghe, cg.id_cargo
FROM ghe g
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN (VALUES
    ('GHE-01', 'Operador de Produção'),
    ('GHE-01', 'Supervisor de Produção'),
    ('GHE-02', 'Auxiliar de Logística'),
    ('GHE-03', 'Assistente Administrativo'),
    ('GHE-03', 'Analista Administrativo'),
    ('GHE-04', 'Analista de Sistemas')
) AS v(ghe_codigo, cargo_nome) ON v.ghe_codigo = g.codigo
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
    ('GHE-01', 20),
    ('GHE-02', 15),
    ('GHE-03', 12),
    ('GHE-04', 10)
) AS v(ghe_codigo, amostra) ON v.ghe_codigo = g.codigo
WHERE NOT EXISTS (SELECT 1 FROM plano_amostragem pa WHERE pa.id_ghe = g.id_ghe);

-- Participantes de cada GHE - CORRECAO: um participante so pode ser
-- registrado se o vinculo pertencer exatamente ao setor do GHE (quando
-- definido) e a um dos cargos associados a ele (ghe_cargo) - a mesma regra
-- agora aplicada em gheService.adicionarParticipante/
-- listarVinculosCompativeisComGhe. A versao anterior deste seed registrava
-- os 6 colaboradores base inteiros no GHE-01, sem checar setor/cargo, o
-- que criava participantes incompativeis (ex.: um colaborador do
-- Administrativo registrado no GHE de Producao). Cada linha abaixo casa
-- explicitamente matricula -> GHE (por codigo), e so os pares realmente
-- compativeis com o setor/cargo de cada GHE foram listados - por isso a
-- contagem por GHE fica abaixo da amostra planejada (isso e esperado, ver
-- docs).
INSERT INTO amostra_participante (id_plano_amostragem, id_vinculo)
SELECT pa.id_plano_amostragem, cv.id_vinculo
FROM plano_amostragem pa
JOIN ghe g ON g.id_ghe = pa.id_ghe
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN (VALUES
    ('DEM003', 'GHE-01'),
    ('DEM006', 'GHE-01'),
    ('DEM011', 'GHE-01'),
    ('DEM004', 'GHE-02'),
    ('DEM010', 'GHE-02'),
    ('DEM001', 'GHE-03'),
    ('DEM005', 'GHE-03'),
    ('DEM008', 'GHE-03'),
    ('DEM002', 'GHE-04'),
    ('DEM009', 'GHE-04')
) AS v(matricula, ghe_codigo) ON v.ghe_codigo = g.codigo
JOIN colaborador c ON c.id_empresa = e.id_empresa AND c.matricula = v.matricula
JOIN colaborador_vinculo cv ON cv.id_colaborador = c.id_colaborador AND cv.principal = TRUE AND cv.ativo = TRUE AND cv.data_fim IS NULL
-- Confere setor/cargo do vinculo contra o GHE, na mesma linha do INSERT -
-- nunca confia so no pareamento manual da tabela VALUES acima.
JOIN ghe_cargo gc ON gc.id_ghe = g.id_ghe AND gc.id_cargo = cv.id_cargo AND gc.ativo = TRUE
WHERE (g.id_setor IS NULL OR g.id_setor = cv.id_setor)
  AND NOT EXISTS (SELECT 1 FROM amostra_participante ap WHERE ap.id_plano_amostragem = pa.id_plano_amostragem AND ap.id_vinculo = cv.id_vinculo);

COMMIT;
