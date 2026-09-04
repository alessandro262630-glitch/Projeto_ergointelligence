// Home (index.html) - pagina de apresentacao para a Feira Tecnica.
// Somente navegacao/apresentacao: nenhuma regra de negocio, nenhum acesso
// direto ao Supabase. O botao "Ver resultado de exemplo" apenas monta um
// link para resultado.html, que continua responsavel por carregar tudo.
import { DEMO_CONFIG } from '../config/demo.js';

function iniciarLinksResultadoDemo() {
    const links = document.querySelectorAll('[data-demo-resultado-link]');
    const aviso = document.getElementById('aviso-resultado-demo');
    const idDemo = DEMO_CONFIG.avaliacaoResultadoExemploId;
    const configurado = Number.isInteger(idDemo) && idDemo > 0;

    links.forEach((link) => {
        if (configurado) {
            link.href = `resultado.html?id_avaliacao=${idDemo}`;
            link.classList.remove('disabled');
            link.removeAttribute('aria-disabled');
            link.removeAttribute('tabindex');
        } else {
            link.href = '#';
            link.classList.add('disabled');
            link.setAttribute('aria-disabled', 'true');
            link.setAttribute('tabindex', '-1');
        }
    });

    if (aviso) {
        aviso.hidden = configurado;
    }

    if (!configurado) {
        console.info('Modo Demonstração: resultado de exemplo ainda não configurado (js/config/demo.js).');
    }
}

iniciarLinksResultadoDemo();
