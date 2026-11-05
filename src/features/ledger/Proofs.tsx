import { useQuery } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { fetchProof, PROOF_ACCEPT } from '@/lib/proof';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Sheet, Skeleton } from '@/ui';

/** The proofs attached to one member's month (RLS lets the member and the treasurer see them). */
export function useProofs(periodId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: ['proofs', periodId, memberId],
    enabled: Boolean(periodId && memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('declaration_proofs')
        .select('id, content_type, created_at')
        .eq('period_id', periodId!)
        .eq('member_id', memberId!)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** The file chooser on the declaration form. Optional; the server checks the real file again. */
export function ProofPicker({ file, onChange, error }: { file: File | null; onChange: (f: File | null) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <label htmlFor="proof-file" className="text-sm font-medium text-fg">Proof of payment (optional)</label>
      <p id="proof-hint" className="text-sm text-muted">A screenshot or PDF of the payment confirmation, up to 4 MB.</p>
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3">
        <Paperclip aria-hidden className="size-5 shrink-0 text-muted" />
        <input
          ref={input}
          id="proof-file"
          type="file"
          accept={PROOF_ACCEPT}
          aria-describedby={error ? 'proof-error' : 'proof-hint'}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="min-w-0 flex-1 py-2 text-sm text-fg file:mr-3 file:h-9 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-fg"
        />
        {file ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Remove the file"
            onClick={() => {
              onChange(null);
              if (input.current) input.current.value = '';
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p id="proof-error" role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function Viewer({ id, label, onClose }: { id: string; label: string; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let url: string | undefined;
    let live = true;
    fetchProof(id).then(
      (f) => {
        url = f.url;
        if (live) setFile(f);
        else URL.revokeObjectURL(f.url);
      },
      (e) => {
        if (live) setError(e);
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  return (
    <Sheet open onClose={onClose} title="Proof of payment" description={label}>
      {error ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : !file ? (
        <div role="status"><span className="sr-only">Loading the file</span><Skeleton className="h-64" /></div>
      ) : file.type === 'application/pdf' ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline">Open the PDF</a>
      ) : (
        <img src={file.url} alt="The proof of payment" className="max-h-[70dvh] w-full rounded-xl object-contain" />
      )}
    </Sheet>
  );
}

/** "Proof" buttons under a declaration, one for each file attached to that member's month. */
export function ProofLinks({ periodId, memberId }: { periodId: string; memberId: string }) {
  const proofs = useProofs(periodId, memberId);
  const [open, setOpen] = useState<{ id: string; label: string } | null>(null);
  if (!proofs.data || proofs.data.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {proofs.data.map((p, i) => {
        const label = `${p.content_type === 'application/pdf' ? 'PDF' : 'Photo'} ${i + 1}, added ${formatDate(p.created_at)}`;
        return (
          <Button
            key={p.id}
            size="sm"
            variant="secondary"
            leftIcon={<Paperclip aria-hidden className="size-4" />}
            aria-label={`View proof of payment: ${label}`}
            onClick={() => setOpen({ id: p.id, label })}
          >
            {`Proof ${i + 1}`}
          </Button>
        );
      })}
      {open ? <Viewer id={open.id} label={open.label} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
