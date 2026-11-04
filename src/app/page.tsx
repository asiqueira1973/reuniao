// Raiz do site: não há página própria no spec; leva ao painel (o proxy manda para /entrar sem sessão).
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/painel");
}
