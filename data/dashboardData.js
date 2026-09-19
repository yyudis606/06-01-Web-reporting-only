import { defaultDashboardContent } from './defaultDashboardContent';
import { deriveDashboardData } from './dashboardModel';

const fallbackData = deriveDashboardData(defaultDashboardContent);

export const dashboardText = fallbackData.dashboardText;
export const updateSchedules = fallbackData.updateSchedules;
export const summaryCards = fallbackData.summaryCards;
export const progressTrend = fallbackData.progressTrend;
export const weeklyResults = fallbackData.weeklyResults;
export const siteStatuses = fallbackData.siteStatuses;
export const divisionResults = fallbackData.divisionResults;
export const divisionChartData = fallbackData.divisionChartData;
export const progressApiData = fallbackData.progressApiData;
