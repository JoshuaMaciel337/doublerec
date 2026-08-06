import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DoubleRec Studio",
    short_name: "DoubleRec",
    description:
      "Grave uma vez e publique em qualquer lugar: cada captura sai em 16:9 e 9:16 ao mesmo tempo.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // a tela fica fixa e quem gira é o aparelho: o enquadramento deitado é
    // resolvido pelo botão de giro, não pela rotação da interface
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["photo", "video", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
