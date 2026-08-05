import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sem páginas com ISR/SSG que dependam de cache persistente no MVP,
// então usamos a configuração padrão (sem incremental cache em R2).
export default defineCloudflareConfig();
