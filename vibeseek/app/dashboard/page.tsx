import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  // Server component is intentionally thin — anon-id lives in localStorage,
  // so all data fetching happens client-side after mount via the aggregator route.
  return <DashboardClient />
}
