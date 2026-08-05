# DoubleRec Studio — Plano Técnico de Produto

> **Grave uma vez. Publique em qualquer lugar.**

> **Nota para quem for implementar (Claude Code / dev):** este documento é a fonte única de verdade do projeto. Ele foi reorganizado a partir do briefing original do produto para ser acionável: cada feature tem escopo, critério de aceite e fase de entrega. Comece pela **Fase 0 → Fase 1 (MVP)** e só avance para as fases seguintes depois que o MVP estiver funcionando e testado em pelo menos Chrome desktop, Chrome Android e Safari iOS.

---

## 1. Visão geral

Aplicação **web** (não app nativo) que grava vídeo pela câmera do dispositivo **uma única vez** e gera, simultaneamente, dois arquivos de saída:

- **Horizontal 16:9** — para YouTube.
- **Vertical 9:16** — para Reels, TikTok, Shorts.

Durante a gravação o usuário já visualiza os dois enquadramentos finais em tempo real (não é um crop feito depois, em pós-produção).

## 2. Público-alvo

| Segmento | Necessidade principal |
|---|---|
| Criadores de conteúdo (YouTube, Instagram, TikTok, Reels, Shorts) | Publicar rápido em múltiplos formatos |
| Empresas / Agências de marketing | Padronizar produção de vídeo em escala |
| Professores / Cursos online | Gravar aula uma vez, distribuir em vários canais |
| Podcasters / Lives gravadas | Gerar clipes verticais a partir da gravação principal |

## 3. Problema

Fluxo atual do criador de conteúdo:

```
Gravar horizontal → Editar → Crop → Gerar vertical → Editar de novo → Exportar → Publicar
```

Isso consome **20 a 40 minutos por vídeo**. O DoubleRec elimina as etapas de crop e reedição.

## 4. Solução (fluxo do usuário final)

1. Abrir o navegador.
2. Entrar no site (sem instalar nada — PWA opcional).
3. Permitir acesso à câmera.
4. Clicar em **REC**.
5. Parar a gravação.
6. Baixar/receber:
   - `video_youtube.mp4` (1080p, 16:9)
   - `video_reels.mp4` (1080p, 9:16)

---

## 5. Roadmap por fases

Esta é a mudança mais importante em relação ao documento original: o briefing listava **todas** as features no mesmo nível, sem indicar o que é essencial vs. o que é diferencial de longo prazo. Abaixo está a priorização sugerida.

### Fase 0 — Prova de conceito técnica (1–2 semanas)
Objetivo: validar que é tecnicamente viável gravar dois recortes simultâneos de um único stream de câmera, no navegador, com performance aceitável.

- [x] Capturar `getUserMedia` e desenhar o frame em dois `<canvas>` (um cortado em 16:9, outro em 9:16).
- [x] Gravar cada canvas com `MediaRecorder` (via `canvas.captureStream()`).
- [ ] Validar em: Chrome Desktop, Chrome Android, Safari iOS, Firefox Desktop.
- [ ] Medir: uso de CPU/GPU, drop de frames, tamanho de arquivo, sincronia de áudio entre os dois vídeos.
- **Critério de aceite:** dois arquivos `.mp4` sincronizados, gerados a partir de uma gravação de 60s, reproduzíveis fora do navegador.
- **Risco principal:** Safari/iOS tem suporte limitado a `MediaRecorder` e a controles manuais de câmera (ver seção 9). Se a Fase 0 falhar no Safari, decidir cedo se o MVP mira "Chromium-first" com Safari em modo degradado.

### Fase 1 — MVP
Objetivo: produto utilizável por um criador de conteúdo real, sem funcionalidades premium.

**Câmera e gravação**
- [x] Preview ao vivo dos dois enquadramentos (vertical e horizontal) lado a lado ou empilhados.
- [x] Botão REC / Stop.
- [x] Contador de tempo de gravação (`00:00:00`).
- [x] Escolha de câmera (frontal/traseira em mobile; seleção de device em desktop).
- [x] Escolha de microfone (interno, USB, Bluetooth/AirPods — conforme `enumerateDevices`).
- [x] Timer de início (3s / 5s / 10s).
- [x] Resolução: 720p, 1080p (2K/4K entram na Fase 2, dependem de performance).
- [x] FPS: 24, 30, 60.
- [x] Indicador de nível de áudio (VU meter simples).
- [x] Indicador de espaço/tempo restante (estimado, baseado em resolução/bitrate escolhidos e `navigator.storage.estimate()`).

**Crop / enquadramento**
- [x] Crop vertical **arrastável manualmente** sobre a imagem horizontal (o usuário posiciona a "janela" 9:16 dentro do frame 16:9 antes ou durante a gravação).
- [x] Grids de composição: 3x3, Center Cross, Safe Area.

**Exportação**
- [x] Ao finalizar, gerar e disponibilizar para download: `video_youtube.mp4` (16:9) e `video_reels.mp4` (9:16). *(A extensão real segue o suporte do navegador: `.webm` em Chromium/Firefox, `.mp4` no Safari.)*
- [x] Nome de arquivo customizável.

**Fora do MVP (explicitamente adiado):**
IA de reenquadramento automático, filtros/LUTs, ajustes de imagem (contraste, saturação etc.), controles manuais de ISO/shutter/WB, exportação para múltiplas redes simultaneamente, conta de usuário, armazenamento em nuvem, PWA instalável.

### Fase 2 — Diferenciais de câmera profissional
- [ ] Controles manuais **quando o navegador permitir** (ver seção 9): ISO, Shutter Speed, White Balance, Zoom (1x–3x, inclusive durante a gravação, via `zoom` constraint da `MediaStreamTrack` quando suportado).
- [ ] Foco automático / manual / touch-to-focus.
- [ ] Resoluções 2K e 4K (com aviso de espaço/performance).
- [ ] Bitrate configurável (Baixo/Médio/Alto/Ultra).
- [ ] Filtros estilo LUT: Cinema, Vlog, Vintage, Cold, Warm, Black&White, HDR, Log, Flat, Instagram, TikTok — aplicados via shader/CSS filter no canvas antes da gravação.
- [ ] Ajustes manuais: Contraste, Saturação, Nitidez, Highlights, Shadows, Exposure, Temperature, Tint, Hue, Vibrance.

### Fase 3 — IA de enquadramento
- [ ] Modo automático: detectar pessoa/rosto/olhos/corpo (MediaPipe / TensorFlow.js) e manter o crop vertical centralizado dinamicamente enquanto a pessoa se move.
- [ ] Modo Produto: acompanhar um objeto (unboxing, demonstração) em vez de rosto.
- [ ] Modo Podcast: detectar duas pessoas e ajustar dinamicamente o enquadramento vertical (split ou alternância de foco por quem fala).
- **Critério de aceite:** reenquadramento a ≥24fps sem travar a gravação principal (rodar a inferência em Web Worker / OffscreenCanvas).

### Fase 4 — Exportação avançada e Safe Zones
- [ ] Exportar já nos formatos/dimensões de: TikTok, Instagram, Facebook, LinkedIn, Pinterest, YouTube Shorts.
- [ ] **Safe Zones**: overlay durante a gravação/preview mostrando onde cada rede social sobrepõe legendas, botões e barras de UI, para o usuário não perder informação importante no crop.

### Fase 5 — SaaS / Premium
- [ ] Contas de usuário (Supabase Auth).
- [ ] Histórico de gravações + armazenamento em nuvem.
- [ ] Exportação em 4K liberada só no plano pago.
- [ ] Legendas automáticas (transcrição).
- [ ] Remoção de ruído do áudio.
- [ ] Publicação direta (API) em YouTube, TikTok, Instagram, LinkedIn.
- [ ] Templates por tipo de conteúdo (podcast, unboxing, aula, vlog).
- [ ] PWA instalável (manifest + service worker), útil principalmente para reduzir fricção de acesso recorrente.

---

## 6. Arquitetura técnica

```
Usuário
  ↓
Câmera (getUserMedia / WebRTC)
  ↓
Frame Buffer (vídeo <video> element, não exibido, só como fonte)
  ↓
Pipeline de processamento (por frame, via requestVideoFrameCallback)
  │
  ├── Canvas A: crop 16:9 → captureStream() → MediaRecorder → encoder → arquivo MP4 (youtube.mp4)
  │
  └── Canvas B: crop 9:16 → captureStream() → MediaRecorder → encoder → arquivo MP4 (reels.mp4)
```

Pontos de atenção arquiteturais:
- **Um único `getUserMedia`/`MediaStream` de origem.** Os dois canvases leem do mesmo `<video>`/frame, evitando abrir a câmera duas vezes.
- **Áudio**: capturar uma vez e anexar aos dois `captureStream()` (ou mixar via `AudioContext` se for preciso aplicar remoção de ruído no futuro).
- **Sincronização**: como os dois `MediaRecorder` começam a partir do mesmo frame de referência, iniciar/parar ambos no mesmo tick evita drift perceptível em gravações curtas/médias. Validar drift em gravações longas (>15 min) na Fase 0.
- **WebCodecs**: usar quando disponível para reduzir custo de CPU de encoding e ganhar controle fino de bitrate/qualidade; fallback para `MediaRecorder` puro quando não suportado.
- **Processamento local**: tudo roda no navegador do usuário — sem custo de servidor para o processamento de vídeo em si, e com benefício de privacidade (vídeo não trafega para um servidor, exceto se o usuário optar por salvar na nuvem no plano SaaS).

## 7. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React, Next.js, TypeScript |
| UI | Tailwind CSS, Framer Motion |
| Vídeo | WebRTC, MediaRecorder, Canvas API, OffscreenCanvas, WebCodecs (quando disponível), WebAssembly |
| IA | MediaPipe, TensorFlow.js |
| Backend | Node.js |
| Banco / Auth / Storage | Supabase |

## 8. Interface (referência visual)

Inspiração: câmera nativa do iPhone + Blackmagic Camera App. Estética limpa, controles discretos nas bordas, foco total no preview.

```
┌──────────────────────────────────────────────────┐
│  DualCam Studio                    [Configurações]│
│  ┌────────────────────┐                           │
│  │                    │                           │
│  │       9:16         │                           │
│  │                    │                           │
│  └────────────────────┘                           │
│  ┌────────────────────────────────────────────┐   │
│  │                                              │   │
│  │                  16:9                        │   │
│  │                                              │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│   ISO   WB   FPS   ZOOM   EXP   LUT                │
│   ─────────────────────────────────────            │
│                    ● REC                           │
└──────────────────────────────────────────────────┘
```

Elementos de HUD, do MVP em diante:
- Contador de gravação (`REC 00:03:15`).
- Espaço restante (`4K · 31 minutos restantes` — estimado).
- Nível de áudio (VU meter).
- Grid overlay (3x3 / 4x4 / Golden Ratio / Center Cross / Safe Area).

---

## 9. Restrição técnica crítica: controles manuais de câmera na Web

**Isso precisa ser comunicado ao usuário final e tratado no design desde o MVP, não deixado para depois.**

Nem todo navegador expõe controle de ISO, shutter speed, foco e white balance via `MediaStreamTrack.applyConstraints()`. Na prática:

- **Chrome/Chromium em Android**: parcialmente suportado (zoom, foco e alguns ajustes de exposição via `ImageCapture` API / constraints, varia por device).
- **Chrome Desktop**: suporte bem mais limitado (webcams não expõem a maioria desses controles).
- **Safari iOS**: **não expõe** controles manuais de ISO/shutter/WB. Zoom e foco são bem mais restritos.

**Estratégia recomendada (aplicar desde a Fase 1/2):**
1. Fazer feature detection em runtime (`track.getCapabilities()`).
2. Se o controle existir → mostrar o slider/opção real na UI.
3. Se não existir → ocultar o controle (não mostrar desabilitado sem explicação) e deixar a câmera em modo automático.
4. Nunca travar a experiência: o app deve funcionar 100% em modo automático em qualquer navegador, com os controles manuais como "bônus" quando disponíveis.

## 10. Estrutura de pastas sugerida (Next.js)

```
doublerec-studio/
├── app/
│   ├── (studio)/
│   │   ├── page.tsx                # tela principal de gravação
│   │   └── layout.tsx
│   └── api/                        # rotas backend (Fase 5: auth, upload, publish)
├── components/
│   ├── camera/
│   │   ├── CameraPreview.tsx
│   │   ├── DualCanvasRenderer.tsx  # coração do pipeline: 2 canvases a partir de 1 stream
│   │   ├── CropOverlay.tsx         # crop vertical arrastável
│   │   └── SafeZoneOverlay.tsx
│   ├── controls/
│   │   ├── CameraSettingsBar.tsx   # ISO/WB/FPS/ZOOM/EXP/LUT
│   │   ├── AudioMeter.tsx
│   │   └── RecordButton.tsx
│   └── export/
│       └── ExportPanel.tsx
├── lib/
│   ├── media/
│   │   ├── useCameraStream.ts      # getUserMedia + capability detection
│   │   ├── useDualRecorder.ts      # 2x MediaRecorder sincronizados
│   │   └── capabilities.ts         # feature detection (ISO/shutter/WB/zoom)
│   └── ai/
│       └── useAutoReframe.ts       # MediaPipe/TF.js — Fase 3
├── public/
└── PROJETO-doublerec-plano-tecnico.md   # este arquivo
```

## 11. Métricas de sucesso do MVP

- Tempo do "abrir o site" até "ter os 2 arquivos baixados" ≤ tempo de gravação + 10 segundos de processamento.
- Funciona sem travar em: Chrome Desktop, Chrome Android, Safari iOS (modo automático).
- Sincronia de áudio/vídeo perceptivelmente correta em gravações de até 10 minutos.
- Zero dependência de servidor para o pipeline de gravação/crop/export do MVP.

## 12. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Drift de sincronismo entre os 2 `MediaRecorder` em gravações longas | Testar cedo (Fase 0); considerar recodificar/realinhar no fechamento do arquivo se necessário |
| Safari/iOS com suporte fraco a `MediaRecorder`/codecs | Definir fallback de formato (ex.: `video/mp4` vs `video/webm`) e testar prioritariamente nesse ambiente |
| Performance da IA de reframe em tempo real (Fase 3) | Rodar inferência em Web Worker/OffscreenCanvas; degradar para crop fixo se FPS cair abaixo do aceitável |
| Espaço em disco / memória em gravações 4K longas | Gravar em chunks (`MediaRecorder.ondataavailable` com `timeslice`) em vez de acumular tudo em memória |

---

## 13. Diferenciais competitivos (visão de produto)

O grande diferencial não é apenas gerar dois vídeos, mas oferecer uma experiência de gravação pensada para quem cria conteúdo em múltiplas plataformas simultaneamente:

- **Safe Zones** — mostrar onde cada rede social sobrepõe legendas/botões/barras.
- **Auto Reframe com IA** — manter pessoas/produtos centralizados automaticamente no vertical.
- **Modo Podcast** — duas pessoas, enquadramento vertical dinâmico.
- **Modo Produto** — seguir um objeto em vez de um rosto.
- **Gravação local** — processamento no navegador sempre que possível (privacidade + custo zero de infraestrutura).
- **PWA** — instalável sem App Store/Play Store.

---

## 14. Como começar (instruções diretas para o Claude Code)

1. Ler este documento inteiro antes de escrever qualquer código.
2. Fazer a **Fase 0** primeiro, isolada, como um protótipo mínimo (`app/(studio)/page.tsx` simples com dois canvases), e reportar de volta o resultado dos testes cross-browser antes de avançar.
3. Só depois de validada a Fase 0, montar o scaffold completo do Next.js seguindo a estrutura de pastas da seção 10.
4. Implementar a Fase 1 (MVP) por completo, feature por feature, marcando os checkboxes deste documento conforme for concluindo.
5. Não implementar nada de Fase 2 em diante sem o MVP estar testado e funcional.
6. Sempre que uma feature depender de uma API do navegador com suporte parcial (câmera manual, zoom, foco), aplicar a estratégia de feature detection da seção 9 — nunca assumir que a API existe.
