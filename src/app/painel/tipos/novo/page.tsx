// [Dono] Novo tipo — seção 10 e épico 8.2: editor com os defaults de 7.3 já preenchidos.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BackToList, EventTypeForm, NEW_TYPE_DEFAULTS } from "@/features/event-types/components/event-type-form";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import styles from "../../painel.module.css";

// Lê a conta (para o prefixo do endereço) e mostra o editor vazio.
async function NewTypeForm() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  return <EventTypeForm id={null} initial={NEW_TYPE_DEFAULTS} siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""} accountSlug={account.slug} />;
}

// Página: link de volta, título "Novo tipo" e o editor.
export default function NewEventTypePage() {
  return (
    <>
      <BackToList />
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{copy.eventTypeForm.titleNew}</h1>
      </div>
      <Suspense fallback={null}>
        <NewTypeForm />
      </Suspense>
    </>
  );
}
