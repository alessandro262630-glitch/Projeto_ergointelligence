import { supabase } from '../config/supabase.js';

const COLUNAS_PERFIL = 'id_perfil_antropometrico, id_colaborador, altura_cm, peso_kg, mao_dominante, data_medicao, origem, ativo';

// Unicos valores aceitos pelo schema (chk_perfil_antropometrico_*).
export const MAOS_DOMINANTES_VALIDAS = ['DIREITA', 'ESQUERDA', 'AMBIDESTRO'];
export const ORIGENS_PERFIL_VALIDAS = ['MEDIDO', 'AUTODECLARADO'];

export async function listarPerfisPorColaborador(idColaborador) {
    const { data, error } = await supabase
        .from('perfil_antropometrico')
        .select(COLUNAS_PERFIL)
        .eq('id_colaborador', idColaborador)
        .eq('ativo', true)
        .order('data_medicao', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

export async function buscarPerfilPorId(idPerfil) {
    const { data, error } = await supabase
        .from('perfil_antropometrico')
        .select(COLUNAS_PERFIL)
        .eq('id_perfil_antropometrico', idPerfil)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

function erroValidacaoPerfil(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// dados: { id_colaborador, altura_cm, peso_kg, mao_dominante, data_medicao,
//          origem }. altura_cm/peso_kg/mao_dominante sao opcionais (o
// schema so exige data_medicao e origem) - null quando nao informados.
// Cada medicao vira uma linha nova (historico de medicoes ao longo do
// tempo, ver comentario em listarPerfisPorColaborador) - nunca sobrescreve
// um perfil existente.
export async function criarPerfil(dados) {
    if (!dados.id_colaborador) {
        throw erroValidacaoPerfil('Colaborador não informado.', 'COLABORADOR_OBRIGATORIO');
    }
    if (!dados.data_medicao) {
        throw erroValidacaoPerfil('Informe a data da medição.', 'DATA_MEDICAO_OBRIGATORIA');
    }
    if (!ORIGENS_PERFIL_VALIDAS.includes(dados.origem)) {
        throw erroValidacaoPerfil('Selecione a origem da medição.', 'ORIGEM_INVALIDA');
    }
    if (dados.mao_dominante && !MAOS_DOMINANTES_VALIDAS.includes(dados.mao_dominante)) {
        throw erroValidacaoPerfil('Mão dominante inválida.', 'MAO_DOMINANTE_INVALIDA');
    }

    const { data, error } = await supabase
        .from('perfil_antropometrico')
        .insert({
            id_colaborador: dados.id_colaborador,
            altura_cm: dados.altura_cm || null,
            peso_kg: dados.peso_kg || null,
            mao_dominante: dados.mao_dominante || null,
            data_medicao: dados.data_medicao,
            origem: dados.origem,
            ativo: true,
        })
        .select(COLUNAS_PERFIL)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// Nunca DELETE: soft delete via ativo=false, mesmo padrao do restante do
// dominio (colaborador, GHE, etc.) - preserva o registro para auditoria
// mesmo que deixe de aparecer nas listas/selects vigentes.
export async function desativarPerfil(idPerfil) {
    const { data, error } = await supabase
        .from('perfil_antropometrico')
        .update({ ativo: false })
        .eq('id_perfil_antropometrico', idPerfil)
        .select(COLUNAS_PERFIL)
        .single();

    if (error) {
        throw error;
    }

    return data;
}
