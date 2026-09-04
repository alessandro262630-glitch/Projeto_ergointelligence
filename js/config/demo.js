// FEIRA-01 - Configuracao do Modo Demonstracao.
//
// Este arquivo contem APENAS parametros de apresentacao para a feira.
// Nao e regra de negocio, nao altera o banco e nao afeta o fluxo normal
// do sistema (colaborador -> vinculo -> avaliacao -> questionario ->
// motor de risco -> resultado). Nenhuma credencial deve ser colocada aqui.
export const DEMO_CONFIG = {
    // id_avaliacao de uma avaliacao ja FINALIZADA, usada pelo botao
    // "Ver resultado de exemplo" da home (index.html) para levar direto a
    // resultado.html?id_avaliacao=<id> - a mesma tela do fluxo real,
    // sem recalcular nada aqui.
    //
    // Valor atual (15) e a avaliacao demo validada na FEIRA-02: fluxo
    // completo executado pela UI (Marina Alves Demo / DEM001), classificacao
    // geral CRITICO, pontuacao total 21, 7 riscos calculados, 14 regras
    // avaliadas e 13 recomendacoes geradas - tudo conferido diretamente no
    // banco. Refresh do resultado testado duas vezes seguidas sem
    // reprocessar nem duplicar nada (ver docs/checklist-feira.md).
    //
    // Definir como null oculta/desabilita o botao (ver js/pages/home.js),
    // por exemplo em um ambiente novo, sem avaliacao finalizada ainda.
    avaliacaoResultadoExemploId: 15,
};
