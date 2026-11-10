#!/usr/bin/env bash
set -euo pipefail
if [[ $# -eq 0 ]]; then
  read -r -p 'E-mail da conta do administrador: ' manager_email
  read -r -p 'Nome do administrador [Administrador]: ' manager_name
  manager_name="${manager_name:-Administrador}"
elif [[ $# -eq 2 ]]; then
  manager_email="$1"
  manager_name="$2"
else
  echo 'Use: bash scripts/activate-ti-management.sh "email-do-gestor@empresa.com.br" "Nome do gestor"' >&2
  exit 1
fi
if [[ ! "$manager_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo 'Informe um e-mail válido para a conta gestora.' >&2
  exit 1
fi
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stack_dir="${TI_SUPABASE_WORKDIR:-/opt}"
cd "$repo_dir"
bash scripts/install-ti-database.sh
bash scripts/install-ti-management.sh "$stack_dir"
node scripts/check-ti-management.mjs "$stack_dir"
node scripts/manage-ti-user.mjs --email "$manager_email" --name "$manager_name" --manager --administrator --reset-password --stack "$stack_dir"
echo 'Ativação concluída. Saia e entre no administrativo com o usuário administrador e a senha definida agora. Abra Analistas TI.'
