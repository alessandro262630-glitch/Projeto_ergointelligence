# DASH-01 — Dashboard GHE + Motor de Risco

## Objetivo

Adicionar ao `dashboard.html` uma seção executiva e operacional voltada aos
**GHEs (Grupos Homogêneos de Exposição)** e ao **Motor de Risco do GHE**,
usando exclusivamente dados persistidos no Supabase. Nenhum valor é
hardcoded — todo número exibido vem de uma consulta real.

O bloco de **Avaliação Individual** pré-existente foi preservado sem
alterações funcionais e apenas realocado abaixo da nova seção, sob o
cabeçalho "Avaliação Individual".

O **Inventário de Riscos não foi integrado** nesta entrega — está fora de
escopo por decisão explícita (ver "Preparação para DASH-02" abaixo).

## Fontes de dados

| Dado | Tabela(s) | Observação |
|---|---|---|
| GHEs ativos da empresa | `ghe` | Filtra por `id_empresa` (empresa ativa) e `ativo = true`. Embute `setor(nome)`. |
| Avaliações GHE | `avaliacao_ghe` | Filtra por `id_ghe IN (...)` e `status <> 'CANCELADA'`. |
| Processamento atual | `processamento_risco_ghe` | Filtra por `status = 'CONCLUIDO'`, embute `metodologia_risco(codigo, versao, status_validacao)`. |
| Resultados de risco | `avaliacao_ghe_risco` | Embute `risco_ergonomico(nome)` e `classificacao_risco_ghe(codigo, nome, cor_hex, prioridade)`. |
| Plano de amostragem | `plano_amostragem` | Exclui `status = 'CANCELADO'`. |
| Coletas concluídas | `coleta_ghe` | Conta apenas `status = 'CONCLUIDA'`, agrupado por `id_avaliacao_ghe`. |

Todo o acesso ao Supabase para este bloco está centralizado em
`js/services/dashboardService.js`. `js/pages/dashboard.js` é estritamente
DOM + ECharts e nunca consulta o banco diretamente.

## Regra de "processamento atual" / "avaliação atual"

Um `ghe` pode ter múltiplas `avaliacao_ghe` ao longo do tempo, e uma
`avaliacao_ghe` pode ter múltiplos `processamento_risco_ghe` (reprocessamento).
Para nunca contar riscos em duplicidade:

1. **Avaliação atual de um GHE** = a `avaliacao_ghe` não cancelada mais
   recente (`data_avaliacao` desc) daquele `id_ghe`.
2. **Processamento atual de uma avaliação** = o `processamento_risco_ghe`
   com `status = 'CONCLUIDO'` mais recente (`processado_em` desc) daquela
   `avaliacao_ghe`.

Ambas as regras são resolvidas com **uma única consulta em lote** por
regra (nunca N+1) seguida de uma redução em memória via `Map` — a primeira
ocorrência de cada chave, já que a consulta vem ordenada
decrescentemente, é a mais recente. Essa lógica está centralizada em
`resolverAvaliacaoAtualPorGhe()` e `carregarProcessamentosAtuaisPorAvaliacao()`
dentro do service; a função exportada `buscarProcessamentoAtualPorAvaliacao(idAvaliacaoGhe)`
expõe a mesma regra para uso pontual fora do dashboard (ex.: uma tela que
precise saber qual é o processamento vigente de uma avaliação específica).

Apenas os resultados dos processamentos **atuais** entram nos KPIs, nos
gráficos e nas tabelas — processamentos antigos/reprocessados nunca são
contados.

## Regra de cada KPI

- **Trabalhadores abrangidos** — soma de `ghe.universo` de todos os GHEs
  ativos da empresa. Independe de haver avaliação ou não.
- **GHEs ativos** — contagem de `ghe` com `ativo = true`.
- **Avaliações GHE** — contagem de `avaliacao_ghe` (avaliação atual de
  cada GHE, não cancelada). Nunca conta avaliações individuais.
- **Riscos identificados** — contagem de **linhas** de
  `avaliacao_ghe_risco` (resultados de risco) vinculadas aos
  processamentos atuais. Esta é uma decisão deliberada: conta-se cada
  *resultado de risco* (uma linha por combinação
  risco×avaliação×processamento), não o número de riscos ergonômicos
  distintos — um mesmo risco ergonômico (ex.: "Movimentos repetitivos")
  aparecendo em dois GHEs diferentes conta como 2, porque representa duas
  situações de exposição distintas monitoradas separadamente.

## Gráfico 1 — Riscos por Classificação

Donut agrupando os resultados de risco (dos processamentos atuais) por
`classificacao_risco_ghe.codigo` (BAIXO/MODERADO/ALTO/CRITICO — apenas as
categorias efetivamente presentes nos dados). A cor de cada fatia vem
sempre de `classificacao_risco_ghe.cor_hex`, nunca de uma paleta fixa por
posição/índice.

## Gráfico 2 — Riscos por GHE

Barra horizontal com a quantidade de resultados de risco por GHE. O
tooltip mostra nome do GHE, universo, quantidade de riscos e a avaliação
utilizada (id da avaliação GHE atual daquele GHE, ou "Sem avaliação
registrada" quando o GHE não tem avaliação atual).

## Indicador "Resultados demonstrativos"

Quando qualquer processamento atual usa uma `metodologia_risco` com
`status_validacao = 'DEMONSTRATIVA'`, um selo discreto
"Resultados demonstrativos" aparece no cabeçalho da seção. Ao clicar (popover
Bootstrap, mesmo padrão já usado em outras telas do app), exibe: "Os
critérios utilizados ainda requerem validação técnica para uso
profissional." O selo nunca é um alerta de destaque total da tela.

## Cobertura das avaliações

Chamada de **"Cobertura"** (nunca "Representatividade estatística" —
termo estatístico que a metodologia atual não sustenta). Por GHE:

```
cobertura_percentual = coletas_concluidas / amostra_planejada × 100
```

- `amostra_planejada` vem do `plano_amostragem` mais recente não
  cancelado vinculado à avaliação atual do GHE.
- `coletas_concluidas` é a contagem de `coleta_ghe` com
  `status = 'CONCLUIDA'` daquela avaliação.
- Quando não existe avaliação atual ou não existe plano de amostragem
  válido, `cobertura_percentual` é `null` e a interface exibe **"N/A"** —
  nunca "0%", que sugeriria uma coleta zerada com meta definida (caso
  distinto e real: GHE com plano mas zero coletas, que mostra "0%"
  corretamente).
- A barra de progresso usa uma única cor neutra (teal da marca) em todos
  os casos — nunca verde/amarelo/vermelho, o que implicaria um julgamento
  de "bom/ruim" que a cobertura descritiva não carrega.

## Principais Riscos

Lista os resultados de risco (processamentos atuais) ordenados por
`classificacao_risco_ghe.prioridade` (decrescente) e, em empate, por
`pontuacao` (decrescente). A ação "Ver Resultado" navega para
`resultado-ghe.html?id_processamento=<id>` **apontando para o
processamento já persistido** — a tela nunca recalcula nada ao ser
aberta a partir do dashboard.

## Estados de interface

- **Carregando** — nenhum "0" é exibido antes dos dados chegarem; a área
  de conteúdo fica oculta e um texto "Carregando indicadores do GHE..."
  é mostrado.
- **Vazio** — quando não há nenhuma `avaliacao_ghe` (0 avaliações),
  mostra "Nenhuma avaliação GHE disponível." — nunca "0 riscos críticos"
  como se fosse um resultado positivo.
- **Erro** — falha em qualquer consulta do bloco é capturada, logada via
  `console.error` e resulta em "Não foi possível carregar os indicadores
  do GHE.", sem interromper o restante da página (o bloco de Avaliação
  Individual continua funcionando normalmente mesmo se este bloco falhar,
  e vice-versa — são carregados de forma independente).

## Dados propositalmente não incluídos

- **Inventário de Riscos** — não entra em nenhum KPI/gráfico desta
  entrega (ver DASH-02 abaixo). O atalho "Ver Inventários" já existe na
  seção de acesso rápido, apontando para `inventarios.html`, mas nenhum
  número do inventário é lido pelo dashboard ainda.
- **Predição / IA** — nenhuma inferência, projeção ou recomendação
  automática.
- **ROI / economia projetada** — nenhum indicador financeiro estimado.
- **Indicadores sem fonte real no banco** — ex.: absenteísmo, turnover,
  produtividade. Nenhum desses existe hoje como tabela/coluna persistida,
  logo não aparecem.

## Preparação para DASH-02

A integração do Inventário de Riscos ao dashboard fica para uma próxima
entrega (DASH-02). O bloco atual já foi desenhado para acomodar uma nova
seção/KPI de Inventário sem retrabalho: os cards de GHE (`ghe-resumo-card`),
a tabela de cobertura e a orquestração em `carregarDashboardGhe()` seguem
o mesmo padrão de carregar-e-renderizar isolado que qualquer novo bloco de
Inventário poderá reaproveitar.

## Funções do service (`js/services/dashboardService.js`)

- `buscarIndicadoresGhe()` — orquestrador principal; retorna
  `{ kpis, ghes, avaliacoes, riscos, resumoPorGhe, algumaMetodologiaDemonstrativa }`.
- `buscarProcessamentoAtualPorAvaliacao(idAvaliacaoGhe)` — processamento
  atual de uma avaliação específica (reutiliza a mesma regra centralizada).
- `agruparRiscosGhePorClassificacao(riscos)` — agrupamento para o gráfico
  de classificação.
- `listarPrincipaisRiscosGhe(riscos, limite)` — lista ordenada por
  prioridade/pontuação para a tabela de principais riscos.

Todas as consultas usam operações em lote (`.in(...)`) e resolução em
memória — nenhuma chamada ao Supabase é feita dentro de um loop por
GHE/avaliação/processamento.
