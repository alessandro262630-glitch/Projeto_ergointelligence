# Checklist da Demonstração — Feira Técnica (08/09/2026)

> Validado na FEIRA-02 (ver `docs/backlog` para o relatório completo da tarefa).
> Ambiente: Supabase de desenvolvimento único (mesmo usado durante todo o MVP).

## Checklist técnico

- [x] Aplicação abre (`index.html`, servido por qualquer servidor HTTP estático)
- [x] Supabase conectado
- [x] Home abre
- [x] Iniciar demonstração funciona (leva a `colaboradores.html`)
- [x] Colaborador demo disponível (Marina Alves Demo — DEM001)
- [x] Vínculo válido (Administrativo · Assistente Administrativo)
- [x] Nova avaliação funciona
- [x] Contexto funciona (atividade associada)
- [x] Questionário funciona (20 perguntas, uma por vez)
- [x] Respostas persistem (confirmadas no banco após refresh no meio do questionário)
- [x] Finalização funciona (`status = FINALIZADA`, `data_finalizacao` preenchida)
- [x] Motor funciona (`avaliacao_risco` gerado automaticamente após finalizar)
- [x] Resultado funciona (`resultado.html?id_avaliacao=...`)
- [x] "Entenda por quê" funciona (rastreabilidade por regra)
- [x] Recomendações funcionam (`origem = REGRA`, `status = SUGERIDA`)
- [x] Resultado de exemplo funciona (`js/config/demo.js` → `id_avaliacao=15`)
- [x] Refresh não duplica dados (testado 2x seguidas em `resultado.html`; `avaliacao_risco`/`avaliacao_risco_regra`/`avaliacao_recomendacao` sem duplicidade)

## Antes de ligar o notebook na feira

1. Testar a internet do local (o sistema depende do Supabase — não há modo offline).
2. Abrir `index.html` uma vez e conferir se a home carrega em poucos segundos.
3. Ter este arquivo (ou o roteiro abaixo) aberto em outra aba/celular como apoio.
4. Confirmar que `js/config/demo.js` ainda aponta para uma avaliação finalizada válida (rodar `Ver Resultado de Exemplo` uma vez).
5. Se o notebook for trocado ou a internet falhar durante o ensaio: usar o **Cenário B** (resultado pronto) como plano seguro.

## Roteiro da demonstração

### Cenário A — Demonstração ao vivo (fluxo completo, ~2 a 3 min)

1. Abrir a Home — apresentar produto e propósito rapidamente.
2. Clicar **Iniciar Demonstração**.
3. Selecionar um colaborador (ex.: Marina Alves Demo) e clicar no ícone de nova avaliação.
4. Preencher/confirmar vínculo, ambiente e tipo de avaliação → **Iniciar avaliação**.
5. Adicionar uma atividade no Contexto → **Próximo**.
6. Responder o Questionário (pode ser rápido, uma pergunta por vez).
7. **Finalizar avaliação** (confirmar no modal).
8. Mostrar o texto "Calculando riscos..." — o Motor está processando.
9. Mostrar o **Resultado**: classificação geral, pontuação, riscos.
10. Abrir **Entenda por quê** em um risco (rastreabilidade por regra).
11. Rolar até **Recomendações** e mostrar as sugestões geradas.

### Cenário B — Resultado pronto (plano de segurança, ~1 min)

Usar quando o tempo for curto, a internet estiver instável, ou algo falhar no Cenário A.

1. Abrir a Home.
2. Clicar **Ver Resultado de Exemplo**.
3. O resultado (classificação **Crítico**, avaliação já processada) aparece direto.
4. Abrir **Entenda por quê**.
5. Mostrar **Recomendações**.

## IDs de demonstração

| Item | Valor |
|---|---|
| Colaborador demo | Marina Alves Demo — matrícula DEM001 |
| Avaliação demo (Resultado de Exemplo) | `id_avaliacao = 15` — Crítico, pontuação 21 |
| Configuração | `js/config/demo.js` → `DEMO_CONFIG.avaliacaoResultadoExemploId` |

Nenhum dado pessoal real foi utilizado — todos os colaboradores são fictícios (seed do projeto).
