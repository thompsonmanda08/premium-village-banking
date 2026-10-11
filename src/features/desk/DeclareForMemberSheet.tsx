import { DeclarationForm } from '@/features/ledger/DeclarationForm';
import type { ActiveMember, DeclarationRow, Wallet } from '@/features/ledger/model';
import { Sheet } from '@/ui';

type Props = { periodId: string; member: ActiveMember; wallets: Wallet[]; initial?: DeclarationRow | null; onClose: () => void };

/** The declaration form in a sheet, for a declaration a member sent the treasurer outside the app. `initial` is the returned one it replaces. */
export function DeclareForMemberSheet({ periodId, member, wallets, initial, onClose }: Props) {
  return (
    <Sheet open onClose={onClose} title={`Declare for ${member.short_name}`} description="Use this for a declaration the member sent you outside the app.">
      <DeclarationForm periodId={periodId} memberId={member.id} wallets={wallets} initial={initial} onDone={onClose} />
    </Sheet>
  );
}
