# MVP-08C — Metodologia Demonstrativa e Execução Completa do Motor GHE

> ⚠️ **A metodologia descrita neste documento (`ERGO-GHE-DEMO 1.0.0`) não é
> científica.** Não representa conformidade legal, validação NR-17,
> diagnóstico ergonômico definitivo, validade estatística, metodologia
> profissional, laudo técnico, resultado clínico ou classificação
> oficial. Serve exclusivamente para demonstrar o funcionamento técnico
> do Motor de Risco do GHE (arquitetura definida em
> `docs/mvp08a-arquitetura-motor-risco-ghe.md` e `docs/mvp08b-fundacao-motor-ghe.md`).
> Qualquer limiar, pontuação, peso ou faixa aqui é fictício e exige
> validação técnica de um profissional habilitado antes de qualquer uso
> além de apresentação do sistema.

## Finalidade

Primeira execução **real e completa** do Motor de Risco do GHE: da
evidência bruta (coletas concluídas) até um resultado persistido e
rastreável, usando uma metodologia inteiramente demonstrativa. Não
implementa metodologia profissional, recomendações, Plano de Ação do
GHE, Inventário de Riscos nem integração com o Dashboard — tudo isso
permanece fora de escopo (ver seções 63-66 do prompt).

## Metodologia DEMO

- **Código**: `ERGO-GHE-DEMO`
- **Versão**: `1.0.0`
- **Status**: `DEMONSTRATIVA` (nunca `VALIDADA` — nenhuma metodologia
  desta feature foi ou será cadastrada como validada)
- Criada por `database/demo/05_seed_metodologia_ghe_demo.sql`
  (idempotente, `INSERT ... WHERE NOT EXISTS`), reaplicável sem duplicar.

## Riscos, regras e condições

4 dos 7 riscos do catálogo (`risco_ergonomico`, reaproveitado sem
duplicação), 7 regras, 9 condições — todas referenciando perguntas e
opções **realmente existentes** em `pergunta_avaliacao`/`opcao_resposta`
(nenhuma pergunta foi inventada). Nenhuma regra usa `MEDIA_NUMERICA`/
`PERCENTUAL_ACIMA_DE_VALOR`: **o catálogo atual não tem nenhuma pergunta
ativa do tipo `NUMERICO`** — criar uma só para "completar a cobertura"
violaria a proibição explícita de inventar pergunta (seção 15 do
prompt). Isso é uma limitação documentada, não um esquecimento.

| Risco | Regra | Agregação | Condição(ões) | Pontuação |
|---|---|---|---|---|
| Fadiga ocupacional | R-DEMO-FAD-01 | AND | Q14 (BOOLEANO) `PERCENTUAL_TRUE ≥ 50` **e** Q15 (ESCALA, opção "Sempre") `PERCENTUAL_OPCAO ≥ 30` | 4 |
| Fadiga ocupacional | R-DEMO-FAD-02 | OR | Q15 (opção "Sempre") `PERCENTUAL_OPCAO ≥ 50` **ou** Q16 (ESCOLHA_UNICA, opção "Intenso") `PERCENTUAL_OPCAO ≥ 30` | 3 |
| Postura inadequada | R-DEMO-POST-01 | AND | Q02 (BOOLEANO) `PERCENTUAL_TRUE ≥ 50` | 2 |
| Postura inadequada | R-DEMO-POST-02 | AND | Q11 (ESCOLHA_UNICA, opção "Pessimo") `PERCENTUAL_OPCAO ≥ 30` | 2 |
| Movimentos repetitivos | R-DEMO-REP-01 | AND | Q04 (BOOLEANO) `PERCENTUAL_TRUE ≥ 50` | 3 |
| Movimentos repetitivos | R-DEMO-REP-02 | AND | Q05 (ESCALA, opção "Sempre") `PERCENTUAL_OPCAO ≥ 30` | 2 |
| Organização inadequada das pausas | R-DEMO-ORG-01 | AND | Q17 (BOOLEANO) `PERCENTUAL_FALSE ≥ 50` (risco quando a MAIORIA diz que NÃO há pausas — Q17 é formulada positivamente) | 2 |

Esta tabela cobre deliberadamente `BOOLEANO`, `ESCALA`, `ESCOLHA_UNICA`,
`AND` e `OR` (exigido pelo prompt) — `R-DEMO-FAD-01`/`R-DEMO-FAD-02`
sozinhas já demonstram os dois tipos de agregação sobre o mesmo risco.

## Classificações demonstrativas

Faixas próprias em `classificacao_risco_ghe` (nunca em
`classificacao_risco`, que permanece intocada), cobrindo toda pontuação
possível sem sobreposição:

| Código | Faixa | Prioridade |
|---|---|---|
| BAIXO | 0 – 1 | 1 |
| MODERADO | 2 – 3 | 2 |
| ALTO | 4 – 5 | 3 |
| CRITICO | 6 – ∞ | 4 |

Nomes (`BAIXO`/`MODERADO`/`ALTO`/`CRITICO`) são só rótulo visual
demonstrativo — a escala matemática por trás é fictícia.

## Processamento (`processarRiscosGhe`, em `js/services/motorRiscoGheService.js`)

Fluxo real (16 passos do prompt, seção 19): valida avaliação
(`CONSOLIDADA`), valida metodologia + estrutura
(`validarMetodologiaProcessavel`, já do MVP-08B), carrega GHE/plano,
carrega coletas `CONCLUIDA` (bloqueia com `SEM_COLETAS_CONCLUIDAS` se
zero), carrega respostas, chama o domínio puro
(`processarRiscosGhePuro`, em `js/domain/ghe-risk/motorRiscoGhe.js`) que
calcula métricas → avalia condições → agrega regras (AND/OR) → soma
pontuação **por risco** → classifica cada risco (reaproveitando
`classificarPontuacao()` do Motor individual, via um adaptador de nomes
de campo — nenhuma modificação naquele arquivo), cria o
`processamento_risco_ghe`, persiste resultado + rastreabilidade
completa.

**Separação de camadas respeitada** (seção 27 do prompt): o service só
busca/persiste; todo o cálculo mora no domínio puro; a página não
recalcula nada.

### Transação lógica (limitação documentada — seção 20 do prompt)

O Supabase REST, acessado a partir do navegador com a chave anônima, **não
oferece uma transação multi-tabela atômica verdadeira**. A integridade é
garantida por **compensação explícita**, não por `COMMIT`/`ROLLBACK`:

1. Cria `processamento_risco_ghe` com `status = 'PROCESSANDO'`.
2. Calcula tudo em memória (domínio puro).
3. Persiste `avaliacao_ghe_risco` → `avaliacao_ghe_risco_regra` →
   `avaliacao_ghe_risco_condicao`, em lotes (nunca 1 INSERT por linha).
4. Se tudo funcionar: `UPDATE status = 'CONCLUIDO'`.
5. Se qualquer passo falhar: reverte (DELETE) tudo o que já foi
   persistido **deste processamento especificamente** e marca
   `status = 'ERRO'` — nunca deixa um processamento `CONCLUIDO` com
   resultado parcial, e nunca toca em nenhum outro processamento.

Essa é a mesma filosofia de compensação já usada por
`riscoService.persistirResultado()` no Motor individual — não uma
solução nova, uma aplicação do mesmo padrão já validado no projeto.

## Amostra incompleta

O processamento **não bloqueia** com cobertura abaixo da amostra
planejada (regra confirmada no MVP-08A — configurável por metodologia no
futuro, sem limiar definido hoje). `resultado-ghe.html` exibe um aviso
explícito sempre que `coletas_concluidas_snapshot < amostra_planejada_snapshot`,
nunca chamando isso de representatividade estatística.

## Snapshot do processamento

Cada processamento congela, no momento exato da execução:
`versao_metodologia_snapshot`, `coletas_concluidas_snapshot`,
`amostra_planejada_snapshot`, `percentual_cobertura_snapshot`,
`processado_em`. Nenhum desses valores muda depois, mesmo que a
avaliação ganhe mais coletas ou a metodologia seja alterada.

## Reprocessamento

Reprocessar uma Avaliação do GHE **cria um novo `processamento_risco_ghe`**
— nunca sobrescreve o anterior. Testado ao vivo: dois processamentos
reais foram criados para a mesma avaliação (GHE-01, `id_avaliacao_ghe=6`),
cada um com seu próprio `id_processamento_risco_ghe`, ambos consultáveis
e íntegros no histórico exibido em `avaliacao-ghe.html`. O mais recente
`CONCLUIDO` é rotulado só como **"Mais recente"** — nunca "Oficial"
(seção 44 do prompt), até que uma decisão de negócio explícita mude
isso.

## Rastreabilidade ("Entenda por quê")

`resultado-ghe.html` → botão "Entenda por quê" em cada card de risco →
`buscarRastreabilidadeResultado()` lê os snapshots já persistidos (nunca
recalcula): por regra, código/pontuação prevista/satisfeita/pontuação
aplicada/detalhe; por condição, pergunta, opção (quando aplicável),
métrica, **parâmetro usado para calcular** (quando a métrica for
parametrizada), **valor calculado**, base de cálculo (n), operador,
**valor usado para comparar**, resultado. Verificado ao vivo contra os
dados reais persistidos — os números exibidos batem exatamente com o
que está gravado no banco.

## Interface

- **`avaliacao-ghe.html`**: card "Processamento de Riscos do GHE",
  visível só quando a avaliação está `CONSOLIDADA`; botão "Processar
  Riscos do GHE" (habilitado só quando a metodologia demonstrativa está
  estruturalmente pronta); modal de confirmação com o aviso obrigatório;
  histórico de processamentos (data, metodologia, cobertura, status,
  link "Ver resultado").
- **`resultado-ghe.html`** + **`js/pages/resultado-ghe.js`** (novos):
  aviso demonstrativo fixo no topo; cabeçalho (GHE, setor, universo,
  amostra planejada, coletas concluídas, cobertura, metodologia, versão,
  data); um card por risco (nome, pontuação, classificação, badge
  "DEMONSTRATIVO", botão "Entenda por quê") — **nunca** um score/
  classificação geral.

## Testes

- **50 testes unitários** (`node --test`, domínio puro, zero dependência
  nova) — os 45 do MVP-08B mais 5 novos cobrindo `processarRiscosGhePuro`
  end-to-end em memória: AND satisfeito/não satisfeito (com rastreabilidade
  da regra não satisfeita), OR satisfeito por uma condição, soma **nunca**
  entre riscos diferentes, classificação ausente lança erro,
  `classificacaoGeral` nunca existe no resultado.
- **E2E real** (Playwright, Chrome, contra o Supabase de produção do
  ambiente demo): metodologia inativa bloqueia; avaliação não consolidada
  bloqueia; botão de processar habilitado corretamente; modal de
  confirmação com o aviso certo; processamento real cria resultado;
  aviso demonstrativo e aviso de amostra incompleta visíveis; 4 cards de
  risco renderizados; nenhum "score geral" em lugar algum; "Entenda por
  quê" mostra métrica/base/operador/resultado batendo exatamente com o
  banco; refresh não recalcula; reprocessamento cria novo id e preserva
  o histórico; processamento antigo continua íntegro e acessível após um
  novo ser criado.
- **Regressão**: Home, Dashboard, Colaboradores, Vínculos, GHE, Detalhe
  do GHE, Avaliação individual/Resultado, Plano de Ação, Avaliação do
  GHE, Coleta, Consolidação — todos OK (um 404 intermitente e não
  relacionado, já presente antes desta feature, reapareceu ora em
  Dashboard ora em Home em execuções diferentes, confirmando que é um
  artefato de carregamento genérico, não uma regressão desta feature).

## Aviso de não validação

Presente em três lugares, com o mesmo texto do prompt: modal de
confirmação antes de processar, topo de `resultado-ghe.html`, e este
documento.

## Próxima etapa

Metodologia **profissional** (limiares, pesos, pontuações e regra de
cobertura reais) permanece bloqueada até validação técnica por
profissional habilitado — nenhuma decisão científica foi tomada nesta
feature. Evoluções futuras já mapeadas e explicitamente fora de escopo
aqui: classificação geral do GHE, recomendações do GHE, Plano de Ação do
GHE, Inventário de Riscos, integração com o Dashboard.
