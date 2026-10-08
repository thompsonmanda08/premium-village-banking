import { CalendarClock } from 'lucide-react';
import { EmptyState, PageHeader } from '@/ui';

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<CalendarClock className="size-7" />} title="Available when the February 2027 cycle opens">
        Your {title.toLowerCase()} fills in once the new cycle starts and declarations are logged.
      </EmptyState>
    </>
  );
}
