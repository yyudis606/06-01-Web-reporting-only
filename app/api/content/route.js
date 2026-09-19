import { getDerivedDashboardData } from '../../server/contentStore';

export async function GET() {
  const data = await getDerivedDashboardData();

  return Response.json({
    dashboardText: data.dashboardText,
    updateSchedules: data.updateSchedules,
    summaryCards: data.summaryCards,
    progressTrend: data.progressTrend,
    weeklyResults: data.weeklyResults,
    divisionResults: data.divisionResults,
    divisionChartData: data.divisionChartData,
    progressApiData: data.progressApiData,
  });
}
