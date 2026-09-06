# MVP-08B — Fundação Física do Motor de Risco do GHE

> Implementa a infraestrutura física aprovada em
> `docs/mvp08a-arquitetura-motor-risco-ghe.md` (versão ajustada). Nenhuma
> metodologia, regra, classificação, pontuação ou limiar científico foi
> inserida — apenas estrutura, domínio puro e validação estrutural. A
> execução completa do motor com uma metodologia demonstrativa fica para
> o MVP-08C.

## Migration

`database/migrations/004_add_motor_risco_ghe.sql` — transacional
(`BEGIN`/`COMMIT`), sem `DROP`, sem apagar dados, sem alterar as
migrations 001/002/003. Aplicada com sucesso no Supabase de produção do
ambiente demonstrativo em 06/09/2026. As mesmas 8 tabelas e índices foram
espelhados em `database/schema.sql` como "BLOCO 8 - MOTOR DE RISCO DO GHE
(MVP-08B)", mantendo o arquivo como fonte única do estado atual completo.

## As 8 tabelas novas

| Tabela | Papel |
|---|---|
| `metodologia_risco` | Catálogo versionado (`UNIQUE(codigo, versao)`) — cada versão é uma linha própria e imutável. |
| `classificacao_risco_ghe` | Faixas de classificação **paralelas** a `classificacao_risco`, escopadas por metodologia. `classificacao_risco` (Motor individual) permanece 100% intacta. |
| `regra_risco_ghe` | Regra do GHE, escopada por metodologia, ligando condições a um `risco_ergonomico` (reaproveitado) e a uma pontuação. |
| `regra_condicao_ghe` | Condição elementar: consulta uma **métrica** (não uma resposta bruta) e compara com um limiar. |
| `processamento_risco_ghe` | Uma linha = uma execução do motor. Reprocessar cria uma linha nova, nunca sobrescreve. |
| `avaliacao_ghe_risco` | Resultado de um risco **dentro de um processamento** (`UNIQUE(id_processamento_risco_ghe, id_risco)`). |
| `avaliacao_ghe_risco_regra` | Rastreabilidade por regra, com snapshot de `codigo`/`pontuacao_resultado` da regra usada. |
| `avaliacao_ghe_risco_condicao` | Rastreabilidade por condição (sem equivalente no Motor individual): guarda o valor da métrica calculada, a base de cálculo, o parâmetro e o valor de comparação usados — tudo snapshotado. |

Todas as constraints (`CHECK`, `UNIQUE`, `FK ... ON DELETE RESTRICT/CASCADE`)
seguem exatamente as convenções já em uso no schema (`BIGINT GENERATED
ALWAYS AS IDENTITY`, `ativo`, `criado_em`/`atualizado_em`, nomes
`fk_`/`uq_`/`chk_`/`ix_`). Dois `CHECK` novos merecem destaque, por
operacionalizarem no banco (defesa em profundidade, além da validação em
JS) os dois invariantes centrais da arquitetura:

```sql
-- id_opcao obrigatorio exatamente para metricas "por opcao"
CONSTRAINT chk_regra_condicao_ghe_opcao_por_metrica CHECK (...)
-- parametro_metrica obrigatorio exatamente para metricas parametrizadas
CONSTRAINT chk_regra_condicao_ghe_parametro_por_metrica CHECK (...)
```

## Domínio de métricas (`js/domain/ghe-risk/metricasGhe.js`)

Funções puras (sem Supabase/DOM/fetch/localStorage), cada uma retornando
sempre `{ valor, baseCalculo }` — nunca só o número, para a rastreabilidade
nunca perder o "n" por trás de um percentual. Nenhum arredondamento
acontece no domínio (isso é responsabilidade de apresentação).

Métricas operacionais nesta fundação:

| Métrica | Tipo de pergunta | `id_opcao`? | parâmetro? |
|---|---|---|---|
| `CONTAGEM_TRUE`, `CONTAGEM_FALSE`, `PERCENTUAL_TRUE`, `PERCENTUAL_FALSE` | BOOLEANO | não | não |
| `CONTAGEM_OPCAO`, `PERCENTUAL_OPCAO` | ESCALA/ESCOLHA_UNICA/ESCOLHA_MULTIPLA | sim | não |
| `MEDIA_VALOR_OPCAO`, `MAXIMO_VALOR_OPCAO`, `MINIMO_VALOR_OPCAO` | ESCALA | não | não |
| `MEDIA_NUMERICA`, `MINIMO_NUMERICO`, `MAXIMO_NUMERICO` | NUMERICO | não | não |
| `PERCENTUAL_ACIMA_DE_VALOR`, `PERCENTUAL_ABAIXO_DE_VALOR` | NUMERICO | não | **sim** |
| `CONTAGEM_RESPOSTAS` | qualquer | não | não |

`PERCENTUAL_ACIMA_DE_OPCAO` **não é operacional** — lançar `calcularMetrica('PERCENTUAL_ACIMA_DE_OPCAO', ...)` resulta em `METRICA_NAO_SUPORTADA`. Pendência metodológica (ver abaixo).

`MEDIA_VALOR_OPCAO`/`MAXIMO_VALOR_OPCAO`/`MINIMO_VALOR_OPCAO` lançam
`METRICA_INDISPONIVEL` quando alguma opção da pergunta não tem
`valor_numero` preenchido — **nunca** usam `ordem` como substituto
silencioso.

## Diferença fundamental: parâmetro da métrica × valor de comparação

```
Pergunta: P01 | Métrica: PERCENTUAL_ACIMA_DE_VALOR | Parâmetro: 4
  -> "calcular o percentual de respostas estritamente maiores que 4"
Respostas: 2, 3, 5, 5, 6 -> 3 de 5 são maiores que 4 (5, 5, 6) -> 60%

Depois: 60% GTE valor_comparacao=50 -> TRUE.

4 (parametro_metrica, usado para CALCULAR) != 50 (valor_comparacao, usado
para AVALIAR) - nunca confundidos, mesmo sendo os dois numeros na mesma
condicao.
```

Confirmado por teste automatizado (`metricasGhe.test.mjs`, "8.
PERCENTUAL_ACIMA_DE_VALOR").

## Avaliador (`js/domain/ghe-risk/avaliadorGhe.js`)

- `avaliarCondicaoGhe({ valorCalculado, operador, valorComparacao })` — só `EQ`/`GTE` nesta fundação (mesma restrição do Motor individual, por compatibilidade deliberada). `valorCalculado` nulo (métrica sem base válida) vira condição `false`, nunca lança erro.
- `agregarResultadosCondicao(operador, resultadosBooleanos)` — `AND`/`OR`, algoritmo extraído em espírito do Motor individual (`motorRisco.avaliarRegra`), reaproveitável sem tocar naquele arquivo.

## Validação estrutural (`js/domain/ghe-risk/validacaoConfiguracaoGhe.js` + `js/services/motorRiscoGheService.js`)

Responde **"esta configuração pode ser executada pelo software"** —
nunca "esta configuração é cientificamente válida" (distinção explícita
mantida em todo o código e comentários).

- `validarCondicaoGhe(condicao, pergunta, opcao)` — compatibilidade
  tipo-de-métrica × tipo-de-pergunta, presença/ausência correta de
  `id_opcao`/`parametro_metrica`, operador suportado.
- `avaliarRegraProcessavel(regra, condicoesValidadas)` — regra ativa, com
  condições, agregador suportado, pontuação presente, todas as condições
  válidas.
- `avaliarMetodologiaBaseProcessavel(metodologia, classificacoes)` —
  metodologia ativa e com ao menos uma classificação ativa.
- `validarMetodologiaProcessavel(idMetodologia)` (service, também
  exportada como `validarConfiguracaoMetodologia`) — orquestra as três
  funções acima após carregar tudo do Supabase em lote (nunca uma
  consulta por condição), devolvendo um relatório completo por regra.

## Processamento e reprocessamento

`processamento_risco_ghe` grava, por execução: metodologia + versão
usada, e um **snapshot** da cobertura (coletas concluídas, amostra
planejada, percentual) no momento exato da execução — esses números
nunca mudam depois, mesmo que a avaliação ganhe mais coletas.
Reprocessar = nova linha nesta tabela; a anterior (e todo o resultado
por baixo dela) permanece inalterada.

`buscarProcessamentoOficial(idAvaliacaoGhe)` centraliza, num único
ponto do service, a regra de "qual processamento vale" — hoje o mais
recente com `status = 'CONCLUIDO'`. Documentado como deliberadamente
simples e evoluível (flag explícita, confirmação de governança, etc. —
nada disso foi implementado, só a arquitetura para o menos permitir sem
quebrar consumidores).

Verificado com fixtures temporárias reais contra o Supabase (criadas e
removidas no mesmo script): dois processamentos para a mesma avaliação
coexistem sem conflito; o mesmo risco processado nos dois é permitido;
`UNIQUE(id_processamento_risco_ghe, id_risco)` bloqueia corretamente uma
duplicata dentro do mesmo processamento (erro `23505`); o resultado do
processamento #1 permanece intacto após o #2 ser criado.

## Rastreabilidade

`avaliacao_ghe_risco_regra` snapshota `codigo`/`pontuacao_resultado` da
regra; `avaliacao_ghe_risco_condicao` snapshota tudo que uma condição
precisa para ser reconstruída sem reprocessar: `tipo_metrica`,
`id_pergunta`, `id_opcao`, `parametro_metrica_utilizado`,
`valor_metrica_calculado`, `base_calculo`, `operador_utilizado`,
`valor_comparacao_utilizado`, `resultado`. Nenhum desses valores depende
da configuração atual de `regra_condicao_ghe`/`regra_risco_ghe`.

## Testes

`js/domain/ghe-risk/__tests__/` (Node test runner nativo — `node --test`,
sem dependência nova; `package.json` raiz criado só para declarar
`"type": "module"` e o script `npm test`). 45 testes, 100% passando,
cobrindo os 18 casos obrigatórios do prompt (contagens/percentuais por
tipo, EQ/GTE, AND/OR, base zero, parâmetro ausente, `id_opcao`
obrigatório ausente, tipo de pergunta incompatível) mais o exemplo
parametrizado obrigatório. Os testes de histórico/unicidade (envolvem
FKs reais) foram verificados à parte, diretamente contra o Supabase, com
fixtures temporárias criadas e removidas no mesmo script (nunca
persistidas).

## Limitações desta fundação (deliberadas)

- Nenhuma função de **escrita** de processamento/resultado existe ainda
  (`criarProcessamento`, `processarMotorRiscoGhe` completo) — só leitura
  de configuração e validação estrutural. A execução real fica para o
  MVP-08C.
- `PERCENTUAL_ACIMA_DE_OPCAO` não é uma métrica operacional.
- Só `EQ`/`GTE` são suportados como operadores de condição.
- Nenhuma metodologia (nem "ERGO-GHE-DEMO") foi inserida no banco.
- Dashboard, Plano de Ação, Inventário, recomendações do GHE e
  classificação geral do GHE não foram tocados/implementados.

## Pendências metodológicas (inalteradas desde o MVP-08A)

1. Tamanho mínimo efetivo de amostra por condição/métrica.
2. Regra de cobertura para processamento oficial.
3. Limites percentuais de qualquer condição (`valor_comparacao`).
4. Pontuação por regra/condição no contexto GHE.
5. Peso por pergunta / peso por risco.
6. Classificação geral do GHE.
7. Método para ESCALA: `ordem` vs. `valor_numero` como base de "acima" (por isso `PERCENTUAL_ACIMA_DE_OPCAO` não é operacional).
8. Origem científica da metodologia (RULA/REBA/NIOSH/OCRA ou própria).
9. Parâmetro/limiar de `PERCENTUAL_ACIMA_DE_VALOR`/`PERCENTUAL_ABAIXO_DE_VALOR`.
10. Regra de resolução do "processamento oficial" além do caso trivial.

Nenhum destes foi resolvido com valor fictício.

## Próxima etapa

**MVP-08C — Metodologia Demonstrativa + Execução Completa do Motor GHE.**
Só nessa etapa poderão existir metodologia demo, regras demo,
classificações demo, processamento real, resultado e "Entenda por quê" —
sempre identificados explicitamente como **DEMONSTRATIVO / NÃO VALIDADO
PARA USO PROFISSIONAL**.
