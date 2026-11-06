// Casca das páginas públicas da conta (/{slug}, /{slug}/{tipo}, confirmado): o conteúdo e, no
// rodapé, o link "Privacidade" exigido pela seção 20 (com o contato desta conta) e os Termos (v0.5).
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";

// Link do rodapé com o slug da página (params é dado de requisição: fica dentro de <Suspense>).
async function PrivacyLink({ params }: { params: LayoutProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  return <Link href={`/privacidade?de=${encodeURIComponent(slug)}`}>{copy.privacy.link}</Link>;
}

export default function PublicAccountLayout({ children, params }: LayoutProps<"/[slug]">) {
  return (
    <>
      {children}
      <footer className={styles.footer}>
        <Suspense fallback={null}>
          <PrivacyLink params={params} />
        </Suspense>
        {" · "}
        <Link href="/termos">{copy.legal.terms}</Link>
      </footer>
    </>
  );
}
