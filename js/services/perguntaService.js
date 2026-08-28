import { supabase } from '../config/supabase.js';

// AVA-03 - Catalogo do questionario ergonomico.
// Nao existe uma tabela "questionario": o questionario e montado
// dinamicamente a partir de pergunta_avaliacao + opcao_resposta (ver
// database/schema.sql). Este service so LE o catalogo vigente - nenhuma
// pergunta e criada, alterada ou versionada aqui.

const COLUNAS_PERGUNTA = 'id_pergunta, codigo, categoria, texto_pergunta, tipo_resposta, unidade, obrigatoria, ordem, versao';
const COLUNAS_OPCAO = 'id_opcao, id_pergunta, codigo, rotulo, valor_numero, ordem';

// Tipos que so fazem sentido com opcao_resposta cadastrada (secao 30). Uma
// pergunta desses tipos sem opcoes ativas e falha de configuracao do
// catalogo, nao um estado valido a ser tolerado em silencio.
export const TIPOS_QUE_EXIGEM_OPCOES = ['ESCALA', 'ESCOLHA_UNICA', 'ESCOLHA_MULTIPLA'];

function erroCatalogo(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

export async function listarPerguntasAtivas() {
    const { data, error } = await supabase
        .from('pergunta_avaliacao')
        .select(COLUNAS_PERGUNTA)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

export async function listarOpcoesPorPergunta(idPergunta) {
    const { data, error } = await supabase
        .from('opcao_resposta')
        .select(COLUNAS_OPCAO)
        .eq('id_pergunta', idPergunta)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

function agruparOpcoesPorPergunta(opcoes) {
    const mapa = new Map();
    (opcoes || []).forEach((opcao) => {
        const lista = mapa.get(opcao.id_pergunta) || [];
        lista.push(opcao);
        mapa.set(opcao.id_pergunta, lista);
    });
    return mapa;
}

// uq_pergunta_avaliacao_codigo (schema) ja impede duas linhas com o mesmo
// codigo, entao isto so dispararia por uma inconsistencia fora do controle
// deste service (ex.: view/RLS customizada). Mesmo assim, a regra do
// catalogo (secao 16) e nunca "escolher uma versao" sozinho - so avisar.
function verificarCodigosDuplicados(perguntas) {
    const vistos = new Set();
    const duplicados = new Set();

    perguntas.forEach((pergunta) => {
        if (vistos.has(pergunta.codigo)) {
            duplicados.add(pergunta.codigo);
        }
        vistos.add(pergunta.codigo);
    });

    if (duplicados.size > 0) {
        console.error(
            'Catálogo de perguntas inconsistente: códigos duplicados entre perguntas ativas:',
            [...duplicados],
        );
        throw erroCatalogo('O catálogo de perguntas precisa de validação.', 'CATALOGO_INCONSISTENTE');
    }
}

// Monta o questionario completo com no maximo 2 consultas (perguntas + as
// opcoes de todas as perguntas carregadas de uma vez), em vez de 1 consulta
// de opcoes por pergunta (secao 21). Retorna a estrutura da secao 22 -
// puramente para consumo do frontend, nada disso e persistido.
export async function carregarQuestionario() {
    const perguntas = await listarPerguntasAtivas();
    verificarCodigosDuplicados(perguntas);

    const idsPerguntas = perguntas.map((pergunta) => pergunta.id_pergunta);
    let opcoesPorPergunta = new Map();

    if (idsPerguntas.length > 0) {
        const { data: opcoes, error } = await supabase
            .from('opcao_resposta')
            .select(COLUNAS_OPCAO)
            .in('id_pergunta', idsPerguntas)
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        if (error) {
            throw error;
        }

        opcoesPorPergunta = agruparOpcoesPorPergunta(opcoes);
    }

    return perguntas.map((pergunta) => {
        const opcoes = opcoesPorPergunta.get(pergunta.id_pergunta) || [];

        if (TIPOS_QUE_EXIGEM_OPCOES.includes(pergunta.tipo_resposta) && opcoes.length === 0) {
            console.error(
                `Pergunta "${pergunta.codigo}" (${pergunta.tipo_resposta}) não possui opções ativas configuradas em opcao_resposta.`,
            );
        }

        return { ...pergunta, opcoes };
    });
}
