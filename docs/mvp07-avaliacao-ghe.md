# Avaliação do GHE, Coletas da Amostra e Consolidação Descritiva — MVP-07

> Este documento cobre a fundação implementada nesta feature. A seção
> "Estado Real Após os Testes" é preenchida somente depois que a migration
> 003 estiver aplicada no Supabase e os testes ao vivo (via interface real)
> forem executados — ver observação no final do arquivo.

## Continuação do fluxo conceitual do GHE

O MVP-06 estabeleceu GHE → Universo → Plano de Amostragem → Participantes.
Esta feature conecta a próxima etapa: **participantes registrados passam a
ter uma coleta de evidências**, e essas coletas são consolidadas de forma
puramente descritiva.

```
GHE
 ↓
Plano de Amostragem
 ↓
Participantes (amostra_participante)
 ↓
**AVALIAÇÃO DO GHE**        ← MVP-07 (novo)
 ↓
**COLETAS (uma por participante)**  ← MVP-07 (novo)
 ↓
**CONSOLIDAÇÃO DESCRITIVA**  ← MVP-07 (novo)
 ↓
RISCO DO GHE                ← MVP-08 (fora de escopo aqui)
```

## O que é uma "Avaliação do GHE"

`avaliacao_ghe` é o cabeçalho de uma rodada de coleta coletiva sobre um GHE:
quem é o avaliador, quando começou, em que plano de amostragem ela se apoia
e em que status está (`RASCUNHO` / `EM_COLETA` / `CONSOLIDADA` /
`CANCELADA`). Um GHE pode ter mais de uma Avaliação do GHE ao longo do
tempo (uma nova rodada após a anterior ser consolidada) — a interface
sempre trabalha com a mais recente.

**Importante**: a Avaliação do GHE nunca substitui a avaliação ergonômica
individual (`avaliacao_ergonomica`). São dois processos paralelos e
independentes:

| | Avaliação Ergonômica (individual) | Avaliação do GHE (coletiva) |
|---|---|---|
| Unidade avaliada | Um colaborador/vínculo | Um GHE (grupo) |
| Resultado | Classificação de risco definitiva (Motor de Risco) | Estatística descritiva (sem classificação de risco nesta feature) |
| Tabelas | `avaliacao_ergonomica`, `resposta_avaliacao`, `resposta_opcao` | `avaliacao_ghe`, `coleta_ghe`, `resposta_coleta`, `resposta_coleta_opcao` |

## O que é uma "Coleta"

`coleta_ghe` é uma sessão de captura de respostas de **um único
participante** dentro de uma Avaliação do GHE — nunca um "resultado
ocupacional individual definitivo". Cada participante da amostra
(`amostra_participante`) pode ter no máximo uma coleta por Avaliação do GHE
(`UNIQUE(id_avaliacao_ghe, id_amostra_participante)`).

O questionário respondido em cada coleta é **exatamente o mesmo catálogo**
usado na avaliação individual (`pergunta_avaliacao` / `opcao_resposta`) —
não existe um segundo catálogo de perguntas para o GHE. Isso significa que
o mesmo conjunto de perguntas gera dois tipos de análise diferentes
dependendo de onde a resposta é gravada: individual (com Motor de Risco) ou
coletiva/descritiva (sem Motor de Risco).

## O que a Consolidação NÃO faz

A consolidação (`consolidacaoGheService.js` / `consolidacao-ghe.html`)
produz **somente estatística descritiva**: contagens, percentuais,
mínimo/máximo/média. Ela explicitamente:

- **Não** calcula pontuação de risco.
- **Não** aciona `motorRisco.js`, `classificadorRisco.js` ou `riscoService.js`.
- **Não** atribui uma classificação (Baixo/Moderado/Alto/Crítico) ao GHE.
- **Não** afirma representatividade estatística da amostra — apenas exibe
  "cobertura descritiva" (coletas concluídas ÷ amostra planejada).

A classificação de risco do GHE é escopo do **MVP-08**, ainda não
implementado. Todas as telas desta feature exibem o aviso: *"Resultados
descritivos da amostra. A classificação do risco do GHE será realizada
conforme metodologia específica de avaliação."*

## Estatística descritiva por tipo de pergunta

| `tipo_resposta` | O que é calculado |
|---|---|
| `BOOLEANO` | Contagem e percentual de Sim / Não |
| `NUMERICO` | Contagem de respostas, mínimo, máximo, média |
| `ESCALA` | Distribuição por opção (contagem/percentual); média descritiva via `opcao_resposta.valor_numero` **somente** quando todas as opções da pergunta têm esse valor preenchido — sempre rotulada como não classificatória |
| `ESCOLHA_UNICA` | Distribuição por opção (contagem/percentual), mesma lógica de `ESCALA` |
| `ESCOLHA_MULTIPLA` | Frequência por opção — cada coleta pode marcar mais de uma opção, então **a soma dos percentuais pode ultrapassar 100%** (isso é esperado e nunca normalizado) |
| `TEXTO` | Contagem de respostas preenchidas + listagem bruta do texto (nenhuma análise ou resumo automático) |

Com zero coletas concluídas, a consolidação não lança erro: retorna todas
as perguntas com `total_respondidas: 0`.

## Entidades Criadas (migration 003)

- **`avaliacao_ghe`** — cabeçalho da rodada de avaliação coletiva. FK para
  `ghe`, `plano_amostragem` e `usuario` (avaliador). `tipo_avaliacao`
  restrito a `AEP` nesta feature. `status`:
  `RASCUNHO`/`EM_COLETA`/`CONSOLIDADA`/`CANCELADA`.
- **`coleta_ghe`** — uma coleta por participante da amostra dentro de uma
  Avaliação do GHE. `UNIQUE(id_avaliacao_ghe, id_amostra_participante)`.
  `status`: `EM_ANDAMENTO`/`CONCLUIDA`/`CANCELADA`. `data_conclusao`
  obrigatória quando `CONCLUIDA` (`chk_coleta_ghe_conclusao`).
- **`resposta_coleta`** — espelha `resposta_avaliacao`, mas **sem**
  `pontuacao_calculada` (uma coleta nunca é pontuada). `UNIQUE(id_coleta,
  id_pergunta)` permite UPSERT.
- **`resposta_coleta_opcao`** — espelha `resposta_opcao`, associando uma
  `resposta_coleta` a uma ou mais `opcao_resposta` (para
  `ESCALA`/`ESCOLHA_UNICA`/`ESCOLHA_MULTIPLA`).

### Cardinalidades

```
GHE (1) ──< (N) AVALIACAO_GHE
PLANO_AMOSTRAGEM (1) ──< (N) AVALIACAO_GHE
USUARIO (1) ──< (N) AVALIACAO_GHE            (avaliador)
AVALIACAO_GHE (1) ──< (N) COLETA_GHE
AMOSTRA_PARTICIPANTE (1) ──< (N) COLETA_GHE  (no máx. 1 por avaliação, via UNIQUE)
COLETA_GHE (1) ──< (N) RESPOSTA_COLETA
RESPOSTA_COLETA (1) ──< (N) RESPOSTA_COLETA_OPCAO
PERGUNTA_AVALIACAO (1) ──< (N) RESPOSTA_COLETA   (catálogo reaproveitado, não duplicado)
```

## Arquitetura de serviços (JS)

- **`js/services/avaliacaoGheService.js`** — ciclo de vida de
  `avaliacao_ghe`/`coleta_ghe`: `iniciarOuContinuarAvaliacaoGhe`
  (idempotente: reaproveita uma avaliação já aberta em vez de criar uma
  segunda em paralelo), `garantirAvaliacaoGheEditavel`,
  `listarProgressoColetas` (todos os participantes do plano, mesmo os sem
  coleta ainda), `criarOuObterColeta` (valida que o participante pertence
  ao mesmo plano da avaliação), `validarColetaParaFinalizacao`/
  `finalizarColeta` (mesmo padrão de duas fases de
  `avaliacaoService.js`/AVA-05: validar sem alterar nada, só então
  escrever), `consolidarAvaliacaoGhe` (transição explícita para
  `CONSOLIDADA`).
- **`js/services/respostaColetaService.js`** — espelha
  `respostaService.js` linha a linha (mesma semântica de "vazio" — `false`
  e `0` são respostas válidas —, mesmo upsert por chave única, mesma
  segunda barreira de validação antes de concluir), trocando
  `avaliacao_ergonomica`/`resposta_avaliacao`/`resposta_opcao` por
  `coleta_ghe`/`resposta_coleta`/`resposta_coleta_opcao` e removendo toda
  lógica de pontuação.
- **`js/services/consolidacaoGheService.js`** — somente leitura; nunca
  escreve no banco. Lê coletas `CONCLUIDA`, agrupa respostas por pergunta e
  aplica a tabela de estatística descritiva acima.

Nenhum dos três serviços importa `motorRisco.js`, `classificadorRisco.js`
ou `riscoService.js`.

## Páginas novas

- **`avaliacao-ghe.html`** — painel de progresso: números de destaque
  (universo, amostra planejada, participantes registrados, coletas
  concluídas), tabela com TODOS os participantes registrados e o status da
  coleta de cada um (`Não iniciada`/`Em andamento`/`Concluída`), botão por
  linha para iniciar/continuar/ver a coleta, e o botão explícito "Consolidar
  Avaliação do GHE" (transição de status, separado de "ver consolidação").
- **`coleta-ghe.html`** — reaproveita a mesma UI de navegação
  pergunta-a-pergunta de `questionario.html` (barra de progresso,
  Anterior/Próxima, controles por tipo), mas persiste em
  `resposta_coleta`/`resposta_coleta_opcao` via `respostaColetaService.js`.
  "Concluir coleta" segue o mesmo padrão de duas etapas (validar → modal de
  confirmação → concluir) da finalização de avaliação individual.
- **`consolidacao-ghe.html`** — somente leitura, agrupada por categoria da
  pergunta (`formatarCategoria`), com o aviso fixo de que isto não é uma
  classificação de risco, e um alerta específico quando a amostra planejada
  ainda não foi totalmente coletada (sem bloquear a visualização).

`ghe-detalhe.html` ganhou um card "Avaliação do GHE" com os botões "Nova
Avaliação do GHE" / "Continuar Avaliação" / "Ver Consolidação", condicionais
ao estado atual.

## Decisões de dados demonstrativos

Diferente da avaliação individual (onde os dados sempre nascem pelo fluxo
real da interface, nunca por `INSERT` — ver `docs/cenario-demo-feira.md`),
esta feature autoriza popular `avaliacao_ghe`/`coleta_ghe`/`resposta_coleta`
por SQL de demonstração, porque **nenhuma dessas tabelas é um "resultado"
no sentido do Motor de Risco** (não têm pontuação, não passam por
classificação). Mesmo assim, `database/demo/04_seed_demo_mvp07.sql` cria
apenas o cabeçalho `avaliacao_ghe` por SQL; as coletas/respostas
propriamente ditas foram geradas através do fluxo real de
`coleta-ghe.html` (mesmo raciocínio já usado em FEIRA-02/03/05: exercitar e
validar a própria interface nova, em vez de confiar só em INSERTs
desacoplados da aplicação).

## Limitações do MVP (deliberadas)

- Não há classificação de risco do GHE — isso é o MVP-08.
- Não há Inventário de Riscos, PGR, AET, riscos psicossociais, eSocial,
  PCMSO ou EPI.
- O Dashboard, o Plano de Ação (FEIRA-04) e o fluxo de avaliação individual
  não foram alterados por esta feature.
- Cancelamento de coleta/avaliação do GHE (transição para `CANCELADA`) tem
  suporte no schema (`CHECK` de status), mas nenhuma ação de UI para
  cancelar foi construída nesta feature — fora do escopo solicitado.
- `resposta_coleta` nunca tem `pontuacao_calculada` porque essa coluna nem
  existe na tabela (diferente de `resposta_avaliacao`).

## Correção: consolidação sem nenhuma coleta concluída

`consolidarAvaliacaoGhe(idAvaliacaoGhe)` originalmente só verificava se a
Avaliação do GHE ainda estava editável (`RASCUNHO`/`EM_COLETA`) antes de
mudar seu status para `CONSOLIDADA` — nada impedia consolidar uma
avaliação recém-criada, sem nenhuma coleta sequer iniciada. Corrigido para
contar as coletas com `status = 'CONCLUIDA'` da avaliação antes de
permitir a transição; com zero coletas concluídas, lança
`CONSOLIDACAO_SEM_COLETAS` e a consolidação é recusada. A interface
(`avaliacao-ghe.html`) também passou a desabilitar o botão "Consolidar
Avaliação do GHE" nesse caso, com uma dica explicando o motivo — mas a
regra que realmente protege o dado é a do service, não a do botão
desabilitado (o service foi testado diretamente, contornando a
interface, e bloqueou corretamente).

Isso não bloqueia a **visualização** da consolidação descritiva: mesmo
com zero coletas concluídas, `consolidacao-ghe.html` continua acessível e
mostra todas as perguntas com `total_respondidas: 0` — o bloqueio é
apenas sobre a transição de status da Avaliação do GHE, nunca sobre a
leitura descritiva.

## Estado Real Após os Testes

Testado com Chrome real (Playwright), contra o Supabase de produção do
ambiente demonstrativo, em 05-06/09/2026, após a aplicação da migration
003 e as duas correções acima:

- **GHE-01 (Operadores de Produção)**: Avaliação do GHE `CONSOLIDADA`
  (id_avaliacao_ghe=6), 2 participantes registrados (Juliana Ribeiro,
  Bruno Martins — ambos compatíveis com setor Produção/cargos Operador e
  Supervisor de Produção), 2 coletas `CONCLUIDA` com respostas contrastantes
  de propósito (perfil "alto" para Juliana, perfil "baixo" para Bruno) para
  validar a matemática de consolidação com valores realmente diferentes.
- **Consolidação descritiva do GHE-01** conferida pergunta a pergunta
  contra o cálculo manual esperado:
  - Q01 (BOOLEANO): 2 respondidas, Sim 1 (50%), Não 1 (50%).
  - Q05 (ESCALA): distribuição Nunca=1/Sempre=1, média descritiva = 2
    (média de 0 e 4).
  - Q11 (ESCOLHA_ÚNICA): distribuição Ótimo=1/Péssimo=1, média descritiva = 2.
  - Q20 (TEXTO, opcional): 1 resposta registrada (Bruno deixou em branco
    de propósito, confirmando que "vazio opcional" não aparece como
    resposta) — texto exato preservado.
  - Todos os valores bateram exatamente com o esperado.
- **GHE-04 (Suporte de Tecnologia)**: 1 participante (Carlos Mendes,
  compatível), Avaliação do GHE criada e deixada em `EM_COLETA` sem
  nenhuma coleta concluída — usada deliberadamente para confirmar o
  bloqueio de consolidação com zero coletas, tanto no service quanto no
  botão da interface.
- **GHE-02 (Equipe de Logística)**: corrigido durante os testes — não
  tinha nenhum cargo associado (o que a correção desta rodada passou a
  bloquear); associado o cargo "Auxiliar de Logística" via
  `associarCargoAoGhe`, deixando o GHE apto a receber participantes.
- **GHE-03 (Equipe Administrativa)**: mantido com seu único participante
  pré-existente (Marina Alves), que é de fato compatível (setor
  Administrativo, cargo Assistente Administrativo).
- Nenhum participante incompatível permanece registrado em nenhum plano de
  amostragem ao final dos testes.
- Catálogo técnico (`pergunta_avaliacao`, `opcao_resposta`,
  `regra_risco`, `classificacao_risco`, `recomendacao`) não foi alterado
  em nenhum momento.
- Motor de Risco, classificador, Dashboard e Plano de Ação não foram
  tocados por nenhuma das mudanças desta rodada.

### Limitação de cobertura de teste (honesta, não escondida)

O catálogo de perguntas vigente (`pergunta_avaliacao`) não possui, hoje,
nenhuma pergunta do tipo `NUMERICO` nem `ESCOLHA_MULTIPLA` — todas as 20
perguntas ativas são `BOOLEANO` (14), `ESCALA` (3), `ESCOLHA_UNICA` (2) ou
`TEXTO` (1, opcional). A matemática descritiva desses dois tipos em
`consolidacaoGheService.js` foi revisada por leitura de código (mesma
estrutura e mesmas premissas dos demais tipos, incluindo o aviso de que
percentuais de `ESCOLHA_MULTIPLA` podem somar mais de 100%), mas **não
pôde ser exercitada com dados reais** nesta rodada, pois não existe
nenhuma pergunta desses tipos para gerar uma coleta real. Criar perguntas
sintéticas desses tipos só para o teste alteraria o catálogo técnico
compartilhado — fora do que esta feature autoriza tocar.
