// [Público] Termos de uso — spec v0.5, épico 8.12. Texto em copy.legal.termsSections.
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { copy } from "@/lib/copy";

// Página institucional: legível por robôs (bug B-03, revisão do OAuth do Google). O layout raiz
// continua noindex para o resto do app.
export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function TermsPage() {
  return <LegalPage title={copy.legal.terms} sections={copy.legal.termsSections} />;
}
