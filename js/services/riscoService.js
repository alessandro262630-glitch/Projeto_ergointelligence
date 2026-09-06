import { supabase } from '../config/supabase.js';
import { buscarAvaliacaoPorId } from './avaliacaoService.js';
import { processarMotorRisco } from '../domain/motorRisco.js';
import { obterClassificacaoGeral } from '../domain/classificadorRisco.js';

// Motor de Risco Ergonomico - camada de service.
// Responsavel por: carregar dados do Supabase, chamar o motor (dominio
// puro em js/domain/motorRisco.js), persistir resultados e rastreabilidade,
// e atualizar avaliacao_ergonomica. NAO contem regras de calculo - isso
// pertence exclusivamente ao dominio (ver motorRisco.js/classificadorRisco.js).

function erroRisco(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Resultados ja persistidos de uma avaliacao (usado tanto para a checagem
// de idempotencia quanto para exibicao futura - secao 47). Uma unica
// consulta com embeds, sem loop por risco.
export async function listarResultadosRiscoDaAvaliacao(idAvaliacao) {
    const { data, error } = await supabase
        .from('avaliacao_risco')
        .select(
            'id_avaliacao_risco, id_risco, pontuacao, justificativa, versao_motor_regras, calculado_em, '
            + 'risco_ergonomico(codigo, nome), classificacao_risco(id_classificacao, codigo, nome, prioridade, cor_hex)',
        )
        .eq('id_avaliacao', idAvaliacao);

    if (error) {
        throw error;
    }

    return (data || []).map((linha) => ({
        id_avaliacao_risco: linha.id_avaliacao_risco,
        id_risco: linha.id_risco,
        codigo_risco: linha.risco_ergonomico?.codigo ?? null,
        nome_risco: linha.risco_ergonomico?.nome ?? null,
        pontuacao: linha.pontuacao,
        classificacao: linha.classificacao_risco ?? null,
        justificativa: linha.justificativa,
        versao_motor_regras: linha.versao_motor_regras,
        calculado_em: linha.calculado_em,
    }));
}

// Carrega, em blocos (nunca em loop por regra/pergunta - secao 48), tudo
// que o motor de dominio precisa para uma avaliacao especifica, e monta as
// estruturas exatamente no formato esperado por processarMotorRisco.
async function carregarDadosParaMotor(avaliacao) {
    const idAvaliacao = avaliacao.id_avaliacao;

    const [
        { data: respostasBrutas, error: erroRespostas },
        { data: riscos, error: erroRiscos },
        { data: regrasBrutas, error: erroRegras },
        { data: classificacoes, error: erroClassificacoes },
    ] = await Promise.all([
        supabase
            .from('resposta_avaliacao')
            .select('id_resposta, id_pergunta, resposta_texto, resposta_numero, resposta_booleano')
            .eq('id_avaliacao', idAvaliacao),
        supabase.from('risco_ergonomico').select('id_risco, codigo, nome, descricao, categoria').eq('ativo', true),
        supabase
            .from('regra_risco')
            .select('id_regra, id_risco, codigo, nome, operador_agregacao, pontuacao_resultado, vigencia_inicio, vigencia_fim')
            .eq('ativo', true),
        supabase
            .from('classificacao_risco')
            .select('id_classificacao, codigo, nome, pontuacao_min, pontuacao_max, prioridade')
            .eq('ativo', true),
    ]);

    if (erroRespostas) throw erroRespostas;
    if (erroRiscos) throw erroRiscos;
    if (erroRegras) throw erroRegras;
    if (erroClassificacoes) throw erroClassificacoes;

    const idsRegras = (regrasBrutas || []).map((regra) => regra.id_regra);
    const { data: condicoesBrutas, error: erroCondicoes } = idsRegras.length > 0
        ? await supabase
            .from('regra_condicao')
            .select('id_condicao, id_regra, id_pergunta, operador, id_opcao, valor_texto, valor_numero, valor_booleano, ordem')
            .in('id_regra', idsRegras)
            .order('ordem', { ascending: true })
        : { data: [], error: null };
    if (erroCondicoes) throw erroCondicoes;

    const idsRespostas = (respostasBrutas || []).map((resposta) => resposta.id_resposta);
    const { data: opcoesSelecionadas, error: erroOpcoesSelecionadas } = idsRespostas.length > 0
        ? await supabase.from('resposta_opcao').select('id_resposta, id_opcao').in('id_resposta', idsRespostas)
        : { data: [], error: null };
    if (erroOpcoesSelecionadas) throw erroOpcoesSelecionadas;

    // Uma unica consulta ao catalogo de opcoes cobre tanto as opcoes que o
    // participante selecionou quanto as opcoes referenciadas pelas
    // condicoes das regras (usadas para validar pertinencia - secao 45).
    const idsOpcoesReferenciadas = new Set();
    (opcoesSelecionadas || []).forEach((linha) => idsOpcoesReferenciadas.add(linha.id_opcao));
    (condicoesBrutas || []).forEach((condicao) => {
        if (condicao.id_opcao !== null && condicao.id_opcao !== undefined) {
            idsOpcoesReferenciadas.add(condicao.id_opcao);
        }
    });

    const idsOpcoesArray = [...idsOpcoesReferenciadas];
    const { data: opcoesCatalogo, error: erroOpcoesCatalogo } = idsOpcoesArray.length > 0
        ? await supabase
            .from('opcao_resposta')
            .select('id_opcao, id_pergunta, codigo, rotulo, valor_numero, ativo')
            .in('id_opcao', idsOpcoesArray)
        : { data: [], error: null };
    if (erroOpcoesCatalogo) throw erroOpcoesCatalogo;

    const opcaoPorId = new Map((opcoesCatalogo || []).map((opcao) => [opcao.id_opcao, opcao]));

    // Estrutura Map<idPergunta, resposta> esperada pelo dominio (secao 11).
    const respostaPorIdResposta = new Map((respostasBrutas || []).map((resposta) => [resposta.id_resposta, resposta]));
    const respostas = {};
    (respostasBrutas || []).forEach((resposta) => {
        respostas[resposta.id_pergunta] = {
            respostaBooleano: resposta.resposta_booleano,
            respostaNumero: resposta.resposta_numero,
            respostaTexto: resposta.resposta_texto,
            opcoes: [],
        };
    });
    (opcoesSelecionadas || []).forEach((linha) => {
        const respostaPai = respostaPorIdResposta.get(linha.id_resposta);
        const opcao = opcaoPorId.get(linha.id_opcao);
        if (!respostaPai || !opcao) {
            return;
        }
        respostas[respostaPai.id_pergunta].opcoes.push({
            idOpcao: opcao.id_opcao,
            codigo: opcao.codigo,
            rotulo: opcao.rotulo,
            valorNumero: opcao.valor_numero,
        });
    });

    // Agrupa condicoes por regra, resolvendo id_opcao -> metadados do
    // catalogo (opcaoReferenciada), para o dominio validar pertinencia sem
    // precisar de uma consulta propria.
    const condicoesPorRegra = new Map();
    (condicoesBrutas || []).forEach((condicao) => {
        const lista = condicoesPorRegra.get(condicao.id_regra) || [];
        lista.push({
            ...condicao,
            opcaoReferenciada: condicao.id_opcao !== null && condicao.id_opcao !== undefined
                ? opcaoPorId.get(condicao.id_opcao) || null
                : null,
        });
        condicoesPorRegra.set(condicao.id_regra, lista);
    });

    const regras = (regrasBrutas || []).map((regra) => ({
        ...regra,
        condicoes: condicoesPorRegra.get(regra.id_regra) || [],
    }));

    return {
        avaliacao,
        respostas,
        regras,
        riscos: riscos || [],
        classificacoes: classificacoes || [],
    };
}

// Persiste o resultado ja calculado (nada e gravado antes de o motor
// terminar de processar tudo em memoria - secao 34/46).
//
// Ordem: avaliacao_risco (1 INSERT em lote) -> avaliacao_risco_regra (1
// INSERT em lote, usando os ids recem-criados) -> avaliacao_ergonomica (1
// UPDATE). Se o segundo INSERT falhar, reverte APENAS os avaliacao_risco
// criados por esta tentativa (nunca resultados historicos preexistentes -
// a idempotencia ja garantiu que nao havia nenhum antes de comecar).
async function persistirResultado(idAvaliacao, resultado) {
    const linhasAvaliacaoRisco = resultado.riscos.map((risco) => ({
        id_avaliacao: idAvaliacao,
        id_risco: risco.id_risco,
        id_classificacao: risco.classificacao.id_classificacao,
        pontuacao: risco.pontuacao,
        justificativa: risco.justificativa,
        versao_motor_regras: resultado.versaoMotor,
    }));

    const { data: riscosInseridos, error: erroInsercaoRiscos } = await supabase
        .from('avaliacao_risco')
        .insert(linhasAvaliacaoRisco)
        .select('id_avaliacao_risco, id_risco');

    if (erroInsercaoRiscos) {
        console.error('Erro ao persistir avaliacao_risco:', erroInsercaoRiscos);
        throw erroRisco('Não foi possível salvar o resultado do cálculo de risco.', 'PERSISTENCIA_RISCO_FALHOU');
    }

    const idAvaliacaoRiscoPorRisco = new Map(riscosInseridos.map((linha) => [linha.id_risco, linha.id_avaliacao_risco]));

    const linhasRegras = [];
    resultado.riscos.forEach((risco) => {
        const idAvaliacaoRisco = idAvaliacaoRiscoPorRisco.get(risco.id_risco);
        risco.regras.forEach((regra) => {
            linhasRegras.push({
                id_avaliacao_risco: idAvaliacaoRisco,
                id_regra: regra.id_regra,
                satisfeita: regra.satisfeita,
                pontuacao_aplicada: regra.pontuacaoAplicada,
                detalhe: regra.detalhe,
            });
        });
    });

    const { error: erroInsercaoRegras } = await supabase.from('avaliacao_risco_regra').insert(linhasRegras);

    if (erroInsercaoRegras) {
        console.error('Erro ao persistir avaliacao_risco_regra:', erroInsercaoRegras);

        const idsParaReverter = riscosInseridos.map((linha) => linha.id_avaliacao_risco);
        const { error: erroReversao } = await supabase
            .from('avaliacao_risco')
            .delete()
            .in('id_avaliacao_risco', idsParaReverter);

        if (erroReversao) {
            console.error(
                'Falha ao reverter avaliacao_risco após erro de persistência de avaliacao_risco_regra:',
                erroReversao,
            );
        }

        throw erroRisco(
            'Não foi possível salvar a rastreabilidade do cálculo de risco. Nenhum resultado foi confirmado.',
            'PERSISTENCIA_REGRAS_FALHOU',
        );
    }

    const { data: avaliacaoAtualizada, error: erroAtualizacao } = await supabase
        .from('avaliacao_ergonomica')
        .update({
            pontuacao_total: resultado.pontuacaoTotal,
            id_classificacao_geral: resultado.classificacaoGeral.id_classificacao,
            versao_motor_regras: resultado.versaoMotor,
        })
        .eq('id_avaliacao', idAvaliacao)
        .select('id_avaliacao, pontuacao_total, id_classificacao_geral, versao_motor_regras, status')
        .single();

    if (erroAtualizacao) {
        console.error('Erro ao atualizar avaliacao_ergonomica após cálculo de risco:', erroAtualizacao);
        // Os resultados por risco (avaliacao_risco/avaliacao_risco_regra) ja
        // estao integros e completos neste ponto - nao ha por que reverte-los
        // por uma falha so no resumo agregado da avaliacao. O erro e
        // reportado para que o problema seja visivel e corrigido.
        throw erroRisco(
            'O cálculo de risco foi salvo, mas não foi possível atualizar o resumo da avaliação (pontuação total e classificação geral).',
            'ATUALIZACAO_AVALIACAO_FALHOU',
        );
    }

    return avaliacaoAtualizada;
}

// Porta de entrada do Motor de Risco. So processa avaliacao FINALIZADA
// (secao 7), nunca reprocessa silenciosamente uma avaliacao que ja possui
// resultado (secao 8/47), e so persiste depois que o dominio calcula e
// valida tudo em memoria (secao 34).
export async function processarRiscosDaAvaliacao(idAvaliacao) {
    let avaliacao;
    try {
        avaliacao = await buscarAvaliacaoPorId(idAvaliacao);
    } catch (error) {
        console.error('Erro ao carregar avaliação para cálculo de risco:', error);
        throw erroRisco('Avaliação não encontrada.', 'AVALIACAO_NAO_ENCONTRADA');
    }

    if (avaliacao.status === 'CANCELADA') {
        throw erroRisco('Uma avaliação cancelada não pode ter o risco calculado.', 'AVALIACAO_CANCELADA');
    }
    if (avaliacao.status !== 'FINALIZADA') {
        throw erroRisco(
            'A avaliação precisa estar finalizada antes do cálculo de risco.',
            'AVALIACAO_NAO_FINALIZADA',
        );
    }

    const resultadosExistentes = await listarResultadosRiscoDaAvaliacao(idAvaliacao);
    if (resultadosExistentes.length > 0) {
        const erro = erroRisco('Esta avaliação já possui resultado de risco calculado.', 'RISCO_JA_PROCESSADO');
        erro.resultadosExistentes = resultadosExistentes;
        throw erro;
    }

    const dados = await carregarDadosParaMotor(avaliacao);

    // Erros de configuracao lancados pelo dominio (operador nao suportado,
    // regra sem condicoes, classificacao ambigua, etc.) sobem tal como
    // vieram - ja carregam .code e mensagem amigavel (ver motorRisco.js).
    const resultado = processarMotorRisco(dados);

    await persistirResultado(idAvaliacao, resultado);

    return resultado;
}

// =====================================================================
// INT-RSK-01 - Integracao ao fluxo (orquestracao + recuperacao de resumo).
// =====================================================================

// Reconstroi SOMENTE o resumo agregado em avaliacao_ergonomica
// (pontuacao_total, id_classificacao_geral, versao_motor_regras) a partir
// dos avaliacao_risco ja persistidos - nunca recalcula regra alguma e nunca
// toca em avaliacao_risco/avaliacao_risco_regra/respostas (secoes 11/15).
// Usada para recuperar o cenario em que o calculo e a persistencia por
// risco funcionaram, mas so a atualizacao final do resumo falhou.
export async function sincronizarResumoAvaliacaoComResultados(idAvaliacao) {
    const resultados = await listarResultadosRiscoDaAvaliacao(idAvaliacao);

    if (resultados.length === 0) {
        throw erroRisco(
            'Não há resultados de risco persistidos para reconstruir o resumo desta avaliação.',
            'SEM_RESULTADOS_PARA_SINCRONIZAR',
        );
    }

    // Todos os resultados de uma mesma avaliacao devem ter sido calculados
    // pela mesma versao do motor - nunca escolher uma arbitrariamente
    // (secao 14).
    const versoes = new Set(resultados.map((resultado) => resultado.versao_motor_regras));
    if (versoes.size > 1) {
        throw erroRisco(
            'Os resultados da avaliação possuem versões de motor inconsistentes.',
            'VERSAO_MOTOR_INCONSISTENTE',
        );
    }
    const [versaoMotor] = versoes;

    // Soma simples das pontuacoes ja persistidas (secao 12) e classificacao
    // geral pela mesma regra do dominio - maior prioridade entre as
    // classificacoes individuais (secao 13) - reaproveitando
    // obterClassificacaoGeral em vez de duplicar a logica aqui.
    const pontuacaoTotal = resultados.reduce((soma, resultado) => soma + Number(resultado.pontuacao), 0);
    const classificacaoGeral = obterClassificacaoGeral(resultados);

    const { data, error } = await supabase
        .from('avaliacao_ergonomica')
        .update({
            pontuacao_total: pontuacaoTotal,
            id_classificacao_geral: classificacaoGeral.id_classificacao,
            versao_motor_regras: versaoMotor,
        })
        .eq('id_avaliacao', idAvaliacao)
        .select('id_avaliacao, pontuacao_total, id_classificacao_geral, versao_motor_regras, status')
        .single();

    if (error) {
        console.error('Erro ao sincronizar resumo da avaliação a partir dos resultados existentes:', error);
        throw erroRisco('Não foi possível sincronizar o resumo da avaliação.', 'SINCRONIZACAO_RESUMO_FALHOU');
    }

    return data;
}

// Porta de entrada para a integracao com o fluxo (questionario.js apos
// finalizar, resultado.html ao abrir/retentar). Nunca reprocessa
// silenciosamente uma avaliacao ja calculada (RISCO_JA_PROCESSADO vira
// sucesso, nao falha) e se autorrecupera quando o calculo/persistencia por
// risco deu certo mas so o resumo agregado falhou (ATUALIZACAO_AVALIACAO_FALHOU).
export async function processarOuObterResultadoRisco(idAvaliacao) {
    let jaExistia = false;
    let precisaRecomporResumo = false;

    try {
        await processarRiscosDaAvaliacao(idAvaliacao);
    } catch (error) {
        if (error.code === 'RISCO_JA_PROCESSADO') {
            jaExistia = true;
            precisaRecomporResumo = true;
        } else if (error.code === 'ATUALIZACAO_AVALIACAO_FALHOU') {
            precisaRecomporResumo = true;
        } else {
            throw error;
        }
    }

    if (precisaRecomporResumo) {
        await sincronizarResumoAvaliacaoComResultados(idAvaliacao);
    }

    const resultados = await listarResultadosRiscoDaAvaliacao(idAvaliacao);
    return { processadoAgora: !jaExistia, jaExistia, resultados };
}

// Rastreabilidade de um unico resultado (secao 28) - usada pelo "Entenda
// por que" da tela de resultado, carregada sob demanda (so quando o
// participante expande), nunca calculada de novo aqui.
export async function listarRastreabilidadeDoResultado(idAvaliacaoRisco) {
    const { data, error } = await supabase
        .from('avaliacao_risco_regra')
        .select('id_avaliacao_risco_regra, id_regra, satisfeita, pontuacao_aplicada, detalhe, avaliado_em, regra_risco(codigo, nome)')
        .eq('id_avaliacao_risco', idAvaliacaoRisco)
        .order('id_avaliacao_risco_regra', { ascending: true });

    if (error) {
        throw error;
    }

    return (data || []).map((linha) => ({
        id_avaliacao_risco_regra: linha.id_avaliacao_risco_regra,
        id_regra: linha.id_regra,
        codigo: linha.regra_risco?.codigo ?? null,
        nome: linha.regra_risco?.nome ?? null,
        satisfeita: linha.satisfeita,
        pontuacao_aplicada: linha.pontuacao_aplicada,
        detalhe: linha.detalhe,
    }));
}

// Classificacao geral da avaliacao (secao 26) - buscarAvaliacaoPorId so traz
// o id_classificacao_geral cru; esta consulta resolve o registro completo
// (nome, cor_hex, prioridade) sem duplicar a regra de classificacao no
// frontend.
export async function buscarClassificacaoPorId(idClassificacao) {
    const { data, error } = await supabase
        .from('classificacao_risco')
        .select('id_classificacao, codigo, nome, pontuacao_min, pontuacao_max, prioridade, cor_hex, descricao')
        .eq('id_classificacao', idClassificacao)
        .single();

    if (error) {
        throw error;
    }

    return data;
}
