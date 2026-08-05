/**
 * Credenciais do Supabase.
 *
 * São valores públicos por natureza — a "publishable key" (antiga "anon key")
 * é feita para ser exposta no navegador, protegida pelas políticas de RLS do
 * Supabase, não pelo sigilo da chave. Por isso ficam com um fallback fixo
 * aqui: assim o app funciona mesmo se a plataforma de hospedagem não tiver
 * repassado as variáveis NEXT_PUBLIC_* no momento do build (eram inlined
 * pelo Next.js em tempo de build; se ausentes, viram `undefined` no bundle).
 *
 * Para apontar para outro projeto Supabase, defina NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente — elas têm prioridade
 * sobre os valores abaixo.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://fzqzpqpglexxuvldnkwq.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ze81G5jk6Y6yBc6-1t5plA_1VdllZ_E";
