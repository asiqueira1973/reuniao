#!/bin/bash
# Bloqueia segredo ou import de src/server/ em código que pode rodar no cliente.
# Implementa as seções 18 e 20: segredo só existe no servidor.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Rodam só no servidor: rotas de API, src/server, server.ts das features, scripts e o proxy.
case "$path" in
  */src/app/api/*|*/src/app/sair/*|*/src/server/*|*/src/features/*/server.ts|*/src/features/*/server/*|*/scripts/*|*/src/proxy.ts) exit 0 ;;
  */src/app/*|*/src/components/*|*/src/features/*|*/src/lib/*) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qE 'SUPABASE_SERVICE_ROLE_KEY|service_role|GOOGLE_CLIENT_SECRET|TOKEN_ENC_KEY|SESSION_SECRET|RESEND_API_KEY|CRON_SECRET|NEXT_PUBLIC_[A-Z_]*(SECRET|KEY)'; then
  echo "Bloqueado: segredo em código que pode rodar no cliente (seções 18 e 20). Leia o segredo só em src/server/ ou numa rota em src/app/api/ e chame essa rota do cliente." >&2
  exit 2
fi
# Arquivo com 'use client' nunca importa src/server.
if echo "$content" | grep -q "use client" && echo "$content" | grep -qE "from ['\"]@/server/|from ['\"](\.\./)+server/"; then
  echo "Bloqueado: componente de cliente importando src/server/ (seção 20). Exponha o dado por uma rota ou passe por props de um Server Component." >&2
  exit 2
fi
exit 0
