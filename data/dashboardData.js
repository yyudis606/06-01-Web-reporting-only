import {
  dailyWorkSummary,
  elapsedDays,
  installationProject,
  progressPercent,
  remainingSite,
  teamTotals,
  teamWorkSummary,
} from './teamWorkInput';

// PUSAT DATA DASHBOARD
// Data pekerjaan Team A sampai E diambil dari file teamWorkInput.js.
// Untuk input hasil kerja harian, cukup edit file data/teamWorkInput.js.

export const dashboardText = {
  title: 'Dashboard Progress Instalasi Site',
  subtitle: 'Overview Pekerjaan Instalasi',
  exportButton: 'Export Report',
  trendPanel: {
    subtitle: 'Progress Harian',
    title: `Trend Instalasi ${elapsedDays} Hari`,
    badge: `${progressPercent}% selesai`,
  },
  weeklyPanel: {
    subtitle: 'Produktivitas',
    title: 'Install Site Per Hari',
  },
  divisionPanel: {
    subtitle: 'Team',
    title: 'Pembagian Hasil Install',
  },
  workPanel: {
    subtitle: 'Work Results',
    title: 'Hasil Kerja Tiap Team',
  },
  updatePanel: {
    subtitle: 'Reminder',
    title: 'Jadwal Update Data',
    description: 'Data progress instalasi wajib diupdate setiap hari pada jam berikut.',
  },
};

// JADWAL PEMBERITAHUAN UPDATE DATA
// Command edit:
// - Tambah/ubah jam update di array ini.
// - Contoh tambah jam baru: { time: '12:00', label: 'Update siang' }
export const updateSchedules = [
  { time: '10:00', label: 'Update pagi' },
  { time: '16:00', label: 'Update sore' },
  { time: '21:00', label: 'Update malam' },
];

// CARD RINGKASAN
// Data value otomatis dari file teamWorkInput.js.
// Pilihan tone: primary, success, warning, accent.
export const summaryCards = [
  {
    title: 'Total Site',
    value: `${installationProject.totalSite}`,
    detail: 'Target semua site yang harus diinstall',
    tone: 'primary',
  },
  {
    title: 'Total Team',
    value: `${teamTotals.team}`,
    detail: 'Jumlah team instalasi aktif',
    tone: 'accent',
  },
  {
    title: 'Done Install',
    value: `${teamTotals.done}`,
    detail: 'Site sudah selesai diinstall',
    tone: 'success',
  },
  {
    title: 'Hold / Cancel',
    value: `${teamTotals.hold} / ${teamTotals.cancel}`,
    detail: `${remainingSite} site belum diproses`,
    tone: 'warning',
  },
];

// CHART GARIS
// Otomatis dibuat dari akumulasi install harian di teamWorkInput.js.
let cumulativeInstall = 0;
export const progressTrend = dailyWorkSummary.map((item) => {
  cumulativeInstall += item.install;

  return {
    label: `Hari ${item.day}`,
    value: cumulativeInstall,
  };
});

// CHART BATANG
// Otomatis dibuat dari total install setiap hari di teamWorkInput.js.
export const weeklyResults = dailyWorkSummary.map((item) => ({
  label: item.label,
  value: item.install,
}));

// DATA DIVISI DAN HASIL KERJA
// Data ini otomatis dari teamWorkInput.js.
export const divisionResults = teamWorkSummary.map((item) => ({
  division: item.team,
  result: item.note,
  progress: item.done,
  hold: item.hold,
  cancel: item.cancel,
  color: item.color,
  status: `Done ${item.done} site`,
}));

export const divisionChartData = divisionResults.map((item) => ({
  label: item.division,
  value: item.progress,
  color: item.color,
}));

export const progressApiData = {
  totalSite: installationProject.totalSite,
  totalTeam: teamTotals.team,
  installPerDay: installationProject.dailyInstallTarget,
  elapsedDays,
  progressPercent,
  doneInstall: teamTotals.done,
  holdSite: teamTotals.hold,
  cancelSite: teamTotals.cancel,
  remainingSite,
  progressTrend,
  weeklyResults,
  dailyWorkSummary,
  divisionResults,
  updateSchedules,
};
