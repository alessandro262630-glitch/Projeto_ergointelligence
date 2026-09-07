# FAIR-PA-01 — Plano de Ação 2.0: suporte a GHE e Inventário de Riscos

## Problema anterior

O Plano de Ação (FEIRA-04) só conseguia nascer de uma Avaliação Individual:
`plano_acao.id_avaliacao` era `NOT NULL` e referenciava exclusivamente
`avaliacao_ergonomica`. O fluxo GHE evoluiu até o Inventário de Riscos
(`GHE → Avaliação GHE → Processamento → Avaliação_GHE_Risco →
Inventário_Risco_Item`), mas não havia como transformar um item do
Inventário em uma ação de tratamento com responsável, prazo e
acompanhamento — o ciclo de demonstração parava na identificação do
risco.

## Compatibilidade com o fluxo individual

O fluxo legado (`Avaliação → Recomendação → Plano → Ação`) **não foi
removido nem reescrito** — continua funcionando exatamente como antes.
A única mudança de comportamento é que `plano_acao` agora grava
explicitamente `origem_tipo = 'AVALIACAO_INDIVIDUAL'` (antes essa origem
era implícita, já que era a única possível). Todo o histórico existente
foi classificado automaticamente como `AVALIACAO_INDIVIDUAL` pela própria
migration (via `DEFAULT` na coluna nova, removido logo em seguida) —
nenhuma linha precisou ser inventada ou adivinhada.

## Nova origem: Inventário de Riscos

Um Plano de Ação agora também pode nascer de uma versão **publicada** do
Inventário de Riscos:

```
INVENTARIO_RISCO
        ↓
PLANO_ACAO (origem_tipo = INVENTARIO_RISCOS)
        ↓
ACAO_PLANO (id_inventario_risco_item aponta para o item tratado)
```

Cada ação pode opcionalmente rastrear qual **item específico** do
Inventário a motivou — o mesmo item carrega GHE, perigo, classificação e
trabalhadores expostos (snapshots já persistidos por MVP-09A/MVP-09C),
exibidos como contexto somente leitura no formulário da ação.

## Modelagem (migration 007)

`database/migrations/007_expand_plano_acao_inventario.sql` (schema.sql
atualizado em conjunto):

- `plano_acao.origem_tipo` (`VARCHAR(20) NOT NULL`) — `AVALIACAO_INDIVIDUAL`
  ou `INVENTARIO_RISCOS`.
- `plano_acao.id_avaliacao` — deixou de ser `NOT NULL` (a FK para
  `avaliacao_ergonomica` continua intacta).
- `plano_acao.id_inventario` (nova FK opcional para `inventario_risco`).
- `CHECK chk_plano_acao_origem_consistente` — garante que **exatamente
  uma** das duas FKs de origem esteja preenchida, nunca as duas nem
  nenhuma.
- `acao_plano.id_inventario_risco_item` (nova FK opcional para
  `inventario_risco_item`).
- `CHECK chk_acao_plano_origem_unica` — uma ação nunca tem
  `id_avaliacao_recomendacao` e `id_inventario_risco_item` preenchidos ao
  mesmo tempo (uma ação "manual", sem origem específica, continua válida
  nos dois fluxos).
- Índices parciais em `plano_acao.id_inventario` e
  `acao_plano.id_inventario_risco_item` (consultas "planos deste
  inventário"/"ações deste item" são um caminho de acesso novo e
  frequente).

Nenhuma tabela/coluna do Motor GHE (`motorRiscoGhe.js`, `metricasGhe.js`,
`avaliadorGhe.js`, `validacaoConfiguracaoGhe.js`) ou do Motor individual
(`motorRisco.js`, `classificadorRisco.js`, `riscoService.js`) foi alterada.

## Decisões documentadas

- **Só Inventário PUBLICADO pode originar um Plano** (`criarPlanoInventario`
  em `js/services/planoAcaoService.js` valida `inventario.status ===
  'PUBLICADO'` antes de criar). Motivo: o Plano deve tratar riscos já
  consolidados no documento, nunca um rascunho ainda em edição.
- **Cross-tenant**: `criarPlanoInventario` também confere que o
  Inventário pertence à empresa ativa (`obterIdEmpresaAtiva()`), mesmo
  padrão de `gheService.validarSetorDaEmpresa`.
- **Item de outro Inventário é bloqueado**: `validarItemCompativelComPlano`
  (interno a `planoAcaoService.js`) impede que uma ação do Plano do
  Inventário A referencie um item do Inventário B.
- **Não duplicar Plano por engano**: o schema não impede múltiplos planos
  por Inventário (mesma modelagem já usada para múltiplos planos por
  avaliação), mas a UI (`inventario-detalhe.html`) mostra "Ver Plano de
  Ação" em vez de "Criar Plano de Ação" quando já existe um.
- **Ações do fluxo Inventário nascem de um item específico**: o botão
  "Adicionar Ação" de topo (usado no fluxo individual) fica oculto quando
  a origem é Inventário — cada linha da tabela "Itens de Risco do
  Inventário" tem seu próprio botão "Adicionar Ação", já pré-vinculado ao
  item clicado. Não foi criado um conceito de "ação geral do plano" sem
  necessidade real.
- **Nenhum valor hardcoded**: contagem de ações por item, resumo de
  progresso (total/abertas/em andamento/concluídas) e o aviso de
  metodologia demonstrativa são sempre calculados a partir dos dados já
  carregados — nunca um número fixo no frontend.

## Rastreabilidade

A partir de uma ação do fluxo Inventário, a cadeia completa já existente
é reaproveitada sem duplicar nenhuma consulta:

```
Ação → item do Inventário (contexto somente leitura no próprio formulário)
     → "Ver Origem" (inventario-detalhe.html, já existente)
       → resultado-ghe.html (já existente)
         → "Entenda por quê" (rastreabilidade regra/condição, já existente)
```

A célula "Origem" da tabela de ações do Inventário já linka diretamente
para `inventario-detalhe.html?id_inventario=<id>`, de onde o usuário
acessa a origem completa do resultado GHE sem que o Plano de Ação precise
reimplementar nada disso.

## Interface

- `plano-acao.html` agora aceita dois pontos de entrada mutuamente
  exclusivos: `?id_avaliacao=<id>` (fluxo legado) e `?id_inventario=<id>`
  (novo fluxo). A página detecta a origem pela URL e alterna entre dois
  blocos de contexto (Colaborador/Setor/Data/Classificação vs.
  Inventário/Versão/Status/Empresa/GHEs abrangidos/Itens de risco), mais
  o aviso de metodologia demonstrativa quando aplicável.
- `inventario-detalhe.html` ganhou o botão "Criar Plano de Ação"/"Ver
  Plano de Ação" no cabeçalho, visível apenas quando o Inventário está
  PUBLICADO.
- O resumo de progresso (total/abertas/em andamento/concluídas) e o
  percentual eventualmente exibido representam **progresso do plano**,
  nunca "redução de risco" — são conceitos diferentes e não são
  confundidos na interface.
- Nenhuma ação é sugerida automaticamente a partir da classificação do
  risco (ex.: "ALTO" não vira "trocar cadeira" sozinho) — toda ação é
  cadastrada manualmente pelo usuário.

## Service (`js/services/planoAcaoService.js`)

Único service para as duas origens (evita duplicar lógica em services
paralelos):

- `criarPlanoAvaliacaoIndividual(dados)` / `criarPlanoInventario(dados)` —
  os dois pontos de entrada para criação, ambos escrevendo através de um
  único inserter privado (`inserirPlano`).
- `buscarPlanoPorAvaliacao(idAvaliacao)` / `buscarPlanoPorInventario(idInventario)`
  / `listarPlanosDoInventario(idInventario)`.
- `criarAcao(dados)` (genérica, aceita `id_avaliacao_recomendacao` OU
  `id_inventario_risco_item`) e `criarAcaoParaItemInventario(idPlano,
  idItem, dados)` (atalho usado pela UI do fluxo Inventário).
- `atualizarAcao`, `alterarStatusAcao`, `concluirAcao` (atalho para
  `alterarStatusAcao(id, 'CONCLUIDA', data)`).
- `verificarPlanoInventarioDemonstrativo(idInventario)` — reaproveita
  `inventarioRiscoService.listarItens` e
  `inventarioIntegracaoService.verificarAlgumaMetodologiaDemonstrativa`
  (mesma função já usada em `inventario-detalhe.js`), sem nenhuma
  consulta nova.

## Dados de demonstração

Nenhum plano/ação foi inserido por hardcode. O cenário de demonstração
(Inventário publicado de "Operadores de Produção" com itens Postura
inadequada / Movimentos repetitivos / Fadiga, um Plano de Ação com 2-3
ações fictícias) foi criado pelo fluxo real da aplicação (UI), e está
marcado como dado de demonstração — as ações fictícias criadas não
representam prescrição técnica oficial, apenas uma ilustração da
mecânica do Plano de Ação.

## Limitações / fora de escopo desta entrega

- EPI, PCMSO, eSocial, CAT, treinamentos, FAP, ROI, AET automática, LLM
  para sugerir ações, Dashboard PGR completo, aprovação formal de
  profissional e qualquer motor de cálculo novo — nenhum desses foi
  implementado.
- O Dashboard (DASH-01) não foi alterado nesta feature.
- Descrições longas (`descricao`/`processo_descricao` etc.) de outras
  tabelas não foram tocadas — fora do escopo desta migration.
