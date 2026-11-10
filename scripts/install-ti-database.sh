#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
db_container="${TI_DB_CONTAINER:-supabase_db_opt}"
cd "$repo_dir"
docker exec -u postgres "$db_container" mkdir -p /tmp/checklist-ti/migrations
docker cp supabase/install-ti.sql "$db_container:/tmp/checklist-ti/install-ti.sql"
docker cp supabase/migrations/. "$db_container:/tmp/checklist-ti/migrations/"
docker exec -u postgres "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/checklist-ti/install-ti.sql
