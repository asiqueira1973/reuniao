#!/bin/bash
# Impede editar migration já versionada no git; mudança de schema vira migration nova (seção 7.6).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*) ;;
  *) exit 0 ;;
esac
rel="${path#"$CLAUDE_PROJECT_DIR"/}"
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
  echo "Bloqueado: $rel já está versionada. Não se edita migration aplicada; crie uma nova migration com a alteração (seção 7.6)." >&2
  exit 2
fi
exit 0
