// Home (index.html) - fundo animado do hero: rede de particulas em
// movimento lento, estilo "tech", puramente decorativo (canvas com
// aria-hidden, sem interatividade). Vanilla JS + Canvas 2D, sem biblioteca
// externa - mesmo principio de dependencia minima do resto do projeto
// (ver FEIRA-03: unica biblioteca grafica do sistema e o ECharts do
// Dashboard; esta animacao nao e um grafico de dados, entao nem isso se
// aplica aqui). Respeita prefers-reduced-motion e pausa quando a aba
// esta em segundo plano, para nao gastar CPU/bateria a toa.

const canvas = document.getElementById('hero-canvas');
const preferemMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canvas && !preferemMenosMovimento) {
    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.home-hero');

    const COR_PONTO = 'rgba(34, 211, 199, 0.9)'; // ciano da marca (glow da coluna no logo)
    const COR_LINHA = 'rgba(15, 123, 140, 0.35)'; // teal da marca
    const DISTANCIA_MAXIMA_LINHA = 170;
    const VELOCIDADE_MAXIMA = 0.35;

    let largura = 0;
    let altura = 0;
    let particulas = [];
    let animando = false;
    let idQuadro = null;

    // Densidade proporcional a area, com piso/teto para nao pesar em telas
    // grandes (TV/monitor da feira) nem ficar vazio em telas pequenas.
    function contarParticulas() {
        const area = largura * altura;
        return Math.max(35, Math.min(110, Math.round(area / 9000)));
    }

    function criarParticulas() {
        particulas = Array.from({ length: contarParticulas() }, () => ({
            x: Math.random() * largura,
            y: Math.random() * altura,
            vx: (Math.random() - 0.5) * VELOCIDADE_MAXIMA,
            vy: (Math.random() - 0.5) * VELOCIDADE_MAXIMA,
            raio: 1.5 + Math.random() * 2,
        }));
    }

    function redimensionar() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        largura = hero.clientWidth;
        altura = hero.clientHeight;
        canvas.width = largura * dpr;
        canvas.height = altura * dpr;
        canvas.style.width = `${largura}px`;
        canvas.style.height = `${altura}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        criarParticulas();
    }

    function desenharQuadro() {
        ctx.clearRect(0, 0, largura, altura);

        particulas.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            // Ricocheteia nas bordas do hero, mantendo a particula sempre visivel.
            if (p.x <= 0 || p.x >= largura) p.vx *= -1;
            if (p.y <= 0 || p.y >= altura) p.vy *= -1;
            p.x = Math.max(0, Math.min(largura, p.x));
            p.y = Math.max(0, Math.min(altura, p.y));
        });

        // Linhas de conexao entre particulas proximas (efeito "rede/circuito").
        for (let i = 0; i < particulas.length; i += 1) {
            for (let j = i + 1; j < particulas.length; j += 1) {
                const a = particulas[i];
                const b = particulas[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distancia = Math.sqrt((dx * dx) + (dy * dy));
                if (distancia < DISTANCIA_MAXIMA_LINHA) {
                    ctx.globalAlpha = 1 - (distancia / DISTANCIA_MAXIMA_LINHA);
                    ctx.strokeStyle = COR_LINHA;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;

        particulas.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
            ctx.fillStyle = COR_PONTO;
            ctx.shadowColor = COR_PONTO;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        if (animando) {
            idQuadro = requestAnimationFrame(desenharQuadro);
        }
    }

    function iniciar() {
        if (animando) return;
        animando = true;
        idQuadro = requestAnimationFrame(desenharQuadro);
    }

    function pausar() {
        animando = false;
        if (idQuadro) cancelAnimationFrame(idQuadro);
    }

    redimensionar();
    iniciar();

    window.addEventListener('resize', redimensionar);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pausar();
        else iniciar();
    });
}
