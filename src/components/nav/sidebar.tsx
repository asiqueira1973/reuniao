"use client";
// Menu lateral do painel — seção 16 (padrão App Store Connect).
// Grupos em negrito escuro, itens indentados sem marcador, hairline entre grupos, um item ativo
// em azul com pílula clara; rodapé com nome, e-mail, "Ver minha página" e Sair (POST /sair).
// Abaixo de 1024 px vira gaveta aberta pelo botão do topo. usePathname exige <Suspense>: o
// SidebarView puro serve de fallback, sem item ativo.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Menu, X } from "lucide-react";
import { copy } from "@/lib/copy";
import styles from "./sidebar.module.css";

type Props = { displayName: string; email: string; slug: string };

const GROUPS = [
  {
    title: copy.nav.groups.agenda,
    items: [
      { href: "/painel/tipos", label: copy.nav.eventTypes },
      { href: "/painel/reunioes", label: copy.nav.meetings },
    ],
  },
  {
    title: copy.nav.groups.configurar,
    items: [
      { href: "/painel/disponibilidade", label: copy.nav.availability },
      { href: "/painel/conta", label: copy.nav.account },
    ],
  },
];

// Diz qual item está ativo: o de prefixo mais longo que casa com a rota atual.
export function activeHrefFor(pathname: string | null): string | null {
  if (!pathname) return null;
  const all = GROUPS.flatMap((g) => g.items.map((i) => i.href));
  return all.filter((h) => pathname === h || pathname.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

// Menu sem lógica de rota: recebe o item ativo pronto (ou null no fallback).
export function SidebarView({ activeHref, displayName, email, slug }: Props & { activeHref: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className={styles.topbar}>
        <button className={styles.menuButton} type="button" aria-label={copy.nav.openMenu} aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={22} strokeWidth={1.75} />
        </button>
        <span className={styles.topbarTitle}>{copy.appName}</span>
      </header>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav className={`${styles.sidebar} ${open ? styles.open : ""}`} aria-label={copy.appName}>
        <div className={styles.brandRow}>
          <span className={styles.brand}>{copy.appName}</span>
          <button className={styles.closeButton} type="button" aria-label={copy.nav.closeMenu} onClick={() => setOpen(false)}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title} className={styles.group}>
            <p className={styles.groupTitle}>{group.title}</p>
            <ul className={styles.items}>
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.item} ${active ? styles.active : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className={styles.footer}>
          <p className={styles.footerName}>{displayName}</p>
          <p className={styles.footerEmail}>{email}</p>
          <a className={styles.footerLink} href={`/${slug}`} target="_blank" rel="noreferrer">
            {copy.nav.viewMyPage}
          </a>
          <form action="/sair" method="post">
            <button className={styles.signOut} type="submit">{copy.nav.signOut}</button>
          </form>
        </div>
      </nav>
    </>
  );
}

// Lê a rota atual para marcar o item ativo.
function SidebarWithPath(props: Props) {
  const pathname = usePathname();
  return <SidebarView {...props} activeHref={activeHrefFor(pathname)} />;
}

// Menu do painel com o item ativo da rota atual (fallback sem item ativo).
export function Sidebar(props: Props) {
  return (
    <Suspense fallback={<SidebarView {...props} activeHref={null} />}>
      <SidebarWithPath {...props} />
    </Suspense>
  );
}
