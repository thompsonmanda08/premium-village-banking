-- A member has at most one live (not accepted, not revoked) invite. The invite-member function revokes the old one
-- before inserting a new one; this index makes two simultaneous requests (a double tap) fail the second with 23505,
-- which the function reports as invite_in_progress, instead of leaving two working links.
create unique index invites_one_live_per_member on public.invites (member_id)
  where accepted_at is null and revoked_at is null;
