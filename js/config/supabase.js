// Cliente Supabase do ErgoIntelligence (MVP).
// Projeto estatico, sem bundler: a biblioteca e carregada via ES Module a
// partir do CDN (jsDelivr +esm), sem npm/Node como requisito do frontend.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Valores de Project Settings > API no painel do Supabase. SUPABASE_ANON_KEY
// e a chave publica (anon/publishable), segura para uso no navegador
// (protegida por RLS). NUNCA usar aqui service_role, senha do banco ou
// qualquer outro segredo administrativo.
const SUPABASE_URL = 'https://sasibzqcbssxkzhpozdh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XaPhsUlMAJTOykwqewIXSQ_DIktdq79';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
