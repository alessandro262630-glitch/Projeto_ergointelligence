import { supabase } from '../config/supabase.js';

const COLUNAS_AMBIENTE = 'id_ambiente, id_setor, codigo, nome, tipo_ambiente, localizacao, ativo';
const COLUNAS_POSTO = 'id_posto, id_ambiente, codigo, nome, tipo_posto, ativo';

// Ambientes de um setor especifico (contexto organizacional do vinculo
// selecionado na avaliacao). Nao existe listagem global de ambientes por
// design: um ambiente sempre pertence a um setor de uma empresa.
export async function listarAmbientesPorSetor(idSetor) {
    const { data, error } = await supabase
        .from('ambiente_trabalho')
        .select(COLUNAS_AMBIENTE)
        .eq('id_setor', idSetor)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

export async function buscarAmbientePorId(idAmbiente) {
    const { data, error } = await supabase
        .from('ambiente_trabalho')
        .select(COLUNAS_AMBIENTE)
        .eq('id_ambiente', idAmbiente)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function listarPostosPorAmbiente(idAmbiente) {
    const { data, error } = await supabase
        .from('posto_trabalho')
        .select(COLUNAS_POSTO)
        .eq('id_ambiente', idAmbiente)
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

export async function buscarPostoPorId(idPosto) {
    const { data, error } = await supabase
        .from('posto_trabalho')
        .select(COLUNAS_POSTO)
        .eq('id_posto', idPosto)
        .single();

    if (error) {
        throw error;
    }

    return data;
}
