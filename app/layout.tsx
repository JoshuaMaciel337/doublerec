import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DoubleRec Studio",
  description:
    "Grave uma vez. Publique em qualquer lugar. Dois vídeos (16:9 e 9:16) a partir de uma única gravação, direto no navegador.",
  applicationName: "DoubleRec",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DoubleRec",
    statusBarStyle: "black",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-zinc-100">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
