import { supabase } from '../config/supabase.js';
import { garantirAvaliacaoEditavel } from './avaliacaoService.js';
import { buscarPerguntaPorId, listarPerguntasAtivas } from './perguntaService.js';

// AVA-04 - Registrar respostas da avaliacao ergonomica.
// Evolui a AVA-03 (que ja carrega e renderiza o questionario dinamicamente)
// persistindo o que o usuario responde em resposta_avaliacao/resposta_opcao.
// Nao calcula pontuacao, nao acessa regra_risco/regra_condicao e nao
// finaliza a avaliacao - isso pertence ao Motor de Risco e a AVA-05.

const COLUNAS_RESPOSTA = 'id_resposta, id_avaliacao, id_pergunta, resposta_texto, resposta_numero, resposta_booleano, pontuacao_calculada, observacao, respondido_em';

// Tipos cujo valor mora diretamente em resposta_avaliacao (colunas
// escalares). Os demais tipos (ESCALA/ESCOLHA_UNICA/ESCOLHA_MULTIPLA) so
// fazem sentido junto de resposta_opcao (secao 6 do prompt AVA-04).
const TIPOS_ESCALARES = ['BOOLEANO', 'NUMERICO', 'TEXTO'];
const TIPOS_COM_OPCOES = ['ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA'];

function erroValidacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// "Vazio" aqui significa "nada para persistir", nao "falso"/"zero" - FALSE e
// 0 sao respostas validas (secao 18: "false e uma resposta valida", "0 deve
// ser considerado resposta quando tecnicamente permitido").
function valorEscalarVazio(tipoResposta, valor) {
    if (tipoResposta === 'BOOLEANO') {
        return valor !== true && valor !== false;
    }
    if (tipoResposta === 'NUMERICO') {
        return valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor));
    }
    if (tipoResposta === 'TEXTO') {
        return typeof valor !== 'string' || valor.trim().length === 0;
    }
    return valor === null || valor === undefined;
}

function agruparOpcoesPorResposta(opcoes) {
    const mapa = new Map();
    (opcoes || []).forEach((linha) => {
        const lista = mapa.get(linha.id_resposta) || [];
        lista.push(linha.id_opcao);
        mapa.set(linha.id_resposta, lista);
    });
    return mapa;
}

// Confere que cada id_opcao existe, esta ativo e pertence exatamente a
// id_pergunta - nunca aceita opcao de outra pergunta (secao 12: "Pergunta
// Q05 + Opcao pertencente a Q11" deve ser bloqueado).
async function validarOpcoesPertencemAPergunta(idPergunta, idsOpcoes) {
    const { data, error } = await supabase
        .from('opcao_resposta')
        .select('id_opcao, id_pergunta, ativo')
        .in('id_opcao', idsOpcoes);

    if (error) {
        throw error;
    }

    const encontradas = new Map((data || []).map((opcao) => [opcao.id_opcao, opcao]));

    idsOpcoes.forEach((idOpcao) => {
        const opcao = encontradas.get(idOpcao);
        if (!opcao) {
            throw erroValidacao('Uma das opções selecionadas não existe.', 'OPCAO_INEXISTENTE');
        }
        if (!opcao.ativo) {
            throw erroValidacao('Uma das opções selecionadas está inativa.', 'OPCAO_INATIVA');
        }
        if (opcao.id_pergunta !== idPergunta) {
            throw erroValidacao('Uma das opções selecionadas não pertence a esta pergunta.', 'OPCAO_INCOMPATIVEL');
        }
    });
}

// --- Leitura ------------------------------------------------------------------

export async function buscarResposta(idAvaliacao, idPergunta) {
    const { data, error } = await supabase
        .from('resposta_avaliacao')
        .select(COLUNAS_RESPOSTA)
        .eq('id_avaliacao', idAvaliacao)
        .eq('id_pergunta', idPergunta)
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data) {
        return null;
    }

    const { data: opcoes, error: erroOpcoes } = await supabase
        .from('resposta_opcao')
        .select('id_opcao')
        .eq('id_resposta', data.id_resposta);

    if (erroOpcoes) {
        throw erroOpcoes;
    }

    return { ...data, opcoes: (opcoes || []).map((linha) => linha.id_opcao) };
}

// Carga eficiente de TODAS as respostas de uma avaliacao: 1 consulta para
// resposta_avaliacao + 1 consulta para resposta_opcao (via IN), nunca 1 par
// de consultas por pergunta (secao 24 do prompt AVA-04).
export async function listarRespostasDaAvaliacao(idAvaliacao) {
    const { data: respostas, error } = await supabase
        .from('resposta_avaliacao')
        .select(COLUNAS_RESPOSTA)
        .eq('id_avaliacao', idAvaliacao);

    if (error) {
        throw error;
    }
    if (!respostas || respostas.length === 0) {
        return [];
    }

    const idsRespostas = respostas.map((resposta) => resposta.id_resposta);
    const { data: opcoes, error: erroOpcoes } = await supabase
        .from('resposta_opcao')
        .select('id_resposta, id_opcao')
        .in('id_resposta', idsRespostas);

    if (erroOpcoes) {
        throw erroOpcoes;
    }

    const opcoesPorResposta = agruparOpcoesPorResposta(opcoes);
    return respostas.map((resposta) => ({
        ...resposta,
        opcoes: opcoesPorResposta.get(resposta.id_resposta) || [],
    }));
}

function reconstruirValor(tipoResposta, resposta) {
    switch (tipoResposta) {
        case 'BOOLEANO':
            return resposta.resposta_booleano;
        case 'NUMERICO':
            return resposta.resposta_numero;
        case 'TEXTO':
            return resposta.resposta_texto;
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return resposta.opcoes[0] ?? null;
        case 'ESCOLHA_MULTIPLA':
            return resposta.opcoes;
        default:
            return null;
    }
}

// Reconstroi o formato ja usado por estadoQuestionario.respostas na AVA-03
// (ver js/pages/questionario.js) a partir do que esta persistido no banco -
// mesmo modelo de estado, nenhuma estrutura nova (secao 23). `perguntas` e
// o catalogo ja carregado pela AVA-03 (carregarQuestionario), reaproveitado
// aqui so para saber o tipo_resposta de cada pergunta sem uma consulta extra.
export async function carregarRespostasDaAvaliacao(idAvaliacao, perguntas) {
    const respostas = await listarRespostasDaAvaliacao(idAvaliacao);
    const tipoPorPergunta = new Map(perguntas.map((pergunta) => [pergunta.id_pergunta, pergunta.tipo_resposta]));

    const estado = {};
    respostas.forEach((resposta) => {
        const tipo = tipoPorPergunta.get(resposta.id_pergunta);
        estado[resposta.id_pergunta] = reconstruirValor(tipo, resposta);
    });

    return estado;
}

// --- Escrita --------------------------------------------------------------------

// Sincroniza resposta_opcao com a selecao atual: busca o que ja existe,
// insere so o que falta, remove so o que nao esta mais selecionado. Nunca
// apenas acumula linhas (secao 15/16 do prompt AVA-04).
export async function sincronizarOpcoesResposta(idResposta, idsOpcoesDesejadas) {
    const { data: existentes, error: erroExistentes } = await supabase
        .from('resposta_opcao')
        .select('id_resposta_opcao, id_opcao')
        .eq('id_resposta', idResposta);

    if (erroExistentes) {
        console.error('Erro ao carregar opções existentes da resposta:', erroExistentes);
        throw erroExistentes;
    }

    const idsExistentes = new Set((existentes || []).map((linha) => linha.id_opcao));
    const idsDesejados = new Set(idsOpcoesDesejadas);

    const paraInserir = idsOpcoesDesejadas.filter((id) => !idsExistentes.has(id));
    const paraRemover = (existentes || []).filter((linha) => !idsDesejados.has(linha.id_opcao));

    if (paraInserir.length > 0) {
        const { error: erroInsercao } = await supabase
            .from('resposta_opcao')
            .insert(paraInserir.map((idOpcao) => ({ id_resposta: idResposta, id_opcao: idOpcao })));

        if (erroInsercao) {
            console.error('Erro ao inserir novas opções da resposta:', erroInsercao);
            throw erroInsercao;
        }
    }

    if (paraRemover.length > 0) {
        const { error: erroRemocao } = await supabase
            .from('resposta_opcao')
            .delete()
            .in('id_resposta_opcao', paraRemover.map((linha) => linha.id_resposta_opcao));

        if (erroRemocao) {
            console.error('Erro ao remover opções obsoletas da resposta:', erroRemocao);
            throw erroRemocao;
        }
    }
}

// Nunca DELETE em avaliacao FINALIZADA/CANCELADA (garantirAvaliacaoEditavel
// cuida disso). resposta_opcao e removida automaticamente pelo ON DELETE
// CASCADE do schema (fk_resposta_opcao_resposta) - nao precisa de limpeza
// manual aqui.
export async function removerResposta(idAvaliacao, idPergunta) {
    await garantirAvaliacaoEditavel(idAvaliacao);

    const { error } = await supabase
        .from('resposta_avaliacao')
        .delete()
        .eq('id_avaliacao', idAvaliacao)
        .eq('id_pergunta', idPergunta);

    if (error) {
        throw error;
    }
}

// BOOLEANO | NUMERICO | TEXTO. UPSERT por (id_avaliacao, id_pergunta) -
// nunca cria uma segunda linha para o mesmo par (secao 4/13). Os demais
// campos escalares sao sempre zerados (secao 14: nunca deixar residuo de
// outro tipo).
export async function salvarRespostaEscalar(idAvaliacao, idPergunta, valor) {
    await garantirAvaliacaoEditavel(idAvaliacao);
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (!TIPOS_ESCALARES.includes(pergunta.tipo_resposta)) {
        throw erroValidacao('Esta pergunta não aceita um valor direto.', 'TIPO_INCOMPATIVEL');
    }

    if (valorEscalarVazio(pergunta.tipo_resposta, valor)) {
        if (pergunta.obrigatoria) {
            throw erroValidacao('Selecione uma resposta antes de continuar.', 'RESPOSTA_OBRIGATORIA');
        }
        await removerResposta(idAvaliacao, idPergunta);
        return null;
    }

    const campos = { resposta_texto: null, resposta_numero: null, resposta_booleano: null };
    if (pergunta.tipo_resposta === 'BOOLEANO') {
        campos.resposta_booleano = valor;
    } else if (pergunta.tipo_resposta === 'NUMERICO') {
        campos.resposta_numero = Number(valor);
    } else if (pergunta.tipo_resposta === 'TEXTO') {
        campos.resposta_texto = valor.trim();
    }

    const { data, error } = await supabase
        .from('resposta_avaliacao')
        .upsert(
            { id_avaliacao: idAvaliacao, id_pergunta: idPergunta, ...campos },
            { onConflict: 'id_avaliacao,id_pergunta' },
        )
        .select(COLUNAS_RESPOSTA)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// ESCALA | ESCOLHA_UNICA | ESCOLHA_MULTIPLA. Cria/atualiza a
// resposta_avaliacao (sempre com colunas escalares NULL - secao 6) e
// sincroniza resposta_opcao com a selecao informada.
export async function salvarRespostaComOpcoes(idAvaliacao, idPergunta, idsOpcoes) {
    await garantirAvaliacaoEditavel(idAvaliacao);
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (!TIPOS_COM_OPCOES.includes(pergunta.tipo_resposta)) {
        throw erroValidacao('Esta pergunta não aceita seleção de opções.', 'TIPO_INCOMPATIVEL');
    }

    const idsUnicos = [...new Set((idsOpcoes || []).filter((id) => id !== null && id !== undefined))];

    if (idsUnicos.length === 0) {
        if (pergunta.obrigatoria) {
            throw erroValidacao('Selecione uma resposta antes de continuar.', 'RESPOSTA_OBRIGATORIA');
        }
        await removerResposta(idAvaliacao, idPergunta);
        return null;
    }

    if (pergunta.tipo_resposta !== 'ESCOLHA_MULTIPLA' && idsUnicos.length > 1) {
        throw erroValidacao('Esta pergunta aceita apenas uma alternativa.', 'MULTIPLAS_OPCOES_NAO_PERMITIDAS');
    }

    await validarOpcoesPertencemAPergunta(pergunta.id_pergunta, idsUnicos);

    const { data: resposta, error } = await supabase
        .from('resposta_avaliacao')
        .upsert(
            {
                id_avaliacao: idAvaliacao,
                id_pergunta: idPergunta,
                resposta_texto: null,
                resposta_numero: null,
                resposta_booleano: null,
            },
            { onConflict: 'id_avaliacao,id_pergunta' },
        )
        .select(COLUNAS_RESPOSTA)
        .single();

    if (error) {
        throw error;
    }

    await sincronizarOpcoesResposta(resposta.id_resposta, idsUnicos);

    return { ...resposta, opcoes: idsUnicos };
}

// Ponto de entrada unico para a pagina (questionario.js): decide a
// estrategia de persistencia a partir do tipo_resposta REAL da pergunta,
// buscado no banco - nunca confia no tipo que o estado do frontend carrega
// (secao 11). `valor` segue exatamente o formato de
// estadoQuestionario.respostas[idPergunta] descrito na secao 23.
export async function salvarResposta(idAvaliacao, idPergunta, valor) {
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (TIPOS_ESCALARES.includes(pergunta.tipo_resposta)) {
        return salvarRespostaEscalar(idAvaliacao, idPergunta, valor);
    }

    if (TIPOS_COM_OPCOES.includes(pergunta.tipo_resposta)) {
        const idsOpcoes = Array.isArray(valor)
            ? valor
            : [valor].filter((item) => item !== null && item !== undefined);
        return salvarRespostaComOpcoes(idAvaliacao, idPergunta, idsOpcoes);
    }

    throw erroValidacao(`Tipo de pergunta não suportado: ${pergunta.tipo_resposta}`, 'TIPO_PERGUNTA_INVALIDO');
}

// --- Validacao por tipo, usada pela AVA-05 antes de finalizar --------------------

const CAMPO_ESCALAR_POR_TIPO = {
    BOOLEANO: 'resposta_booleano',
    NUMERICO: 'resposta_numero',
    TEXTO: 'resposta_texto',
};
const CAMPOS_ESCALARES = Object.values(CAMPO_ESCALAR_POR_TIPO);

// Campos escalares de uma resposta que NAO pertencem ao tipo em uso devem
// estar todos NULL (secao 16 do prompt AVA-05). Reaproveitado tanto para
// tipos escalares quanto para tipos com opcao.
function possuiResiduoDeOutroTipo(resposta, tipoResposta) {
    const possuiOpcoes = resposta.opcoes && resposta.opcoes.length > 0;

    if (TIPOS_ESCALARES.includes(tipoResposta)) {
        // O proprio campo esperado para este tipo e tratado separadamente
        // (respondida-ou-nao); aqui so interessa a mistura com resposta_opcao
        // ou com OUTRO campo escalar alem do esperado.
        const campoEsperado = CAMPO_ESCALAR_POR_TIPO[tipoResposta];
        const outrosEscalaresPreenchidos = CAMPOS_ESCALARES.some(
            (campo) => campo !== campoEsperado && resposta[campo] !== null,
        );
        return outrosEscalaresPreenchidos || possuiOpcoes;
    }

    // ESCALA/ESCOLHA_UNICA/ESCOLHA_MULTIPLA: nenhum campo escalar pode estar
    // preenchido, a resposta inteira mora em resposta_opcao.
    return CAMPOS_ESCALARES.some((campo) => resposta[campo] !== null);
}

// Confere que cada id_opcao referenciado existe, esta ativo e pertence a
// esta pergunta - a mesma regra que a AVA-04 aplica na escrita, reaplicada
// aqui como segunda barreira antes de finalizar (secao 17): nunca confiar
// so no estado que a interface produziu.
function validarOpcoesContraCatalogo(idPergunta, idsOpcoes, mapaOpcoes) {
    for (const idOpcao of idsOpcoes) {
        const opcao = mapaOpcoes.get(idOpcao);
        if (!opcao) {
            return 'OPCAO_INEXISTENTE';
        }
        if (!opcao.ativo) {
            return 'OPCAO_INATIVA';
        }
        if (opcao.id_pergunta !== idPergunta) {
            return 'OPCAO_DE_OUTRA_PERGUNTA';
        }
    }
    return null;
}

// Resultado por pergunta: 'OK' | 'FALTANTE' (obrigatoria sem resposta valida)
// | 'VAZIA_OPCIONAL' (sem resposta, mas tudo bem) | 'INCONSISTENTE'
// (estruturalmente invalida, independente de ser obrigatoria ou nao - ver
// secao 22 ponto 11: "nao existem inconsistencias impeditivas").
function validarRespostaPorTipo(pergunta, resposta, mapaOpcoes) {
    const tipo = pergunta.tipo_resposta;

    if (!resposta) {
        return { status: pergunta.obrigatoria ? 'FALTANTE' : 'VAZIA_OPCIONAL' };
    }

    if (TIPOS_ESCALARES.includes(tipo)) {
        const valorAtual = resposta[CAMPO_ESCALAR_POR_TIPO[tipo]];
        const vazia = valorEscalarVazio(tipo, valorAtual);
        if (vazia) {
            return { status: pergunta.obrigatoria ? 'FALTANTE' : 'VAZIA_OPCIONAL' };
        }
        if (possuiResiduoDeOutroTipo(resposta, tipo)) {
            return { status: 'INCONSISTENTE', motivo: 'CAMPOS_INCOMPATIVEIS' };
        }
        return { status: 'OK' };
    }

    if (TIPOS_COM_OPCOES.includes(tipo)) {
        if (possuiResiduoDeOutroTipo(resposta, tipo)) {
            return { status: 'INCONSISTENTE', motivo: 'CAMPOS_INCOMPATIVEIS' };
        }

        const quantidade = resposta.opcoes.length;
        if (quantidade === 0) {
            return { status: pergunta.obrigatoria ? 'FALTANTE' : 'VAZIA_OPCIONAL' };
        }
        if (tipo !== 'ESCOLHA_MULTIPLA' && quantidade > 1) {
            return {
                status: 'INCONSISTENTE',
                motivo: tipo === 'ESCALA' ? 'MULTIPLAS_OPCOES_EM_ESCALA' : 'MULTIPLAS_OPCOES_EM_ESCOLHA_UNICA',
            };
        }

        const motivoOpcaoInvalida = validarOpcoesContraCatalogo(pergunta.id_pergunta, resposta.opcoes, mapaOpcoes);
        if (motivoOpcaoInvalida) {
            return { status: 'INCONSISTENTE', motivo: motivoOpcaoInvalida };
        }
        return { status: 'OK' };
    }

    return { status: 'INCONSISTENTE', motivo: 'TIPO_DESCONHECIDO' };
}

// Segunda barreira de integridade antes da finalizacao (AVA-05): valida
// TODAS as perguntas ativas (nao so as obrigatorias) contra o tipo real
// armazenado no catalogo e contra o catalogo de opcoes, consultando o banco
// de novo em vez de confiar no que a interface acumulou (secao 17 do
// prompt AVA-05). So 3 consultas no total (perguntas + respostas, que por
// sua vez ja faz resposta_avaliacao + resposta_opcao internamente, + uma
// para os metadados das opcoes referenciadas) - nunca uma por pergunta
// (secao 20).
export async function verificarPerguntasObrigatoriasRespondidas(idAvaliacao) {
    const [perguntas, respostas] = await Promise.all([
        listarPerguntasAtivas(),
        listarRespostasDaAvaliacao(idAvaliacao),
    ]);

    const idsOpcoesReferenciadas = [...new Set(respostas.flatMap((resposta) => resposta.opcoes))];
    let mapaOpcoes = new Map();
    if (idsOpcoesReferenciadas.length > 0) {
        const { data: opcoes, error } = await supabase
            .from('opcao_resposta')
            .select('id_opcao, id_pergunta, ativo')
            .in('id_opcao', idsOpcoesReferenciadas);

        if (error) {
            throw error;
        }
        mapaOpcoes = new Map((opcoes || []).map((opcao) => [opcao.id_opcao, opcao]));
    }

    const respostaPorPergunta = new Map(respostas.map((resposta) => [resposta.id_pergunta, resposta]));
    const obrigatorias = perguntas.filter((pergunta) => pergunta.obrigatoria);

    const faltantes = [];
    const inconsistencias = [];

    perguntas.forEach((pergunta) => {
        const resposta = respostaPorPergunta.get(pergunta.id_pergunta);
        const resultado = validarRespostaPorTipo(pergunta, resposta, mapaOpcoes);

        if (resultado.status === 'FALTANTE') {
            faltantes.push({
                id_pergunta: pergunta.id_pergunta,
                codigo: pergunta.codigo,
                texto_pergunta: pergunta.texto_pergunta,
                motivo: 'SEM_RESPOSTA',
            });
        } else if (resultado.status === 'INCONSISTENTE') {
            inconsistencias.push({
                id_pergunta: pergunta.id_pergunta,
                codigo: pergunta.codigo,
                texto_pergunta: pergunta.texto_pergunta,
                motivo: resultado.motivo,
            });
        }
    });

    return {
        completo: faltantes.length === 0 && inconsistencias.length === 0,
        totalObrigatorias: obrigatorias.length,
        totalRespondidas: obrigatorias.length - faltantes.length,
        faltantes,
        inconsistencias,
    };
}
