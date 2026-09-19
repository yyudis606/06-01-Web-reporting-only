import { dailyWorkInput, installationProject, teams } from './teamWorkInput';

export const defaultDashboardContent = {
  text: {
    title: 'Dashboard Progress Instalasi Site',
    subtitle: 'Overview Pekerjaan Instalasi',
    exportButton: 'Export Report',
    trendSubtitle: 'Progress Harian',
    weeklySubtitle: 'Produktivitas',
    weeklyTitle: 'Install Site Per Hari',
    divisionSubtitle: 'Team',
    divisionTitle: 'Pembagian Hasil Install',
    workSubtitle: 'Work Results',
    workTitle: 'Hasil Kerja Tiap Team',
    updateSubtitle: 'Reminder',
    updateTitle: 'Jadwal Update Data',
    updateDescription: 'Data progress instalasi wajib diupdate setiap hari pada jam berikut.',
  },
  project: {
    totalSite: installationProject.totalSite,
    dailyInstallTarget: installationProject.dailyInstallTarget,
  },
  updateSchedules: [
    { time: '10:00', label: 'Update pagi' },
    { time: '16:00', label: 'Update sore' },
    { time: '21:00', label: 'Update malam' },
  ],
  teams,
  dailyWorkInput,
};
