import { progressApiData } from '../../../data/dashboardData';

export async function GET() {
  return Response.json({
    success: true,
    message: 'Progress report data fetched successfully.',
    data: progressApiData,
  });
}
