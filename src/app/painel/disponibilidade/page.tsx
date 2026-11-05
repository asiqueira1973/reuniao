// Provisória: só o título, para o menu do painel não levar a 404. A tela de verdade nasce no
// épico 8.3 (seção 10).
import { copy } from "@/lib/copy";
import styles from "../painel.module.css";

export default function Page() {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>{copy.nav.availability}</h1>
    </div>
  );
}
