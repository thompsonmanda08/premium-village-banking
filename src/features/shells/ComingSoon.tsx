import { CalendarClock } from 'lucide-react';
import { EmptyState, PageHeader } from '@/ui';

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<CalendarClock className="size-7" />} title="Coming soon">
        Your {title.toLowerCase()} will show your figures from the treasurer’s statements. We’re building it now.
      </EmptyState>
    </>
  );
}
