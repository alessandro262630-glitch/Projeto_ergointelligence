# MVP-09A — Arquitetura do Inventário de Riscos Ocupacionais

> Documento de **arquitetura e análise**. Nenhum código, SQL ou migration
> foi criado. Pré-condição verificada ao vivo contra o Supabase antes de
> desenhar a integração (não presumida).

========================================
## 1. ESTADO ATUAL
========================================

**MVP-08C**: verificado ao vivo — **CONCLUÍDO E COM DADOS REAIS**.
`processamento_risco_ghe` tem 2 linhas `status = 'CONCLUIDO'` (ids 3 e 4,
mesma avaliação do GHE-01, metodologia `ERGO-GHE-DEMO 1.0.0`);
`avaliacao_ghe_risco` tem 8 resultados reais (4 riscos × 2
processamentos), cada um com `id_classificacao_ghe` preenchido.

**Integração disponível**: **SIM, sem aguardar nada** — a cadeia
`avaliacao_ghe_risco → processamento_risco_ghe → avaliacao_ghe → ghe` e
`avaliacao_ghe_risco → classificacao_risco_ghe` já existe, está povoada
e é exatamente a fonte que o Inventário precisa consumir. A integração
desenhada abaixo não é conceitual/hipotética — é imediatamente
implementável no MVP-09B.

========================================
## 2. OBJETIVO DO INVENTÁRIO
========================================

Transformar resultado de avaliação em **gestão estruturada do risco**:
`GHE → Avaliação → Processamento → Risco identificado → Inventário →
Plano de Ação → Acompanhamento`. O Inventário não é "lista de riscos" —
é um **documento versionado** que contextualiza cada risco na
organização (GHE, ambiente, atividade, fonte, exposição, medidas
existentes, classificação) e preserva esse contexto como histórico
imutável uma vez publicado.

========================================
## 3. PERIGO VS RISCO
========================================

- **Perigo** = fonte/situação com potencial de causar dano (catálogo,
  atemporal, independe de contexto).
- **Risco** = resultado da avaliação daquele perigo dentro de um
  contexto de exposição específico (o que `avaliacao_ghe_risco` já
  produz para o domínio ergonômico).

`risco_ergonomico` **não é** o catálogo universal de perigos — é
vocabulário específico do Motor ergonômico, com pontuação/regras
acopladas. O Inventário precisa de um catálogo mais amplo e
**agnóstico de motor** (`perigo_ocupacional`), que cobre categorias que
o sistema ainda nem processa automaticamente (químico, físico,
biológico, acidente).

========================================
## 4. CATÁLOGO DE PERIGOS
========================================

**Nova entidade: `perigo_ocupacional`** (catálogo global, mesmo padrão
de `risco_ergonomico`/`classificacao_risco` — sem `id_empresa`).

Campos: `id_perigo`, `codigo`, `categoria`, `nome`, `descricao`,
`ativo`, `criado_em`.

Categorias (CHECK, mesmo padrão de `risco_ergonomico.categoria`):
`FISICO`, `QUIMICO`, `BIOLOGICO`, `ERGONOMICO`, `ACIDENTE`. **Uma única
tabela genérica com coluna `categoria`** — não cinco tabelas por tipo
(seção 8 do prompt): não há necessidade estrutural de tabelas
diferentes por categoria, os campos são idênticos para qualquer
perigo, só o vocabulário/categoria muda.

O processamento automático hoje só cobre `ERGONOMICO` (via o Motor GHE);
as demais categorias existem na arquitetura desde já, mas sem nenhum
motor que as calcule (seção 36/37 — não implementar agora).

========================================
## 5. PONTE RISCO ERGONÔMICO → PERIGO
========================================

**Nova entidade: `risco_ergonomico_perigo`** — liga o vocabulário do
Motor ao catálogo do Inventário, sem o Motor conhecer o Inventário.

**Cardinalidade recomendada: N:1** (vários `risco_ergonomico` podem
apontar para o mesmo `perigo_ocupacional`; cada `risco_ergonomico` mapeia
para **no máximo um** `perigo_ocupacional`). Não recomendo N:N nesta
etapa: os 7 `risco_ergonomico` já são fatores específicos e estreitos
(cada um já é uma linha própria, não uma categoria ampla) — não há caso
de uso real, hoje, em que um único fator precise apontar para dois
perigos diferentes simultaneamente. O caso inverso (dois fatores
ergonômicos distintos mapeando para o mesmo perigo mais genérico do
catálogo, ex.: "Permanência prolongada em postura estática" e "Postura
inadequada" ambos → "Posturas inadequadas / posições forçadas") é
plausível e o N:1 já cobre isso sem exigir uma associativa complexa.

Campos: `id_mapeamento`, `id_risco` (FK `risco_ergonomico`, **UNIQUE** —
garante o N:1), `id_perigo` (FK `perigo_ocupacional`), `ativo`,
`criado_em`.

========================================
## 6. VERSIONAMENTO DO INVENTÁRIO
========================================

Nunca `UPDATE` para representar uma nova revisão. Nova versão = nova
linha em `inventario_risco`, com `id_inventario_anterior` apontando para
a anterior (cadeia de versões, não uma tabela de "histórico" separada).
Uma versão `PUBLICADA` nunca volta a `RASCUNHO` nem é editada pelo fluxo
normal (seção 14/16).

========================================
## 7. INVENTARIO_RISCO
========================================

**Nova entidade** (cabeçalho/versão do documento).

Campos: `id_inventario`, `id_empresa`, `numero_versao`,
`id_inventario_anterior` (nulo na v1), `titulo`, `descricao`, `status`,
`data_referencia`, `criado_por` (FK `usuario`), `criado_em`,
`publicado_em` (nulo até publicar).

**Adição justificada além da lista do prompt**: `publicado_por` (FK
`usuario`, nulo até publicar) — a seção 59 pede explicitamente "quem
publicou?" como requisito de auditoria; sem este campo essa pergunta não
teria resposta (o `criado_por` responde só "quem criou"). Reaproveita
`usuario`, nunca um cadastro paralelo de profissional (seção 58).

**Status**: `RASCUNHO`, `PUBLICADO`, `CANCELADO` (seção 16 — conjunto
mínimo, sem estado "em revisão" intermediário, que não tem uso claro
aqui).

`UNIQUE(id_empresa, numero_versao)`.

========================================
## 8. INVENTARIO_RISCO_ITEM
========================================

**Nova entidade** — um item = um perigo dentro de um contexto de
exposição (GHE), nunca vários GHEs numa única linha (seção 18: preferir
múltiplos itens a esconder contextos diferentes).

Campos: `id_inventario_risco_item`, `id_inventario` (FK, não editável
depois de publicado), `id_ghe` (FK `ghe`), `id_perigo` (FK
`perigo_ocupacional`), `id_ambiente` (FK `ambiente_trabalho`, opcional),
`processo_ambiente_descricao` (TEXT, opcional — fallback textual quando
a estrutura de ambiente/posto não representar bem o "processo", seção
20), `fonte_circunstancia` (TEXT — a circunstância REAL, distinta da
descrição genérica do catálogo de perigo, seção 22),
`possiveis_lesoes_agravos` (TEXT, nunca gerado por LLM/diagnóstico
automático, seção 23), `trabalhadores_expostos_snapshot` (INTEGER,
nunca lido ao vivo de `ghe.universo`, seção 19), `medidas_existentes`
(TEXT), `medida_existente_categoria` (opcional — ver seção 25 abaixo),
`caracterizacao_exposicao` (categórico opcional) +
`caracterizacao_exposicao_descricao` (TEXT complementar, seção 26),
`origem_tipo` (`MOTOR_GHE` | `MANUAL`), `id_avaliacao_ghe_risco` (FK,
nulo quando `MANUAL` — ver seção 11), snapshots de avaliação (seção
12), `criado_em`, `atualizado_em`.

**Sem coluna de status própria no item.** A imutabilidade é herdada do
`status` do `inventario_risco` pai — um item nunca fica "publicado"
enquanto o inventário está "rascunho" nem vice-versa; ter os dois
estados separados criaria a possibilidade de divergirem. "Status do
item" nas telas (seção 49) é um **indicador computado** (completo/
incompleto via `validarItemInventarioCompleto`), nunca uma coluna
persistida.

**Identidade estável** (seção 65, para o futuro Plano de Ação 2.0): a
própria PK (`id_inventario_risco_item`) já garante isso — nenhum campo
adicional necessário.

**Hierarquia de controles** (seção 25): `medida_existente_categoria`
(nulo, `CHECK IN ('ELIMINACAO','SUBSTITUICAO','ENGENHARIA',
'ADMINISTRATIVA','EPI')` quando preenchido) é um campo de
**classificação manual opcional** do que já existe — nunca uma ação
sugerida automaticamente. Isso deixa a estrutura pronta para uma tela
futura organizar medidas por hierarquia, sem construir nenhum motor
agora.

========================================
## 9. ATIVIDADES
========================================

**Nova entidade associativa: `inventario_risco_item_atividade`** (N:N
entre item e `atividade`, reaproveitada sem alteração/duplicação).
Campos: `id_inventario_risco_item_atividade`, `id_inventario_risco_item`
(FK), `id_atividade` (FK), `UNIQUE(id_inventario_risco_item,
id_atividade)`, `criado_em`. Física (não soft-delete) enquanto o
inventário estiver em `RASCUNHO` — mesma lógica de imutabilidade do item
pai: uma vez publicado, a associação também não muda.

========================================
## 10. CONTEXTO / EXPOSIÇÃO
========================================

`ambiente_trabalho`/`posto_trabalho`/`setor` são **reaproveitados**, não
duplicados — `id_ambiente` no item cobre a maioria dos casos reais
(ambientes já existem por setor). Quando o contexto real não for bem
representado por um `ambiente_trabalho` cadastrado (ex.: um "processo"
que atravessa vários ambientes), `processo_ambiente_descricao` (texto
livre) cobre o caso sem forçar a criação de uma entidade `PROCESSO` sem
necessidade comprovada (seção 20 — decisão explícita de não criar).
`caracterizacao_exposicao` usa um pequeno conjunto categórico
(`ROTINEIRA`/`NAO_ROTINEIRA`/`HABITUAL`/`INTERMITENTE`) + descrição
livre complementar, evitando tanto o enum rígido demais quanto o texto
livre sem nenhuma estrutura (seção 26).

========================================
## 11. ORIGEM E RASTREABILIDADE
========================================

Um único ponteiro de origem — `id_avaliacao_ghe_risco` — é suficiente
para responder **todas** as perguntas da seção 28 (qual GHE, qual
avaliação, qual processamento, qual metodologia, qual versão, qual
resultado, quando, qual classificação), porque esse encadeamento **já
existe** no schema do MVP-08:

```
avaliacao_ghe_risco → processamento_risco_ghe (metodologia, versão, data, cobertura)
                    → avaliacao_ghe → ghe
                    → classificacao_risco_ghe
```

Não adicionar FKs redundantes (`id_processamento_risco_ghe`,
`id_avaliacao_ghe` diretas no item) — isso duplicaria informação já
alcançável por join a partir de `id_avaliacao_ghe_risco` e criaria risco
de inconsistência se algum dia divergissem. "Ver origem" (seção 51) é
simplesmente: `resultado-ghe.html?id_processamento=<processamento
resolvido a partir de id_avaliacao_ghe_risco>`.

O Inventário **nunca** duplica a rastreabilidade regra-a-regra/
condição-a-condição do Motor (seção 52) — quem quiser esse nível de
detalhe abre o processamento de origem.

========================================
## 12. SNAPSHOTS
========================================

Apesar de as FKs de origem usarem `ON DELETE RESTRICT` (o que já impede
a **exclusão** de qualquer linha referenciada), duas coisas ainda podem
mudar **em uma linha existente**, sem excluí-la:

1. `classificacao_risco_ghe.nome`/`cor_hex` podem ser editados depois
   (não são versionados por si — diferente de `metodologia_risco`, cuja
   versão é imutável por ser uma linha nova a cada mudança).
2. Um bug/correção manual futura poderia, em tese, alterar
   `avaliacao_ghe_risco.pontuacao` depois de calculada.

Por isso, os snapshots citados no prompt são necessários e suficientes:
`pontuacao_snapshot`, `classificacao_codigo_snapshot`,
`classificacao_nome_snapshot`, `metodologia_codigo_snapshot`,
`metodologia_versao_snapshot`. Nenhum outro é proposto — não duplicar
"tudo" indiscriminadamente (seção 29 do prompt).

========================================
## 13. PUBLICAÇÃO E IMUTABILIDADE
========================================

`validarInventarioPublicavel(idInventario)` (conceitual, seção 70)
verifica: `status = RASCUNHO`; existe ≥1 item; todos os itens completos
(`validarItemInventarioCompleto` em cada um); todos os `id_ghe`
referenciados pertencem à `id_empresa` do inventário (bloqueio
cross-tenant, seção 57); toda origem `MOTOR_GHE` aponta para um
`avaliacao_ghe_risco` cujo processamento é `CONCLUIDO`; nenhuma
duplicidade inválida (seção 8/34 abaixo). Publicar é a única transição
que grava `publicado_em`/`publicado_por` e, a partir daí, todo o
conjunto (inventário + itens + associações de atividade) fica
congelado pelo fluxo normal — qualquer alteração exige nova versão.

**Item incompleto**: pode existir livremente em `RASCUNHO` (seção 40).
`PUBLICAR` bloqueia e a mensagem de erro deve identificar
item-a-item quais campos faltam (nunca um erro genérico "há itens
incompletos").

========================================
## 14. NOVA VERSÃO
========================================

**Recomendação: clonar os itens da versão anterior** (opção B da seção
41) para a nova versão em `RASCUNHO` — preservar contexto e permitir
revisão item a item é mais útil na prática do que começar vazio (opção
A exigiria redigitar tudo, mesmo quando só 1 risco mudou). Itens
clonados são **linhas novas**, nunca compartilhadas com a versão
anterior (seção 42) — a versão 1 nunca é afetada por edições feitas nos
clones da versão 2. Cada clone recomeça sua checagem de completude do
zero (mesmo que já viesse completo, por segurança).

========================================
## 15. MODELO CONCEITUAL FINAL
========================================

```
EMPRESA (1) ──< (N) INVENTARIO_RISCO
                        │ id_inventario_anterior (auto-referência, 0..1)
                        │
                        └──< (N) INVENTARIO_RISCO_ITEM
                                    ├──> GHE
                                    ├──> PERIGO_OCUPACIONAL
                                    ├──> AMBIENTE_TRABALHO (opcional)
                                    ├──<N:N>── ATIVIDADE (via INVENTARIO_RISCO_ITEM_ATIVIDADE)
                                    └──> (opcional, quando origem_tipo=MOTOR_GHE)
                                         AVALIACAO_GHE_RISCO
                                              └──> PROCESSAMENTO_RISCO_GHE ──> AVALIACAO_GHE ──> GHE
                                              └──> CLASSIFICACAO_RISCO_GHE

RISCO_ERGONOMICO (N) ──> (1) PERIGO_OCUPACIONAL   [via RISCO_ERGONOMICO_PERIGO, id_risco UNIQUE]

USUARIO (1) ──< (N) INVENTARIO_RISCO   [como criado_por]
USUARIO (1) ──< (N) INVENTARIO_RISCO   [como publicado_por, quando publicado]
```

========================================
## 16. CARDINALIDADES
========================================

| Relação | Cardinalidade | Observação |
|---|---|---|
| Empresa → Inventário | 1:N | tenant |
| Inventário → Inventário (versão anterior) | 0..1:1 | cadeia linear, nunca ramificada |
| Inventário → Item | 1:N | |
| GHE → Item | 1:N | item nunca aponta para mais de 1 GHE (seção 18) |
| Perigo → Item | 1:N | |
| Item ↔ Atividade | N:N | via associativa |
| Item → Avaliação_GHE_Risco | N:1, opcional | só quando `origem_tipo = MOTOR_GHE`; `UNIQUE(id_inventario, id_avaliacao_ghe_risco)` quando preenchido (evita reimportar o mesmo resultado duas vezes no mesmo inventário) |
| Risco_ergonomico → Perigo_ocupacional | N:1 | ver seção 5 |
| Usuário → Inventário | 1:N (×2 papéis) | criado_por, publicado_por |

Nenhuma cardinalidade fica em aberto como "provavelmente N:N" sem
decisão (seção 77 do prompt).

========================================
## 17. ENTIDADES NOVAS
========================================

1. **`perigo_ocupacional`** — catálogo global de perigos, agnóstico de
   motor. Necessária: `risco_ergonomico` é estreito demais (só
   ergonômico, acoplado a pontuação) para servir de catálogo do
   Inventário.
2. **`risco_ergonomico_perigo`** — ponte N:1 entre o vocabulário do
   Motor e o catálogo do Inventário. Necessária para o Motor nunca
   precisar conhecer o Inventário (seção 9).
3. **`inventario_risco`** — cabeçalho/versão do documento. Necessária:
   sem isso não há como versionar/publicar/tornar imutável um conjunto
   de itens como unidade.
4. **`inventario_risco_item`** — o próprio risco contextualizado.
   Necessária: é o conteúdo do documento.
5. **`inventario_risco_item_atividade`** — associativa N:N com
   `atividade`. Necessária porque um item pode abranger mais de uma
   atividade, e `atividade` não deve ser duplicada.

Nenhuma das cinco hipóteses do prompt foi descartada — todas se
confirmaram necessárias pela análise acima.

========================================
## 18. MATRIZ DE IMPACTO
========================================

| ENTIDADE ATUAL | AÇÃO | MOTIVO |
|---|---|---|
| `risco_ergonomico` | MANTER | vocabulário do Motor individual, intocado; ponte via mapeamento, nunca reinterpretado |
| `avaliacao_ghe_risco` | MANTER + REFERENCIAR | origem direta de itens `MOTOR_GHE` |
| `processamento_risco_ghe` | MANTER + REFERENCIAR (indireto, via `avaliacao_ghe_risco`) | contexto de metodologia/versão/data da origem |
| `avaliacao_ghe` / `ghe` | MANTER + REFERENCIAR | contexto organizacional do item |
| `classificacao_risco_ghe` | MANTER + REFERENCIAR | fonte do snapshot de classificação |
| `atividade` | MANTER + REUTILIZAR | via nova associativa, nunca duplicada |
| `ambiente_trabalho` / `posto_trabalho` / `setor` | MANTER + REUTILIZAR (opcional) | contexto de processo/ambiente, com fallback textual |
| `usuario` | MANTER + REUTILIZAR | `criado_por`/`publicado_por`, nunca cadastro paralelo |
| `empresa` | MANTER + REFERENCIAR | tenant do inventário |
| `plano_acao` / `acao_plano` | **MANTER INTACTA** | não conectada nesta etapa — `plano_acao.id_avaliacao` hoje só aceita avaliação individual; conectar ao Inventário é o futuro "Plano de Ação 2.0", fora de escopo (seção 44) |
| Motor GHE (`motorRiscoGhe.js`, `motorRiscoGheService.js`) | **MANTER INTACTO** | Inventário é consumidor, nunca coloca regra de negócio dentro do Motor (seção 55) |
| Motor individual (`motorRisco.js`/`classificadorRisco.js`/`riscoService.js`) | **MANTER INTACTO** | fora de escopo, nunca tocado (seção 56) |

========================================
## 19. CONTRATO DE IMPORTAÇÃO
========================================

```
importarResultadoGheParaInventario({
  idInventario,
  idAvaliacaoGheRisco,       // origem - encadeia tudo mais via join
  idPerigoOcupacional,       // sugerido automaticamente via risco_ergonomico_perigo
                             // a partir de avaliacao_ghe_risco.id_risco, mas confirmável/ajustável
  contexto: {
    idAmbiente,                       // opcional
    processoAmbienteDescricao,        // opcional
    idsAtividades,                    // array, opcional
    fonteCircunstancia,               // texto
    possiveisLesoesAgravos,           // texto, opcional
    trabalhadoresExpostos,            // sugerido = ghe.universo NO MOMENTO da importação,
                                       // sempre editável e sempre snapshotado
    medidasExistentes,                // texto, opcional
    medidaExistenteCategoria,         // opcional
    caracterizacaoExposicao,          // opcional
    caracterizacaoExposicaoDescricao, // opcional
  }
})
```

Bloqueia (seção 32/33): processamento de origem que não seja
`CONCLUIDO`; e nunca seleciona um processamento "automaticamente" sem o
usuário ver explicitamente qual metodologia/versão/data está
importando.

========================================
## 20. CONTRATO DO ITEM
========================================

```
{
  id, idInventario,
  contexto: { ghe, ambiente, atividades: [...], processoAmbienteDescricao },
  perigo: { codigo, categoria, nome },
  fonteCircunstancia, possiveisLesoesAgravos,
  exposicao: { trabalhadoresExpostosSnapshot, caracterizacao, caracterizacaoDescricao },
  medidasExistentes, medidaExistenteCategoria,
  avaliacao: {
    origemTipo,                 // MOTOR_GHE | MANUAL
    idAvaliacaoGheRisco,        // nulo se MANUAL
    pontuacaoSnapshot,          // nulo se MANUAL
    classificacaoCodigoSnapshot, classificacaoNomeSnapshot,   // nulos se MANUAL
    metodologiaCodigoSnapshot, metodologiaVersaoSnapshot,     // nulos se MANUAL
  },
  completude: { completo, camposPendentes: [...] }   // calculado, nunca persistido
}
```

========================================
## 21. REGRAS DE COMPLETUDE
========================================

`validarItemInventarioCompleto(item)` → `{ completo, camposPendentes }`.
Obrigatórios para publicação: GHE, perigo, `fonteCircunstancia`,
`possiveisLesoesAgravos`, `trabalhadoresExpostosSnapshot`, pelo menos um
entre atividade/ambiente/`processoAmbienteDescricao` (algum contexto de
processo precisa existir). **Decisão de implementação** (não regra
confirmada por fonte externa): itens `MANUAL` **podem** ser publicados
sem nenhuma classificação de risco preenchida — registram a presença de
um perigo/contexto gerenciado sem uma nota quantificada, o que é uma
prática legítima de inventário (nem todo perigo listado precisa ter
sido processado por um motor automático); a validação de completude
simplesmente não exige campos de classificação quando `origem_tipo =
MANUAL`, e nunca preenche esses campos com um valor inventado (seção
35).

========================================
## 22. RISCOS ARQUITETURAIS
========================================

- **Duplicidade entre `risco_ergonomico` e `perigo_ocupacional`**:
  mitigado pela ponte N:1 explícita — nunca inserir a mesma informação
  duas vezes, `risco_ergonomico` permanece só vocabulário do Motor.
- **Perda de histórico**: mitigado por nunca fazer `UPDATE` para
  representar nova versão, e nunca `DELETE` de inventário `PUBLICADO`.
- **Edição de inventário publicado**: mitigado por regra de aplicação
  (não DB) que bloqueia qualquer escrita em itens/associações quando o
  inventário pai está `PUBLICADO` — recomendo reforçar isso também
  com um `CHECK`/trigger na modelagem física (MVP-09B) se o Postgres
  permitir de forma simples; documentar como pendência de decisão de
  implementação.
- **Item apontando para processamento errado**: mitigado por
  `idAvaliacaoGheRisco` ser resolvido pelo próprio usuário a partir de
  uma lista explícita (nunca "o mais recente" escolhido automaticamente
  — seção 33).
- **Classificação atual substituindo snapshot histórico**: mitigado
  pelos snapshots da seção 12 — a tela do item nunca faz join ao vivo
  em `classificacao_risco_ghe` para exibir o nome/cor atuais.
- **GHE de outra empresa**: mitigado por `validarInventarioPublicavel`
  conferir `id_empresa` de todo `id_ghe` referenciado contra a empresa
  do inventário.
- **Duplicação de risco no mesmo contexto**: mitigado por
  `UNIQUE(id_inventario, id_avaliacao_ghe_risco)` (nunca reimporta o
  mesmo resultado 2x), sem impedir cenários legítimos de mesmo
  perigo+GHE com atividade/fonte diferentes (seção 34).
- **Confusão entre Inventário e PGR completo**: mitigado por nunca
  rotular a tela como "PGR" — sempre "Inventário de Riscos
  Ocupacionais", com Plano de Ação como módulo integrador futuro
  (seção 45).
- **Dados incompletos publicados**: mitigado por
  `validarInventarioPublicavel` bloquear a publicação, nunca só avisar.

========================================
## 23. CASOS DE TESTE
========================================

*(Para o futuro MVP-09B — mantidos na numeração do prompt.)*

1. Criar inventário v1. 2. Importar risco do GHE. 3. Importar outro
risco. 4. Bloquear duplicidade (mesmo `id_avaliacao_ghe_risco` 2x no
mesmo inventário). 5. Completar contexto de um item incompleto. 6.
Publicar. 7. Impedir edição de item/inventário após publicação. 8.
Criar versão 2 (clonando itens da v1). 9. Alterar um item na v2. 10.
Confirmar v1 intacta após a alteração na v2. 11. GHE muda `universo`
depois de um item já publicado. 12. v1 mantém o `trabalhadores_
expostos_snapshot` antigo, nunca o novo `universo`. 13. Novo
processamento do Motor GHE muda a classificação de um risco. 14. Versão
antiga do Inventário (com o snapshot velho) permanece intacta mesmo
assim. 15. GHE de outra empresa bloqueado ao tentar importar/publicar.
16. Item incompleto bloqueia a publicação (mensagem identifica QUAL
item/campo). 17. "Ver origem" de um item `MOTOR_GHE` abre exatamente o
processamento correto.

========================================
## 24. IMPACTO FUTURO NO BANCO
========================================

- **Tabelas novas**: **5** (`perigo_ocupacional`,
  `risco_ergonomico_perigo`, `inventario_risco`,
  `inventario_risco_item`, `inventario_risco_item_atividade`).
- **Alterações em tabelas existentes**: **0** (nenhuma coluna nova em
  `risco_ergonomico`, `avaliacao_ghe_risco`, `ghe`, `atividade`,
  `plano_acao` ou qualquer outra).
- **Alterações destrutivas**: **0**.

========================================
## 25. O QUE NÃO SERÁ IMPLEMENTADO
========================================

Plano de Ação 2.0 (conectar Inventário a `plano_acao`/`acao_plano`);
EPI; PCMSO; CAT; eSocial; Treinamentos; Dashboard de PGR; motor de
cálculo para perigos físicos/químicos/biológicos/de acidente;
hierarquia de controles como motor (só o campo de classificação manual
opcional); apresentação do Inventário como "PGR completo".

========================================
## 26. STATUS MVP-09B
========================================

## PRONTO PARA MODELAGEM FÍSICA

**Justificativa**: todas as entidades, campos, cardinalidades, contratos
e regras de completude/publicação estão definidos sem depender de
nenhuma decisão externa pendente (diferente do MVP-08, que dependia de
validação metodológica científica — aqui as decisões são de modelagem
de produto, já tomadas e justificadas nesta análise). A única
integração externa necessária (Motor GHE) já existe e tem dados reais
verificados. Os poucos pontos marcados como "decisão de implementação"
(clonagem de versão, publicação de item manual sem classificação,
reforço de imutabilidade via trigger) são escolhas de engenharia
razoáveis, não bloqueios.

========================================
## 27. STATUS FINAL
========================================

## MVP-09A — ARQUITETURA APROVADA
