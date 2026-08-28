import { supabase } from '../config/supabase.js';

const COLUNAS_PERFIL = 'id_perfil_antropometrico, id_colaborador, altura_cm, peso_kg, mao_dominante, data_medicao, origem, ativo';

// Somente leitura nesta feature (AVA-01): criacao/edicao de perfil
// antropometrico pertence a outra tela, fora deste escopo.
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
