-- Security hardening from SECURITY_AUDIT.md.

-- PostgreSQL searches pg_temp before the search_path for tables unless pg_temp is listed;
-- listing it last means a session's temp tables can never shadow what a definer function reads.
alter function public.is_member(uuid) set search_path = public, pg_temp;
alter function public.is_admin(uuid) set search_path = public, pg_temp;
alter function public.can_see_figures(uuid, uuid) set search_path = public, pg_temp;
alter function public.write_audit() set search_path = public, pg_temp;
alter function public.guard_last_admin() set search_path = public, pg_temp;
alter function public.set_admin(uuid, boolean) set search_path = public, pg_temp;
alter function public.invite_preview(text) set search_path = public, pg_temp;
alter function public.accept_invite(text) set search_path = public, pg_temp;

-- Admins can insert invites directly through the API, so the 14-day lifetime the Edge Function
-- sets is enforced here too. One day of slack covers clock skew between the function and the database.
alter table public.invites add constraint invites_ttl check (expires_at <= created_at + interval '15 days');
