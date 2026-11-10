#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stack_dir="${1:-/opt}"
if [[ ! -f "$stack_dir/supabase/config.toml" ]]; then
  echo "Configuração da instância Supabase não encontrada em $stack_dir/supabase/config.toml. Informe a pasta da instância como argumento." >&2
  exit 1
fi
if ! command -v supabase >/dev/null; then echo 'O CLI Supabase não foi encontrado no servidor.' >&2; exit 1; fi
if ! command -v pm2 >/dev/null; then echo 'O PM2 não foi encontrado no servidor.' >&2; exit 1; fi
# Confirm the running local project before copying anything. Do not deploy to cloud.
supabase status --workdir "$stack_dir" >/dev/null
mkdir -p "$stack_dir/supabase/functions/manage-ti-analysts" "$stack_dir/supabase/functions/_shared"
cp "$repo_dir/supabase/functions/manage-ti-analysts/index.ts" "$stack_dir/supabase/functions/manage-ti-analysts/index.ts"
cp "$repo_dir/supabase/functions/_shared/tiAnalystManagement.ts" "$stack_dir/supabase/functions/_shared/tiAnalystManagement.ts"
if pm2 describe checklist-ti-functions >/dev/null 2>&1; then
  pm2 restart checklist-ti-functions
else
  pm2 start "$(command -v supabase)" --name checklist-ti-functions --interpreter none --cwd "$stack_dir" -- functions serve manage-ti-analysts --workdir "$stack_dir"
fi
pm2 save
echo 'Serviço de gestão do TI iniciado. Configure a conta gestora e confira os logs com: pm2 logs checklist-ti-functions --lines 30'
