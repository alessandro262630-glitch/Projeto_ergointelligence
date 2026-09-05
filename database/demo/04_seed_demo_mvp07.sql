-- =====================================================================
-- ErgoIntelligence | Seed Demo - Avaliacao do GHE (MVP-07)
-- =====================================================================
-- Idempotente. Depende de 02_seed_demo_base.sql e 03_seed_demo_ghe.sql ja
-- executados.
--
-- Cria APENAS a Avaliacao do GHE (o "cabecalho" do processo coletivo).
-- As COLETAS e RESPOSTAS individuais foram deliberadamente NAO escritas
-- aqui como INSERT bruto: a secao 54 do prompt MVP-07 autoriza dados
-- demonstrativos de coleta/resposta via SQL, mas escrever ~19 respostas
-- por coleta a mao (por codigo de pergunta/opcao) e tedioso e propenso a
-- erro sem trazer beneficio real sobre o caminho ja adotado no resto do
-- projeto (FEIRA-02/03/05): usar o FLUXO REAL da interface
-- (coleta-ghe.html) para gerar as coletas e respostas, exatamente como um
-- avaliador faria na feira. Isso tambem exercita e valida as paginas
-- novas no mesmo passo, em vez de confiar apenas em INSERTs desacoplados
-- da aplicacao.
--
-- Ver docs/mvp07-avaliacao-ghe.md para o passo a passo de como as
-- coletas demonstrativas foram (re)criadas via UI.
-- =====================================================================

BEGIN;

INSERT INTO avaliacao_ghe (id_ghe, id_plano_amostragem, id_avaliador, tipo_avaliacao, status, data_avaliacao, observacoes)
SELECT g.id_ghe, pa.id_plano_amostragem, u.id_usuario, 'AEP', 'EM_COLETA', NOW(),
       'Avaliacao demonstrativa do GHE Operadores de Producao - coletas realizadas pelo fluxo real da interface.'
FROM ghe g
JOIN empresa e ON e.id_empresa = g.id_empresa AND e.cnpj = '12345678000190'
JOIN plano_amostragem pa ON pa.id_ghe = g.id_ghe
JOIN usuario u ON u.id_empresa = e.id_empresa AND u.email = 'avaliador.sst@ergotech.demo'
WHERE g.nome = 'Operadores de Producao'
  AND NOT EXISTS (SELECT 1 FROM avaliacao_ghe ag WHERE ag.id_ghe = g.id_ghe);

COMMIT;
