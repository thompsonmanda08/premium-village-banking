import { useRouteError } from 'react-router';
import { friendlyError } from '@/lib/errors';
import { ErrorScreen } from './ErrorScreen';

/** Router errorElement: a render or loader error never reaches the default screen, which prints the raw message. */
export function RouteError() {
  const error = useRouteError();
  return <ErrorScreen title="Something went wrong" message={friendlyError(error)} onRetry={() => window.location.reload()} />;
}
