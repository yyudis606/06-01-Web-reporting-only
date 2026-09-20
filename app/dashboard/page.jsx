import DashboardContent from './_components/DashboardContent';
import { getDerivedDashboardData } from '../server/contentStore';
import './style.scss';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const dashboardData = await getDerivedDashboardData();

  return <DashboardContent initialData={dashboardData} />;
}
