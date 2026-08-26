import { supabase } from '../config/supabase.js';

// colaborador_vinculo nao possui coluna atualizado_em no schema (apenas
// criado_em) - ver database/schema.sql. Nao adicionar essa coluna aqui.
const COLUNAS_VINCULO = 'id_vinculo, id_colaborador, id_setor, id_cargo, data_inicio, data_fim, principal, ativo, criado_em, setor(nome), cargo(nome)';

// Achata o objeto embutido do PostgREST ({ setor: { nome } }) para um campo
// de string simples, mais conveniente para quem consome o service.
function mapearVinculo(linha) {
    if (!linha) {
        return null;
    }
    return {
        ...linha,
        setor: linha.setor?.nome ?? null,
        cargo: linha.cargo?.nome ?? null,
    };
}

function erroPrincipalDuplicado() {
    const erro = new Error('Este colaborador já possui um vínculo principal ativo e vigente.');
    erro.code = 'PRINCIPAL_JA_EXISTE';
    return erro;
}

export async function listarVinculosPorColaborador(idColaborador) {
    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .select(COLUNAS_VINCULO)
        .eq('id_colaborador', idColaborador)
        .order('data_inicio', { ascending: false });

    if (error) {
        throw error;
    }

    return data.map(mapearVinculo);
}

export async function buscarVinculoPorId(idVinculo) {
    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .select(COLUNAS_VINCULO)
        .eq('id_vinculo', idVinculo)
        .single();

    if (error) {
        throw error;
    }

    return mapearVinculo(data);
}

// Vinculo principal, ativo e vigente do colaborador (no maximo um, por
// constraint do banco). Retorna null quando nao existe - isso e um estado
// valido (colaborador sem vinculo no momento), nao um erro.
//
// Reutilizavel por outras features (ex.: AVA-02 - selecionar contexto da
// avaliacao ergonomica) para resolver setor/cargo vigentes do colaborador.
export async function buscarVinculoAtual(idColaborador) {
    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .select(COLUNAS_VINCULO)
        .eq('id_colaborador', idColaborador)
        .eq('principal', true)
        .eq('ativo', true)
        .is('data_fim', null)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return mapearVinculo(data);
}

// dados: { id_colaborador, id_setor, id_cargo, data_inicio, principal }
export async function criarVinculo(dados) {
    // Antecipa a regra de negocio (o banco tambem protege via indice unico
    // parcial): nunca tenta criar um segundo principal vigente em silencio.
    if (dados.principal) {
        const vinculoExistente = await buscarVinculoAtual(dados.id_colaborador);
        if (vinculoExistente) {
            throw erroPrincipalDuplicado();
        }
    }

    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .insert({
            id_colaborador: dados.id_colaborador,
            id_setor: dados.id_setor,
            id_cargo: dados.id_cargo,
            data_inicio: dados.data_inicio,
            principal: dados.principal,
            ativo: true,
        })
        .select(COLUNAS_VINCULO)
        .single();

    if (error) {
        throw error;
    }

    return mapearVinculo(data);
}

// dados: { id_setor, id_cargo, data_inicio, principal }
// Edicao e permitida apenas para vinculos vigentes (data_fim IS NULL): um
// vinculo encerrado e historico e nao deve ser reaberto/alterado no MVP.
export async function atualizarVinculo(idVinculo, dados) {
    const vinculoAtual = await buscarVinculoPorId(idVinculo);

    if (vinculoAtual.data_fim) {
        const erro = new Error('Não é possível editar um vínculo encerrado.');
        erro.code = 'VINCULO_ENCERRADO';
        throw erro;
    }

    if (dados.principal) {
        const vinculoPrincipalVigente = await buscarVinculoAtual(vinculoAtual.id_colaborador);
        if (vinculoPrincipalVigente && vinculoPrincipalVigente.id_vinculo !== idVinculo) {
            throw erroPrincipalDuplicado();
        }
    }

    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .update({
            id_setor: dados.id_setor,
            id_cargo: dados.id_cargo,
            data_inicio: dados.data_inicio,
            principal: dados.principal,
        })
        .eq('id_vinculo', idVinculo)
        .select(COLUNAS_VINCULO)
        .single();

    if (error) {
        throw error;
    }

    return mapearVinculo(data);
}

// Nunca DELETE: encerra preenchendo data_fim, preservando o historico.
export async function encerrarVinculo(idVinculo, dataFim) {
    const vinculoAtual = await buscarVinculoPorId(idVinculo);

    if (dataFim < vinculoAtual.data_inicio) {
        const erro = new Error('A data de encerramento não pode ser anterior à data de início.');
        erro.code = 'DATA_FIM_INVALIDA';
        throw erro;
    }

    const { data, error } = await supabase
        .from('colaborador_vinculo')
        .update({ data_fim: dataFim })
        .eq('id_vinculo', idVinculo)
        .select(COLUNAS_VINCULO)
        .single();

    if (error) {
        throw error;
    }

    return mapearVinculo(data);
}

// --- Catalogos (somente leitura; CRUD de setor/cargo fica fora de escopo) --
export async function listarSetores() {
    const { data, error } = await supabase
        .from('setor')
        .select('id_setor, nome')
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

export async function listarCargos() {
    const { data, error } = await supabase
        .from('cargo')
        .select('id_cargo, nome')
        .eq('ativo', true)
        .order('nome', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}
