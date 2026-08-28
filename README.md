# ErgoIntelligence

Plataforma de Inteligência Ergonômica.

## Objetivo do MVP

Validar, por meio de uma aplicação funcional e interativa em feira, a hipótese central do produto: transformar respostas estruturadas de uma avaliação ergonômica em um resultado compreensível, rastreável e acionável, com classificação de riscos e recomendações vinculadas a regras determinísticas do sistema.




## Tecnologias utilizadas
- HTML e JavaScript puro (sem bundler/build step)
- Bootstrap 5 (CSS + JS, via CDN) como framework de UI — layout, navbar,
  offcanvas (sidebar), cards, tabelas, formulários, modais e toasts
- Supabase (PostgreSQL) como infraestrutura de persistência do MVP

## Estrutura principal das pastas

```
ergointelligence/
├── index.html / avaliacao.html / resultado.html / dashboard.html
├── css/
│   └── custom.css  # unicos ajustes que o tema padrao do Bootstrap nao cobre
├── js/
│   ├── config/     # configuração (ex.: cliente Supabase)
│   ├── services/   # acesso a dados (avaliações, perguntas, riscos, recomendações)
│   ├── domain/     # motor de risco e classificação (regras de negócio)
│   ├── pages/      # orquestração de cada tela
│   └── utils/      # formatadores, validações e notificações (toast)
├── database/       # schema.sql, seed.sql e migrations do modelo físico
├── docs/           # documentação do projeto (modelo lógico, consolidação do MVP)
└── assets/         # logo e ícones
```

## Execução básica

Este é um projeto estático (HTML/CSS/JS puro). Basta servir a pasta raiz com qualquer servidor HTTP local e configurar as credenciais públicas do Supabase em `js/config/supabase.js`. Exemplo:

```bash
npx serve .
# ou
python -m http.server 8000
```

Em seguida, acesse `index.html` pelo navegador.

## Observação

O MVP utiliza exclusivamente **dados fictícios**, preparados para demonstração e validação da experiência em feira — não representa dados reais de empresas, colaboradores ou diagnóstico clínico/ocupacional.
