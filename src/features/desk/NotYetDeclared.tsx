import { useState } from 'react';
import { liveDeclarations, undeclared, type ActiveMember, type DeclarationRow, type Wallet } from '@/features/ledger/model';
import { Button, Card } from '@/ui';
import { DeclareForMemberSheet } from './DeclareForMemberSheet';

type Props = { periodId: string; members: ActiveMember[]; declarations: DeclarationRow[]; wallets: Wallet[] };

/** Active members with no live declaration. The treasurer can type in a WhatsApp declaration for any of them. */
export function NotYetDeclared({ periodId, members, declarations, wallets }: Props) {
  const [picked, setPicked] = useState<ActiveMember | null>(null);
  const missing = undeclared(members, liveDeclarations(declarations));
  if (missing.length === 0) return null;
  return (
    <Card>
      <h3 className="text-lg font-semibold text-fg">Not yet declared</h3>
      <ul role="list" className="divide-y divide-line">
        {missing.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-fg">{m.short_name}</span>
            <Button size="sm" variant="secondary" aria-label={`Declare for ${m.short_name}`} onClick={() => setPicked(m)}>Declare</Button>
          </li>
        ))}
      </ul>
      {picked ? <DeclareForMemberSheet periodId={periodId} member={picked} wallets={wallets} onClose={() => setPicked(null)} /> : null}
    </Card>
  );
}
