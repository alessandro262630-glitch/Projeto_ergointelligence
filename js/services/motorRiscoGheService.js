import { supabase } from '../config/supabase.js';
import {
    validarCondicaoGhe,
    avaliarRegraProcessavel,
    avaliarMetodologiaBaseProcessavel,
} from '../domain/ghe-risk/validacaoConfiguracaoGhe.js';
import { processarRiscosGhePuro } from '../domain/ghe-risk/motorRiscoGhe.js';
import { buscarAvaliacaoGhePorId } from './avaliacaoGheService.js';
import { buscarGhePorId, buscarPlanoAmostragemPorId } from './gheService.js';

// Motor de Risco do GHE - camada de service (MVP-08B: fundacao fisica e
// validacao estrutural; MVP-08C: primeira execucao completa com
// metodologia EXCLUSIVAMENTE DEMONSTRATIVA). Responsavel por LER a
// configuracao e as evidencias do Supabase, chamar o dominio puro
// (js/domain/ghe-risk/motorRiscoGhe.js) e persistir resultado +
// rastreabilidade. NAO contem regras de calculo - isso pertence
// exclusivamente ao dominio (mesma separacao ja usada por
// riscoService.js/motorRisco.js no Motor individual).

function erroMotorGhe(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

const COLUNAS_METODOLOGIA = 'id_metodologia, codigo, nome, versao, descricao, tipo_contexto, status_validacao, ativo, criado_em';
const COLUNAS_CLASSIFICACAO_GHE = 'id_classificacao_ghe, id_metodologia, codigo, nome, descricao, pontuacao_minima, pontuacao_maxima, prioridade, cor_hex, ativo, criado_em';
const COLUNAS_REGRA_GHE = 'id_regra_ghe, id_metodologia, id_risco, codigo, nome, descricao, operador_agregacao, pontuacao_resultado, ativo, criado_em, atualizado_em';
const COLUNAS_CONDICAO_GHE = 'id_condicao_ghe, id_regra_ghe, id_pergunta, id_opcao, tipo_metrica, parametro_metrica, operador, valor_comparacao, ordem, ativo, criado_em';

// =====================================================================
// Leitura de configuracao
// =====================================================================

export async function listarMetodologias() {
    const { data, error } = await supabase
        .from('metodologia_risco')
        .select(COLUNAS_METODOLOGIA)
        .order('codigo', { ascending: true })
        .order('versao', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function buscarMetodologia(idMetodologia) {
    const { data, error } = await supabase
        .from('metodologia_risco')
        .select(COLUNAS_METODOLOGIA)
        .eq('id_metodologia', idMetodologia)
        .single();

    if (error) throw error;
    return data;
}

export async function buscarClassificacoes(idMetodologia) {
    const { data, error } = await supabase
        .from('classificacao_risco_ghe')
        .select(COLUNAS_CLASSIFICACAO_GHE)
        .eq('id_metodologia', idMetodologia)
        .order('pontuacao_minima', { ascending: true });

    if (error) throw error;
    return data || [];
}

// Traz as regras da metodologia JA com suas condicoes embutidas
// (`condicoes: [...]`) - 2 consultas no total (regras + condicoes em
// lote via IN), nunca uma consulta de condicoes por regra (mesmo
// criterio ja usado em riscoService.carregarDadosParaMotor).
export async function buscarRegras(idMetodologia) {
    const { data: regras, error } = await supabase
        .from('regra_risco_ghe')
        .select(COLUNAS_REGRA_GHE)
        .eq('id_metodologia', idMetodologia)
        .order('codigo', { ascending: true });

    if (error) throw error;
    if (!regras || regras.length === 0) return [];

    const idsRegras = regras.map((regra) => regra.id_regra_ghe);
    const { data: condicoes, error: erroCondicoes } = await supabase
        .from('regra_condicao_ghe')
        .select(COLUNAS_CONDICAO_GHE)
        .in('id_regra_ghe', idsRegras)
        .order('ordem', { ascending: true });

    if (erroCondicoes) throw erroCondicoes;

    const condicoesPorRegra = new Map();
    (condicoes || []).forEach((condicao) => {
        const lista = condicoesPorRegra.get(condicao.id_regra_ghe) || [];
        lista.push(condicao);
        condicoesPorRegra.set(condicao.id_regra_ghe, lista);
    });

    return regras.map((regra) => ({ ...regra, condicoes: condicoesPorRegra.get(regra.id_regra_ghe) || [] }));
}

export async function buscarCondicoes(idRegraGhe) {
    const { data, error } = await supabase
        .from('regra_condicao_ghe')
        .select(COLUNAS_CONDICAO_GHE)
        .eq('id_regra_ghe', idRegraGhe)
        .order('ordem', { ascending: true });

    if (error) throw error;
    return data || [];
}

// =====================================================================
// Validacao ESTRUTURAL (nunca cientifica - ver secao 43 do prompt
// MVP-08B e js/domain/ghe-risk/validacaoConfiguracaoGhe.js)
// =====================================================================

// Resolve, em lote, as perguntas/opcoes referenciadas por um conjunto de
// condicoes - nunca uma consulta por condicao.
async function carregarCatalogoParaValidacao(condicoesTodas) {
    const idsPerguntas = [...new Set(condicoesTodas.map((c) => c.id_pergunta))];
    const idsOpcoes = [...new Set(condicoesTodas.map((c) => c.id_opcao).filter((id) => id !== null && id !== undefined))];

    const [{ data: perguntas, error: erroPerguntas }, { data: opcoes, error: erroOpcoes }] = await Promise.all([
        idsPerguntas.length > 0
            ? supabase.from('pergunta_avaliacao').select('id_pergunta, tipo_resposta, ativo').in('id_pergunta', idsPerguntas)
            : Promise.resolve({ data: [], error: null }),
        idsOpcoes.length > 0
            ? supabase.from('opcao_resposta').select('id_opcao, id_pergunta, ativo').in('id_opcao', idsOpcoes)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (erroPerguntas) throw erroPerguntas;
    if (erroOpcoes) throw erroOpcoes;

    return {
        perguntaPorId: new Map((perguntas || []).map((p) => [p.id_pergunta, p])),
        opcaoPorId: new Map((opcoes || []).map((o) => [o.id_opcao, o])),
    };
}

// Valida se uma metodologia PODE SER EXECUTADA pelo Motor GHE - nunca se
// e cientificamente valida (distincao explicita da arquitetura MVP-08A/
// MVP-08B, secao 43). Retorna um relatorio completo, nunca so um
// booleano: cada regra aparece com seus proprios motivos de bloqueio,
// para quem configura a metodologia saber exatamente o que corrigir.
//
// Tambem exportada como `validarConfiguracaoMetodologia` (mesmo nome
// usado na secao 41 do prompt MVP-08B) - as duas sao a MESMA funcao,
// nao ha duas implementacoes para nao divergirem no futuro.
export async function validarMetodologiaProcessavel(idMetodologia) {
    let metodologia;
    try {
        metodologia = await buscarMetodologia(idMetodologia);
    } catch (error) {
        console.error('Erro ao carregar metodologia para validação estrutural:', error);
        return {
            processavel: false,
            metodologia: null,
            motivosBase: [{ codigo: 'METODOLOGIA_NAO_ENCONTRADA', mensagem: 'Metodologia não encontrada.' }],
            classificacoes: { total: 0, ativas: 0 },
            regras: [],
        };
    }

    const [classificacoes, regras] = await Promise.all([
        buscarClassificacoes(idMetodologia),
        buscarRegras(idMetodologia),
    ]);

    const { processavel: baseProcessavel, motivos: motivosBase } = avaliarMetodologiaBaseProcessavel(metodologia, classificacoes);

    const todasCondicoes = regras.flatMap((regra) => regra.condicoes);
    const { perguntaPorId, opcaoPorId } = await carregarCatalogoParaValidacao(todasCondicoes);

    const relatorioRegras = regras.map((regra) => {
        const condicoesValidadas = regra.condicoes.map((condicao) => {
            const pergunta = perguntaPorId.get(condicao.id_pergunta) || null;
            const opcao = condicao.id_opcao ? (opcaoPorId.get(condicao.id_opcao) || null) : null;
            const resultado = validarCondicaoGhe(condicao, pergunta, opcao);
            return { condicao, ...resultado };
        });

        const { processavel, motivos } = avaliarRegraProcessavel(regra, condicoesValidadas);

        return {
            id_regra_ghe: regra.id_regra_ghe,
            codigo: regra.codigo,
            nome: regra.nome,
            ativo: regra.ativo,
            processavel,
            motivos,
        };
    });

    const regrasProcessaveis = relatorioRegras.filter((r) => r.processavel).length;

    return {
        // Uma metodologia so e considerada processavel de fato quando a
        // base (ativa + tem classificacao) esta ok E existe pelo menos
        // 1 regra processavel - metodologia sem nenhuma regra utilizavel
        // nunca deveria ser oferecida para processamento oficial (ainda
        // que a base estrutural esteja correta).
        processavel: baseProcessavel && regrasProcessaveis > 0,
        metodologia,
        motivosBase,
        classificacoes: { total: classificacoes.length, ativas: classificacoes.filter((c) => c.ativo).length },
        regras: relatorioRegras,
        resumo: { totalRegras: relatorioRegras.length, regrasProcessaveis, regrasNaoProcessaveis: relatorioRegras.length - regrasProcessaveis },
    };
}

export { validarMetodologiaProcessavel as validarConfiguracaoMetodologia };

// =====================================================================
// Processamento (leitura de historico) - MVP-08B fundacao: so leitura.
// Nenhuma funcao de ESCRITA de processamento/resultado existe ainda
// (secao 40/41 do prompt MVP-08B: a execucao oficial do motor com uma
// metodologia real fica para o MVP-08C).
// =====================================================================

// Resolve o processamento "oficial" de uma Avaliacao do GHE. Regra
// atual (deliberadamente simples, documentada como evoluivel - secao 15
// da arquitetura MVP-08A/secao 24 do prompt MVP-08B): o mais recente com
// status CONCLUIDO. Centralizado aqui para que, se essa regra precisar
// evoluir (flag explicita, relacao entre processamentos, confirmacao de
// governanca), a mudanca fique contida neste unico ponto - nunca
// espalhada pelas paginas que consultam resultados.
export async function buscarProcessamentoOficial(idAvaliacaoGhe) {
    const { data, error } = await supabase
        .from('processamento_risco_ghe')
        .select('id_processamento_risco_ghe, id_avaliacao_ghe, id_metodologia, versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot, status, processado_em')
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .eq('status', 'CONCLUIDO')
        .order('processado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function listarProcessamentos(idAvaliacaoGhe) {
    const { data, error } = await supabase
        .from('processamento_risco_ghe')
        .select('id_processamento_risco_ghe, id_avaliacao_ghe, id_metodologia, versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot, status, processado_em, metodologia_risco(codigo)')
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .order('processado_em', { ascending: false });

    if (error) throw error;
    return (data || []).map((linha) => ({ ...linha, codigo_metodologia: linha.metodologia_risco?.codigo ?? null }));
}

// Conveniencia para a interface encontrar a metodologia demonstrativa
// sem hardcodar id_metodologia no frontend (secao 49 do prompt MVP-08C:
// "não hardcode no frontend"). Nunca usada para decidir se algo é
// cientificamente válido - so localiza o registro pelo codigo/versao.
export async function buscarMetodologiaDemoPadrao() {
    const { data, error } = await supabase
        .from('metodologia_risco')
        .select(COLUNAS_METODOLOGIA)
        .eq('codigo', 'ERGO-GHE-DEMO')
        .eq('versao', '1.0.0')
        .maybeSingle();

    if (error) throw error;
    return data;
}

// =====================================================================
// Processamento (ESCRITA) - MVP-08C: primeira execucao completa do
// Motor GHE, exclusivamente com metodologia DEMONSTRATIVA.
// =====================================================================

async function carregarRiscosPorIds(idsRiscos) {
    if (idsRiscos.length === 0) return [];
    const { data, error } = await supabase
        .from('risco_ergonomico')
        .select('id_risco, codigo, nome, descricao, categoria')
        .in('id_risco', idsRiscos)
        .eq('ativo', true);
    if (error) throw error;
    return data || [];
}

// Carrega, em lote, so as perguntas/opcoes REALMENTE referenciadas pelas
// condicoes da metodologia - nunca o catalogo inteiro (mesmo criterio ja
// usado em riscoService.carregarDadosParaMotor).
async function carregarPerguntasEOpcoes(idsPerguntas) {
    if (idsPerguntas.length === 0) return { perguntas: [], opcoesPorPergunta: new Map() };

    const [{ data: perguntas, error: erroPerguntas }, { data: opcoes, error: erroOpcoes }] = await Promise.all([
        supabase.from('pergunta_avaliacao').select('id_pergunta, codigo, tipo_resposta, ativo').in('id_pergunta', idsPerguntas),
        supabase.from('opcao_resposta').select('id_opcao, id_pergunta, valor_numero, ativo').in('id_pergunta', idsPerguntas).eq('ativo', true),
    ]);
    if (erroPerguntas) throw erroPerguntas;
    if (erroOpcoes) throw erroOpcoes;

    const opcoesPorPergunta = new Map();
    (opcoes || []).forEach((o) => {
        const lista = opcoesPorPergunta.get(o.id_pergunta) || [];
        lista.push({ idOpcao: o.id_opcao, valorNumero: o.valor_numero });
        opcoesPorPergunta.set(o.id_pergunta, lista);
    });

    return { perguntas: perguntas || [], opcoesPorPergunta };
}

// Carrega as respostas de TODAS as coletas concluidas, agrupadas por
// pergunta - uma LISTA por pergunta (nao um valor unico como no Motor
// individual), pois o GHE agrega evidencia de N participantes. 3
// consultas no total (resposta_coleta + resposta_coleta_opcao + reaproveita
// o opcoesPorPergunta ja carregado para resolver valorNumero), nunca uma
// consulta por coleta/pergunta.
async function carregarRespostasDasColetas(idsColetas, idsPerguntas, opcoesPorPergunta) {
    const respostasPorPergunta = new Map(idsPerguntas.map((id) => [id, []]));
    if (idsColetas.length === 0 || idsPerguntas.length === 0) return respostasPorPergunta;

    const { data: respostas, error } = await supabase
        .from('resposta_coleta')
        .select('id_resposta_coleta, id_coleta, id_pergunta, resposta_texto, resposta_numero, resposta_booleano')
        .in('id_coleta', idsColetas)
        .in('id_pergunta', idsPerguntas);
    if (error) throw error;

    const idsRespostas = (respostas || []).map((r) => r.id_resposta_coleta);
    const { data: opcoesSelecionadas, error: erroOpcoesSel } = idsRespostas.length > 0
        ? await supabase.from('resposta_coleta_opcao').select('id_resposta_coleta, id_opcao').in('id_resposta_coleta', idsRespostas)
        : { data: [], error: null };
    if (erroOpcoesSel) throw erroOpcoesSel;

    const valorNumeroPorOpcao = new Map();
    opcoesPorPergunta.forEach((lista) => lista.forEach((o) => valorNumeroPorOpcao.set(o.idOpcao, o.valorNumero)));

    const opcoesPorResposta = new Map();
    (opcoesSelecionadas || []).forEach((linha) => {
        const lista = opcoesPorResposta.get(linha.id_resposta_coleta) || [];
        lista.push({ idOpcao: linha.id_opcao, valorNumero: valorNumeroPorOpcao.get(linha.id_opcao) ?? null });
        opcoesPorResposta.set(linha.id_resposta_coleta, lista);
    });

    (respostas || []).forEach((r) => {
        const lista = respostasPorPergunta.get(r.id_pergunta) || [];
        lista.push({
            respostaBooleano: r.resposta_booleano,
            respostaNumero: r.resposta_numero,
            respostaTexto: r.resposta_texto,
            opcoes: opcoesPorResposta.get(r.id_resposta_coleta) || [],
        });
        respostasPorPergunta.set(r.id_pergunta, lista);
    });

    return respostasPorPergunta;
}

// Reverte (fisicamente) todo o resultado ja persistido de UM
// processamento especifico - usado somente quando algo falha NO MEIO da
// persistencia deste processamento (secao 20 do prompt MVP-08C: "nao
// deixar processamento CONCLUIDO com metade dos riscos persistidos").
// Nunca toca em nenhum outro processamento.
async function reverterResultadosDoProcessamento(idProcessamentoRiscoGhe) {
    const { data: resultados } = await supabase
        .from('avaliacao_ghe_risco')
        .select('id_avaliacao_ghe_risco')
        .eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe);

    const idsResultados = (resultados || []).map((r) => r.id_avaliacao_ghe_risco);
    if (idsResultados.length > 0) {
        const { data: regrasAvaliadas } = await supabase
            .from('avaliacao_ghe_risco_regra')
            .select('id_avaliacao_ghe_risco_regra')
            .in('id_avaliacao_ghe_risco', idsResultados);

        const idsRegrasAvaliadas = (regrasAvaliadas || []).map((r) => r.id_avaliacao_ghe_risco_regra);
        if (idsRegrasAvaliadas.length > 0) {
            await supabase.from('avaliacao_ghe_risco_condicao').delete().in('id_avaliacao_ghe_risco_regra', idsRegrasAvaliadas);
            await supabase.from('avaliacao_ghe_risco_regra').delete().in('id_avaliacao_ghe_risco_regra', idsRegrasAvaliadas);
        }
        await supabase.from('avaliacao_ghe_risco').delete().in('id_avaliacao_ghe_risco', idsResultados);
    }
}

// Porta de entrada do processamento oficial do Motor GHE. So processa
// com uma metodologia estruturalmente valida (validarMetodologiaProcessavel),
// so considera coletas CONCLUIDA, nunca sobrescreve um processamento
// anterior (reprocessar = nova linha - MVP-08A, Ajuste 02) e nunca deixa
// um processamento CONCLUIDO com resultado parcial: o Supabase REST não
// oferece uma transação multi-tabela verdadeira a partir do navegador
// (limitação documentada em docs/mvp08c-metodologia-demo-motor-ghe.md) -
// a integridade e garantida por COMPENSAÇÃO explícita (reverte o que foi
// escrito deste processamento e marca status=ERRO) em vez de COMMIT/ROLLBACK
// atômico.
export async function processarRiscosGhe(idAvaliacaoGhe, idMetodologia) {
    // 1. Avaliacao do GHE precisa existir e estar CONSOLIDADA (fase
    // descritiva encerrada) antes do processamento oficial de risco.
    const avaliacaoGhe = await buscarAvaliacaoGhePorId(idAvaliacaoGhe);
    if (avaliacaoGhe.status === 'CANCELADA') {
        throw erroMotorGhe('Esta avaliação do GHE foi cancelada e não pode ser processada.', 'AVALIACAO_GHE_CANCELADA');
    }
    if (avaliacaoGhe.status !== 'CONSOLIDADA') {
        throw erroMotorGhe('A avaliação do GHE precisa estar consolidada antes do processamento oficial de risco.', 'AVALIACAO_GHE_NAO_CONSOLIDADA');
    }

    // 2/3. Metodologia + validacao ESTRUTURAL completa (nunca cientifica).
    const relatorioValidacao = await validarMetodologiaProcessavel(idMetodologia);
    if (!relatorioValidacao.metodologia) {
        throw erroMotorGhe('Metodologia não encontrada.', 'METODOLOGIA_NAO_ENCONTRADA');
    }
    if (!relatorioValidacao.metodologia.ativo) {
        throw erroMotorGhe('Esta metodologia está inativa e não pode ser utilizada.', 'METODOLOGIA_INATIVA');
    }
    if (!relatorioValidacao.processavel) {
        const erro = erroMotorGhe('A metodologia não está estruturalmente pronta para processamento.', 'METODOLOGIA_NAO_PROCESSAVEL');
        erro.detalhes = relatorioValidacao;
        throw erro;
    }

    // 4/5. GHE + Plano de Amostragem (para o snapshot de cobertura).
    const [ghe, plano] = await Promise.all([
        buscarGhePorId(avaliacaoGhe.id_ghe),
        buscarPlanoAmostragemPorId(avaliacaoGhe.id_plano_amostragem),
    ]);

    // 6/7. Coletas CONCLUIDA - nunca EM_ANDAMENTO/CANCELADA contaminam o
    // resultado oficial (regra confirmada desde o MVP-07).
    const { data: coletasConcluidas, error: erroColetas } = await supabase
        .from('coleta_ghe')
        .select('id_coleta')
        .eq('id_avaliacao_ghe', idAvaliacaoGhe)
        .eq('status', 'CONCLUIDA');
    if (erroColetas) throw erroColetas;

    if (!coletasConcluidas || coletasConcluidas.length === 0) {
        throw erroMotorGhe('Não é possível processar sem nenhuma coleta concluída.', 'SEM_COLETAS_CONCLUIDAS');
    }
    const idsColetas = coletasConcluidas.map((c) => c.id_coleta);

    // 8/9. Perguntas/opcoes/respostas necessarias - so as regras ATIVAS e
    // PROCESSAVEIS entram no calculo oficial (uma regra inativa ou
    // NAO_PROCESSAVEL nunca contamina o resultado, mesmo que exista na
    // tabela).
    const regrasTodas = await buscarRegras(idMetodologia);
    const idsRegrasProcessaveis = new Set(
        relatorioValidacao.regras.filter((r) => r.processavel && r.ativo).map((r) => r.id_regra_ghe),
    );
    const regrasProcessaveis = regrasTodas.filter((r) => idsRegrasProcessaveis.has(r.id_regra_ghe));

    const idsRiscos = [...new Set(regrasProcessaveis.map((r) => r.id_risco))];
    const idsPerguntas = [...new Set(regrasProcessaveis.flatMap((r) => r.condicoes.map((c) => c.id_pergunta)))];

    const [riscos, { perguntas, opcoesPorPergunta }, classificacoesGhe] = await Promise.all([
        carregarRiscosPorIds(idsRiscos),
        carregarPerguntasEOpcoes(idsPerguntas),
        buscarClassificacoes(idMetodologia),
    ]);
    const respostasPorPergunta = await carregarRespostasDasColetas(idsColetas, idsPerguntas, opcoesPorPergunta);

    // Snapshot de cobertura (secao 13/23 do prompt MVP-08C) - congelado
    // no momento exato desta execucao, nunca recalculado depois.
    const percentualCobertura = plano.amostra_planejada > 0
        ? Math.round((idsColetas.length / plano.amostra_planejada) * 1000) / 10
        : 0;

    // 13. Cria o processamento em PROCESSANDO ANTES de calcular (secao 24
    // do prompt MVP-08C) - se o calculo falhar, ja existe uma linha para
    // marcar como ERRO, nunca um estado "sumido".
    const { data: processamentoCriado, error: erroProcessamento } = await supabase
        .from('processamento_risco_ghe')
        .insert({
            id_avaliacao_ghe: idAvaliacaoGhe,
            id_metodologia: idMetodologia,
            versao_metodologia_snapshot: relatorioValidacao.metodologia.versao,
            coletas_concluidas_snapshot: idsColetas.length,
            amostra_planejada_snapshot: plano.amostra_planejada,
            percentual_cobertura_snapshot: percentualCobertura,
            status: 'PROCESSANDO',
        })
        .select('id_processamento_risco_ghe, id_avaliacao_ghe, id_metodologia, versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot, status, processado_em')
        .single();
    if (erroProcessamento) throw erroProcessamento;

    const idProcessamentoRiscoGhe = processamentoCriado.id_processamento_risco_ghe;

    try {
        // 9/10/11/12. Camadas 3-6, inteiramente no dominio puro.
        const resultado = processarRiscosGhePuro({
            perguntas,
            opcoesPorPergunta,
            respostasPorPergunta,
            riscos,
            regras: regrasProcessaveis,
            classificacoesGhe,
        });

        // 14. Persiste avaliacao_ghe_risco (1 INSERT em lote).
        const linhasResultado = resultado.riscos.map((r) => ({
            id_processamento_risco_ghe: idProcessamentoRiscoGhe,
            id_risco: r.id_risco,
            id_classificacao_ghe: r.classificacao.id_classificacao_ghe,
            pontuacao: r.pontuacao,
        }));
        const { data: resultadosInseridos, error: erroResultados } = await supabase
            .from('avaliacao_ghe_risco')
            .insert(linhasResultado)
            .select('id_avaliacao_ghe_risco, id_risco');
        if (erroResultados) throw erroResultados;

        const idResultadoPorRisco = new Map(resultadosInseridos.map((r) => [r.id_risco, r.id_avaliacao_ghe_risco]));

        // 15. Persiste avaliacao_ghe_risco_regra (1 INSERT em lote).
        const linhasRegra = [];
        resultado.riscos.forEach((r) => {
            r.regras.forEach((regra) => {
                linhasRegra.push({
                    id_avaliacao_ghe_risco: idResultadoPorRisco.get(r.id_risco),
                    id_regra_ghe: regra.id_regra_ghe,
                    codigo_regra_snapshot: regra.codigoRegraSnapshot,
                    pontuacao_resultado_snapshot: regra.pontuacaoResultadoSnapshot,
                    satisfeita: regra.satisfeita,
                    pontuacao_aplicada: regra.pontuacaoAplicada,
                    detalhe: regra.detalhe,
                    // referencia temporaria para religar as condicoes depois
                    // da insercao (nao e uma coluna real) - removida antes
                    // do insert de fato via desestruturacao abaixo.
                    __condicoes: regra.condicoes,
                    __idRegraGhe: regra.id_regra_ghe,
                });
            });
        });

        const { data: regrasInseridas, error: erroRegras } = await supabase
            .from('avaliacao_ghe_risco_regra')
            .insert(linhasRegra.map(({ __condicoes, __idRegraGhe, ...linha }) => linha))
            .select('id_avaliacao_ghe_risco_regra, id_avaliacao_ghe_risco, id_regra_ghe');
        if (erroRegras) throw erroRegras;

        // Casa cada regra inserida de volta as suas condicoes (por
        // id_avaliacao_ghe_risco + id_regra_ghe, unicos juntos dentro
        // deste processamento - uq_avaliacao_ghe_risco_regra garante isso).
        const chaveRegra = (idResultado, idRegra) => `${idResultado}:${idRegra}`;
        const idRegraAvaliadaPorChave = new Map(
            regrasInseridas.map((r) => [chaveRegra(r.id_avaliacao_ghe_risco, r.id_regra_ghe), r.id_avaliacao_ghe_risco_regra]),
        );

        // 16(interno). Persiste avaliacao_ghe_risco_condicao (1 INSERT em
        // lote, para TODAS as condicoes de TODAS as regras de uma vez).
        const linhasCondicao = [];
        linhasRegra.forEach((linha) => {
            const idRegraAvaliada = idRegraAvaliadaPorChave.get(chaveRegra(linha.id_avaliacao_ghe_risco, linha.__idRegraGhe));
            linha.__condicoes.forEach((c) => {
                linhasCondicao.push({
                    id_avaliacao_ghe_risco_regra: idRegraAvaliada,
                    id_condicao_ghe: c.id_condicao_ghe,
                    id_pergunta: c.idPergunta,
                    id_opcao: c.idOpcao,
                    tipo_metrica: c.tipoMetrica,
                    parametro_metrica_utilizado: c.parametroMetrica,
                    valor_metrica_calculado: c.valorCalculado,
                    base_calculo: c.baseCalculo,
                    operador_utilizado: c.operador,
                    valor_comparacao_utilizado: c.valorComparacao,
                    resultado: c.resultado,
                });
            });
        });

        if (linhasCondicao.length > 0) {
            const { error: erroCondicoes } = await supabase.from('avaliacao_ghe_risco_condicao').insert(linhasCondicao);
            if (erroCondicoes) throw erroCondicoes;
        }

        // Tudo persistido com sucesso - so agora o processamento vira
        // CONCLUIDO (nunca antes, secao 20/24 do prompt MVP-08C).
        const { data: processamentoConcluido, error: erroConclusao } = await supabase
            .from('processamento_risco_ghe')
            .update({ status: 'CONCLUIDO' })
            .eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe)
            .select('id_processamento_risco_ghe, id_avaliacao_ghe, id_metodologia, versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot, status, processado_em')
            .single();
        if (erroConclusao) throw erroConclusao;

        return { processamento: processamentoConcluido, riscos: resultado.riscos };
    } catch (erroProcessamentoInterno) {
        console.error('Erro ao processar riscos do GHE - revertendo resultado parcial:', erroProcessamentoInterno);
        try {
            await reverterResultadosDoProcessamento(idProcessamentoRiscoGhe);
        } catch (erroReversao) {
            console.error('Falha ao reverter resultado parcial do processamento:', erroReversao);
        }
        await supabase.from('processamento_risco_ghe').update({ status: 'ERRO' }).eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe);

        if (erroProcessamentoInterno?.code) throw erroProcessamentoInterno;
        throw erroMotorGhe('Não foi possível concluir o processamento de riscos do GHE.', 'PROCESSAMENTO_FALHOU');
    }
}

// =====================================================================
// Leitura de resultado (para resultado-ghe.html / "Entenda por quê")
// =====================================================================

const COLUNAS_RESULTADO = 'id_avaliacao_ghe_risco, id_processamento_risco_ghe, id_risco, id_classificacao_ghe, pontuacao, criado_em, '
    + 'risco_ergonomico(codigo, nome, categoria), classificacao_risco_ghe(codigo, nome, prioridade, cor_hex)';

export async function buscarProcessamento(idProcessamentoRiscoGhe) {
    const { data, error } = await supabase
        .from('processamento_risco_ghe')
        .select('id_processamento_risco_ghe, id_avaliacao_ghe, id_metodologia, versao_metodologia_snapshot, coletas_concluidas_snapshot, amostra_planejada_snapshot, percentual_cobertura_snapshot, status, processado_em')
        .eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe)
        .single();
    if (error) throw error;
    return data;
}

export async function listarResultadosGhe(idProcessamentoRiscoGhe) {
    const { data, error } = await supabase
        .from('avaliacao_ghe_risco')
        .select(COLUNAS_RESULTADO)
        .eq('id_processamento_risco_ghe', idProcessamentoRiscoGhe)
        .order('id_avaliacao_ghe_risco', { ascending: true });

    if (error) throw error;
    return (data || []).map((linha) => ({
        id_avaliacao_ghe_risco: linha.id_avaliacao_ghe_risco,
        id_risco: linha.id_risco,
        codigo_risco: linha.risco_ergonomico?.codigo ?? null,
        nome_risco: linha.risco_ergonomico?.nome ?? null,
        pontuacao: linha.pontuacao,
        classificacao: linha.classificacao_risco_ghe ?? null,
        criado_em: linha.criado_em,
    }));
}

// Rastreabilidade completa de UM resultado (risco dentro de um
// processamento): regras avaliadas + condicoes de cada uma - usado pelo
// "Entenda por quê" (secao 37 do prompt MVP-08C). So leitura de
// snapshots ja persistidos, nunca recalcula nada.
export async function buscarRastreabilidadeResultado(idAvaliacaoGheRisco) {
    const { data: regras, error: erroRegras } = await supabase
        .from('avaliacao_ghe_risco_regra')
        .select('id_avaliacao_ghe_risco_regra, id_regra_ghe, codigo_regra_snapshot, pontuacao_resultado_snapshot, satisfeita, pontuacao_aplicada, detalhe, criado_em, regra_risco_ghe(nome, operador_agregacao)')
        .eq('id_avaliacao_ghe_risco', idAvaliacaoGheRisco)
        .order('id_avaliacao_ghe_risco_regra', { ascending: true });
    if (erroRegras) throw erroRegras;

    const idsRegrasAvaliadas = (regras || []).map((r) => r.id_avaliacao_ghe_risco_regra);
    const { data: condicoes, error: erroCondicoes } = idsRegrasAvaliadas.length > 0
        ? await supabase
            .from('avaliacao_ghe_risco_condicao')
            .select('id_avaliacao_ghe_risco_regra, id_pergunta, id_opcao, tipo_metrica, parametro_metrica_utilizado, valor_metrica_calculado, base_calculo, operador_utilizado, valor_comparacao_utilizado, resultado, pergunta_avaliacao(codigo, texto_pergunta, categoria), opcao_resposta(rotulo)')
            .in('id_avaliacao_ghe_risco_regra', idsRegrasAvaliadas)
        : { data: [], error: null };
    if (erroCondicoes) throw erroCondicoes;

    const condicoesPorRegra = new Map();
    (condicoes || []).forEach((c) => {
        const lista = condicoesPorRegra.get(c.id_avaliacao_ghe_risco_regra) || [];
        lista.push({
            id_pergunta: c.id_pergunta,
            pergunta_codigo: c.pergunta_avaliacao?.codigo ?? null,
            pergunta_texto: c.pergunta_avaliacao?.texto_pergunta ?? null,
            pergunta_categoria: c.pergunta_avaliacao?.categoria ?? null,
            id_opcao: c.id_opcao,
            opcao_rotulo: c.opcao_resposta?.rotulo ?? null,
            tipo_metrica: c.tipo_metrica,
            parametro_metrica_utilizado: c.parametro_metrica_utilizado,
            valor_metrica_calculado: c.valor_metrica_calculado,
            base_calculo: c.base_calculo,
            operador_utilizado: c.operador_utilizado,
            valor_comparacao_utilizado: c.valor_comparacao_utilizado,
            resultado: c.resultado,
        });
        condicoesPorRegra.set(c.id_avaliacao_ghe_risco_regra, lista);
    });

    return (regras || []).map((r) => ({
        id_avaliacao_ghe_risco_regra: r.id_avaliacao_ghe_risco_regra,
        codigo: r.codigo_regra_snapshot,
        nome: r.regra_risco_ghe?.nome ?? null,
        operador_agregacao: r.regra_risco_ghe?.operador_agregacao ?? null,
        pontuacao_resultado_snapshot: r.pontuacao_resultado_snapshot,
        satisfeita: r.satisfeita,
        pontuacao_aplicada: r.pontuacao_aplicada,
        detalhe: r.detalhe,
        condicoes: condicoesPorRegra.get(r.id_avaliacao_ghe_risco_regra) || [],
    }));
}
