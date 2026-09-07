-- =====================================================================
-- ErgoIntelligence | Seed Demo - Base Organizacional
-- =====================================================================
-- Idempotente: pode ser executado mais de uma vez sem duplicar (usa
-- INSERT ... WHERE NOT EXISTS, ancorado nas UNIQUE constraints reais do
-- schema). Cria apenas o minimo necessario para a interface funcionar -
-- NAO cadastra centenas de colaboradores (ver secao 14 do prompt
-- MVP-07): 8 a 12 colaboradores fictícios bastam, o universo de cada GHE
-- fica declarado em database/demo/03_seed_demo_ghe.sql, independente da
-- quantidade de colaboradores aqui.
--
-- Nenhum dado pessoal real. Nomes/matriculas claramente demonstrativos.
-- =====================================================================

BEGIN;

-- 1 empresa
INSERT INTO empresa (razao_social, nome_fantasia, cnpj, email, telefone)
SELECT 'ErgoTech Solucoes Industriais Ltda.', 'ErgoTech Demo', '12345678000190', 'contato@ergotech.demo', '(11) 4000-0000'
WHERE NOT EXISTS (SELECT 1 FROM empresa WHERE cnpj = '12345678000190');

-- 4 setores
INSERT INTO setor (id_empresa, codigo_interno, nome)
SELECT e.id_empresa, v.codigo, v.nome
FROM empresa e
CROSS JOIN (VALUES ('SET-ADM', 'Administrativo'), ('SET-TEC', 'Tecnologia'), ('SET-PRO', 'Produção'), ('SET-LOG', 'Logística')) AS v(codigo, nome)
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM setor s WHERE s.id_empresa = e.id_empresa AND s.nome = v.nome);

-- Cargos (um por setor, suficiente para a demonstracao)
INSERT INTO cargo (id_empresa, codigo_interno, nome)
SELECT e.id_empresa, v.codigo, v.nome
FROM empresa e
CROSS JOIN (VALUES
    ('CAR-AADM', 'Assistente Administrativo'),
    ('CAR-NADM', 'Analista Administrativo'),
    ('CAR-SIST', 'Analista de Sistemas'),
    ('CAR-OPRO', 'Operador de Produção'),
    ('CAR-SPRO', 'Supervisor de Produção'),
    ('CAR-ALOG', 'Auxiliar de Logística')
) AS v(codigo, nome)
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM cargo c WHERE c.id_empresa = e.id_empresa AND c.nome = v.nome);

-- 1 usuario responsavel (sem autenticacao formal neste MVP - ver
-- js/services/avaliacaoService.js:obterAvaliadorPadrao)
INSERT INTO usuario (id_empresa, nome, email, senha_hash, perfil)
SELECT e.id_empresa, 'Avaliador SST Demo', 'avaliador.sst@ergotech.demo', 'demo-nao-usar-em-producao', 'SST'
FROM empresa e
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id_empresa = e.id_empresa AND u.email = 'avaliador.sst@ergotech.demo');

-- 10 colaboradores ficticios, distribuidos nos 4 setores (secao 14 do
-- prompt MVP-07: pequena quantidade, universo do GHE e declarado a parte)
INSERT INTO colaborador (id_empresa, matricula, nome, email, data_admissao)
SELECT e.id_empresa, v.matricula, v.nome, v.email, v.data_admissao::date
FROM empresa e
CROSS JOIN (VALUES
    ('DEM001', 'Marina Alves Demo', 'marina.alves@ergotech.demo', '2023-02-10'),
    ('DEM002', 'Carlos Mendes Demo', 'carlos.mendes@ergotech.demo', '2022-08-01'),
    ('DEM003', 'Juliana Ribeiro Demo', 'juliana.ribeiro@ergotech.demo', '2021-05-20'),
    ('DEM004', 'Rafael Lima Demo', 'rafael.lima@ergotech.demo', '2023-11-03'),
    ('DEM005', 'Fernanda Costa Demo', 'fernanda.costa@ergotech.demo', '2020-09-15'),
    ('DEM006', 'Bruno Martins Demo', 'bruno.martins@ergotech.demo', '2022-01-10'),
    ('DEM008', 'Patricia Souza Demo', 'patricia.souza@ergotech.demo', '2021-03-22'),
    ('DEM009', 'Diego Fernandes Demo', 'diego.fernandes@ergotech.demo', '2023-06-12'),
    ('DEM010', 'Camila Rocha Demo', 'camila.rocha@ergotech.demo', '2022-10-05'),
    ('DEM011', 'Thiago Barbosa Demo', 'thiago.barbosa@ergotech.demo', '2021-12-01')
) AS v(matricula, nome, email, data_admissao)
WHERE e.cnpj = '12345678000190'
  AND NOT EXISTS (SELECT 1 FROM colaborador c WHERE c.id_empresa = e.id_empresa AND c.matricula = v.matricula);

-- Vinculo principal vigente de cada colaborador (distribuidos entre os 4
-- setores - secao 12 do prompt FEIRA-05, para permitir "riscos por setor"
-- ja no fluxo individual existente).
-- CORRECAO MVP-06/MVP-07: este pareamento setor/cargo tambem e a base do
-- que 03_seed_demo_ghe.sql usa para registrar participantes compativeis
-- com cada GHE (mesmo setor do GHE + cargo associado via ghe_cargo). Ao
-- adicionar novos colaboradores aqui, mantenha o par setor/cargo coerente
-- com os cargos que 03_seed_demo_ghe.sql associa a cada GHE - caso
-- contrario, gheService.adicionarParticipante/listarVinculosCompativeisComGhe
-- corretamente recusara esse colaborador como participante.
INSERT INTO colaborador_vinculo (id_colaborador, id_setor, id_cargo, data_inicio, principal)
SELECT c.id_colaborador, s.id_setor, cg.id_cargo, c.data_admissao, TRUE
FROM colaborador c
JOIN empresa e ON e.id_empresa = c.id_empresa AND e.cnpj = '12345678000190'
JOIN (VALUES
    ('DEM001', 'Administrativo', 'Assistente Administrativo'),
    ('DEM002', 'Tecnologia', 'Analista de Sistemas'),
    ('DEM003', 'Produção', 'Operador de Produção'),
    ('DEM004', 'Logística', 'Auxiliar de Logística'),
    ('DEM005', 'Administrativo', 'Analista Administrativo'),
    ('DEM006', 'Produção', 'Supervisor de Produção'),
    ('DEM008', 'Administrativo', 'Assistente Administrativo'),
    ('DEM009', 'Tecnologia', 'Analista de Sistemas'),
    ('DEM010', 'Logística', 'Auxiliar de Logística'),
    ('DEM011', 'Produção', 'Operador de Produção')
) AS v(matricula, setor_nome, cargo_nome) ON v.matricula = c.matricula
JOIN setor s ON s.id_empresa = e.id_empresa AND s.nome = v.setor_nome
JOIN cargo cg ON cg.id_empresa = e.id_empresa AND cg.nome = v.cargo_nome
WHERE NOT EXISTS (
    SELECT 1 FROM colaborador_vinculo cv
    WHERE cv.id_colaborador = c.id_colaborador AND cv.principal = TRUE AND cv.ativo = TRUE AND cv.data_fim IS NULL
);

COMMIT;
