-- Empresas administradoras: pueden crear y ver los códigos de invitación desde el panel
alter table public.companies add column is_admin boolean not null default false;
