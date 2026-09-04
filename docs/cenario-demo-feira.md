# Cenário de Demonstração — Feira Técnica 08/09/2026

> Documento gerado na FEIRA-05. Todos os dados abaixo existem de verdade no
> Supabase, criados pelo fluxo real da aplicação (colaborador → vínculo →
> avaliação → contexto → questionário → finalizar → Motor de Risco). Nenhum
> resultado foi inserido diretamente em `avaliacao_risco`,
> `avaliacao_risco_regra` ou `avaliacao_recomendacao`, e o Motor/classificador
> não foram alterados.

## Ambiente

- Empresa: ErgoTech Soluções Industriais Ltda. (fictícia)
- Setores: Administrativo, Tecnologia, Produção, Logística
- 6 colaboradores fictícios ativos, distribuídos nos 4 setores
- 18 avaliações **FINALIZADA**, datadas entre **15/04/2026 e 04/09/2026**
- 7 Planos de Ação, 16 Ações, com status variados

Nenhum dado pessoal real foi utilizado. Todos os colaboradores têm nomes e
matrículas claramente demonstrativos (sufixo "Demo", matrícula `DEM0XX`).

## Colaborador Demo Principal (avaliação em destaque)

A avaliação **id_avaliacao = 15** (já configurada como Resultado de Exemplo
desde a FEIRA-01/02) foi reaproveitada como **Demo Principal**, pois já
atendia integralmente aos requisitos: colaborador, vínculo, contexto,
atividade, questionário completo, status FINALIZADA, resultados de risco,
rastreabilidade, classificação geral, recomendações, Plano de Ação e ações —
tudo já validado em sessões anteriores (FEIRA-02/03/04). Não foi necessário
trocar o ID configurado em `js/config/demo.js`.

- **Colaborador**: Marina Alves Demo (matrícula DEM001)
- **Setor**: Administrativo
- **Vínculo**: Analista Administrativo
- **Data da avaliação**: 04/09/2026
- **Classificação geral**: **CRÍTICO**
- **Pontuação total**: 21

### Riscos identificados (avaliação 15)

| Risco | Classificação | Pontuação |
|---|---|---|
| Fadiga ocupacional | Crítico | 5 |
| Movimentos repetitivos | Alto | 4 |
| Condições ambientais desfavoráveis | Alto | 4 |
| Postura inadequada | Moderado | 3 |
| Esforço físico excessivo | Moderado | 3 |
| Permanência prolongada em postura estática | Moderado | 2 |
| Organização inadequada das pausas | Baixo | 0 |

### Recomendações (avaliação 15)

13 recomendações geradas pelo fluxo real (REGRA), todas com status
`SUGERIDA`, entre elas: *Avaliar possibilidade de alternância postural*,
*Revisar adequação do mobiliário ao usuário* (2×), *Avaliar organização das
pausas* (2×), *Orientar sobre postura adequada*, *Orientar ajuste da
estação de trabalho*, *Avaliar redistribuição de tarefas repetitivas*,
*Avaliar inserção de pausas adicionais* (2×), *Avaliar técnica de
movimentação manual de cargas*, *Avaliar condições ambientais do posto*,
*Realizar análise profissional do posto* (REC-PROF-01, liberada por haver
risco ALTO/CRÍTICO).

### Plano de Ação (avaliação 15)

- **Título**: "Plano de ação - Avaliacao Marina Alves Demo (Critico)"
- **Status**: Em andamento
- **Início**: 05/09/2026 · **Alvo**: 05/10/2026

| Ação | Prioridade | Prazo | Status |
|---|---|---|---|
| Avaliar alternância postural no posto de trabalho | Alta | 20/09/2026 | Em andamento |
| Revisar adequação do mobiliário ao usuário | Média | 01/09/2026 | Aberta *(atrasada)* |
| Avaliar organização das pausas ao longo da jornada | Média | 25/09/2026 | Concluída |

## Colaborador Demo ao Vivo

Reservado para o fluxo demonstrado **ao vivo, na hora**, na frente da banca —
por isso **não foi finalizado nenhuma avaliação "surpresa" para ele antes da
feira** (o roteiro abaixo foi apenas **ensaiado** em uma avaliação de teste,
que ficou registrada como id_avaliacao=28, mas o apresentador deve criar uma
**nova** avaliação ao vivo seguindo o mesmo roteiro).

- **Nome**: Fernanda Costa Demo
- **Matrícula**: DEM005
- **Setor**: Administrativo
- **Cargo**: Analista Administrativo
- **Vínculo**: já cadastrado e válido (id_vinculo=9), pronto para uso

## Respostas da Demonstração (roteiro ensaiado — resultado real: CRÍTICO, 21 pontos)

Atividade selecionada no contexto: **Análise de documentos**.

Este roteiro foi **executado** (não escrito antes de rodar) em uma avaliação
de teste real; o resultado abaixo é o que o Motor realmente calculou.

| # | Pergunta | Resposta a marcar |
|---|---|---|
| 1 | Permanece sentado por períodos prolongados sem se levantar? | Sim |
| 2 | É necessário inclinar o tronco com frequência durante a atividade? | Sim |
| 3 | Há necessidade de manter os braços elevados acima da linha dos ombros? | Sim |
| 4 | A atividade exige movimentos repetitivos das mãos ou braços? | Sim |
| 5 | Com que frequência os mesmos movimentos são repetidos ao longo da jornada? | Sempre |
| 6 | A atividade exige levantamento manual de cargas? | Sim |
| 7 | Há necessidade de aplicação frequente de força com as mãos ou braços? | Sim |
| 8 | Com que frequência você realiza esforço físico intenso durante a jornada? | Sempre |
| 9 | A cadeira utilizada permite ajuste de altura? | Sim |
| 10 | A superfície de trabalho está em altura adequada para você? | Sim |
| 11 | Como você avalia o conforto geral do mobiliário utilizado? | Péssimo |
| 12 | O ambiente apresenta condições que dificultam a execução confortável da atividade (ruído, iluminação, temperatura)? | Sim |
| 13 | Como você avalia a iluminação do ambiente de trabalho? | Péssimo |
| 14 | Você percebe aumento de fadiga ao longo da jornada de trabalho? | Sim |
| 15 | Com que frequência sente desconforto após períodos prolongados de atividade? | Sempre |
| 16 | Qual a intensidade do desconforto percebido ao final da jornada? | Intenso |
| 17 | Existem pausas programadas durante a jornada de trabalho? | Sim |
| 18 | Há possibilidade de alternar entre diferentes tarefas ao longo do dia? | Sim |
| 19 | Você já recebeu orientação sobre postura adequada para a atividade? | Sim |
| 20 | Deseja registrar alguma observação adicional? | (deixar em branco) |

### Resultado Esperado (real, obtido no ensaio)

- **Classificação geral**: CRÍTICO
- **Pontuação total**: 21
- **Riscos identificados**: Permanência prolongada em postura estática,
  Postura inadequada, Movimentos repetitivos, Esforço físico excessivo,
  Fadiga ocupacional, Organização inadequada das pausas, Condições
  ambientais desfavoráveis (7 riscos, mesmo padrão da avaliação 15)

Depois de finalizar, seguir para: Entenda por quê → Recomendações → Plano de
Ação (criar um novo, ex. título "Plano de Adequação Ergonômica — Fernanda
Costa Demo") → adicionar 1 ação ao vivo → Dashboard (mostrar o KPI/gráfico
atualizando).

## Dashboard Esperado

Com os dados preparados (antes de qualquer ação criada ao vivo na feira):

| Indicador | Valor |
|---|---|
| Avaliações realizadas | 18 |
| Riscos identificados | 88 |
| Alto/Crítico | 20 |
| Ações em acompanhamento | 9 (2 atrasadas) |
| Riscos por Classificação | Crítico 6 · Alto 14 · Moderado 58 · Baixo 10 |
| Riscos por Setor | Produção 34 · Administrativo 24 · Tecnologia 16 · Logística 14 |
| Evolução das Avaliações | abr 2 · mai 2 · jun 2 · jul 2 · ago 5 · set 5 |
| Status do Plano de Ação | Em andamento 4 · Aberta 4 · Concluída 5 · Cancelada 2 · Bloqueada 1 |

Todos os totais foram cruzados matematicamente (donut = KPI riscos; barras de
setor = KPI riscos; soma da evolução = KPI avaliações; soma do plano = total
de ações no banco) — ver relatório final da FEIRA-05 para o detalhamento.

## Plano B (pouco tempo / falha de rede)

Se o fluxo ao vivo (criar avaliação → questionário → finalizar) não puder
ser demonstrado por qualquer motivo (tempo curto, instabilidade de rede),
usar o **Cenário B** abaixo, que não depende de nenhuma escrita nova no
banco durante a apresentação.

## Cenário A — Demonstração Principal (fluxo completo ao vivo)

```
HOME
 ↓
INICIAR DEMONSTRAÇÃO
 ↓
COLABORADOR DEMO (Fernanda Costa Demo)
 ↓
NOVA AVALIAÇÃO
 ↓
CONTEXTO (atividade: Análise de documentos)
 ↓
QUESTIONÁRIO (roteiro documentado acima)
 ↓
FINALIZAR
 ↓
PROCESSAMENTO (Motor de Risco)
 ↓
RESULTADO (esperado: Crítico, 21 pts)
 ↓
ENTENDA POR QUÊ
 ↓
RECOMENDAÇÕES
 ↓
PLANO DE AÇÃO (criar + adicionar 1 ação)
 ↓
DASHBOARD (mostrar indicadores atualizados)
```

Tempo medido do fluxo completo (Home → Resultado, sem contar plano/ações):
**≈ 1 minuto e 20 segundos** de interações automatizadas (script), o que em
uso manual por um apresentador tende a ficar entre 3 e 5 minutos (20
perguntas + navegação). Dentro do limite de ~5 minutos da seção 26 — não foi
necessário remover perguntas nem usar apenas o fluxo parcial, mas o Cenário
B fica como alternativa segura se o tempo apertar.

## Cenário B — Demonstração Curta (Resultado de Exemplo)

```
HOME
 ↓
VER RESULTADO DE EXEMPLO  (id_avaliacao=15, Marina Alves Demo)
 ↓
RESULTADO  (Crítico, 21 pts)
 ↓
ENTENDA POR QUÊ
 ↓
RECOMENDAÇÕES
 ↓
PLANO DE AÇÃO  (já existe — "Ver Plano de Ação")
 ↓
DASHBOARD
```

Recomendado quando houver pouco tempo — nenhuma escrita nova é necessária,
tudo já está persistido e validado.

## Cenário C — Visão Executiva (perguntas de gestores/banca)

```
HOME
 ↓
ABRIR DASHBOARD
 ↓
KPIs (18 avaliações · 88 riscos · 20 alto/crítico · 9 ações)
 ↓
Riscos por Classificação (clicar numa fatia para filtrar)
 ↓
Riscos por Setor (clicar numa barra para filtrar)
 ↓
Ações / Status do Plano de Ação
 ↓
Riscos que Exigem Atenção
```

O cross-filter (clicar em uma classificação ou setor) foi testado e
funciona corretamente — filtra os demais elementos relacionados a risco sem
alterar nenhum dado; "Limpar filtros" sempre restaura a visão geral.

## Observações

- As avaliações 7, 8, 9, 10 e 14 permanecem em status `EM_ANDAMENTO`
  (rascunhos de sessões de teste anteriores) — não fazem parte do cenário
  de demonstração e não afetam os KPIs (o Dashboard só conta avaliações
  `FINALIZADA`).
- Não foi possível obter naturalmente uma avaliação com classificação geral
  **BAIXO** dentro do conjunto de perguntas/regras existente — mesmo com
  respostas de severidade mínima em todas as perguntas, o resultado mínimo
  observado foi **MODERADO** (pontuação 4). Isso não foi forçado nem
  contornado: é o piso real do questionário atual. A demonstração já cobre
  Moderado, Alto e Crítico, o que atende à seção 17 ("pelo menos um
  resultado baixo/moderado").
- O colaborador "Alessandro teste de inserção" (matrícula DEM007, inativo)
  é um registro de teste de sessões anteriores e não faz parte do cenário
  de demonstração.
