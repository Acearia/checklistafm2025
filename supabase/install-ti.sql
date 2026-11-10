\set ON_ERROR_STOP on
select to_regclass('public.ti_members') is not null as ti_installed \gset
\if :ti_installed
\echo 'Base do TI já instalada; preservando dados.'
\else
\ir migrations/20261110120000_create_ti_handover.sql
\endif
select to_regclass('public.ti_computer_checklists') is not null as computer_installed \gset
\if :computer_installed
\echo 'Checklist de computadores já instalado; preservando dados.'
\else
\ir migrations/20261110140000_create_ti_computer_checklists.sql
\endif
select to_regclass('public.ti_account_managers') is not null as ti_managers_installed \gset
\if :ti_managers_installed
\echo 'Gestão de contas do TI já instalada; preservando autorizações.'
\else
\ir migrations/20261110160000_create_ti_account_managers.sql
\endif
