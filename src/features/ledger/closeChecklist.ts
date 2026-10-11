import { appliedGrounds, loanRequests, openSuggestions, type PenaltySuggestion } from './deskMoney';
import type { EntryRow } from './memberViews';
import { deadlineNote, liveDeclarations, undeclared, type ActiveMember, type DeclarationRow } from './model';

export type CloseChecklist = {
  waiting: number;
  notDeclared: ActiveMember[];
  /** Members whose only live declaration was returned and not sent again: only approval writes entries, so nothing of theirs is counted. */
  returned: ActiveMember[];
  penaltiesPending: number;
  requestsUnsent: number;
  deadline: { text: string; tone: 'neutral' | 'warning' | 'danger' };
  blocked: boolean;
};

type Input = {
  declarations: DeclarationRow[];
  members: ActiveMember[];
  suggestions: PenaltySuggestion[];
  appliedEntries: EntryRow[];
  loans: Array<{ member_id: string; principal: number }>;
  deadline: string;
  today: string;
};

/** What the treasurer should know before closing. Only waiting declarations block: that is the engine's own rule. */
export function closeChecklist(i: Input): CloseChecklist {
  const live = liveDeclarations(i.declarations);
  const waiting = live.filter((d) => d.status === 'submitted').length;
  const counted = new Set(live.filter((d) => d.status === 'approved').map((d) => d.member_id));
  return {
    waiting,
    notDeclared: undeclared(i.members, live),
    returned: i.members.filter((m) => !counted.has(m.id) && live.some((d) => d.member_id === m.id && d.status === 'returned')),
    penaltiesPending: openSuggestions(i.suggestions, appliedGrounds(i.appliedEntries), new Set()).length,
    requestsUnsent: loanRequests(i.declarations, i.loans).filter((r) => r.sent === 0).length,
    deadline: deadlineNote(i.today, i.deadline),
    blocked: waiting > 0,
  };
}
