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
      install: total.install + Number(item.install || 0),
      hold: total.hold + Number(item.hold || 0),
      cancel: total.cancel + Number(item.cancel || 0),
    }),
    {
      install: 0,
      hold: 0,
      cancel: 0,
    },
  );

const normalizeContent = (content) => ({
  ...content,
  project: {
    totalSite: Number(content.project?.totalSite || 0),
    dailyInstallTarget: Number(content.project?.dailyInstallTarget || 0),
  },
  updateSchedules: Array.isArray(content.updateSchedules) ? content.updateSchedules : [],
  teams: Array.isArray(content.teams) ? content.teams : [],
  dailyWorkInput: Array.isArray(content.dailyWorkInput) ? content.dailyWorkInput : [],
  siteStatuses: Array.isArray(content.siteStatuses) ? content.siteStatuses : [],
});

export function deriveDashboardData(rawContent) {
  const content = normalizeContent(rawContent);
  const text = content.text || {};
  const allDays = content.dailyWorkInput.map((item) => Number(item.day || 0));
  const elapsedDays = Math.max(...allDays, 0);

  const teamWorkInput = content.teams.map((team) => ({
    team: team.name,
    color: team.color,
    dailyResults: content.dailyWorkInput
      .filter((item) => item.team === team.name)
      .map((item) => ({
        day: Number(item.day || 0),
        install: Number(item.install || 0),
        hold: Number(item.hold || 0),
        cancel: Number(item.cancel || 0),
        note: buildDailyNote(item),
      })),
  }));

  const teamWorkSummary = teamWorkInput.map((team) => {
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

  const dailyWorkSummary = Array.from({ length: elapsedDays }, (_, index) => {
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

  const teamTotals = teamWorkSummary.reduce(
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

  const remainingSite = Math.max(
    content.project.totalSite - teamTotals.done - teamTotals.hold - teamTotals.cancel,
    0,
  );

  const progressPercent = content.project.totalSite > 0
    ? Math.round((teamTotals.done / content.project.totalSite) * 100)
    : 0;

  const dashboardText = {
    title: text.title,
    subtitle: text.subtitle,
    exportButton: text.exportButton,
    trendPanel: {
      subtitle: text.trendSubtitle,
      title: `Trend Instalasi ${elapsedDays} Hari`,
      badge: `${progressPercent}% selesai`,
    },
    weeklyPanel: {
      subtitle: text.weeklySubtitle,
      title: text.weeklyTitle,
    },
    divisionPanel: {
      subtitle: text.divisionSubtitle,
      title: text.divisionTitle,
    },
    workPanel: {
      subtitle: text.workSubtitle,
      title: text.workTitle,
    },
    updatePanel: {
      subtitle: text.updateSubtitle,
      title: text.updateTitle,
      description: text.updateDescription,
    },
  };

  const summaryCards = [
    {
      title: 'Total Site',
      value: `${content.project.totalSite}`,
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

  let cumulativeInstall = 0;
  const progressTrend = dailyWorkSummary.map((item) => {
    cumulativeInstall += item.install;

    return {
      label: `Hari ${item.day}`,
      value: cumulativeInstall,
    };
  });

  const weeklyResults = dailyWorkSummary.map((item) => ({
    label: item.label,
    value: item.install,
  }));

  const divisionResults = teamWorkSummary.map((item) => ({
    division: item.team,
    result: item.note,
    progress: item.done,
    hold: item.hold,
    cancel: item.cancel,
    color: item.color,
    status: `Done ${item.done} site`,
  }));

  const divisionChartData = divisionResults.map((item) => ({
    label: item.division,
    value: item.progress,
    color: item.color,
  }));

  return {
    content,
    dashboardText,
    updateSchedules: content.updateSchedules,
    siteStatuses: content.siteStatuses.map((site) => ({
      name: site.name || 'Site tanpa nama',
      status: ['Open', 'Done', 'Hold', 'Cancel'].includes(site.status) ? site.status : 'Open',
      team: site.team || 'Belum ditentukan',
      note: site.note || '',
    })),
    summaryCards,
    progressTrend,
    weeklyResults,
    divisionResults,
    divisionChartData,
    progressApiData: {
      totalSite: content.project.totalSite,
      totalTeam: teamTotals.team,
      installPerDay: content.project.dailyInstallTarget,
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
      updateSchedules: content.updateSchedules,
      siteStatuses: content.siteStatuses,
    },
  };
}
