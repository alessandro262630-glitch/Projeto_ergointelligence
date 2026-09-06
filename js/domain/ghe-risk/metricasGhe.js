// Motor de Risco do GHE - Camada 3 (Metricas de Evidencia).
// MVP-08B - fundacao fisica. Logica pura: recebe estruturas JavaScript
// (respostas ja carregadas de resposta_coleta/resposta_coleta_opcao pelo
// service), retorna estruturas JavaScript. NAO importa Supabase, NAO
// manipula DOM, NAO consulta o banco - a leitura de dados e
// responsabilidade exclusiva de js/services/motorRiscoGheService.js.
//
// Cada funcao de metrica retorna sempre { valor, baseCalculo } - nunca
// so o valor (secao 35 do prompt MVP-08B): toda metrica percentual/
// numerica precisa do "n" para nao induzir falsa precisao na
// rastreabilidade (ver docs/mvp08a-arquitetura-motor-risco-ghe.md,
// secao "Riscos Arquiteturais").
//
// Nenhuma metrica arredonda o resultado - arredondamento e
// responsabilidade de apresentacao (pagina), nunca do dominio (secao 36
// do prompt): 66.6667 chega inteiro ate o avaliador de condicao.

function erroMetrica(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.code = codigo;
    return erro;
}

// Tipos de metrica atualmente operacionais (secao 17 do prompt MVP-08B).
// PERCENTUAL_ACIMA_DE_OPCAO fica de fora deliberadamente: pendencia
// metodologica (ordem vs valor_numero como base de "acima" em ESCALA -
// ver docs/mvp08a-arquitetura-motor-risco-ghe.md).
export const TIPOS_METRICA_SUPORTADOS = [
    'CONTAGEM_TRUE', 'CONTAGEM_FALSE', 'PERCENTUAL_TRUE', 'PERCENTUAL_FALSE',
    'CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO',
    'MEDIA_VALOR_OPCAO', 'MAXIMO_VALOR_OPCAO', 'MINIMO_VALOR_OPCAO',
    'MEDIA_NUMERICA', 'MINIMO_NUMERICO', 'MAXIMO_NUMERICO',
    'PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR',
    'CONTAGEM_RESPOSTAS',
];

// Metricas cujo calculo exige um id_opcao (a opcao-alvo) e metricas cujo
// calculo exige um parametro numerico livre - usado tanto aqui quanto
// por validacaoConfiguracaoGhe.js, mantidos num unico lugar para nunca
// divergir entre validacao e calculo.
export const METRICAS_QUE_EXIGEM_OPCAO = ['CONTAGEM_OPCAO', 'PERCENTUAL_OPCAO'];
export const METRICAS_QUE_EXIGEM_PARAMETRO = ['PERCENTUAL_ACIMA_DE_VALOR', 'PERCENTUAL_ABAIXO_DE_VALOR'];

// "Vazio" aqui segue exatamente a mesma semantica ja estabelecida em
// respostaColetaService.js/consolidacaoGheService.js: false e 0 sao
// respostas validas, nunca tratadas como ausencia de resposta.
function respostaColetaPreenchida(tipoResposta, resposta) {
    if (!resposta) return false;
    switch (tipoResposta) {
        case 'BOOLEANO':
            return resposta.respostaBooleano === true || resposta.respostaBooleano === false;
        case 'NUMERICO':
            return typeof resposta.respostaNumero === 'number' && !Number.isNaN(resposta.respostaNumero);
        case 'ESCALA':
        case 'ESCOLHA_UNICA':
            return Array.isArray(resposta.opcoes) && resposta.opcoes.length === 1;
        case 'ESCOLHA_MULTIPLA':
            return Array.isArray(resposta.opcoes) && resposta.opcoes.length > 0;
        default:
            return false;
    }
}

function percentual(quantidade, base) {
    return base > 0 ? (quantidade / base) * 100 : 0;
}

// --- BOOLEANO -----------------------------------------------------------------

export function calcularContagemTrue(respostas) {
    const respondidas = respostas.filter((r) => respostaColetaPreenchida('BOOLEANO', r));
    const valor = respondidas.filter((r) => r.respostaBooleano === true).length;
    return { valor, baseCalculo: respondidas.length };
}

export function calcularContagemFalse(respostas) {
    const respondidas = respostas.filter((r) => respostaColetaPreenchida('BOOLEANO', r));
    const valor = respondidas.filter((r) => r.respostaBooleano === false).length;
    return { valor, baseCalculo: respondidas.length };
}

export function calcularPercentualTrue(respostas) {
    const { valor: contagem, baseCalculo } = calcularContagemTrue(respostas);
    return { valor: percentual(contagem, baseCalculo), baseCalculo };
}

export function calcularPercentualFalse(respostas) {
    const { valor: contagem, baseCalculo } = calcularContagemFalse(respostas);
    return { valor: percentual(contagem, baseCalculo), baseCalculo };
}

// --- ESCALA / ESCOLHA_UNICA / ESCOLHA_MULTIPLA (por opcao) ---------------------
// A base de PERCENTUAL_OPCAO e o total de respostas preenchidas para a
// pergunta (nao a soma de selecoes) - em ESCOLHA_MULTIPLA a soma dos
// percentuais de todas as opcoes pode ultrapassar 100%, exatamente como
// ja documentado em consolidacaoGheService.js. Isso nunca e "corrigido".

export function calcularContagemOpcao(respostas, idOpcao, tipoResposta) {
    const respondidas = respostas.filter((r) => respostaColetaPreenchida(tipoResposta, r));
    const valor = respondidas.filter((r) => (r.opcoes || []).some((o) => o.idOpcao === idOpcao)).length;
    return { valor, baseCalculo: respondidas.length };
}

export function calcularPercentualOpcao(respostas, idOpcao, tipoResposta) {
    const { valor: contagem, baseCalculo } = calcularContagemOpcao(respostas, idOpcao, tipoResposta);
    return { valor: percentual(contagem, baseCalculo), baseCalculo };
}

// MEDIA/MAXIMO/MINIMO_VALOR_OPCAO exigem que TODAS as opcoes da pergunta
// tenham valor_numero preenchido (secao 33 do prompt MVP-08B) - nunca
// usar `ordem` como substituto silencioso quando valor_numero faltar.
// `opcoesDaPergunta` e o catalogo completo de opcao_resposta ativas
// desta pergunta (nao so as selecionadas), para essa checagem ser
// possivel.
function garantirValorNumericoCompleto(opcoesDaPergunta) {
    const semValor = (opcoesDaPergunta || []).some((o) => o.valorNumero === null || o.valorNumero === undefined);
    if (semValor || !opcoesDaPergunta || opcoesDaPergunta.length === 0) {
        throw erroMetrica(
            'Esta métrica exige que todas as opções da pergunta tenham valor_numero preenchido.',
            'METRICA_INDISPONIVEL',
        );
    }
}

function valoresNumericosSelecionados(respostas, tipoResposta) {
    const respondidas = respostas.filter((r) => respostaColetaPreenchida(tipoResposta, r));
    const valores = [];
    respondidas.forEach((r) => {
        (r.opcoes || []).forEach((o) => {
            if (typeof o.valorNumero === 'number' && !Number.isNaN(o.valorNumero)) {
                valores.push(o.valorNumero);
            }
        });
    });
    return { valores, baseCalculo: respondidas.length };
}

export function calcularMediaValorOpcao(respostas, tipoResposta, opcoesDaPergunta) {
    garantirValorNumericoCompleto(opcoesDaPergunta);
    const { valores, baseCalculo } = valoresNumericosSelecionados(respostas, tipoResposta);
    if (valores.length === 0) {
        return { valor: null, baseCalculo };
    }
    const soma = valores.reduce((acc, v) => acc + v, 0);
    return { valor: soma / valores.length, baseCalculo };
}

export function calcularMaximoValorOpcao(respostas, tipoResposta, opcoesDaPergunta) {
    garantirValorNumericoCompleto(opcoesDaPergunta);
    const { valores, baseCalculo } = valoresNumericosSelecionados(respostas, tipoResposta);
    return { valor: valores.length > 0 ? Math.max(...valores) : null, baseCalculo };
}

export function calcularMinimoValorOpcao(respostas, tipoResposta, opcoesDaPergunta) {
    garantirValorNumericoCompleto(opcoesDaPergunta);
    const { valores, baseCalculo } = valoresNumericosSelecionados(respostas, tipoResposta);
    return { valor: valores.length > 0 ? Math.min(...valores) : null, baseCalculo };
}

// --- NUMERICO -------------------------------------------------------------------

function valoresNumericosDiretos(respostas) {
    return respostas
        .filter((r) => respostaColetaPreenchida('NUMERICO', r))
        .map((r) => r.respostaNumero);
}

export function calcularMediaNumerica(respostas) {
    const valores = valoresNumericosDiretos(respostas);
    if (valores.length === 0) {
        return { valor: null, baseCalculo: 0 };
    }
    const soma = valores.reduce((acc, v) => acc + v, 0);
    return { valor: soma / valores.length, baseCalculo: valores.length };
}

export function calcularMinimoNumerico(respostas) {
    const valores = valoresNumericosDiretos(respostas);
    return { valor: valores.length > 0 ? Math.min(...valores) : null, baseCalculo: valores.length };
}

export function calcularMaximoNumerico(respostas) {
    const valores = valoresNumericosDiretos(respostas);
    return { valor: valores.length > 0 ? Math.max(...valores) : null, baseCalculo: valores.length };
}

// PERCENTUAL_ACIMA/ABAIXO_DE_VALOR sao metricas PARAMETRIZADAS: o
// `parametro` (o valor de corte, ex.: 4) e usado para CALCULAR a
// metrica - nunca confundir com o `valor_comparacao` da condicao, que so
// entra depois, no avaliador (js/domain/ghe-risk/avaliadorGhe.js). Ver
// exemplo obrigatorio em docs/mvp08a-arquitetura-motor-risco-ghe.md.
export function calcularPercentualAcimaDeValor(respostas, parametro) {
    if (parametro === null || parametro === undefined || Number.isNaN(Number(parametro))) {
        throw erroMetrica('PERCENTUAL_ACIMA_DE_VALOR exige um parâmetro numérico.', 'PARAMETRO_METRICA_AUSENTE');
    }
    const valores = valoresNumericosDiretos(respostas);
    const acima = valores.filter((v) => v > Number(parametro)).length;
    return { valor: percentual(acima, valores.length), baseCalculo: valores.length };
}

export function calcularPercentualAbaixoDeValor(respostas, parametro) {
    if (parametro === null || parametro === undefined || Number.isNaN(Number(parametro))) {
        throw erroMetrica('PERCENTUAL_ABAIXO_DE_VALOR exige um parâmetro numérico.', 'PARAMETRO_METRICA_AUSENTE');
    }
    const valores = valoresNumericosDiretos(respostas);
    const abaixo = valores.filter((v) => v < Number(parametro)).length;
    return { valor: percentual(abaixo, valores.length), baseCalculo: valores.length };
}

// --- UNIVERSAL --------------------------------------------------------------------
// Aplicavel a qualquer tipo_resposta, inclusive TEXTO (so como metadado -
// nenhuma metrica de risco existe para TEXTO, secao 14 do prompt
// MVP-08A). `tipoResposta` decide o criterio de "preenchida".
export function calcularContagemRespostas(respostas, tipoResposta) {
    const valor = respostas.filter((r) => respostaColetaPreenchida(tipoResposta, r)).length;
    return { valor, baseCalculo: valor };
}

// --- Dispatcher unico ------------------------------------------------------------
// Ponto de entrada usado pelo avaliador de condicao (Camada 4): decide a
// funcao de calculo a partir do tipo_metrica REAL da condicao - nunca
// confia em qual funcao "parece certa" no ponto de chamada.
//
// contexto: { respostas, tipoResposta, opcoesDaPergunta, idOpcao, parametroMetrica }
//   respostas: array de respostas (uma por coleta concluida) desta pergunta
//   tipoResposta: pergunta_avaliacao.tipo_resposta (BOOLEANO/NUMERICO/ESCALA/...)
//   opcoesDaPergunta: catalogo completo de opcao_resposta ativas da pergunta
//   idOpcao: obrigatorio para CONTAGEM_OPCAO/PERCENTUAL_OPCAO
//   parametroMetrica: obrigatorio para PERCENTUAL_ACIMA/ABAIXO_DE_VALOR
export function calcularMetrica(tipoMetrica, contexto) {
    const { respostas, tipoResposta, opcoesDaPergunta, idOpcao, parametroMetrica } = contexto;

    if (!TIPOS_METRICA_SUPORTADOS.includes(tipoMetrica)) {
        throw erroMetrica(`Métrica não suportada pelo Motor GHE: ${tipoMetrica}`, 'METRICA_NAO_SUPORTADA');
    }

    switch (tipoMetrica) {
        case 'CONTAGEM_TRUE':
            return calcularContagemTrue(respostas);
        case 'CONTAGEM_FALSE':
            return calcularContagemFalse(respostas);
        case 'PERCENTUAL_TRUE':
            return calcularPercentualTrue(respostas);
        case 'PERCENTUAL_FALSE':
            return calcularPercentualFalse(respostas);
        case 'CONTAGEM_OPCAO':
            return calcularContagemOpcao(respostas, idOpcao, tipoResposta);
        case 'PERCENTUAL_OPCAO':
            return calcularPercentualOpcao(respostas, idOpcao, tipoResposta);
        case 'MEDIA_VALOR_OPCAO':
            return calcularMediaValorOpcao(respostas, tipoResposta, opcoesDaPergunta);
        case 'MAXIMO_VALOR_OPCAO':
            return calcularMaximoValorOpcao(respostas, tipoResposta, opcoesDaPergunta);
        case 'MINIMO_VALOR_OPCAO':
            return calcularMinimoValorOpcao(respostas, tipoResposta, opcoesDaPergunta);
        case 'MEDIA_NUMERICA':
            return calcularMediaNumerica(respostas);
        case 'MINIMO_NUMERICO':
            return calcularMinimoNumerico(respostas);
        case 'MAXIMO_NUMERICO':
            return calcularMaximoNumerico(respostas);
        case 'PERCENTUAL_ACIMA_DE_VALOR':
            return calcularPercentualAcimaDeValor(respostas, parametroMetrica);
        case 'PERCENTUAL_ABAIXO_DE_VALOR':
            return calcularPercentualAbaixoDeValor(respostas, parametroMetrica);
        case 'CONTAGEM_RESPOSTAS':
            return calcularContagemRespostas(respostas, tipoResposta);
        default:
            throw erroMetrica(`Métrica não suportada pelo Motor GHE: ${tipoMetrica}`, 'METRICA_NAO_SUPORTADA');
    }
}
