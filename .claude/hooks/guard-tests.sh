#!/bin/bash
# Em correção de bug (arquivo .claude/fix-mode presente), impede editar testes para "fazer passar".
# Implementa a seção 22.1: bug se corrige no código, não no teste.
[ -f "$CLAUDE_PROJECT_DIR/.claude/fix-mode" ] || exit 0
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  *.test.ts|*.test.tsx|*.spec.ts|*/__tests__/*|*/tests/*|*/supabase/tests/*)
    echo "Bloqueado: modo de correção ativo (.claude/fix-mode). Corrija o código, não o teste (seção 22.1). Se o teste estiver errado de fato, pare e explique ao humano." >&2
    exit 2 ;;
esac
exit 0
