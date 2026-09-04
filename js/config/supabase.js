// Cliente Supabase do ErgoIntelligence (MVP).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

//credenciais do SupaBase para a criação do client
const SUPABASE_URL = 'https://sasibzqcbssxkzhpozdh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XaPhsUlMAJTOykwqewIXSQ_DIktdq79';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
