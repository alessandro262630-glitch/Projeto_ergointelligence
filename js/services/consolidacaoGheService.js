import { supabase } from '../config/supabase.js';
import { buscarAvaliacaoGhePorId } from './avaliacaoGheService.js';
import { buscarGhePorId, buscarPlanoAmostragemPorId, listarParticipantes } from './gheService.js';
import { carregarQuestionario } from './perguntaService.js';

// MVP-07 - Consolidacao descritiva da Avaliacao do GHE.
// Le SOMENTE coletas CONCLUIDA e produz estatisticas puramente descritivas
// por pergunta (contagens, percentuais, min/max/media quando aplicavel).
// NUNCA calcula, atribui ou sugere uma classificacao de risco para o GHE -
// isso e escopo do MVP-08 (Motor de Risco do GHE), ainda nao implementado.
// Este service nunca importa motorRisco.js/classificadorRisco.js/
// riscoService.js e nunca altera nenhuma linha no banco (somente leitura).

function respostaColetaPreenchida(tipoResposta, resposta) {
    if (!resposta) return false;
    switch (tipoResposta) {
        case 'BOOLEANO':
            return resposta.resposta_booleano === true || resposta.resposta_booleano === false;
        case 'NUMERICO':
            return typeof resposta.resposta_numero === 'number' && !Number.isNaN(resposta.resposta_numero);
        case 'TEXTO':
            return typeof resposta.resposta_texto === 'string' && resposta.resposta_texto.trim().length > 0;
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return Array.isArray(resposta.opcoes) && resposta.opcoes.length === 1;
        case 'ESCOLHA_MULTIPLA':
            return Array.isArray(resposta.opcoes) && resposta.opcoes.length > 0;
        default:
            return false;
    }
}

function agruparOpcoesPorResposta(opcoes) {
    const mapa = new Map();
    (opcoes || []).forEach((linha) => {
        const lista = mapa.get(linha.id_resposta_coleta) || [];
        lista.push(linha.id_opcao);
        mapa.set(linha.id_resposta_coleta, lista);
    });
    return mapa;
}

function percentual(quantidade, total) {
    return total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0;
}

function calcularEstatisticasBooleano(respostas) {
    const total = respostas.length;
    const totalSim = respostas.filter((r) => r.resposta_booleano === true).length;
    const totalNao = total - totalSim;
    return {
        total_respondidas: total,
        sim: { quantidade: totalSim, percentual: percentual(totalSim, total) },
        nao: { quantidade: totalNao, percentual: percentual(totalNao, total) },
    };
}

function calcularEstatisticasNumerico(respostas) {
    const valores = respostas.map((r) => r.resposta_numero);
    const total = valores.length;
    if (total === 0) {
        return { total_respondidas: 0, minimo: null, maximo: null, media: null };
    }
    const soma = valores.reduce((acc, v) => acc + v, 0);
    return {
        total_respondidas: total,
        minimo: Math.min(...valores),
        maximo: Math.max(...valores),
        media: Math.round((soma / total) * 100) / 100,
    };
}

// ESCALA/ESCOLHA_UNICA: distribuicao por opcao (uma unica opcao por
// resposta, pelo proprio significado do tipo). `media_descritiva` via
// opcao_resposta.valor_numero so aparece quando TODAS as opcoes da pergunta
// tem valor_numero preenchido, e e sempre rotulada como descritiva na
// pagina - nunca como pontuacao ou classificacao de risco.
function calcularEstatisticasOpcaoUnica(pergunta, respostas) {
    const total = respostas.length;
    const contagemPorOpcao = new Map();
    respostas.forEach((r) => {
        const idOpcao = r.opcoes[0];
        contagemPorOpcao.set(idOpcao, (contagemPorOpcao.get(idOpcao) || 0) + 1);
    });

    const distribuicao = pergunta.opcoes.map((opcao) => ({
        id_opcao: opcao.id_opcao,
        rotulo: opcao.rotulo,
        quantidade: contagemPorOpcao.get(opcao.id_opcao) || 0,
        percentual: percentual(contagemPorOpcao.get(opcao.id_opcao) || 0, total),
    }));

    const todasComValor = pergunta.opcoes.length > 0
        && pergunta.opcoes.every((opcao) => opcao.valor_numero !== null && opcao.valor_numero !== undefined);

    let mediaDescritiva = null;
    if (todasComValor && total > 0) {
        const mapaValor = new Map(pergunta.opcoes.map((opcao) => [opcao.id_opcao, Number(opcao.valor_numero)]));
        const soma = respostas.reduce((acc, r) => acc + (mapaValor.get(r.opcoes[0]) ?? 0), 0);
        mediaDescritiva = Math.round((soma / total) * 100) / 100;
    }

    return { total_respondidas: total, distribuicao, media_descritiva: mediaDescritiva };
}

// ESCOLHA_MULTIPLA: frequencia por opcao - cada coleta pode marcar mais de
// uma opcao, entao a SOMA dos percentuais pode ultrapassar 100%. Isso e
// esperado e nunca deve ser normalizado/"corrigido" para somar 100%.
function calcularEstatisticasMultipla(pergunta, respostas) {
    const total = respostas.length;
    const contagemPorOpcao = new Map();
    respostas.forEach((r) => {
        r.opcoes.forEach((idOpcao) => {
            contagemPorOpcao.set(idOpcao, (contagemPorOpcao.get(idOpcao) || 0) + 1);
        });
    });

    const distribuicao = pergunta.opcoes.map((opcao) => ({
        id_opcao: opcao.id_opcao,
        rotulo: opcao.rotulo,
        quantidade: contagemPorOpcao.get(opcao.id_opcao) || 0,
        percentual: percentual(contagemPorOpcao.get(opcao.id_opcao) || 0, total),
    }));

    return { total_respondidas: total, distribuicao };
}

// TEXTO: so contagem + listagem bruta das respostas - nenhuma analise,
// resumo automatico ou conclusao gerada a partir do texto livre.
function calcularEstatisticasTexto(respostas) {
    return {
        total_respondidas: respostas.length,
        respostas: respostas.map((r) => r.resposta_texto),
    };
}

function calcularEstatisticasPergunta(pergunta, respostasDaPergunta) {
    const respondidas = respostasDaPergunta.filter((r) => respostaColetaPreenchida(pergunta.tipo_resposta, r));

    switch (pergunta.tipo_resposta) {
        case 'BOOLEANO':
            return calcularEstatisticasBooleano(respondidas);
        case 'NUMERICO':
            return calcularEstatisticasNumerico(respondidas);
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return calcularEstatisticasOpcaoUnica(pergunta, respondidas);
        case 'ESCOLHA_MULTIPLA':
            return calcularEstatisticasMultipla(pergunta, respondidas);
        case 'TEXTO':
            return calcularEstatisticasTexto(respondidas);
        default:
            return { total_respondidas: 0 };
    }
}

// Monta a consolidacao descritiva completa de uma Avaliacao do GHE. Nunca
// bloqueia por amostra incompleta (a pagina so exibe um aviso quando
// coletas_concluidas < amostra_planejada) e nunca lanca erro por "nada para
// consolidar" - com zero coletas concluidas, retorna estatisticas vazias
// normalmente (total_respondidas: 0 em cada pergunta).
export async function gerarConsolidacaoDaAvaliacao(idAvaliacaoGhe) {
    const avaliacao = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);
    const [ghe, plano] = await Promise.all([
        buscarGhePorId(avaliacao.id_ghe),
        buscarPlanoAmostragemPorId(avaliacao.id_plano_amostragem),
    ]);
    const participantes = await listarParticipantes(plano.id_plano_amostragem);

    const { data: coletasConcluidas, error: erroColetas } = await supabase
        .from('coleta_ghe')
        .select('id_coleta')
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .eq('status', 'CONCLUIDA');

    if (erroColetas) throw erroColetas;

    const idsColetas = (coletasConcluidas || []).map((c) => c.id_coleta);
    const perguntas = await carregarQuestionario();

    const respostasPorPergunta = new Map();
    if (idsColetas.length > 0) {
        const { data: respostas, error: erroRespostas } = await supabase
            .from('resposta_coleta')
            .select('id_resposta_coleta, id_coleta, id_pergunta, resposta_texto, resposta_numero, resposta_booleano')
            .in('id_coleta', idsColetas);

        if (erroRespostas) throw erroRespostas;

        const idsRespostas = (respostas || []).map((r) => r.id_resposta_coleta);
        let opcoesPorResposta = new Map();
        if (idsRespostas.length > 0) {
            const { data: opcoes, error: erroOpcoes } = await supabase
                .from('resposta_coleta_opcao')
                .select('id_resposta_coleta, id_opcao')
                .in('id_resposta_coleta', idsRespostas);

            if (erroOpcoes) throw erroOpcoes;
            opcoesPorResposta = agruparOpcoesPorResposta(opcoes);
        }

        (respostas || []).forEach((r) => {
            const lista = respostasPorPergunta.get(r.id_pergunta) || [];
            lista.push({ ...r, opcoes: opcoesPorResposta.get(r.id_resposta_coleta) || [] });
            respostasPorPergunta.set(r.id_pergunta, lista);
        });
    }

    const perguntasConsolidadas = perguntas.map((pergunta) => ({
        id_pergunta: pergunta.id_pergunta,
        codigo: pergunta.codigo,
        categoria: pergunta.categoria,
        texto_pergunta: pergunta.texto_pergunta,
        tipo_resposta: pergunta.tipo_resposta,
        unidade: pergunta.unidade,
        ...calcularEstatisticasPergunta(pergunta, respostasPorPergunta.get(pergunta.id_pergunta) || []),
    }));

    return {
        avaliacao,
        ghe,
        plano,
        universo: ghe.universo,
        universo_snapshot: plano.universo_snapshot,
        amostra_planejada: plano.amostra_planejada,
        participantes_registrados: participantes.length,
        coletas_concluidas: idsColetas.length,
        cobertura_percentual: percentual(idsColetas.length, plano.amostra_planejada),
        amostra_atingida: idsColetas.length >= plano.amostra_planejada,
        perguntas: perguntasConsolidadas,
    };
}
