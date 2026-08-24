import { supabase } from '../config/supabase.js';

const COLUNAS_COLABORADOR = 'id_colaborador, id_empresa, matricula, nome, email, data_admissao, ativo, criado_em, atualizado_em';

// O MVP opera com uma unica empresa demo. O id e obtido do banco (nunca
// fixo no codigo) e mantido em cache no modulo para evitar uma consulta
// extra a cada cadastro.
let idEmpresaAtivaCache = null;

async function obterIdEmpresaAtiva() {
    if (idEmpresaAtivaCache !== null) {
        return idEmpresaAtivaCache;
    }

    const { data, error } = await supabase
        .from('empresa')
        .select('id_empresa')
        .eq('ativo', true)
        .limit(1)
        .single();

    if (error) {
        throw error;
    }

    idEmpresaAtivaCache = data.id_empresa;
    return idEmpresaAtivaCache;
}

export async function listarColaboradores() {
    const { data, error } = await supabase
        .from('colaborador')
        .select(COLUNAS_COLABORADOR)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

export async function buscarColaboradorPorId(id) {
    const { data, error } = await supabase
        .from('colaborador')
        .select(COLUNAS_COLABORADOR)
        .eq('id_colaborador', id)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function criarColaborador(dados) {
    const idEmpresa = await obterIdEmpresaAtiva();

    const { data, error } = await supabase
        .from('colaborador')
        .insert({
            id_empresa: idEmpresa,
            matricula: dados.matricula,
            nome: dados.nome,
            email: dados.email,
            data_admissao: dados.data_admissao,
            ativo: true,
        })
        .select(COLUNAS_COLABORADOR)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function atualizarColaborador(id, dados) {
    const { data, error } = await supabase
        .from('colaborador')
        .update({
            matricula: dados.matricula,
            nome: dados.nome,
            email: dados.email,
            data_admissao: dados.data_admissao,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_colaborador', id)
        .select(COLUNAS_COLABORADOR)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// Soft delete: nunca DELETE FROM colaborador. O historico (vinculos,
// avaliacoes, planos de acao) referencia o colaborador e deve ser
// preservado; ON DELETE RESTRICT no schema impediria a exclusao fisica
// de qualquer forma.
export async function desativarColaborador(id) {
    const { data, error } = await supabase
        .from('colaborador')
        .update({
            ativo: false,
            atualizado_em: new Date().toISOString(),
        })
        .eq('id_colaborador', id)
        .select(COLUNAS_COLABORADOR)
        .single();

    if (error) {
        throw error;
    }

    return data;
}
