// Layout raiz: idioma pt-BR, tokens visuais (seção 16) e noindex por padrão (assunção 24.8). Página
// inicial, privacidade e termos sobrepõem com index (v0.5, bug B-03).
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
