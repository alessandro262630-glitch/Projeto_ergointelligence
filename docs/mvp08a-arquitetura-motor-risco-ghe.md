# MVP-08A — Arquitetura do Motor de Risco do GHE (versão ajustada)

> Documento de **arquitetura e análise**. Nenhum código foi implementado,
> nenhuma migration foi criada, nenhuma tabela foi alterada. Esta versão
> substitui a anterior, incorporando três ajustes estruturais pedidos
> após revisão: (1) classificação paralela em vez de extensão, (2)
> entidade explícita de processamento/execução, (3) separação entre
> parâmetro da métrica e valor de comparação da condição.

========================================
## 1. AJUSTES REALIZADOS EM RELAÇÃO À VERSÃO ANTERIOR
========================================

**Classificação paralela** — a proposta anterior de estender
`classificacao_risco` com uma coluna `id_metodologia` foi **descartada**.
`classificacao_risco` permanece 100% intacta — nenhuma coluna nova,
nenhuma consulta do motor individual muda. O GHE ganha uma tabela
paralela própria, `classificacao_risco_ghe`. Motivo: isolamento
elimina qualquer risco de faixas sobrepostas entre metodologias
diferentes dividindo a mesma tabela, e elimina qualquer necessidade de
tocar consultas existentes do motor individual — isolamento > economia
de tabela.

**Processamento como entidade explícita** — a hierarquia anterior
(`AVALIACAO_GHE → AVALIACAO_GHE_RISCO`) escondia a noção de "execução".
Passa a existir `PROCESSAMENTO_RISCO_GHE` entre as duas, representando
uma execução completa do motor (uma metodologia, uma versão, uma
cobertura, um instante). Reprocessamento deixa de ser um conceito vago
e passa a ser, estruturalmente, "criar um novo `processamento_risco_ghe`
— nunca sobrescrever o anterior".

**Parâmetro da métrica separado do valor de comparação** — o modelo
anterior comprimia dois conceitos diferentes num só campo
(`valor_limite`). Agora `regra_condicao_ghe` tem dois campos
distintos: `parametro_metrica` (usado para **calcular** a métrica,
quando ela precisar de um parâmetro) e `valor_comparacao` (usado para
**avaliar** o resultado já calculado da métrica contra o operador). Os
dois nunca se confundem, mesmo quando ambos são números na mesma faixa
de valor (ver exemplo obrigatório na seção 6).

========================================
## 2. MODELO CONCEITUAL FINAL
========================================

```
RISCO_ERGONOMICO (reaproveitado, catálogo puro)
      ▲
      │  N:1
      │
METODOLOGIA_RISCO (nova; cada versão = uma linha própria, codigo+versao)
      │
      ├──1:N──> CLASSIFICACAO_RISCO_GHE (nova; paralela a classificacao_risco)
      │
      └──1:N──> REGRA_RISCO_GHE (nova)
                        │
                        └──1:N──> REGRA_CONDICAO_GHE (nova)
                                   (id_pergunta/id_opcao apontam para
                                    pergunta_avaliacao/opcao_resposta,
                                    reaproveitados)

AVALIACAO_GHE (existente, MVP-07)
      │
      └──1:N──> PROCESSAMENTO_RISCO_GHE (nova; 1 linha = 1 execução)
                        │  aponta para EXATAMENTE 1 METODOLOGIA_RISCO
                        │
                        └──1:N──> AVALIACAO_GHE_RISCO (nova)
                                   UNIQUE(id_processamento, id_risco)
                                        │
                                        └──1:N──> AVALIACAO_GHE_RISCO_REGRA (nova)
                                                        │
                                                        └──1:N──> AVALIACAO_GHE_RISCO_CONDICAO (nova)
```

Nota de leitura: `METODOLOGIA_RISCO` e a árvore de `AVALIACAO_GHE` são
dois sub-modelos que se conectam apenas através de
`PROCESSAMENTO_RISCO_GHE.id_metodologia` — a metodologia é catálogo
(existe independente de qualquer avaliação), o processamento é evento
(existe só porque uma avaliação foi processada com aquela metodologia).

`COLETA_GHE`/`RESPOSTA_COLETA`/`RESPOSTA_COLETA_OPCAO` continuam como
fonte de evidência bruta (Camada 1), lidas pelo processamento mas sem
nenhuma FK nova saindo delas — a leitura é sempre "avaliação → coletas
concluídas", nunca o contrário.

========================================
## 3. CLASSIFICACAO_RISCO_GHE
========================================

**Responsabilidade**: armazenar faixas de classificação de risco
próprias de uma metodologia GHE — nunca compartilhadas com o motor
individual.

**Relacionamento**: `METODOLOGIA_RISCO (1) ──< (N) CLASSIFICACAO_RISCO_GHE`.

**Campos conceituais**: `id_classificacao_ghe`, `id_metodologia`,
`codigo`, `nome`, `descricao`, `pontuacao_minima`, `pontuacao_maxima`,
`prioridade`, `cor_hex`, `ativo`, `criado_em`.

**Nota de nomenclatura vs. reuso de função** (ver seção 31 do prompt,
respondida em detalhe na seção 7 abaixo): os nomes de campo aqui usam
`pontuacao_minima`/`pontuacao_maxima` (grafia completa), enquanto
`classificacao_risco` usa `pontuacao_min`/`pontuacao_max`. Isso é
proposital — reforça visualmente que são tabelas independentes, não
"quase a mesma coisa com nomes iguais". Isso tem uma implicação direta
sobre a reutilização de `classificarPontuacao()` — ver seção 7.

Cada metodologia é responsável por definir suas próprias faixas — sem
faixa "padrão"/"herdada" de `classificacao_risco`. Zero acoplamento.

========================================
## 4. PROCESSAMENTO_RISCO_GHE
========================================

**Responsabilidade**: registrar o contexto completo de UMA execução
oficial do motor sobre UMA avaliação do GHE.

**Campos conceituais (modelo inicial, sem evolução futura ainda)**:
`id_processamento_risco_ghe`, `id_avaliacao_ghe`, `id_metodologia`,
`versao_metodologia_snapshot` (texto — redundância proposital, mesmo
espírito de `avaliacao_risco.versao_motor_regras` ser uma string e não
só uma FK, para sobreviver mesmo que a linha de metodologia mude/seja
desativada depois), `coletas_concluidas_snapshot`,
`amostra_planejada_snapshot`, `percentual_cobertura_snapshot`, `status`
(do próprio processamento — ex.: `PROCESSADO`/`ERRO`, não confundir com
"é o processamento oficial?"), `processado_em`.

**Evolução futura, marcada mas não adicionada agora**:
`id_processamento_anterior` (link explícito para encadear
reprocessamentos), `motivo_reprocessamento`, `confirmacao_profissional`,
`confirmado_por`, `confirmado_em`. Esses campos só fazem sentido quando
o fluxo de reprocessamento e a governança de cobertura mínima (pendência
já registrada) forem de fato definidos — adicioná-los agora seria
antecipar decisão de produto sem necessidade comprovada.

**Cada processamento aponta para EXATAMENTE UMA metodologia** —
tecnicamente garantido por `id_metodologia` ser uma FK não-nula. Como
cada versão de metodologia é uma linha própria em `metodologia_risco`
(mesmo padrão de `regra_risco.versao` ser uma coluna por linha, não uma
tabela de versões à parte), "apontar para uma metodologia" já implica
"apontar para uma versão exata" — não há ambiguidade possível.

**Identificação do processamento oficial/vigente** (seção 15 do prompt):
`MAX(processado_em)` sozinho foi descartado como regra implícita — ele
"funciona" no caso comum, mas esconde a decisão dentro de cada consulta
em vez de centralizá-la, e não permite nenhum cenário futuro em que um
processamento mais antigo precise ser mantido como oficial (ex.: um
reprocessamento de teste que não deveria substituir o resultado
apresentado). **Recomendação**: a resolução de "qual é o processamento
oficial desta avaliação" deve morar em **uma única função do service**
(`buscarProcessamentoOficial(idAvaliacaoGhe)`), nunca espalhada em
múltiplas consultas — hoje essa função pode implementar a regra mais
simples (mais recente com `status = 'PROCESSADO'`), e se um dia for
necessário um flag explícito (`vigente = true`) ou uma relação de
substituição, a mudança fica contida nesse único ponto, sem exigir
alterar quem consome os resultados. Não implementar isso agora — só
registrar a recomendação.

========================================
## 5. REGRA_CONDICAO_GHE (revisada)
========================================

Campos conceituais: `id_condicao_ghe`, `id_regra_ghe`, `id_pergunta`,
`id_opcao` (nulo — só preenchido quando a métrica for por opção),
`tipo_metrica`, `parametro_metrica` (nulo — só preenchido quando a
métrica exigir), `operador`, `valor_comparacao`, `ordem`.

`id_opcao` nunca duplica dentro de `parametro_metrica` — quando a
métrica é por opção (`PERCENTUAL_OPCAO`, `CONTAGEM_OPCAO`), a opção-alvo
vive exclusivamente na FK `id_opcao`; `parametro_metrica` é reservado
para valores que não têm uma FK própria no catálogo (ex.: o "4" de
`PERCENTUAL_ACIMA_DE_VALOR`, que é um número livre, não uma opção
cadastrada).

========================================
## 6. MÉTRICAS E PARÂMETROS
========================================

| MÉTRICA | TIPO DE PERGUNTA | PRECISA ID_OPCAO? | PRECISA PARÂMETRO? | RESULTADO |
|---|---|---|---|---|
| `CONTAGEM_TRUE` | BOOLEANO | não | não | contagem |
| `CONTAGEM_FALSE` | BOOLEANO | não | não | contagem |
| `PERCENTUAL_TRUE` | BOOLEANO | não | não | percentual |
| `PERCENTUAL_FALSE` | BOOLEANO | não | não | percentual |
| `CONTAGEM_OPCAO` | ESCALA / ESCOLHA_UNICA / ESCOLHA_MULTIPLA | **sim** | não | contagem |
| `PERCENTUAL_OPCAO` | ESCALA / ESCOLHA_UNICA / ESCOLHA_MULTIPLA | **sim** | não | percentual |
| `MEDIA_VALOR_OPCAO` | ESCALA | não | não | número |
| `MAXIMO_VALOR_OPCAO` | ESCALA | não | não | número |
| `MINIMO_VALOR_OPCAO` | ESCALA | não | não | número |
| `PERCENTUAL_ACIMA_DE_OPCAO` | ESCALA | **sim** (opção de referência) | não | percentual — **PENDÊNCIA**: base de "acima" (`ordem` vs `valor_numero`) indefinida, ver seção 15 |
| `MEDIA_NUMERICA` | NUMERICO | não | não | número |
| `MINIMO_NUMERICO` | NUMERICO | não | não | número |
| `MAXIMO_NUMERICO` | NUMERICO | não | não | número |
| `PERCENTUAL_ACIMA_DE_VALOR` | NUMERICO | não | **sim** (valor de corte) | percentual |
| `PERCENTUAL_ABAIXO_DE_VALOR` | NUMERICO | não | **sim** (valor de corte) | percentual |
| `CONTAGEM_RESPOSTAS` | qualquer | não | não | contagem (n) |

**TEXTO**: nenhuma métrica de risco — só `CONTAGEM_RESPOSTAS` como
metadado.

### Exemplo obrigatório: parâmetro ≠ valor de comparação

```
Pergunta: P01
Métrica: PERCENTUAL_ACIMA_DE_VALOR
Parâmetro da métrica: 4
  → interpretação: "calcular o percentual de respostas > 4"
Resultado calculado da métrica: 40%   (base = n respostas numéricas)

Avaliação da condição:
  40% (valor calculado)  OPERADOR: GTE  Valor de comparação: 30%
  → resultado: TRUE

4 (parâmetro, usado para CALCULAR) ≠ 30 (valor de comparação, usado
para AVALIAR o resultado já calculado). São dois números, dois papéis,
duas colunas.
```

========================================
## 7. REUTILIZAÇÃO DE FUNÇÕES (reavaliada)
========================================

- **`classificarPontuacao(pontuacao, classificacoes)`** — a função em si
  continua genérica: não importa `classificacao_risco` nem qualquer
  tabela, só itera um array recebido por parâmetro e lê
  `classificacao.pontuacao_min`/`pontuacao_max`/`codigo`. **Mas**,
  como `classificacao_risco_ghe` propositalmente usa
  `pontuacao_minima`/`pontuacao_maxima` (seção 3), uma chamada direta
  passando linhas de `classificacao_risco_ghe` sem tradução leria
  `undefined` nesses campos. **Conclusão**: a função é *tecnicamente*
  reaproveitável (nenhuma mudança nela é necessária), mas exige um
  **adaptador fino no domínio do GHE** que reformata cada linha de
  `classificacao_risco_ghe` para o formato exato que a função espera
  (`{ id_classificacao, codigo, nome, pontuacao_min, pontuacao_max,
  prioridade }`) antes de chamá-la. Isso mantém `classificadorRisco.js`
  absolutamente intocado e ainda assim evita duplicar a lógica de
  "exatamente uma faixa deve bater, senão erro".
- **`obterClassificacaoGeral(riscosCalculados)`** — tecnicamente
  reaproveitável pelo mesmo motivo (função pura e genérica). **Não deve
  ser usada como fonte oficial de classificação geral do GHE** sem uma
  decisão metodológica que autorize "maior severidade entre riscos" como
  a regra válida para o GHE — hoje isso é só uma possibilidade entre
  outras (seção 34 do prompt anterior), não uma decisão tomada. Reuso
  técnico ≠ validação de uso. Fica registrado como PENDÊNCIA (seção 15).

========================================
## 8. REPROCESSAMENTO
========================================

Modelo conceitual: **nunca UPDATE em resultados antigos**. Reprocessar =
criar um novo `processamento_risco_ghe`. O antigo permanece, com todas
as suas `avaliacao_ghe_risco`/`avaliacao_ghe_risco_regra`/
`avaliacao_ghe_risco_condicao` intactas e consultáveis para sempre.

```
AVALIAÇÃO GHE #15

PROCESSAMENTO #1
  Metodologia: ERGO-GHE-DEMO 1.0.0
  6 coletas concluídas
  ├── Fadiga        → pontuação X, classificação Y
  ├── Postura       → pontuação X, classificação Y
  └── Repetitividade→ pontuação X, classificação Y

  (tempo passa; metodologia evolui; mais coletas são concluídas)

PROCESSAMENTO #2
  Metodologia: ERGO-GHE-DEMO 1.1.0
  8 coletas concluídas
  ├── Fadiga        → pontuação X', classificação Y'
  ├── Postura       → pontuação X', classificação Y'
  └── Repetitividade→ pontuação X', classificação Y'

PROCESSAMENTO #1 continua existindo, sem nenhum campo alterado,
consultável e comparável ao #2 a qualquer momento.
```

Fluxo de "quando/como disparar um reprocessamento" **não é definido
nesta tarefa** (nem UI, nem regra de negócio) — só o modelo de dados que
o suporta.

========================================
## 9. RASTREABILIDADE
========================================

Cada condição avaliada grava, em `avaliacao_ghe_risco_condicao`:
`tipo_metrica`, `id_pergunta`, `id_opcao`, `parametro_metrica_utilizado`
(snapshot), `valor_metrica_calculado`, `base_calculo`, `operador`,
`valor_comparacao_utilizado` (snapshot), `resultado`. Nenhum desses
valores depende da configuração atual de `regra_condicao_ghe` para ser
reconstruído — mesmo que a condição original mude de parâmetro/limite
amanhã, esta linha preserva o que foi realmente usado naquele
processamento.

### Exemplo obrigatório

```
RISCO: Fadiga
PROCESSAMENTO: #2
METODOLOGIA: ERGO-GHE-DEMO 1.1.0
REGRA: R-FAD-01

CONDIÇÃO:
  Pergunta: P05
  Métrica: PERCENTUAL_TRUE
  Parâmetro: N/A (esta métrica não usa parâmetro)
  Resultado da métrica: 66,7%
  Base de cálculo: 6
  Operador: GTE
  Valor de comparação: [PENDÊNCIA METODOLÓGICA]
  Resultado da condição: TRUE/FALSE (depende do valor de comparação, hoje indefinido)
  Pontuação aplicada: [PENDÊNCIA METODOLÓGICA]
```

========================================
## 10. CONTRATO DE ENTRADA (revisado)
========================================

```
{
  processamento: { idAvaliacaoGhe, solicitadoEm, tipoProcessamento: 'INICIAL' | 'REPROCESSAMENTO' },
  ghe, planoAmostragem,
  coletasConcluidas: [ { id_coleta, id_amostra_participante, data_conclusao } ],
  respostasPorPergunta: {
    [idPergunta]: [ { idColeta, respostaBooleano, respostaNumero, respostaTexto, opcoes }, ... ]  // LISTA por pergunta
  },
  perguntas, opcoes, riscos,             // catálogos reaproveitados
  metodologia: { id_metodologia, codigo, versao, status_validacao },
  regrasGhe: [
    { id_regra_ghe, id_risco, operador_agregacao, pontuacao_resultado,
      condicoes: [
        { id_condicao_ghe, tipo_metrica, id_pergunta, id_opcao, parametro_metrica, operador, valor_comparacao }
      ] }
  ],
  classificacoesGhe: [...],              // classificacao_risco_ghe filtradas por id_metodologia exato
  cobertura: { coletasConcluidas, amostraPlanejada, percentual, confirmacaoGovernanca: null | {...} }
}
```

Nunca inclui resultados de processamentos anteriores — cada execução
calcula do zero a partir da evidência bruta e da configuração vigente
no momento, nunca "herda" ou ajusta um resultado passado.

========================================
## 11. CONTRATO DE SAÍDA (revisado)
========================================

```
{
  processamento: {
    idProcessamentoRiscoGhe, avaliacaoGheId,
    metodologia: { id_metodologia, codigo, versao },
    processadoEm,
    cobertura: { coletasConcluidas, amostraPlanejada, percentual }
  },
  riscos: [
    {
      idRisco, codigo, nome,
      regras: [
        {
          idRegraGhe, codigo, satisfeita, pontuacaoAplicada, detalhe,
          condicoes: [
            { idCondicaoGhe, tipoMetrica, idPergunta, idOpcao,
              parametroMetrica, valorCalculado, baseCalculo,
              operador, valorComparacao, resultado }
          ]
        }
      ],
      pontuacao,
      classificacaoGhe: { id_classificacao_ghe, codigo, nome, prioridade }
    }
  ],
  classificacaoGeral: null   // PENDÊNCIA METODOLÓGICA — seção 15
}
```

========================================
## 12. MATRIZ DE IMPACTO (revisada)
========================================

| ENTIDADE | AÇÃO | MOTIVO |
|---|---|---|
| `classificacao_risco` | **MANTER INTACTA** | Isolamento total do motor individual — nenhuma coluna nova, nenhuma consulta muda (decisão revisada nesta versão) |
| `regra_risco` | MANTER, NÃO REUTILIZAR | Semântica do motor individual preservada |
| `regra_condicao` | MANTER, NÃO REUTILIZAR | Compara resposta única a valor fixo — incompatível com métrica agregada |
| `avaliacao_risco` | MANTER, NÃO REUTILIZAR | `UNIQUE(id_avaliacao,id_risco)` sem conceito de execução — incompatível com reprocessamento explícito |
| `avaliacao_risco_regra` | MANTER, NÃO REUTILIZAR | Granularidade (1/regra, texto livre) insuficiente para a rastreabilidade pedida ao GHE |
| `risco_ergonomico` | MANTER + REUTILIZAR | Catálogo puro, sem pontuação embutida |
| `pergunta_avaliacao` / `opcao_resposta` | MANTER + REUTILIZAR | Já compartilhado desde o MVP-07 |
| `avaliacao_ghe` / `coleta_ghe` / `resposta_coleta*` | MANTER | Fonte de evidência, sem alteração |
| `metodologia_risco` | **NOVA** | Identifica e versiona a metodologia de forma explícita e auditável |
| `classificacao_risco_ghe` | **NOVA** | Faixas próprias do GHE, isoladas do motor individual (Ajuste 01) |
| `regra_risco_ghe` | **NOVA** | Regra do GHE, escopada por metodologia |
| `regra_condicao_ghe` | **NOVA** | Condição sobre métrica, com parâmetro e valor de comparação separados (Ajuste 03) |
| `processamento_risco_ghe` | **NOVA** | Representa uma execução do motor, habilita reprocessamento sem sobrescrever histórico (Ajuste 02) |
| `avaliacao_ghe_risco` | **NOVA** | Resultado por risco, agora pertencente a um processamento (`UNIQUE(id_processamento, id_risco)`) |
| `avaliacao_ghe_risco_regra` | **NOVA** | Rastreabilidade por regra dentro do processamento |
| `avaliacao_ghe_risco_condicao` | **NOVA** | Rastreabilidade por condição, com snapshot de parâmetro e valor de comparação |

========================================
## 13. ENTIDADES NOVAS FINAIS
========================================

1. `metodologia_risco`
2. `classificacao_risco_ghe`
3. `regra_risco_ghe`
4. `regra_condicao_ghe`
5. `processamento_risco_ghe`
6. `avaliacao_ghe_risco`
7. `avaliacao_ghe_risco_regra`
8. `avaliacao_ghe_risco_condicao`

========================================
## 14. IMPACTO FUTURO NO BANCO (revisado)
========================================

- **Tabelas novas**: 8 (listadas na seção 13).
- **Alterações em `classificacao_risco`**: 0.
- **Alterações no motor individual** (`motorRisco.js`,
  `classificadorRisco.js`, `riscoService.js`, `regra_risco`,
  `regra_condicao`, `avaliacao_risco`, `avaliacao_risco_regra`,
  `classificacao_risco`): 0.
- **Remoções**: 0. **Renomeações**: 0. **Mudança de significado em
  tabela existente**: 0.
- Nenhuma migration criada nesta tarefa.

========================================
## 15. REGRAS CONFIRMADAS
========================================

- Motor individual (`motorRisco.js`/`classificadorRisco.js`/
  `riscoService.js`) e suas 5 tabelas (`regra_risco`, `regra_condicao`,
  `avaliacao_risco`, `avaliacao_risco_regra`, `classificacao_risco`)
  permanecem 100% intocados — confirmado explicitamente nesta revisão.
- `classificacao_risco_ghe` é paralela, nunca compartilhada com
  `classificacao_risco`.
- Resultado de risco do GHE pertence a um `processamento_risco_ghe`,
  nunca diretamente a uma `avaliacao_ghe`.
- Reprocessamento cria um novo processamento; nunca sobrescreve um
  existente.
- `UNIQUE(id_processamento_risco_ghe, id_risco)` é a regra de
  integridade correta (substitui a ausência de unicidade da versão
  anterior).
- Parâmetro da métrica e valor de comparação da condição são conceitos
  e campos distintos, nunca fundidos.
- Métricas continuam sendo calculadas por funções puras em memória —
  nenhuma tabela de catálogo de métricas é criada.
- `classificarPontuacao()`/`obterClassificacaoGeral()` são reaproveitadas
  só como funções (via adaptador, no caso da primeira) — nunca como
  autorização automática de regra de negócio para o GHE.
- Somente coletas `CONCLUIDA` entram no processamento; zero coletas
  bloqueia (regra do MVP-07, preservada).
- LLM não participa do cálculo; processamento é determinístico;
  histórico não muda silenciosamente.

========================================
## 16. PENDÊNCIAS METODOLÓGICAS
========================================

1. Tamanho mínimo efetivo de amostra por condição/métrica.
2. Regra de cobertura para processamento oficial (infraestrutura pode
   suportar configuração por metodologia + confirmação profissional —
   nenhum limiar definido).
3. Limites percentuais de qualquer condição (`valor_comparacao`).
4. Pontuação por regra/condição no contexto GHE.
5. Peso por pergunta / peso por risco.
6. Classificação geral do GHE (nenhuma regra de agregação entre riscos
   diferentes foi aprovada; `classificacaoGeral: null` por padrão).
7. Método para ESCALA: `ordem` vs. `valor_numero` como base de "acima".
8. Origem científica da metodologia (RULA/REBA/NIOSH/OCRA ou própria) —
   metodologia inicial permanece rotulada como demonstrativa.
9. Parâmetro/limiar de `PERCENTUAL_ACIMA_DE_VALOR` e
   `PERCENTUAL_ABAIXO_DE_VALOR`.
10. Regra de resolução do "processamento oficial vigente" além do caso
    trivial (mais recente) — só relevante quando reprocessamento com
    governança for de fato implementado.

Nenhum destes itens deve ser resolvido com valor fictício, mesmo a
título de exemplo em código ou seed.

========================================
## 17. STATUS PARA MVP-08B
========================================

**Infraestrutura configurável**: PRONTA PARA MODELAGEM FÍSICA.
**Metodologia profissional**: BLOQUEADA POR VALIDAÇÃO METODOLÓGICA.

(Justificativa detalhada na resposta principal, seção 16/17 do
relatório formatado.)
