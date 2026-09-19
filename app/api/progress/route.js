import { getDerivedDashboardData } from '../../server/contentStore';

export async function GET() {
  const dashboardData = await getDerivedDashboardData();

  return Response.json({
    success: true,
    message: 'Progress report data fetched successfully.',
    data: dashboardData.progressApiData,
  });
}
