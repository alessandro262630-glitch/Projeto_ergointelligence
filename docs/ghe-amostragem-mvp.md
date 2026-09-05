# GHE e Amostragem — MVP-06

## Conceito de GHE

GHE significa **Grupo Homogêneo de Exposição**: um conjunto de trabalhadores
que compartilham condições semelhantes de exposição ocupacional. A partir
desta feature, o GHE passa a ser a unidade principal de análise de risco do
ErgoIntelligence — o colaborador individual continua existindo no sistema
(cadastro, vínculo, avaliação individual), mas deixa de ser a única forma
de caracterizar risco em uma organização.

Um GHE **não** representa necessariamente um único cargo ou um único
colaborador. Pode abranger múltiplos trabalhadores e múltiplos cargos
compatíveis com aquele contexto de exposição (por isso a associação
GHE↔Cargo é N:N — ver `ghe_cargo`).

Novo fluxo conceitual (fundação implementada nesta feature em **negrito**):

```
EMPRESA
  ↓
SETOR
  ↓
**GHE**
  ↓
**UNIVERSO DE TRABALHADORES**
  ↓
**PLANO DE AMOSTRAGEM**
  ↓
**AMOSTRA (PARTICIPANTES)**
  ↓
COLETAS               ← MVP-07
  ↓
CONSOLIDAÇÃO          ← MVP-07
  ↓
RISCO DO GHE          ← MVP-07
```

## Papel do Universo

`ghe.universo` é o **tamanho declarado** do grupo homogêneo — um número
informado pelo usuário, não uma contagem de registros do sistema. Para a
demonstração, um GHE pode ter universo = 180 trabalhadores sem que exista
nenhum colaborador cadastrado individualmente para compor esse número. O
objetivo é demonstrar a escalabilidade conceitual do modelo (uma empresa
com centenas de trabalhadores não precisa de centenas de avaliações
individuais).

## Papel da Amostra

`plano_amostragem` documenta o **planejamento** da amostra de um GHE:
quantos trabalhadores serão efetivamente avaliados, com que critério, e
quem é o responsável. Importante: **`plano_amostragem.universo_snapshot`
preserva o universo do GHE no momento em que o plano foi criado** — se o
universo do GHE mudar depois, os planos já existentes continuam mostrando
o valor histórico, não o valor atual. Isso é intencional: um plano de
amostragem documenta uma decisão tomada em um momento específico.

## Diferença entre Universo, Amostra Planejada e Participantes Registrados

Estes são **três números diferentes**, e a interface nunca os confunde:

| Conceito | Onde vive | Significado |
|---|---|---|
| **Universo** | `ghe.universo` (atual) / `plano_amostragem.universo_snapshot` (histórico) | Tamanho declarado do grupo todo |
| **Amostra planejada** | `plano_amostragem.amostra_planejada` | Quantos trabalhadores o plano pretende avaliar |
| **Participantes registrados** | `COUNT(amostra_participante)` por plano | Quantos vínculos de colaboradores já foram efetivamente associados ao plano no sistema |

Exemplo real de demonstração: universo = 180, amostra planejada = 20,
participantes registrados = 6. Isso **não é um erro nem uma amostra
incompleta que bloqueia o sistema** — é o estado normal e esperado de um
MVP demonstrativo, onde não é necessário (nem desejável) cadastrar todos
os 20 participantes planejados.

## Percentual: apenas descritivo, nunca estatístico

A interface calcula `amostra_planejada ÷ universo_snapshot × 100` e exibe
o resultado como **"Participação planejada"**, sempre acompanhado do
texto: *"Percentual descritivo. A metodologia de amostragem deve ser
definida pelo profissional responsável."*

**O sistema nunca afirma que a amostra é estatisticamente representativa do
universo.** Não existe, nesta feature, nenhum cálculo de tamanho de amostra,
margem de erro, nível de confiança ou representatividade. Essas decisões
metodológicas são de responsabilidade do profissional de SST/ergonomia,
fora do escopo técnico desta fundação.

## Entidades Criadas (migration 002)

- **`ghe`** — Grupo Homogêneo de Exposição. Pertence a uma `empresa`
  (obrigatório) e, opcionalmente, a um `setor`. Campos: `codigo` (opcional,
  único por empresa), `nome` (único por empresa), `descricao`, `universo`
  (> 0), `ativo`.
- **`ghe_cargo`** — associativa N:N entre `ghe` e `cargo` (cargos
  compatíveis com aquele contexto de exposição).
- **`plano_amostragem`** — planejamento de amostra de um GHE. Guarda
  `universo_snapshot`, `amostra_planejada` (≤ universo_snapshot), `status`
  (`PLANEJADO`/`EM_COLETA`/`CONCLUIDO`/`CANCELADO` — decisão desta feature,
  pois não havia um conjunto de status pré-existente para isso),
  `criterio`/`observacao` em texto livre, `id_responsavel` (FK para
  `usuario`) e `data_plano`.
- **`amostra_participante`** — associativa entre `plano_amostragem` e
  `colaborador_vinculo` (não diretamente com `colaborador`, para preservar
  setor/cargo/período do vínculo). `UNIQUE(id_plano_amostragem,
  id_vinculo)` impede duplicidade.

### Cardinalidades

```
EMPRESA (1) ──< (N) GHE
SETOR   (1) ──< (N) GHE                [opcional]
GHE     (N) >──< (N) CARGO             via GHE_CARGO
GHE     (1) ──< (N) PLANO_AMOSTRAGEM
PLANO_AMOSTRAGEM (1) ──< (N) AMOSTRA_PARTICIPANTE
COLABORADOR_VINCULO (1) ──< (N) AMOSTRA_PARTICIPANTE
USUARIO (1) ──< (N) PLANO_AMOSTRAGEM   (responsável)
```

## Limitações do MVP (deliberadas)

- Não há cálculo de tamanho de amostra, representatividade estatística,
  consolidação de coletas ou risco do GHE — tudo isso é o MVP-07.
- Não há novo Motor de Risco; o Motor atual (avaliação individual) não foi
  alterado e continua funcionando exatamente como antes.
- Não há Inventário de Riscos, PGR, AET, riscos psicossociais, eSocial,
  PCMSO ou EPI.
- O Dashboard e o Plano de Ação (módulo FEIRA-04) não foram alterados.
- `plano_amostragem.universo_snapshot` e `id_responsavel` não são
  editáveis após a criação do plano (preserva o contexto histórico da
  decisão).
- Remoção de GHE é sempre lógica (`ativo`) — nunca `DELETE` físico, pois
  pode estar referenciado por planos de amostragem históricos.
- Associação de cargo (`ghe_cargo`) também usa soft delete (`ativo`):
  remover um cargo apenas marca `ativo = false`; associar novamente o
  mesmo cargo **reativa a mesma linha** em vez de tentar inserir uma nova
  (que violaria `UNIQUE(id_ghe, id_cargo)`). Testado e confirmado.
- Remoção de participante (`amostra_participante`) é `DELETE` físico — é
  uma relação de apoio (quem foi registrado como participante), não um
  registro de histórico de decisão como o próprio plano.
- **Isolamento por empresa é validado explicitamente na aplicação**
  (`gheService.js`), não apenas pelas FKs: setor, cargo e vínculo
  informados são sempre conferidos contra a empresa do GHE/plano antes de
  gravar. Testado com uma empresa/setor/cargo de outro tenant criados
  temporariamente via API e removidos em seguida — ambos os casos foram
  corretamente bloqueados (`SETOR_INCOMPATIVEL`, `CARGO_INCOMPATIVEL`).

## Estado Real Após os Testes (dados demonstrativos)

Preparado pelo fluxo normal da interface (nunca por INSERT manual) em
04/09/2026:

| GHE | Setor | Universo (atual) | Amostra planejada | Participantes registrados | Status do plano |
|---|---|---|---|---|---|
| Operadores de Produção (GHE-01) | Produção | 190 | 20 | 1 | Planejado |
| Equipe de Logística (GHE-02) | Logística | 85 | 12 | 1 | Planejado |
| Equipe Administrativa (GHE-03) | Administrativo | 90 | 10 | 0 | Planejado |
| Suporte de Tecnologia (GHE-04) | Tecnologia | 55 | 8 | 0 | Planejado |

- **Universo total demonstrativo**: 420 trabalhadores.
- **Amostra total planejada**: 50.
- **Colaboradores fictícios realmente cadastrados no sistema**: 6 — muito
  menor que o universo declarado, demonstrando deliberadamente que
  `ghe.universo` não depende de `COUNT(colaborador)`.
- O GHE-01 teve seu universo alterado de 180 para 190 durante o teste de
  histórico; o plano de amostragem já existente continua mostrando
  `universo_snapshot = 180`, confirmando que o snapshot não acompanha
  alterações posteriores do GHE.
- O mesmo vínculo (Marina Alves Demo) foi registrado como participante em
  dois planos de amostragem diferentes (GHE-01 e GHE-02) — confirma que a
  restrição de duplicidade é por plano (`UNIQUE(id_plano_amostragem,
  id_vinculo)`), não uma proibição global do vínculo.

## Próxima Etapa

**MVP-07 — Avaliação do GHE e Coletas da Amostra**, que deverá conectar:

```
GHE
 ↓
Plano de Amostragem
 ↓
Participantes
 ↓
Coletas
 ↓
Consolidação (risco do GHE)
```

Isso não foi implementado nesta feature.
