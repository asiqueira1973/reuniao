// Layout raiz: idioma pt-BR, tokens visuais (seção 16) e noindex em todas as páginas (assunção 24.8).
import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.appName,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
