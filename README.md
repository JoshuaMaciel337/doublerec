# DoubleRec Studio

> Grave uma vez. Publique em qualquer lugar.

Aplicação web que grava vídeo pela câmera do dispositivo **uma única vez** e gera, simultaneamente, dois arquivos: **horizontal 16:9** (YouTube) e **vertical 9:16** (Reels, TikTok, Shorts). Todo o processamento acontece no navegador — nada é enviado a servidores.

O plano completo do produto está em [PROJETO-doublerec-plano-tecnico.md](PROJETO-doublerec-plano-tecnico.md).

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no Chrome e permita o acesso à câmera e ao microfone.

## Autenticação

O app é protegido por login (Supabase Auth, e-mail/senha). Sem sessão válida, qualquer rota redireciona para `/login` — a checagem acontece no `proxy.ts` (redirecionamento) e no layout do estúdio no servidor (proteção real). As credenciais de conexão ficam em `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Os usuários são criados no painel do Supabase (Authentication → Users). Para sair, use o botão de logout na barra superior do estúdio.

> A API de câmera (`getUserMedia`) só funciona em contexto seguro: `localhost` ou HTTPS. Para testar no celular na mesma rede, use um túnel HTTPS (ex.: `npx ngrok http 3000`) ou configure certificado local.

## Como usar

1. Permita o acesso à câmera e ao microfone.
2. Arraste a janela **9:16** sobre o preview horizontal para escolher o enquadramento vertical.
3. Ajuste resolução, FPS, timer de início, câmera e microfone na engrenagem (canto superior direito).
4. Clique no botão vermelho para gravar e novamente para parar.
5. Baixe os dois arquivos no painel de exportação.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- WebRTC (`getUserMedia`), Canvas API, `MediaRecorder`, `canvas.captureStream()`

## Formato dos arquivos

O formato de saída segue o suporte nativo do navegador: `.mp4` no Safari e `.webm` em navegadores Chromium/Firefox. Conversão garantida para MP4 (via WebCodecs/muxer) está planejada para uma fase futura.
