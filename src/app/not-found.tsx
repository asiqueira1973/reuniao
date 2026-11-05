// Página 404 (seção 10): "Página não encontrada." no visual do app.
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--surface)" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", fontWeight: 600 }}>404</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{copy.booking.notFound}</h1>
      </div>
    </main>
  );
}
