-- =====================================================================
-- ErgoIntelligence | Seed Demo - Catalogo de Perigos Ocupacionais (MVP-09B)
-- =====================================================================
-- Idempotente (INSERT ... WHERE NOT EXISTS). Depende da migration 005 ja
-- aplicada. Resolve risco_ergonomico exclusivamente por CODIGO (nunca ID
-- hardcoded), mesmo criterio ja usado em 05_seed_metodologia_ghe_demo.sql.
--
-- Poucos perigos demonstrativos relevantes (secao 65 do prompt MVP-09B) -
-- NAO tenta popular um catalogo completo de SST. Prioriza os perigos
-- ergonomicos associados aos riscos ja utilizados pelo Motor GHE
-- demonstrativo (ver database/demo/05_seed_metodologia_ghe_demo.sql):
-- Postura inadequada, Movimentos repetitivos, Esforco fisico, Fadiga
-- ocupacional e Organizacao inadequada das pausas.
--
-- Um perigo FISICO (ruido) e incluido apenas para comprovar que o
-- catalogo e agnostico de categoria (chk_perigo_ocupacional_categoria
-- aceita FISICO/QUIMICO/BIOLOGICO/ERGONOMICO/ACIDENTE) - permanece sem
-- mapeamento para risco_ergonomico porque nao ha risco ergonomico
-- correspondente, e nenhum motor de calculo para as categorias
-- nao-ergonomicas e implementado nesta feature (secao 10 do prompt).
--
-- Mapeamento risco_ergonomico -> perigo_ocupacional so e criado quando a
-- correspondencia e inequivoca (secao 67) - nenhuma equivalencia
-- duvidosa e inventada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. PERIGOS OCUPACIONAIS
-- ---------------------------------------------------------------------
INSERT INTO perigo_ocupacional (codigo, categoria, nome, descricao, ativo)
SELECT v.codigo, v.categoria, v.nome, v.descricao, TRUE
FROM (VALUES
    ('ERG-001', 'ERGONOMICO', 'Postura inadequada',
        'Adocao de posturas que forcam articulacoes e estruturas musculoesqueleticas alem dos limites confortaveis durante a execucao das tarefas.'),
    ('ERG-002', 'ERGONOMICO', 'Movimentos repetitivos',
        'Execucao continua e ciclica dos mesmos movimentos musculares, sem pausas ou variacao suficiente, ao longo da jornada de trabalho.'),
    ('ERG-003', 'ERGONOMICO', 'Esforço físico excessivo',
        'Aplicacao de forca muscular acima da capacidade recomendada para levantar, empurrar, puxar ou sustentar cargas.'),
    ('ERG-004', 'ERGONOMICO', 'Fadiga ocupacional',
        'Desgaste fisico ou mental acumulado ao longo da jornada, associado a ritmo, duracao ou intensidade do trabalho.'),
    ('ERG-005', 'ERGONOMICO', 'Organização inadequada das pausas',
        'Ausencia ou insuficiencia de pausas programadas para recuperacao fisica e mental durante a jornada de trabalho.'),
    ('FIS-001', 'FISICO', 'Ruído contínuo acima do limite de tolerância',
        'Exposicao a niveis de pressao sonora continuos ou intermitentes capazes de causar dano auditivo ou extra-auditivo. Sem motor de calculo implementado nesta feature.')
) AS v(codigo, categoria, nome, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM perigo_ocupacional p WHERE p.codigo = v.codigo
);

-- ---------------------------------------------------------------------
-- 2. MAPEAMENTO RISCO_ERGONOMICO -> PERIGO_OCUPACIONAL (N:1)
-- ---------------------------------------------------------------------
INSERT INTO risco_ergonomico_perigo (id_risco, id_perigo, ativo)
SELECT r.id_risco, p.id_perigo, TRUE
FROM (VALUES
    ('RISCO-POST-02', 'ERG-001'),
    ('RISCO-REP-01',  'ERG-002'),
    ('RISCO-ESF-01',  'ERG-003'),
    ('RISCO-FAD-01',  'ERG-004'),
    ('RISCO-ORG-01',  'ERG-005')
) AS v(codigo_risco, codigo_perigo)
JOIN risco_ergonomico r ON r.codigo = v.codigo_risco
JOIN perigo_ocupacional p ON p.codigo = v.codigo_perigo
WHERE NOT EXISTS (
    SELECT 1 FROM risco_ergonomico_perigo m WHERE m.id_risco = r.id_risco
);

COMMIT;
