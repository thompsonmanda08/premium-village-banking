begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select has_table('public', t, t || ' exists')
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;

select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
  'RLS is enabled on ' || t
)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;

select col_default_is('public', 'groups', 'figures_visibility', 'open'::text, 'figures are open by default');
select col_default_is('public', 'groups', 'currency', 'ZMW'::text, 'currency defaults to ZMW');
select col_default_is('public', 'members', 'role', 'member'::text, 'new members are plain members');
select col_default_is('public', 'cycles', 'status', 'planned'::text, 'new cycles are planned');
select col_has_default('public', 'cycle_rules', 'min_saving', 'minimum saving has a default (K250)');

select throws_ok(
  $$insert into public.groups (name, owner_user_id, figures_visibility) values ('x', gen_random_uuid(), 'secret')$$,
  '23514', null, 'figures_visibility only accepts open or private'
);

select * from finish();
rollback;
