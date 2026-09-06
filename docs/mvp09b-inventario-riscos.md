# MVP-09B — Fundação Física do Inventário de Riscos Ocupacionais

> Implementação da arquitetura aprovada em
> `docs/mvp09a-arquitetura-inventario-riscos.md`. Este documento cobre o
> que foi efetivamente construído: banco, domínio, service e páginas.
> A importação automática de resultados do Motor GHE para o Inventário
> **não** foi implementada aqui — é o escopo do MVP-09C.

## Migration

`database/migrations/005_add_inventario_riscos.sql` (transacional,
`BEGIN`/`COMMIT`), aplicada com sucesso ao Supabase de demonstração.
Cria 5 tabelas novas e 11 índices. **Zero alterações** em qualquer
tabela existente — confirmado comparando a contagem de colunas de
`risco_ergonomico`, `avaliacao_ghe_risco`, `processamento_risco_ghe` e
das tabelas do Motor individual antes e depois da migration.

## Entidades

- **`perigo_ocupacional`** — catálogo global de perigos (`FISICO`,
  `QUIMICO`, `BIOLOGICO`, `ERGONOMICO`, `ACIDENTE`), independente de
  motor de cálculo. Soft delete via `ativo` (nunca `DELETE`).
- **`risco_ergonomico_perigo`** — ponte **N:1** entre `risco_ergonomico`
  (vocabulário do Motor GHE, intocado) e `perigo_ocupacional`.
  `UNIQUE(id_risco)` garante que cada risco ergonômico mapeia para no
  máximo um perigo.
- **`inventario_risco`** — cabeçalho de uma versão do documento por
  empresa (`numero_versao` sequencial, `id_inventario_anterior` encadeia
  a versão anterior). Status: `RASCUNHO` / `PUBLICADO` / `CANCELADO`.
  Um `CHECK` de banco (`chk_inventario_risco_publicacao_consistente`)
  garante que `publicado_por`/`publicado_em` só existem quando
  `status = 'PUBLICADO'`.
- **`inventario_risco_item`** — um perigo, em um GHE, dentro de uma
  versão. Campos de conteúdo são nulos no banco (a completude é
  responsabilidade da aplicação); apenas `id_inventario`/`id_ghe`/
  `id_perigo` são estruturalmente obrigatórios. Um `CHECK`
  (`chk_inventario_risco_item_origem_consistente`) garante, **no
  banco**, que um item `MANUAL` nunca carregue snapshot de
  classificação — reforço além da aplicação (nunca confiar só na UI).
- **`inventario_risco_item_atividade`** — associação N:N com
  `atividade` (reutilizada, nunca duplicada).

## Perigo vs. Risco

`risco_ergonomico` permanece exclusivamente o vocabulário do Motor GHE
(acoplado a regras/pontuação). O Inventário nunca referencia
`risco_ergonomico` diretamente — sempre `perigo_ocupacional`, resolvido
via `risco_ergonomico_perigo` quando a origem é o Motor. Isso mantém os
dois motores (ergonômico e o futuro cálculo de outras categorias)
desacoplados do vocabulário do Inventário.

## Versionamento e Imutabilidade

Nova versão = nova linha em `inventario_risco`, nunca `UPDATE`. Uma vez
`PUBLICADO`, o inventário e seus itens ficam bloqueados para edição —
reforçado em **duas camadas**:

1. **UI**: botões de edição escondidos quando `status !== 'RASCUNHO'`.
2. **Service** (`js/services/inventarioRiscoService.js`): toda função de
   escrita (`atualizarInventarioRascunho`, `atualizarItem`,
   `associarAtividade`, `removerAtividade`) chama
   `validarInventarioEditavel()` e lança `INVENTARIO_NAO_EDITAVEL` se o
   inventário não estiver em `RASCUNHO` — **mesmo que a chamada venha
   direto do console do navegador**, sem passar pela UI. Testado e
   confirmado via chamada direta ao service (ver seção de testes).

## Nova Versão (Clonagem)

`criarNovaVersao()` só aceita um inventário `PUBLICADO`. Clona cada
item (e suas atividades) para **linhas novas** — nunca compartilha a
linha física com a versão anterior. Inserção item a item (não em lote)
para garantir a correspondência exata entre cada item original e seu
clone, necessária para clonar as atividades certas de cada um. Testado
e confirmado: editar um item na v2 **não** altera o item correspondente
na v1.

## Snapshots

`trabalhadores_expostos_snapshot` é preenchido a partir de
`ghe.universo` **no momento da criação do item** e nunca recalculado —
testado explicitamente: um item criado com `universo=190` continua com
`190` mesmo depois do `ghe.universo` ser alterado para `999` e revertido.
Os snapshots de classificação (`pontuacao_snapshot`,
`classificacao_codigo_snapshot`, `classificacao_nome_snapshot`,
`metodologia_codigo_snapshot`, `metodologia_versao_snapshot`) estão
modelados e prontos para o MVP-09C — nenhum item `MOTOR_GHE` é criado
por esta feature.

## Completude e Publicação

`js/domain/inventario-risco/completudeInventario.js` (domínio puro,
zero dependência de Supabase/DOM) — `avaliarCompletudeItem(item,
atividades)` retorna `{ completo, camposPendentes }`. Um item incompleto
**pode existir livremente em RASCUNHO**. Campos avaliados: GHE, perigo,
fonte/circunstância, possíveis lesões/agravos, trabalhadores expostos,
contexto (ambiente **ou** posto **ou** processo **ou** atividade —
qualquer um satisfaz), medidas existentes, caracterização da exposição.
Itens de origem `MANUAL` nunca exigem classificação (decisão de
arquitetura do MVP-09A, seção 21) — registrar um perigo/contexto sem
nota quantificada é uma prática legítima de inventário.

`validarInventarioPublicavel()` (service) verifica: status `RASCUNHO`,
ao menos 1 item, todos os itens completos, e isolamento por empresa
(reconfirmado no momento da publicação, mesmo já bloqueado na criação
do item). `publicarInventario()` só executa após essa validação passar,
e o `UPDATE` inclui `.eq('status', 'RASCUNHO')` como defesa extra contra
corrida/duplo clique.

## Isolamento por Empresa (Tenant)

Toda função que recebe um `id_ghe`/`id_atividade` externo valida
explicitamente que ele pertence à mesma empresa do inventário
(`validarGheDaEmpresaDoInventario`, checagem de `atividade.id_empresa`
em `associarAtividade`) — a FK sozinha não impede um ID de outra
empresa. Testado com uma empresa e um GHE temporários: `criarItem`
lançou `GHE_INCOMPATIVEL` corretamente.

## Service

`js/services/inventarioRiscoService.js` — todas as funções da seção 51
do prompt implementadas: `listarInventarios`, `buscarInventario`,
`criarInventario`, `atualizarInventarioRascunho`, `listarItens`,
`buscarItem`, `criarItem`, `atualizarItem`, `cancelarRascunho`,
`validarItemCompleto`, `validarInventarioPublicavel`,
`publicarInventario`, `criarNovaVersao`, `listarAtividadesDoItem`,
`associarAtividade`, `removerAtividade`, `buscarOrigemItem` (mais
`listarPerigosOcupacionais`, necessária para o formulário de item).
Nenhuma função toca DOM.

## Páginas

- **`inventarios.html`** + `js/pages/inventarios.js`: lista de versões
  por empresa (versão, título, data, status, itens, GHEs abrangidos,
  criado por, publicado em), criação de novo inventário e criação de
  nova versão a partir de um publicado.
- **`inventario-detalhe.html`** + `js/pages/inventario-detalhe.js`:
  cabeçalho (com edição/cancelamento/publicação/nova versão conforme o
  status), painel de pendências de publicação, tabela de itens
  (GHE/categoria/perigo/atividades/expostos/classificação/origem/
  completude), modal de item com campos em cascata (GHE → ambiente →
  posto) e gestão de atividades associadas em tempo real. **Decisão de
  implementação**: "Abrir"/"Editar"/"Visualizar" da lista apontam para
  a mesma página de detalhe — a edição é habilitada ou não conforme o
  `status`, em vez de duas telas redundantes.
- **Sidebar**: link "Inventário de Riscos" adicionado a todas as 14
  páginas que já tinham o menu lateral (nunca rotulado como "PGR").

## Seed

`database/demo/07_seed_perigos_demo.sql` (idempotente) — 6 perigos
(5 ERGONOMICO cobrindo os riscos já usados no Motor GHE demonstrativo,
mais 1 FISICO para comprovar que o catálogo é agnóstico de categoria) e
5 mapeamentos `risco_ergonomico_perigo`. Nenhum `inventario_risco` é
criado pela seed (decisão do MVP-09A/09B: o cenário demo completo fica
para o MVP-09C).

## Testes

- **10 testes unitários** (`node --test`,
  `js/domain/inventario-risco/__tests__/completudeInventario.test.mjs`)
  cobrindo todos os critérios de completude, incluindo `0` como valor
  válido de expostos e item `MANUAL` sem classificação. Total do
  projeto: **60 testes, 100% passando**.
- **E2E real** (Playwright, Chrome, contra o Supabase de demonstração):
  criar inventário → `RASCUNHO`; criar item → snapshot correto; alterar
  `ghe.universo` e confirmar que o snapshot do item não muda; associar
  2 atividades e bloquear duplicidade; criar item incompleto → rascunho
  permitido, publicação bloqueada com lista de pendências; completar e
  publicar → `PUBLICADO`; confirmar imutabilidade **no service**
  (cabeçalho/item/atividade); criar nova versão → itens e atividades
  clonados com IDs novos; editar item na v2 sem afetar a v1; cross-tenant
  bloqueado; cancelar rascunho e confirmar bloqueio de edição depois;
  fluxo real via UI (criar inventário e item pelos formulários,
  persistência confirmada após F5). Todos os 20 cenários passaram.
- **Regressão**: Home, Dashboard, Colaboradores, Vínculos, GHEs, Plano
  de Ação, Avaliação do GHE, Resultado do GHE e a nova página de
  Inventários — nenhuma quebra. O único 404 observado é o artefato
  intermitente de favicon já documentado em sessões anteriores,
  não relacionado a esta feature.

## Limitações e Pendências

- Importação automática de resultados do Motor GHE (`origem_tipo =
  'MOTOR_GHE'`) **não implementada** — estrutura pronta (FK
  `id_avaliacao_ghe_risco`, snapshots, `CHECK` de consistência), mas
  nenhum fluxo cria esses itens ainda.
- Nenhum reforço de imutabilidade via *trigger* de banco além do que já
  existe (a imutabilidade de `PUBLICADO` hoje é garantida pelo service,
  não por um `CHECK`/trigger que rejeite `UPDATE` em `inventario_risco_item`
  quando o inventário pai está `PUBLICADO`) — documentado como
  possível reforço futuro, não bloqueador.
- Cancelamento de `RASCUNHO` sempre usa `status = CANCELADO` (nunca
  `DELETE` físico), mesmo para rascunhos vazios — decisão deliberada de
  auditoria, não uma limitação técnica.

## Próxima Etapa

**MVP-09C — Integração Motor GHE → Inventário + Cenário Demo**:
`RESULTADO DO GHE → SELECIONAR RESULTADOS → MAPEAR PERIGOS → IMPORTAR →
COMPLETAR CONTEXTO → PUBLICAR INVENTÁRIO`. Não implementado nesta etapa.
