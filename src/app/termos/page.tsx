// [Público] Termos de uso — spec v0.5, épico 8.12. Texto em copy.legal.termsSections.
import { LegalPage } from "@/components/legal/legal-page";
import { copy } from "@/lib/copy";

export default function TermsPage() {
  return <LegalPage title={copy.legal.terms} sections={copy.legal.termsSections} />;
}
