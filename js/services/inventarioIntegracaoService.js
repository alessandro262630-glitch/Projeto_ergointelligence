import { supabase } from '../config/supabase.js';
import { obterIdEmpresaAtiva } from './colaboradorService.js';
import { buscarInventario } from './inventarioRiscoService.js';

// MVP-09C - Integracao do Motor de Risco do GHE com o Inventario de
// Riscos Ocupacionais. Este service e EXCLUSIVAMENTE CONSUMIDOR: le
// resultados ja persistidos em avaliacao_ghe_risco/processamento_risco_ghe
// e grava itens de inventario com origem_tipo='MOTOR_GHE'. E PROIBIDO
// aqui: calcular metrica, avaliar regra/condicao, somar pontuacao ou
// classificar risco - qualquer numero usado e sempre um snapshot de algo
// que o Motor GHE ja calculou e gravou (js/services/motorRiscoGheService.js,
// js/domain/ghe-risk/*.js - nenhum desses arquivos e importado ou
// reimplementado aqui).
//
// Unidade de importacao: UMA linha de avaliacao_ghe_risco (1 risco + 1
// processamento + 1 GHE). O CHECK chk_inventario_risco_item_origem_consistente
// (corrigido na migration 006) e a UNIQUE(id_inventario, id_avaliacao_ghe_risco)
// (ja existente desde a migration 005) sao a ultima linha de defesa contra
// snapshot incompleto e duplicidade - este service nunca confia soente na
// validacao da UI.

function erroIntegracao(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// =====================================================================
// LEITURA: cadeia completa de UM resultado (risco -> processamento ->
// avaliacao GHE -> GHE -> empresa), com metodologia e classificacao
// embutidas numa unica consulta (nested select do PostgREST) - nunca uma
// consulta por nivel.
// =====================================================================

const COLUNAS_CADEIA_RESULTADO = `
    id_avaliacao_ghe_risco, id_risco, pontuacao, id_classificacao_ghe, criado_em,
    risco_ergonomico(id_risco, codigo, nome),
    classificacao_risco_ghe(codigo, nome, cor_hex),
    processamento_risco_ghe(
        id_processamento_risco_ghe, status, processado_em, id_avaliacao_ghe,
        versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot,
        metodologia_risco(id_metodologia, codigo, versao, status_validacao),
        avaliacao_ghe(id_avaliacao_ghe, id_ghe, ghe(id_ghe, id_empresa, nome, codigo, universo, setor(nome)))
    )
`;

async function buscarCadeiaResultado(idAvaliacaoGheRisco) {
    const { data, error } = await supabase
        .from('avaliacao_ghe_risco')
        .select(COLUNAS_CADEIA_RESULTADO)
        .eq('id_avaliacao_ghe_risco', idAvaliacaoGheRisco)
        .single();

    if (error) throw error;

    const processamento = data.processamento_risco_ghe;
    const avaliacaoGhe = processamento?.avaliacao_ghe;
    const ghe = avaliacaoGhe?.ghe;
    const metodologia = processamento?.metodologia_risco;

    return {
        id_avaliacao_ghe_risco: data.id_avaliacao_ghe_risco,
        id_risco: data.id_risco,
        risco_codigo: data.risco_ergonomico?.codigo ?? null,
        risco_nome: data.risco_ergonomico?.nome ?? null,
        pontuacao: data.pontuacao,
        classificacao_codigo: data.classificacao_risco_ghe?.codigo ?? null,
        classificacao_nome: data.classificacao_risco_ghe?.nome ?? null,
        classificacao_cor_hex: data.classificacao_risco_ghe?.cor_hex ?? null,
        processamento: {
            id_processamento_risco_ghe: processamento?.id_processamento_risco_ghe ?? null,
            status: processamento?.status ?? null,
            processado_em: processamento?.processado_em ?? null,
            coletas_concluidas_snapshot: processamento?.coletas_concluidas_snapshot ?? null,
            amostra_planejada_snapshot: processamento?.amostra_planejada_snapshot ?? null,
            percentual_cobertura_snapshot: processamento?.percentual_cobertura_snapshot ?? null,
        },
        id_avaliacao_ghe: avaliacaoGhe?.id_avaliacao_ghe ?? null,
        id_ghe: ghe?.id_ghe ?? null,
        ghe_nome: ghe?.nome ?? null,
        ghe_codigo: ghe?.codigo ?? null,
        ghe_setor: ghe?.setor?.nome ?? null,
        ghe_universo: ghe?.universo ?? null,
        id_empresa_ghe: ghe?.id_empresa ?? null,
        metodologia_codigo: metodologia?.codigo ?? null,
        metodologia_versao: metodologia?.versao ?? null,
        metodologia_status_validacao: metodologia?.status_validacao ?? null,
    };
}

// =====================================================================
// INVENTARIOS DE DESTINO (somente RASCUNHO da empresa ativa - secao 10)
// =====================================================================

export async function listarInventariosRascunhoDaEmpresa() {
    const idEmpresa = await obterIdEmpresaAtiva();

    const { data, error } = await supabase
        .from('inventario_risco')
        .select('id_inventario, numero_versao, titulo, status, data_referencia')
        .eq('id_empresa', idEmpresa)
        .eq('status', 'RASCUNHO')
        .order('numero_versao', { ascending: false });

    if (error) throw error;
    return data || [];
}

// =====================================================================
// RESULTADOS DE UM PROCESSAMENTO (para a etapa "Selecionar riscos" - secao 9)
// =====================================================================

// Reaproveita motorRiscoGheService.listarResultadosGhe seria redundante
// aqui, pois a modal de importacao precisa, para cada risco, tambem do
// perigo mapeado e (quando idInventario e informado) se aquele resultado
// ja foi importado NAQUELE inventario - por isso a consulta propria via
// buscarCadeiaResultado nao e usada aqui (evitaria N+1); consulta direta
// e enxuta, sem duplicar regra de calculo (nenhuma pontuacao e recalculada).
export async function listarResultadosProcessamento(idProcessamentoRiscoGhe, idInventario = null) {
    const { data, error } = await supabase
        .from('avaliacao_ghe_risco')
        .select(`
            id_avaliacao_ghe_risco, id_risco, pontuacao,
            risco_ergonomico(id_risco, codigo, nome),
            classificacao_risco_ghe(codigo, nome, cor_hex)
        `)
        .eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe)
        .order('id_avaliacao_ghe_risco', { ascending: true });

    if (error) throw error;

    const idsRisco = [...new Set((data || []).map((linha) => linha.id_risco))];
    const mapaPerigos = await resolverPerigosPorRiscos(idsRisco);

    let idsJaImportados = new Set();
    if (idInventario) {
        const { data: itensExistentes, error: erroItens } = await supabase
            .from('inventario_risco_item')
            .select('id_avaliacao_ghe_risco')
            .eq('id_inventario', idInventario)
            .not('id_avaliacao_ghe_risco', 'is', null);
        if (erroItens) throw erroItens;
        idsJaImportados = new Set((itensExistentes || []).map((i) => i.id_avaliacao_ghe_risco));
    }

    return (data || []).map((linha) => {
        const perigo = mapaPerigos.get(linha.id_risco) ?? null;
        return {
            id_avaliacao_ghe_risco: linha.id_avaliacao_ghe_risco,
            id_risco: linha.id_risco,
            risco_codigo: linha.risco_ergonomico?.codigo ?? null,
            risco_nome: linha.risco_ergonomico?.nome ?? null,
            pontuacao: linha.pontuacao,
            classificacao_codigo: linha.classificacao_risco_ghe?.codigo ?? null,
            classificacao_nome: linha.classificacao_risco_ghe?.nome ?? null,
            classificacao_cor_hex: linha.classificacao_risco_ghe?.cor_hex ?? null,
            perigo,
            jaImportado: idsJaImportados.has(linha.id_avaliacao_ghe_risco),
        };
    });
}

// =====================================================================
// MAPEAMENTO RISCO -> PERIGO (risco_ergonomico_perigo, migration 005)
// =====================================================================
// UNIQUE(id_risco) em risco_ergonomico_perigo ja impede fisicamente mais
// de um perigo por risco (MVP-09A, secao 5) - "mapeamento ambiguo" (secao
// 14 do prompt MVP-09C) nao e um estado alcancavel nesta arquitetura;
// resolverPerigoResultado so precisa distinguir "mapeado" de "nao
// mapeado", nunca "mapeado para mais de um".

export async function resolverPerigoResultado(idRisco) {
    const mapa = await resolverPerigosPorRiscos([idRisco]);
    return mapa.get(idRisco) ?? null;
}

async function resolverPerigosPorRiscos(idsRisco) {
    const mapa = new Map();
    if (!idsRisco || idsRisco.length === 0) return mapa;

    const { data, error } = await supabase
        .from('risco_ergonomico_perigo')
        .select('id_risco, perigo_ocupacional(id_perigo, codigo, categoria, nome)')
        .in('id_risco', idsRisco)
        .eq('ativo', true);

    if (error) throw error;

    (data || []).forEach((linha) => {
        if (!linha.perigo_ocupacional) return;
        mapa.set(linha.id_risco, {
            id_perigo: linha.perigo_ocupacional.id_perigo,
            codigo: linha.perigo_ocupacional.codigo,
            categoria: linha.perigo_ocupacional.categoria,
            nome: linha.perigo_ocupacional.nome,
        });
    });
    return mapa;
}

// =====================================================================
// VALIDACAO DE IMPORTABILIDADE (secao 4/10/11 do prompt MVP-09C)
// =====================================================================
// Nunca confia so na UI: chamada tanto pela pre-visualizacao quanto pela
// importacao de fato, mesmo que a tela ja tenha filtrado as opcoes.
export async function validarResultadoImportavel(idAvaliacaoGheRisco, idInventario) {
    const [resultado, inventario] = await Promise.all([
        buscarCadeiaResultado(idAvaliacaoGheRisco),
        buscarInventario(idInventario),
    ]);

    if (inventario.status !== 'RASCUNHO') {
        throw erroIntegracao('O inventário selecionado não está em rascunho.', 'INVENTARIO_NAO_EDITAVEL');
    }
    if (resultado.processamento.status !== 'CONCLUIDO') {
        throw erroIntegracao('Este resultado pertence a um processamento que não está concluído.', 'PROCESSAMENTO_NAO_CONCLUIDO');
    }
    if (resultado.id_empresa_ghe !== inventario.id_empresa) {
        throw erroIntegracao('O GHE de origem deste resultado não pertence à empresa deste inventário.', 'INVENTARIO_EMPRESA_INCOMPATIVEL');
    }

    return { resultado, inventario };
}

// =====================================================================
// DUPLICIDADE (secao 25/26/27) - mesmo INVENTARIO + mesmo
// id_avaliacao_ghe_risco nao pode aparecer duas vezes. Verificacao previa
// (UX) - a garantia final e a UNIQUE do banco, capturada em
// importarResultadoGhe.
// =====================================================================
export async function verificarResultadoJaImportado(idInventario, idAvaliacaoGheRisco) {
    const { data, error } = await supabase
        .from('inventario_risco_item')
        .select('id_inventario_risco_item')
        .eq('id_inventario', idInventario)
        .eq('id_avaliacao_ghe_risco', idAvaliacaoGheRisco)
        .maybeSingle();

    if (error) throw error;
    return data ? data.id_inventario_risco_item : null;
}

// =====================================================================
// PRE-VISUALIZACAO (secao 29/30) - resolve tudo, mas nao grava nada.
// =====================================================================
export async function prepararImportacaoResultado(idAvaliacaoGheRisco, idInventario) {
    const { resultado, inventario } = await validarResultadoImportavel(idAvaliacaoGheRisco, idInventario);
    const perigo = await resolverPerigoResultado(resultado.id_risco);
    const idItemExistente = await verificarResultadoJaImportado(idInventario, idAvaliacaoGheRisco);

    return {
        inventario: { id_inventario: inventario.id_inventario, numero_versao: inventario.numero_versao, titulo: inventario.titulo },
        ghe_nome: resultado.ghe_nome,
        risco_nome: resultado.risco_nome,
        perigo,
        pontuacao: resultado.pontuacao,
        classificacao_nome: resultado.classificacao_nome,
        metodologia_codigo: resultado.metodologia_codigo,
        metodologia_versao: resultado.metodologia_versao,
        metodologia_status_validacao: resultado.metodologia_status_validacao,
        trabalhadores_expostos_previstos: resultado.ghe_universo,
        jaImportado: idItemExistente !== null,
        importavel: perigo !== null && idItemExistente === null,
    };
}

// =====================================================================
// IMPORTACAO (secao 18/19/25/26) - idempotente: repetir a mesma
// importacao nunca gera segunda linha (UNIQUE(id_inventario,
// id_avaliacao_ghe_risco), ja existente desde a migration 005).
// =====================================================================
const COLUNAS_ITEM_RETORNO = `
    id_inventario_risco_item, id_inventario, id_ghe, id_perigo, trabalhadores_expostos_snapshot,
    origem_tipo, id_avaliacao_ghe_risco, pontuacao_snapshot, classificacao_codigo_snapshot,
    classificacao_nome_snapshot, metodologia_codigo_snapshot, metodologia_versao_snapshot
`;

export async function importarResultadoGhe(idAvaliacaoGheRisco, idInventario) {
    const { resultado } = await validarResultadoImportavel(idAvaliacaoGheRisco, idInventario);

    const perigo = await resolverPerigoResultado(resultado.id_risco);
    if (!perigo) {
        return { status: 'SEM_MAPEAMENTO', id_avaliacao_ghe_risco: idAvaliacaoGheRisco, risco_nome: resultado.risco_nome };
    }

    const { data, error } = await supabase
        .from('inventario_risco_item')
        .insert({
            id_inventario: idInventario,
            id_ghe: resultado.id_ghe,
            id_perigo: perigo.id_perigo,
            // Snapshot do universo do GHE NO MOMENTO da importacao - nunca
            // recalculado depois, mesmo que o GHE mude (secao 19, mesmo
            // principio ja aplicado a itens MANUAL desde o MVP-09B).
            trabalhadores_expostos_snapshot: resultado.ghe_universo,
            origem_tipo: 'MOTOR_GHE',
            id_avaliacao_ghe_risco: idAvaliacaoGheRisco,
            pontuacao_snapshot: resultado.pontuacao,
            classificacao_codigo_snapshot: resultado.classificacao_codigo,
            classificacao_nome_snapshot: resultado.classificacao_nome,
            metodologia_codigo_snapshot: resultado.metodologia_codigo,
            metodologia_versao_snapshot: resultado.metodologia_versao,
        })
        .select(COLUNAS_ITEM_RETORNO)
        .single();

    if (error) {
        if (error.code === '23505') {
            return { status: 'JA_IMPORTADO', id_avaliacao_ghe_risco: idAvaliacaoGheRisco, risco_nome: resultado.risco_nome };
        }
        console.error('Erro ao importar resultado do GHE para o inventário:', error);
        throw erroIntegracao('Não foi possível importar este resultado.', 'PERSISTENCIA_IMPORTACAO_FALHOU');
    }

    return { status: 'IMPORTADO', id_avaliacao_ghe_risco: idAvaliacaoGheRisco, risco_nome: resultado.risco_nome, item: data };
}

// Importacao em lote (secao 28) - nunca mascara falha parcial: cada
// resultado tem seu proprio status na resposta, mesmo que outros da mesma
// chamada tenham sido importados com sucesso.
export async function importarResultadosGhe(idsAvaliacaoGheRisco, idInventario) {
    const resultados = [];
    for (const idAvaliacaoGheRisco of idsAvaliacaoGheRisco) {
        try {
            const resultado = await importarResultadoGhe(idAvaliacaoGheRisco, idInventario);
            resultados.push(resultado);
        } catch (error) {
            console.error(`Erro ao importar resultado ${idAvaliacaoGheRisco}:`, error);
            resultados.push({ status: 'ERRO', id_avaliacao_ghe_risco: idAvaliacaoGheRisco, mensagem: error.message });
        }
    }
    return resultados;
}

// Usado pelo aviso do cabecalho do inventario (secao 45) - verifica, em
// lote, se alguma das metodologias (codigo+versao) dos itens MOTOR_GHE
// esta marcada como DEMONSTRATIVA. Nunca reinterpreta o rotulo (secao 20:
// DEMONSTRATIVA nunca vira VALIDADA por aqui) - so consulta o que ja
// esta gravado em metodologia_risco.
export async function verificarAlgumaMetodologiaDemonstrativa(paresCodigoVersao) {
    if (!paresCodigoVersao || paresCodigoVersao.length === 0) return false;

    const codigos = [...new Set(paresCodigoVersao.map((p) => p.codigo))];
    const { data, error } = await supabase
        .from('metodologia_risco')
        .select('codigo, versao, status_validacao')
        .in('codigo', codigos);
    if (error) throw error;

    return (data || []).some((metodologia) => paresCodigoVersao.some(
        (par) => par.codigo === metodologia.codigo
            && par.versao === metodologia.versao
            && metodologia.status_validacao === 'DEMONSTRATIVA',
    ));
}

// =====================================================================
// ORIGEM (para inventario-detalhe.html - "Ver Origem", secao 32/33/45) -
// estende inventarioRiscoService.buscarOrigemItem (ja existente desde a
// migration 005) com o nome do GHE e o status_validacao da metodologia,
// necessarios para o aviso obrigatorio de metodologia demonstrativa
// (secao 21/45). NUNCA reprocessa (secao 34) - so leitura de historico ja
// persistido.
// =====================================================================
export async function buscarOrigemItemInventario(idItem) {
    const { data: item, error: erroItem } = await supabase
        .from('inventario_risco_item')
        .select('id_inventario_risco_item, origem_tipo, id_avaliacao_ghe_risco, pontuacao_snapshot, classificacao_nome_snapshot, ghe(nome)')
        .eq('id_inventario_risco_item', idItem)
        .single();
    if (erroItem) throw erroItem;

    if (item.origem_tipo !== 'MOTOR_GHE' || !item.id_avaliacao_ghe_risco) {
        return null;
    }

    const resultado = await buscarCadeiaResultado(item.id_avaliacao_ghe_risco);

    return {
        id_avaliacao_ghe_risco: resultado.id_avaliacao_ghe_risco,
        id_processamento_risco_ghe: resultado.processamento.id_processamento_risco_ghe,
        processado_em: resultado.processamento.processado_em,
        ghe_nome: item.ghe?.nome ?? resultado.ghe_nome,
        metodologia_codigo: resultado.metodologia_codigo,
        metodologia_versao: resultado.metodologia_versao,
        metodologia_status_validacao: resultado.metodologia_status_validacao,
        pontuacao: item.pontuacao_snapshot,
        classificacao_nome: item.classificacao_nome_snapshot,
    };
}
