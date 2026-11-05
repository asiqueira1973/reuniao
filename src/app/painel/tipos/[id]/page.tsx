// [Dono] Editar tipo — seção 10 e épico 8.2. Tipo de outra conta, excluído ou id inválido → 404.
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackToList, EventTypeForm } from "@/features/event-types/components/event-type-form";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getEventType } from "@/server/db/event-types";
import styles from "../../painel.module.css";

// Carrega o tipo da conta da sessão e abre o editor com os valores atuais.
async function EditTypeContent({ params }: { params: PageProps<"/painel/tipos/[id]">["params"] }) {
  const { id } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  if (!z.uuid().safeParse(id).success) notFound();
  const type = await getEventType(account.id, id);
  if (!type) notFound();
  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{type.nome}</h1>
      </div>
      <EventTypeForm
        id={type.id}
        initial={{
          nome: type.nome, slug: type.slug, descricao: type.descricao ?? "", duracao_min: type.duracao_min, com_meet: type.com_meet,
          antecedencia_min: type.antecedencia_min, janela_dias: type.janela_dias, intervalo_antes_min: type.intervalo_antes_min,
          intervalo_depois_min: type.intervalo_depois_min, passo_min: type.passo_min, visivel_na_pagina: type.visivel_na_pagina, ativo: type.ativo,
        }}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        accountSlug={account.slug}
      />
    </>
  );
}

// Página: link de volta e o editor do tipo (carrega em streaming).
export default function EditEventTypePage({ params }: PageProps<"/painel/tipos/[id]">) {
  return (
    <>
      <BackToList />
      <Suspense fallback={null}>
        <EditTypeContent params={params} />
      </Suspense>
    </>
  );
}
