import { useCurrentUser } from '@/auth/auth-context'
import { LeadsPage } from './leads-page'
import { PipelinePage } from './pipeline-page'

/** `/leads`: affiliates see their own leads, staff and admins the pipeline. */
export function LeadsRoute() {
  const user = useCurrentUser()
  return user.role === 'AFFILIATE' ? <LeadsPage /> : <PipelinePage />
}
