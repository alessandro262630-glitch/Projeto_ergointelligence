# MVP-09C — Integração do Motor de Risco do GHE com o Inventário de Riscos

> Conecta resultados já processados e persistidos pelo Motor de Risco do
> GHE (MVP-08C) ao Inventário de Riscos Ocupacionais (MVP-09B). O
> Inventário **consome** resultados; ele **nunca recalcula** risco.

## Pré-condições verificadas

- **Motor GHE (MVP-08C)**: operacional. `motorRiscoGheService.js`,
  `js/domain/ghe-risk/*.js` — não alterados por esta feature.
- **Inventário (MVP-09B)**: operacional (`inventarioRiscoService.js`,
  `inventarios.html`, `inventario-detalhe.html`).
- **Correção de integridade de item `MOTOR_GHE`**: o CHECK
  `chk_inventario_risco_item_origem_consistente`, criado na migration 005,
  exigia apenas `id_avaliacao_ghe_risco IS NOT NULL` para
  `origem_tipo='MOTOR_GHE'` — os outros 5 campos de snapshot podiam ficar
  `NULL` sem violar a constraint. A **migration 006**
  (`006_fix_inventario_item_motor_ghe_snapshot.sql`) substitui o CHECK
  para exigir os 6 campos (`id_avaliacao_ghe_risco`, `pontuacao_snapshot`,
  `classificacao_codigo_snapshot`, `classificacao_nome_snapshot`,
  `metodologia_codigo_snapshot`, `metodologia_versao_snapshot`) — aplicada
  com sucesso ao banco de demonstração antes de qualquer item `MOTOR_GHE`
  existir (tabela estava vazia, sem risco de migração de dados).

## Arquitetura

Novo service exclusivamente consumidor:
`js/services/inventarioIntegracaoService.js`. Ele nunca importa
`js/domain/ghe-risk/*.js` nem reimplementa cálculo — toda leitura de
resultado usa `avaliacao_ghe_risco`/`processamento_risco_ghe` já
persistidos, com uma única consulta aninhada (nested select do PostgREST)
resolvendo a cadeia completa risco → processamento → avaliação GHE → GHE
→ empresa, evitando consultas em cascata.

Funções expostas: `listarInventariosRascunhoDaEmpresa`,
`listarResultadosProcessamento`, `resolverPerigoResultado`,
`validarResultadoImportavel`, `verificarResultadoJaImportado`,
`prepararImportacaoResultado`, `importarResultadoGhe`,
`importarResultadosGhe`, `buscarOrigemItemInventario`,
`verificarAlgumaMetodologiaDemonstrativa`.

## Fluxo funcional

```
RESULTADO GHE → ADICIONAR AO INVENTÁRIO → SELECIONAR INVENTÁRIO
→ SELECIONAR RISCOS → MAPEAR RISCO→PERIGO → PRÉ-VISUALIZAR → IMPORTAR
→ COMPLETAR CONTEXTO → VALIDAR → PUBLICAR
```

Implementado como um wizard de 4 passos num único modal
(`#modal-importar-inventario`) em `resultado-ghe.html`, aberto pelo botão
**Adicionar ao Inventário** — visível **somente** quando
`processamento_risco_ghe.status = 'CONCLUIDO'` (nunca para PROCESSANDO,
ERRO ou CANCELADO, mesmo com a URL aberta diretamente — o botão é
reavaliado no carregamento da página).

"Completar contexto", "Validar" e "Publicar" reutilizam integralmente as
telas e funções já existentes de `inventario-detalhe.html` /
`inventarioRiscoService.js` (MVP-09B) — nada foi reimplementado.

## Origem e snapshots

Cada item `MOTOR_GHE` aponta para exatamente **um**
`avaliacao_ghe_risco` (1 risco + 1 processamento + 1 GHE) via
`id_avaliacao_ghe_risco`, e congela no momento da importação:
`trabalhadores_expostos_snapshot` (universo do GHE), `pontuacao_snapshot`,
`classificacao_codigo_snapshot`, `classificacao_nome_snapshot`,
`metodologia_codigo_snapshot`, `metodologia_versao_snapshot`. Nenhum
desses valores é recalculado depois — testado explicitamente: alterar o
universo do GHE, a pontuação e a classificação do resultado de origem
**depois** de importado não altera o item já criado (teste da seção 54).
Um novo processamento do mesmo GHE/risco também não altera itens já
importados de processamentos anteriores (seção 55) — cada
`avaliacao_ghe_risco` é uma linha imutável e um novo processamento nunca
sobrescreve resultados antigos (regra já garantida desde o MVP-08A).

Não duplica rastreabilidade de regra/condição no Inventário — o item só
guarda o ponteiro (`id_avaliacao_ghe_risco`); "Ver Origem" sempre navega
de volta para `resultado-ghe.html?id_processamento=...`, que já tem
"Entenda por quê" com a rastreabilidade completa.

## Mapeamento risco → perigo

Usa `risco_ergonomico_perigo` (migration 005). A `UNIQUE(id_risco)` dessa
tabela impede fisicamente mais de um perigo por risco — "mapeamento
ambíguo" não é um estado alcançável nesta arquitetura, então
`resolverPerigoResultado` só distingue "mapeado" de "não mapeado". Um
risco sem mapeamento nunca gera item (mensagem "Este risco ainda não
possui um perigo ocupacional associado." na lista de seleção, checkbox
desabilitado) — seleção manual de perigo não existe na arquitetura atual
e não foi adicionada aqui (mesma decisão de escopo do MVP-09B para
setor/cargo/função).

## Duplicidade e idempotência

`UNIQUE(id_inventario, id_avaliacao_ghe_risco)` (já existente desde a
migration 005) é a garantia final: **NULL** é permitido se repetir (itens
`MANUAL`), mas o mesmo par inventário+resultado nunca pode se repetir.
`importarResultadoGhe` captura o erro `23505` do Postgres e retorna
`JA_IMPORTADO` em vez de deixar a exceção estourar — importar o mesmo
resultado duas vezes nunca cria uma segunda linha. Testado.

`importarResultadosGhe` (lote) nunca mascara falha parcial: cada
resultado recebe seu próprio `status` (`IMPORTADO`, `JA_IMPORTADO`,
`SEM_MAPEAMENTO` ou `ERRO`) na resposta.

## Isolamento por empresa (cross-tenant)

`validarResultadoImportavel` compara `ghe.id_empresa` (resolvido a partir
do resultado) com `inventario_risco.id_empresa` e lança
`INVENTARIO_EMPRESA_INCOMPATIVEL` se forem diferentes — testado com uma
empresa/inventário temporários.

## Inventário de destino

Somente inventários com `status = 'RASCUNHO'` da empresa ativa aparecem
como destino (`listarInventariosRascunhoDaEmpresa`).
`validarResultadoImportavel` reforça isso no service (`INVENTARIO_NAO_EDITAVEL`)
mesmo que a lista da UI já tenha filtrado — testado contra um inventário
`PUBLICADO` e um `CANCELADO`.

## Caráter demonstrativo

`metodologia_risco.status_validacao` nunca é reinterpretado — a
importação copia o `codigo`/`versao` da metodologia, e a verificação de
"demonstrativa" (`verificarAlgumaMetodologiaDemonstrativa`) sempre
consulta o valor atual em `metodologia_risco`, nunca converte
`DEMONSTRATIVA` em `VALIDADA`. Três avisos obrigatórios ficam explícitos:
(1) na pré-visualização do wizard, antes de importar; (2) no modal "Ver
Origem" de cada item; (3) no cabeçalho do próprio inventário, sempre que
ao menos um item vier de metodologia demonstrativa.

## Cenário demonstrativo

Inventário "Inventário de Riscos Ocupacionais MVP-09C" (v1) criado pelo
fluxo real (nunca inserido como `PUBLICADO` via SQL), com 3 riscos reais
importados do processamento #4 do GHE-01 "Operadores de Produção"
(universo 190, metodologia ERGO-GHE-DEMO 1.0.0): Postura inadequada
(Alto), Movimentos repetitivos (Alto) e Fadiga ocupacional (Crítico).
Contexto completado com dados fictícios coerentes e inventário publicado
ao final — usado como prova de ponta a ponta do fluxo completo.

## Testes

Testado via Playwright contra o Supabase de demonstração real (nunca
mockado): fluxo principal completo (criar inventário → abrir wizard em
`resultado-ghe.html` → selecionar inventário/riscos → pré-visualizar →
importar → completar contexto → publicar → refresh → Ver Origem) e 8
casos de integridade isolados (processamento não concluído, inventário
publicado/cancelado, cross-tenant, sem mapeamento, duplicidade/idempotência,
imutabilidade de snapshot, item não afetado por novo processamento) — 19
cenários no total, todos passando. Suíte de domínio (60 testes
unitários) e regressão em 14 páginas do sistema (Home, Dashboard,
Colaboradores, GHEs, GHE detalhe, Avaliação GHE, Coleta, Consolidação,
Resultado GHE, Inventários, Inventário detalhe, Plano de Ação, Nova
Avaliação individual, Resultado individual) sem quebras.

## Limitações

- Seleção manual de perigo para risco sem mapeamento não existe (por
  design desta etapa — ver seção "Mapeamento").
- O wizard de importação vive inteiramente em `resultado-ghe.html`; não
  há uma rota alternativa a partir de `inventario-detalhe.html` para
  "importar mais riscos depois" (o caminho é sempre partir do resultado
  do GHE).
- Nenhuma UI para desfazer uma importação além do fluxo já existente de
  encerrar/cancelar o inventário inteiro (itens `MOTOR_GHE`, assim como
  `MANUAL`, não têm uma ação de "remover item" nesta etapa).
