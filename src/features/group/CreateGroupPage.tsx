import { useId, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { useSession } from '@/features/auth/SessionProvider';
import { defaultShortName } from '@/features/settings/memberForm';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Alert, Button, TextField, useToast } from '@/ui';
import { cn } from '@/ui/cn';
import { useMembership } from './useMembership';

const CURRENCIES = [
  { value: 'ZMW', label: 'ZMW — Zambian Kwacha' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'UGX', label: 'UGX — Ugandan Shilling' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
] as const;

type Currency = (typeof CURRENCIES)[number]['value'];

type FormValues = {
  groupName: string;
  currency: Currency;
  fullName: string;
  shortName: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(f: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!f.groupName.trim()) e.groupName = 'Enter a name for your group.';
  else if (f.groupName.trim().length > 120) e.groupName = 'Use 120 characters or fewer.';
  if (!f.fullName.trim()) e.fullName = 'Enter your full name.';
  else if (f.fullName.trim().length > 120) e.fullName = 'Use 120 characters or fewer.';
  const short = f.shortName.trim() || defaultShortName(f.fullName);
  if (!short) e.shortName = 'Enter a short name.';
  else if (short.length > 40) e.shortName = 'Use 40 characters or fewer.';
  return e;
}

export function CreateGroupPage() {
  const { session } = useSession();
  const membership = useMembership(session?.user.id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const currencyId = useId();

  const [form, setForm] = useState<FormValues>({ groupName: '', currency: 'ZMW', fullName: '', shortName: '' });
  const [showErrors, setShowErrors] = useState(false);

  const errors = validate(form);
  const effectiveShort = form.shortName.trim() || defaultShortName(form.fullName);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: form.groupName.trim(),
        p_currency: form.currency,
        p_full_name: form.fullName.trim(),
        p_short_name: effectiveShort,
      });
      if (error) throw error;
      return data; // group uuid
    },
    onSuccess: () => {
      haptic();
      // Drop the cached "no group" so RequireMembership fetches fresh.
      qc.removeQueries({ queryKey: ['membership'] });
      toast('Your group is ready. Start by adding members.', { tone: 'success' });
      navigate('/', { replace: true });
    },
  });

  // Wait for membership, then send anyone who already has a group home: closes the double-submit race.
  if (membership.isPending) return <FullScreenLoader />;
  if (membership.data) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate();
  };

  const field = (k: keyof FormValues) => ({
    value: form[k],
    onChange: (ev: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: ev.target.value })),
  });

  const isAlreadyInGroup = (create.error as { message?: string } | null)?.message === 'already_in_group';

  return (
    <AuthLayout title="Create a group" subtitle="Set up your village banking group and invite your members.">
      <form className="grid gap-4" noValidate onSubmit={submit}>
        {create.isError && (
          <Alert
            tone={isAlreadyInGroup ? 'warning' : 'danger'}
            action={
              isAlreadyInGroup ? (
                <Button size="sm" variant="secondary" onClick={() => navigate('/', { replace: true })}>
                  Go home
                </Button>
              ) : undefined
            }
          >
            {friendlyError(create.error)}
          </Alert>
        )}

        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-semibold text-muted">Group details</legend>
          <TextField
            label="Group name"
            placeholder="e.g. Premium Village Banking"
            maxLength={120}
            autoComplete="off"
            error={showErrors ? errors.groupName : undefined}
            {...field('groupName')}
          />

          {/* Currency — native <select> styled to match TextField */}
          <div className="grid gap-1.5">
            <label htmlFor={currencyId} className="text-sm font-medium text-fg">
              Currency
            </label>
            <select
              id={currencyId}
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as Currency }))}
              className={cn(
                'h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-fg transition',
                'focus-visible:border-accent focus-visible:outline-none',
              )}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-semibold text-muted">Your name in the group</legend>
          <TextField
            label="Full name"
            placeholder="e.g. Thompson Manda"
            maxLength={120}
            autoComplete="name"
            error={showErrors ? errors.fullName : undefined}
            {...field('fullName')}
          />
          <TextField
            label="Short name"
            hint="Shown in lists and greetings. Defaults to your first name."
            placeholder={effectiveShort || 'e.g. Thompson'}
            maxLength={40}
            autoComplete="off"
            // Only flag short name if a full name is already entered, to avoid a confusing double-blank error.
            error={showErrors && form.fullName.trim() ? errors.shortName : undefined}
            {...field('shortName')}
          />
        </fieldset>

        <Button type="submit" fullWidth isLoading={create.isPending}>
          Create group
        </Button>
      </form>
    </AuthLayout>
  );
}
