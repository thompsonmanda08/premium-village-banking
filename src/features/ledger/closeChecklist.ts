import { appliedGrounds, loanRequests, openSuggestions, type PenaltySuggestion } from './deskMoney';
import type { EntryRow } from './memberViews';
import { deadlineNote, liveDeclarations, undeclared, type ActiveMember, type DeclarationRow } from './model';

export type CloseChecklist = {
  waiting: number;
  notDeclared: ActiveMember[];
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
  return {
    waiting,
    notDeclared: undeclared(i.members, live),
    penaltiesPending: openSuggestions(i.suggestions, appliedGrounds(i.appliedEntries), new Set()).length,
    requestsUnsent: loanRequests(i.declarations, i.loans).filter((r) => r.sent === 0).length,
    deadline: deadlineNote(i.today, i.deadline),
    blocked: waiting > 0,
  };
}
