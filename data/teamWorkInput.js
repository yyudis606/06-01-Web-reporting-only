// FILE INPUT HARIAN HASIL KERJA TEAM
// Ini file paling penting untuk update dashboard setiap hari.
// Cara pakai paling mudah:
// 1. Buka file ini.
// 2. Cari bagian dailyWorkInput.
// 3. Tambahkan 1 baris data untuk setiap team per hari.
// 4. Simpan file, dashboard akan menghitung total otomatis.

// DATA TARGET PROJECT
// Command edit:
// - totalSite = total semua site yang harus diinstall.
// - dailyInstallTarget = target install seluruh team per hari.
export const installationProject = {
  totalSite: 10,
  dailyInstallTarget: 2,
};

// DAFTAR TEAM
// Command edit:
// - Ubah nama team di sini jika nama team berubah.
// - Ubah warna chart team di bagian color.
export const teams = [
  { name: 'Team A', color: '#7c3aed' },
  { name: 'Team B', color: '#22c55e' },
  { name: 'Team C', color: '#f59e0b' },
  { name: 'Team D', color: '#bbcbd9' },
  { name: 'Team E', color: '#ef4444' },
];

// INPUT DATA HARIAN
// Command paling mudah untuk input harian:
// Tambahkan baris baru seperti contoh ini:
// { day: 11, team: 'Team A', install: 5, hold: 0, cancel: 0 },
//
// Arti kolom:
// - day = hari ke berapa.
// - team = nama team, harus sama dengan daftar teams di atas.
// - install = jumlah site berhasil install.
// - hold = jumlah site hold.
// - cancel = jumlah site cancel.
//
// Contoh:
// Team A Hari 1: 2 site install, 2 cancel, 1 hold
// ditulis:
// { day: 1, team: 'Team A', install: 2, hold: 1, cancel: 2 },
//
// Team A Hari 2: 5 site install
// ditulis:
// { day: 2, team: 'Team A', install: 5, hold: 0, cancel: 0 },
export const dailyWorkInput = [
  // { day: 1, team: 'Team A', install: 2, hold: 1, cancel: 2 },
  { day: 2, team: 'Team A', install: 0, hold: 0, cancel: 0 },
  { day: 3, team: 'Team A', install: 2, hold: 0, cancel: 1 },
  { day: 4, team: 'Team A', install: 0, hold: 1, cancel: 0 },

  { day: 1, team: 'Team B', install: 1, hold: 1, cancel: 0 },

  { day: 4, team: 'Team C', install: 0, hold: 0, cancel: 1 },

  { day: 6, team: 'Team D', install: 0, hold: 1, cancel: 2 },

  { day: 8, team: 'Team E', install: 1, hold: 0, cancel: 0 },
];

const buildDailyNote = (item) => {
  const notes = [];

  if (item.install > 0) {
    notes.push(`${item.install} site install`);
  }

  if (item.hold > 0) {
    notes.push(`${item.hold} hold`);
  }

  if (item.cancel > 0) {
    notes.push(`${item.cancel} cancel`);
  }

  return notes.length > 0 ? notes.join(', ') : 'Tidak ada update';
};

const sumDailyResults = (dailyResults) =>
  dailyResults.reduce(
    (total, item) => ({
      install: total.install + item.install,
      hold: total.hold + item.hold,
      cancel: total.cancel + item.cancel,
    }),
    {
      install: 0,
      hold: 0,
      cancel: 0,
    },
  );

const allDays = dailyWorkInput.map((item) => item.day);
export const elapsedDays = Math.max(...allDays, 0);

export const teamWorkInput = teams.map((team) => ({
  team: team.name,
  color: team.color,
  dailyResults: dailyWorkInput
    .filter((item) => item.team === team.name)
    .map((item) => ({
      day: item.day,
      install: item.install,
      hold: item.hold,
      cancel: item.cancel,
      note: buildDailyNote(item),
    })),
}));

export const teamWorkSummary = teamWorkInput.map((team) => {
  const total = sumDailyResults(team.dailyResults);

  return {
    team: team.team,
    done: total.install,
    hold: total.hold,
    cancel: total.cancel,
    color: team.color,
    dailyResults: team.dailyResults,
    note: `Install ${total.install} site, hold ${total.hold} site, cancel ${total.cancel} site`,
  };
});

export const dailyWorkSummary = Array.from({ length: elapsedDays }, (_, index) => {
  const day = index + 1;
  const dayResults = teamWorkInput.flatMap((team) =>
    team.dailyResults
      .filter((item) => item.day === day)
      .map((item) => ({
        team: team.team,
        color: team.color,
        ...item,
      })),
  );

  return {
    day,
    label: `H${day}`,
    install: dayResults.reduce((sum, item) => sum + item.install, 0),
    hold: dayResults.reduce((sum, item) => sum + item.hold, 0),
    cancel: dayResults.reduce((sum, item) => sum + item.cancel, 0),
    teams: dayResults,
  };
});

export const teamTotals = teamWorkSummary.reduce(
  (total, item) => ({
    team: total.team + 1,
    done: total.done + item.done,
    hold: total.hold + item.hold,
    cancel: total.cancel + item.cancel,
  }),
  {
    team: 0,
    done: 0,
    hold: 0,
    cancel: 0,
  },
);

export const remainingSite = Math.max(
  installationProject.totalSite - teamTotals.done - teamTotals.hold - teamTotals.cancel,
  0,
);

export const progressPercent = Math.round(
  (teamTotals.done / installationProject.totalSite) * 100,
);
