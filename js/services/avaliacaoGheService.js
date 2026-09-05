import { supabase } from '../config/supabase.js';
import { buscarGhePorId, buscarPlanoAmostragemAtual, buscarPlanoAmostragemPorId, listarParticipantes } from './gheService.js';
import { verificarPerguntasObrigatoriasRespondidasColeta } from './respostaColetaService.js';

// MVP-07 - Avaliacao do GHE e Coletas da Amostra.
// Le/escreve AVALIACAO_GHE e COLETA_GHE
// (database/migrations/003_add_avaliacao_ghe_coletas.sql). Cada COLETA e
// uma sessao de captura de evidencias de UM participante da amostra dentro
// de uma Avaliacao do GHE - NUNCA um "resultado ocupacional individual
// definitivo" (isso continua sendo avaliacao_ergonomica). Este service
// NUNCA calcula risco/pontuacao nem aciona motorRisco.js/classificadorRisco.js/
// riscoService.js - a classificacao do GHE fica para o MVP-08.
//
// Dependencia circular segura com respostaColetaService.js (mesmo padrao
// documentado em avaliacaoService.js/respostaService.js): nenhum dos dois
// modulos chama a funcao importada durante a propria avaliacao do modulo,
// so depois, quando a pagina invoca alguma funcao.

const COLUNAS_AVALIACAO_GHE = 'id_avaliacao_ghe, id_ghe, id_plano_amostragem, id_avaliador, tipo_avaliacao, status, data_avaliacao, observacoes, criado_em, atualizado_em';
const COLUNAS_COLETA = 'id_coleta, id_avaliacao_ghe, id_amostra_participante, status, data_conclusao, criado_em, atualizado_em';

const STATUS_AVALIACAO_GHE_EDITAVEIS = ['RASCUNHO', 'EM_COLETA'];
const STATUS_COLETA_EDITAVEL = 'EM_ANDAMENTO';

function erroAvaliacaoGhe(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// =====================================================================
// AVALIACAO_GHE
// =====================================================================

export async function buscarAvaliacaoGhePorId(idAvaliacaoGhe) {
    const { data, error } = await supabase
        .from('avaliacao_ghe')
        .select(COLUNAS_AVALIACAO_GHE)
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .single();

    if (error) throw error;
    return data;
}

// O modelo permite mais de uma Avaliacao do GHE ao longo do tempo (uma nova
// rodada apos a anterior ser consolidada) - retorna a mais recente
// (criado_em DESC), mesmo padrao ja usado em
// gheService.buscarPlanoAmostragemAtual/planoAcaoService.buscarPlanoPorAvaliacao.
export async function buscarAvaliacaoGheAtual(idGhe) {
    const { data, error } = await supabase
        .from('avaliacao_ghe')
        .select(COLUNAS_AVALIACAO_GHE)
        .eq('id_ghe', idGhe)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

// Garante que a Avaliacao do GHE ainda permite coletas/edicao (RASCUNHO ou
// EM_COLETA) - nunca confia so no estado que a interface acumulou, mesmo
// padrao de avaliacaoService.garantirAvaliacaoEditavel.
export async function garantirAvaliacaoGheEditavel(idAvaliacaoGhe) {
    const avaliacao = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);

    if (avaliacao.status === 'CONSOLIDADA') {
        throw erroAvaliacaoGhe('Esta avaliação do GHE já foi consolidada e não pode ser alterada.', 'AVALIACAO_GHE_CONSOLIDADA');
    }
    if (avaliacao.status === 'CANCELADA') {
        throw erroAvaliacaoGhe('Esta avaliação do GHE foi cancelada e não pode ser alterada.', 'AVALIACAO_GHE_CANCELADA');
    }
    if (!STATUS_AVALIACAO_GHE_EDITAVEIS.includes(avaliacao.status)) {
        throw erroAvaliacaoGhe('Esta avaliação do GHE não permite alterações no momento.', 'STATUS_NAO_EDITAVEL');
    }

    return avaliacao;
}

// Ponto de entrada unico para "Nova Avaliação do GHE" / "Continuar
// Avaliação" (a pagina decide o rotulo do botao, mas os dois chamam esta
// mesma funcao idempotente): reaproveita uma avaliacao ja aberta
// (RASCUNHO/EM_COLETA) em vez de criar uma segunda em paralelo. So cria uma
// nova quando a mais recente ja estiver CONSOLIDADA/CANCELADA ou nao
// existir nenhuma ainda.
export async function iniciarOuContinuarAvaliacaoGhe(dados) {
    if (!dados.id_ghe) {
        throw erroAvaliacaoGhe('GHE não informado.', 'GHE_OBRIGATORIO');
    }
    if (!dados.id_avaliador) {
        throw erroAvaliacaoGhe('Não foi possível identificar o avaliador.', 'AVALIADOR_OBRIGATORIO');
    }

    const existente = await buscarAvaliacaoGheAtual(dados.id_ghe);
    if (existente && STATUS_AVALIACAO_GHE_EDITAVEIS.includes(existente.status)) {
        return existente;
    }

    const ghe = await buscarGhePorId(dados.id_ghe);

    const plano = await buscarPlanoAmostragemAtual(dados.id_ghe);
    if (!plano) {
        throw erroAvaliacaoGhe(
            'É necessário criar um plano de amostragem antes de iniciar a avaliação do GHE.',
            'PLANO_AMOSTRAGEM_OBRIGATORIO',
        );
    }

    const { data: avaliador, error: erroAvaliador } = await supabase
        .from('usuario')
        .select('id_usuario, id_empresa, ativo')
        .eq('id_usuario', dados.id_avaliador)
        .single();

    if (erroAvaliador) throw erroAvaliador;
    if (!avaliador.ativo || avaliador.id_empresa !== ghe.id_empresa) {
        throw erroAvaliacaoGhe('O avaliador informado não é válido para esta empresa.', 'AVALIADOR_INVALIDO');
    }

    const { data, error } = await supabase
        .from('avaliacao_ghe')
        .insert({
            id_ghe: dados.id_ghe,
            id_plano_amostragem: plano.id_plano_amostragem,
            id_avaliador: dados.id_avaliador,
            tipo_avaliacao: 'AEP',
            status: 'EM_COLETA',
            data_avaliacao: new Date().toISOString(),
            observacoes: dados.observacoes ?? null,
        })
        .select(COLUNAS_AVALIACAO_GHE)
        .single();

    if (error) {
        console.error('Erro ao criar avaliação do GHE:', error);
        throw erroAvaliacaoGhe('Não foi possível iniciar a avaliação do GHE.', 'PERSISTENCIA_AVALIACAO_GHE_FALHOU');
    }
    return data;
}

// =====================================================================
// COLETA_GHE
// =====================================================================

export async function buscarColetaPorId(idColeta) {
    const { data, error } = await supabase
        .from('coleta_ghe')
        .select(COLUNAS_COLETA)
        .eq('id_coleta', idColeta)
        .single();

    if (error) throw error;
    return data;
}

// Visao completa de progresso: TODOS os participantes registrados no plano
// da avaliacao, cada um com sua coleta (ou null, quando ainda nao
// iniciada) - permite a tela mostrar "6 de 20" mesmo antes de qualquer
// coleta existir fisicamente (secao 3/53 do prompt MVP-07).
export async function listarProgressoColetas(idAvaliacaoGhe) {
    const avaliacao = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);
    const participantes = await listarParticipantes(avaliacao.id_plano_amostragem);

    const { data: coletas, error } = await supabase
        .from('coleta_ghe')
        .select(COLUNAS_COLETA)
        .eq('id_avaliacao_ghe', idAvaliacaoGhe);

    if (error) throw error;

    const coletaPorParticipante = new Map((coletas || []).map((coleta) => [coleta.id_amostra_participante, coleta]));

    return participantes.map((participante) => ({
        participante,
        coleta: coletaPorParticipante.get(participante.id_amostra_participante) || null,
    }));
}

// Garante que a coleta ainda permite respostas (EM_ANDAMENTO) e que a
// avaliacao-mae ainda permite coleta - reaplicado a cada escrita, nunca so
// na abertura da pagina (mesmo espirito de garantirAvaliacaoEditavel).
export async function garantirColetaEditavel(idColeta) {
    const coleta = await buscarColetaPorId(idColeta);

    if (coleta.status === 'CONCLUIDA') {
        throw erroAvaliacaoGhe('Esta coleta já foi concluída e não pode ser alterada.', 'COLETA_CONCLUIDA');
    }
    if (coleta.status === 'CANCELADA') {
        throw erroAvaliacaoGhe('Esta coleta foi cancelada e não pode ser alterada.', 'COLETA_CANCELADA');
    }
    if (coleta.status !== STATUS_COLETA_EDITAVEL) {
        throw erroAvaliacaoGhe('Esta coleta não permite alterações no momento.', 'STATUS_COLETA_NAO_EDITAVEL');
    }

    await garantirAvaliacaoGheEditavel(coleta.id_avaliacao_ghe);
    return coleta;
}

// Cria a coleta do participante se ainda nao existir, ou retorna a
// existente (idempotente - "Iniciar coleta" e "Continuar coleta" chamam a
// mesma funcao). Nunca cria uma coleta para um participante de OUTRO plano
// de amostragem (secao 22/23 do prompt): valida que o participante
// pertence exatamente ao plano da avaliacao antes de inserir.
export async function criarOuObterColeta(idAvaliacaoGhe, idAmostraParticipante) {
    const avaliacao = await garantirAvaliacaoGheEditavel(idAvaliacaoGhe);

    const { data: participante, error: erroParticipante } = await supabase
        .from('amostra_participante')
        .select('id_amostra_participante, id_plano_amostragem')
        .eq('id_amostra_participante', idAmostraParticipante)
        .single();

    if (erroParticipante) throw erroParticipante;
    if (participante.id_plano_amostragem !== avaliacao.id_plano_amostragem) {
        throw erroAvaliacaoGhe(
            'Este participante não pertence ao plano de amostragem desta avaliação.',
            'PARTICIPANTE_INCOMPATIVEL',
        );
    }

    const { data: existente, error: erroExistente } = await supabase
        .from('coleta_ghe')
        .select(COLUNAS_COLETA)
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .eq('id_amostra_participante', idAmostraParticipante)
        .maybeSingle();

    if (erroExistente) throw erroExistente;
    if (existente) {
        return existente;
    }

    const { data, error } = await supabase
        .from('coleta_ghe')
        .insert({
            id_avaliacao_ghe: idAvaliacaoGhe,
            id_amostra_participante: idAmostraParticipante,
            status: 'EM_ANDAMENTO',
        })
        .select(COLUNAS_COLETA)
        .single();

    if (error) {
        if (error.code === '23505') {
            // Corrida entre duas chamadas concorrentes: a outra ja criou -
            // busca de novo em vez de falhar (mesmo espirito da secao 25/26
            // do prompt AVA-05, aplicado aqui a coleta).
            const { data: linhaExistente, error: erroRebusca } = await supabase
                .from('coleta_ghe')
                .select(COLUNAS_COLETA)
                .eq('id_avaliacao_ghe', idAvaliacaoGhe)
                .eq('id_amostra_participante', idAmostraParticipante)
                .single();
            if (erroRebusca) throw erroRebusca;
            return linhaExistente;
        }
        console.error('Erro ao criar coleta:', error);
        throw erroAvaliacaoGhe('Não foi possível iniciar a coleta deste participante.', 'PERSISTENCIA_COLETA_FALHOU');
    }
    return data;
}

// Roda a validacao de obrigatoriedade/consistencia sem alterar nada -
// reusada tanto pela pagina (para exibir pendencias) quanto por
// finalizarColeta antes do UPDATE (mesmo padrao de
// avaliacaoService.validarAvaliacaoParaFinalizacao).
export async function validarColetaParaFinalizacao(idColeta) {
    const coleta = await buscarColetaPorId(idColeta);

    if (coleta.status === 'CONCLUIDA') {
        return { valida: false, jaConcluida: true, erros: ['Esta coleta já foi concluída.'] };
    }
    if (coleta.status === 'CANCELADA') {
        return { valida: false, erros: ['Esta coleta foi cancelada e não pode ser concluída.'] };
    }

    const erros = [];
    const resultadoPerguntas = await verificarPerguntasObrigatoriasRespondidasColeta(idColeta);
    if (resultadoPerguntas.faltantes.length > 0) {
        erros.push(`Existem ${resultadoPerguntas.faltantes.length} pergunta(s) obrigatória(s) sem resposta.`);
    }
    if (resultadoPerguntas.inconsistencias.length > 0) {
        console.error('Inconsistências encontradas nas respostas da coleta:', resultadoPerguntas.inconsistencias);
        erros.push('Foi encontrada uma inconsistência nas respostas. Revise antes de concluir.');
    }

    return { valida: erros.length === 0, erros, perguntas: resultadoPerguntas };
}

// Conclui a coleta somente apos validarColetaParaFinalizacao passar. O
// UPDATE so afeta a linha se ainda estiver EM_ANDAMENTO no momento exato da
// escrita (protecao contra concorrencia/duplo clique, mesmo padrao de
// avaliacaoService.finalizarAvaliacao) - nunca calcula pontuacao nem aciona
// o Motor de Risco.
export async function finalizarColeta(idColeta) {
    const validacao = await validarColetaParaFinalizacao(idColeta);
    if (!validacao.valida) {
        const codigo = validacao.jaConcluida ? 'COLETA_JA_CONCLUIDA' : 'VALIDACAO_FINALIZACAO_COLETA_FALHOU';
        const erro = erroAvaliacaoGhe(validacao.erros[0] || 'Não foi possível concluir a coleta.', codigo);
        erro.detalhes = validacao;
        throw erro;
    }

    const { data, error } = await supabase
        .from('coleta_ghe')
        .update({ status: 'CONCLUIDA', data_conclusao: new Date().toISOString() })
        .eq('id_coleta', idColeta)
        .eq('status', STATUS_COLETA_EDITAVEL)
        .select(COLUNAS_COLETA);

    if (error) throw error;

    if (!data || data.length === 0) {
        const coletaAtual = await buscarColetaPorId(idColeta);
        if (coletaAtual.status === 'CONCLUIDA') {
            throw erroAvaliacaoGhe('Esta coleta já foi concluída.', 'COLETA_JA_CONCLUIDA');
        }
        throw erroAvaliacaoGhe('Não foi possível concluir a coleta. Tente novamente.', 'FINALIZACAO_COLETA_FALHOU');
    }

    return data[0];
}

// Transicao explicita e definitiva da Avaliacao do GHE para CONSOLIDADA -
// acao separada de "ver consolidacao" (que e so leitura e funciona mesmo
// com a amostra incompleta): usada pelo botao dedicado em
// consolidacao-ghe.html quando o avaliador decide encerrar esta rodada.
// Nunca calcula/atribui classificacao de risco (isso e o MVP-08).
export async function consolidarAvaliacaoGhe(idAvaliacaoGhe) {
    await garantirAvaliacaoGheEditavel(idAvaliacaoGhe);

    const { data, error } = await supabase
        .from('avaliacao_ghe')
        .update({ status: 'CONSOLIDADA', atualizado_em: new Date().toISOString() })
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .in('status', STATUS_AVALIACAO_GHE_EDITAVEIS)
        .select(COLUNAS_AVALIACAO_GHE);

    if (error) throw error;

    if (!data || data.length === 0) {
        const atual = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);
        if (atual.status === 'CONSOLIDADA') {
            throw erroAvaliacaoGhe('Esta avaliação do GHE já foi consolidada.', 'AVALIACAO_GHE_JA_CONSOLIDADA');
        }
        throw erroAvaliacaoGhe('Não foi possível consolidar a avaliação do GHE.', 'CONSOLIDACAO_FALHOU');
    }

    return data[0];
}
