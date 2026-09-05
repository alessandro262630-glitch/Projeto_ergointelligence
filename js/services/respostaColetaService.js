import { supabase } from '../config/supabase.js';
import { garantirColetaEditavel } from './avaliacaoGheService.js';
import { buscarPerguntaPorId, listarPerguntasAtivas } from './perguntaService.js';

// MVP-07 - Respostas da coleta do GHE (resposta_coleta/resposta_coleta_opcao).
// Espelha exatamente a arquitetura de respostaService.js (mesmo catalogo de
// perguntas/opcoes, mesma semantica de "vazio", mesmo upsert por chave
// unica), trocando apenas a tabela-mae (coleta_ghe em vez de
// avaliacao_ergonomica) e removendo pontuacao_calculada: uma coleta NUNCA
// calcula pontuacao nem aciona motorRisco.js/classificadorRisco.js/riscoService.js
// - isso pertence a um resultado individual definitivo (avaliacao_ergonomica)
// ou a classificacao do GHE (MVP-08), nenhum dos dois no escopo deste
// service.

const COLUNAS_RESPOSTA_COLETA = 'id_resposta_coleta, id_coleta, id_pergunta, resposta_texto, resposta_numero, resposta_booleano, observacao, respondido_em';

const TIPOS_ESCALARES = ['BOOLEANO', 'NUMERICO', 'TEXTO'];
const TIPOS_COM_OPCOES = ['ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA'];

function erroValidacao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// "Vazio" aqui significa "nada para persistir", nao "falso"/"zero" - FALSE e
// 0 sao respostas validas, mesma semantica de respostaService.js.
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
        const lista = mapa.get(linha.id_resposta_coleta) || [];
        lista.push(linha.id_opcao);
        mapa.set(linha.id_resposta_coleta, lista);
    });
    return mapa;
}

// Confere que cada id_opcao existe, esta ativo e pertence exatamente a
// id_pergunta - identico a respostaService.js (mesmo catalogo
// pergunta_avaliacao/opcao_resposta, reutilizado sem alteracao).
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

export async function buscarRespostaColeta(idColeta, idPergunta) {
    const { data, error } = await supabase
        .from('resposta_coleta')
        .select(COLUNAS_RESPOSTA_COLETA)
        .eq('id_coleta', idColeta)
        .eq('id_pergunta', idPergunta)
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data) {
        return null;
    }

    const { data: opcoes, error: erroOpcoes } = await supabase
        .from('resposta_coleta_opcao')
        .select('id_opcao')
        .eq('id_resposta_coleta', data.id_resposta_coleta);

    if (erroOpcoes) {
        throw erroOpcoes;
    }

    return { ...data, opcoes: (opcoes || []).map((linha) => linha.id_opcao) };
}

// Carga eficiente de TODAS as respostas de uma coleta: 1 consulta para
// resposta_coleta + 1 consulta para resposta_coleta_opcao (via IN), mesmo
// padrao de respostaService.listarRespostasDaAvaliacao.
export async function listarRespostasDaColeta(idColeta) {
    const { data: respostas, error } = await supabase
        .from('resposta_coleta')
        .select(COLUNAS_RESPOSTA_COLETA)
        .eq('id_coleta', idColeta);

    if (error) {
        throw error;
    }
    if (!respostas || respostas.length === 0) {
        return [];
    }

    const idsRespostas = respostas.map((resposta) => resposta.id_resposta_coleta);
    const { data: opcoes, error: erroOpcoes } = await supabase
        .from('resposta_coleta_opcao')
        .select('id_resposta_coleta, id_opcao')
        .in('id_resposta_coleta', idsRespostas);

    if (erroOpcoes) {
        throw erroOpcoes;
    }

    const opcoesPorResposta = agruparOpcoesPorResposta(opcoes);
    return respostas.map((resposta) => ({
        ...resposta,
        opcoes: opcoesPorResposta.get(resposta.id_resposta_coleta) || [],
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

// Reconstroi o mesmo formato de estado usado por coleta.js (espelhando
// estadoQuestionario.respostas de questionario.js) a partir do que esta
// persistido no banco. `perguntas` e o catalogo ja carregado via
// perguntaService.carregarQuestionario(), reaproveitado so para saber o
// tipo_resposta de cada pergunta sem uma consulta extra.
export async function carregarRespostasDaColeta(idColeta, perguntas) {
    const respostas = await listarRespostasDaColeta(idColeta);
    const tipoPorPergunta = new Map(perguntas.map((pergunta) => [pergunta.id_pergunta, pergunta.tipo_resposta]));

    const estado = {};
    respostas.forEach((resposta) => {
        const tipo = tipoPorPergunta.get(resposta.id_pergunta);
        estado[resposta.id_pergunta] = reconstruirValor(tipo, resposta);
    });

    return estado;
}

// --- Escrita --------------------------------------------------------------------

// Sincroniza resposta_coleta_opcao com a selecao atual: busca o que ja
// existe, insere so o que falta, remove so o que nao esta mais selecionado.
// Identico a respostaService.sincronizarOpcoesResposta.
export async function sincronizarOpcoesRespostaColeta(idRespostaColeta, idsOpcoesDesejadas) {
    const { data: existentes, error: erroExistentes } = await supabase
        .from('resposta_coleta_opcao')
        .select('id_resposta_coleta_opcao, id_opcao')
        .eq('id_resposta_coleta', idRespostaColeta);

    if (erroExistentes) {
        console.error('Erro ao carregar opções existentes da resposta de coleta:', erroExistentes);
        throw erroExistentes;
    }

    const idsExistentes = new Set((existentes || []).map((linha) => linha.id_opcao));
    const idsDesejados = new Set(idsOpcoesDesejadas);

    const paraInserir = idsOpcoesDesejadas.filter((id) => !idsExistentes.has(id));
    const paraRemover = (existentes || []).filter((linha) => !idsDesejados.has(linha.id_opcao));

    if (paraInserir.length > 0) {
        const { error: erroInsercao } = await supabase
            .from('resposta_coleta_opcao')
            .insert(paraInserir.map((idOpcao) => ({ id_resposta_coleta: idRespostaColeta, id_opcao: idOpcao })));

        if (erroInsercao) {
            console.error('Erro ao inserir novas opções da resposta de coleta:', erroInsercao);
            throw erroInsercao;
        }
    }

    if (paraRemover.length > 0) {
        const { error: erroRemocao } = await supabase
            .from('resposta_coleta_opcao')
            .delete()
            .in('id_resposta_coleta_opcao', paraRemover.map((linha) => linha.id_resposta_coleta_opcao));

        if (erroRemocao) {
            console.error('Erro ao remover opções obsoletas da resposta de coleta:', erroRemocao);
            throw erroRemocao;
        }
    }
}

// Nunca DELETE em coleta CONCLUIDA/CANCELADA (garantirColetaEditavel cuida
// disso). resposta_coleta_opcao e removida automaticamente pelo ON DELETE
// CASCADE (fk_resposta_coleta_opcao_resposta_coleta).
export async function removerRespostaColeta(idColeta, idPergunta) {
    await garantirColetaEditavel(idColeta);

    const { error } = await supabase
        .from('resposta_coleta')
        .delete()
        .eq('id_coleta', idColeta)
        .eq('id_pergunta', idPergunta);

    if (error) {
        throw error;
    }
}

// BOOLEANO | NUMERICO | TEXTO. UPSERT por (id_coleta, id_pergunta) - nunca
// cria uma segunda linha para o mesmo par. Os demais campos escalares sao
// sempre zerados (nunca deixar residuo de outro tipo).
export async function salvarRespostaColetaEscalar(idColeta, idPergunta, valor) {
    await garantirColetaEditavel(idColeta);
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (!TIPOS_ESCALARES.includes(pergunta.tipo_resposta)) {
        throw erroValidacao('Esta pergunta não aceita um valor direto.', 'TIPO_INCOMPATIVEL');
    }

    if (valorEscalarVazio(pergunta.tipo_resposta, valor)) {
        if (pergunta.obrigatoria) {
            throw erroValidacao('Selecione uma resposta antes de continuar.', 'RESPOSTA_OBRIGATORIA');
        }
        await removerRespostaColeta(idColeta, idPergunta);
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
        .from('resposta_coleta')
        .upsert(
            { id_coleta: idColeta, id_pergunta: idPergunta, ...campos },
            { onConflict: 'id_coleta,id_pergunta' },
        )
        .select(COLUNAS_RESPOSTA_COLETA)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// ESCALA | ESCOLHA_UNICA | ESCOLHA_MULTIPLA. Cria/atualiza a resposta_coleta
// (sempre com colunas escalares NULL) e sincroniza resposta_coleta_opcao com
// a selecao informada.
export async function salvarRespostaColetaComOpcoes(idColeta, idPergunta, idsOpcoes) {
    await garantirColetaEditavel(idColeta);
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (!TIPOS_COM_OPCOES.includes(pergunta.tipo_resposta)) {
        throw erroValidacao('Esta pergunta não aceita seleção de opções.', 'TIPO_INCOMPATIVEL');
    }

    const idsUnicos = [...new Set((idsOpcoes || []).filter((id) => id !== null && id !== undefined))];

    if (idsUnicos.length === 0) {
        if (pergunta.obrigatoria) {
            throw erroValidacao('Selecione uma resposta antes de continuar.', 'RESPOSTA_OBRIGATORIA');
        }
        await removerRespostaColeta(idColeta, idPergunta);
        return null;
    }

    if (pergunta.tipo_resposta !== 'ESCOLHA_MULTIPLA' && idsUnicos.length > 1) {
        throw erroValidacao('Esta pergunta aceita apenas uma alternativa.', 'MULTIPLAS_OPCOES_NAO_PERMITIDAS');
    }

    await validarOpcoesPertencemAPergunta(pergunta.id_pergunta, idsUnicos);

    const { data: resposta, error } = await supabase
        .from('resposta_coleta')
        .upsert(
            {
                id_coleta: idColeta,
                id_pergunta: idPergunta,
                resposta_texto: null,
                resposta_numero: null,
                resposta_booleano: null,
            },
            { onConflict: 'id_coleta,id_pergunta' },
        )
        .select(COLUNAS_RESPOSTA_COLETA)
        .single();

    if (error) {
        throw error;
    }

    await sincronizarOpcoesRespostaColeta(resposta.id_resposta_coleta, idsUnicos);

    return { ...resposta, opcoes: idsUnicos };
}

// Ponto de entrada unico para a pagina (coleta-ghe.js): decide a estrategia
// de persistencia a partir do tipo_resposta REAL da pergunta, buscado no
// banco - nunca confia no tipo que o estado do frontend carrega. `valor`
// segue o mesmo formato usado em questionario.js/estadoQuestionario.respostas.
export async function salvarRespostaColeta(idColeta, idPergunta, valor) {
    const pergunta = await buscarPerguntaPorId(idPergunta);

    if (TIPOS_ESCALARES.includes(pergunta.tipo_resposta)) {
        return salvarRespostaColetaEscalar(idColeta, idPergunta, valor);
    }

    if (TIPOS_COM_OPCOES.includes(pergunta.tipo_resposta)) {
        const idsOpcoes = Array.isArray(valor)
            ? valor
            : [valor].filter((item) => item !== null && item !== undefined);
        return salvarRespostaColetaComOpcoes(idColeta, idPergunta, idsOpcoes);
    }

    throw erroValidacao(`Tipo de pergunta não suportado: ${pergunta.tipo_resposta}`, 'TIPO_PERGUNTA_INVALIDO');
}

// --- Validacao por tipo, usada antes de concluir a coleta -----------------------

const CAMPO_ESCALAR_POR_TIPO = {
    BOOLEANO: 'resposta_booleano',
    NUMERICO: 'resposta_numero',
    TEXTO: 'resposta_texto',
};
const CAMPOS_ESCALARES = Object.values(CAMPO_ESCALAR_POR_TIPO);

// Identico a respostaService.possuiResiduoDeOutroTipo: campos escalares que
// nao pertencem ao tipo em uso devem estar todos NULL.
function possuiResiduoDeOutroTipo(resposta, tipoResposta) {
    const possuiOpcoes = resposta.opcoes && resposta.opcoes.length > 0;

    if (TIPOS_ESCALARES.includes(tipoResposta)) {
        const campoEsperado = CAMPO_ESCALAR_POR_TIPO[tipoResposta];
        const outrosEscalaresPreenchidos = CAMPOS_ESCALARES.some(
            (campo) => campo !== campoEsperado && resposta[campo] !== null,
        );
        return outrosEscalaresPreenchidos || possuiOpcoes;
    }

    return CAMPOS_ESCALARES.some((campo) => resposta[campo] !== null);
}

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

// Resultado por pergunta: 'OK' | 'FALTANTE' | 'VAZIA_OPCIONAL' |
// 'INCONSISTENTE' - identico a respostaService.validarRespostaPorTipo.
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

// Segunda barreira de integridade antes de concluir a coleta: valida TODAS
// as perguntas ativas contra o tipo real armazenado no catalogo e contra o
// catalogo de opcoes, consultando o banco de novo em vez de confiar no que
// a interface acumulou - identico em espirito a
// respostaService.verificarPerguntasObrigatoriasRespondidas, so trocando a
// fonte das respostas para resposta_coleta/id_coleta.
export async function verificarPerguntasObrigatoriasRespondidasColeta(idColeta) {
    const [perguntas, respostas] = await Promise.all([
        listarPerguntasAtivas(),
        listarRespostasDaColeta(idColeta),
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
