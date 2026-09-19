import ExcelJS from 'exceljs';
import { getDerivedDashboardData } from '../../server/contentStore';

export const runtime = 'nodejs';

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2563EB' },
};

const TITLE_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF172554' },
};

const applySheetStyle = (worksheet, title, columns) => {
  worksheet.columns = columns;
  worksheet.views = [{ state: 'frozen', ySplit: 3 }];
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: columns.length },
  };

  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleCell.fill = TITLE_FILL;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  const headerRow = worksheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) {
      return;
    }

    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD8E1F0' } },
      };
    });
  });
};

const addSummarySheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet('Ringkasan');
  applySheetStyle(worksheet, data.dashboardText.title, [
    { header: 'Informasi', key: 'label', width: 28 },
    { header: 'Nilai', key: 'value', width: 22 },
    { header: 'Keterangan', key: 'detail', width: 48 },
  ]);

  data.summaryCards.forEach((card) => {
    worksheet.addRow({
      label: card.title,
      value: card.value,
      detail: card.detail,
    });
  });

  worksheet.addRow({
    label: 'Progress Selesai',
    value: `${data.progressApiData.progressPercent}%`,
    detail: `${data.progressApiData.doneInstall} dari ${data.progressApiData.totalSite} site`,
  });
  worksheet.addRow({
    label: 'Target Install Harian',
    value: data.progressApiData.installPerDay,
    detail: 'Target site yang diinstall per hari',
  });
};

const addDailyProgressSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet('Progress Harian');
  applySheetStyle(worksheet, 'Progress Pekerjaan Harian', [
    { header: 'Hari', key: 'day', width: 12 },
    { header: 'Team', key: 'team', width: 22 },
    { header: 'Install', key: 'install', width: 14 },
    { header: 'Hold', key: 'hold', width: 14 },
    { header: 'Cancel', key: 'cancel', width: 14 },
    { header: 'Catatan', key: 'note', width: 42 },
  ]);

  data.progressApiData.dailyWorkSummary.forEach((day) => {
    if (day.teams.length === 0) {
      worksheet.addRow({
        day: `Hari ${day.day}`,
        team: '-',
        install: 0,
        hold: 0,
        cancel: 0,
        note: 'Tidak ada update',
      });
      return;
    }

    day.teams.forEach((team) => {
      worksheet.addRow({
        day: `Hari ${day.day}`,
        team: team.team,
        install: team.install,
        hold: team.hold,
        cancel: team.cancel,
        note: team.note,
      });
    });
  });
};

const addTeamSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet('Hasil Team');
  applySheetStyle(worksheet, 'Hasil Pekerjaan Tiap Team', [
    { header: 'Team', key: 'team', width: 24 },
    { header: 'Done', key: 'done', width: 14 },
    { header: 'Hold', key: 'hold', width: 14 },
    { header: 'Cancel', key: 'cancel', width: 14 },
    { header: 'Keterangan', key: 'result', width: 48 },
  ]);

  data.divisionResults.forEach((team) => {
    worksheet.addRow({
      team: team.division,
      done: team.progress,
      hold: team.hold,
      cancel: team.cancel,
      result: team.result,
    });
  });
};

const addSiteSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet('Detail Site');
  applySheetStyle(worksheet, 'Status Site dan Team Lokasi', [
    { header: 'No.', key: 'number', width: 10 },
    { header: 'Nama Site', key: 'name', width: 30 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Team Lokasi', key: 'team', width: 24 },
    { header: 'Catatan', key: 'note', width: 48 },
  ]);

  data.siteStatuses.forEach((site, index) => {
    worksheet.addRow({
      number: index + 1,
      name: site.name,
      status: site.status,
      team: site.team,
      note: site.note || '-',
    });
  });
};

const addScheduleSheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet('Jadwal Update');
  applySheetStyle(worksheet, 'Jadwal Update Data Progress', [
    { header: 'No.', key: 'number', width: 10 },
    { header: 'Waktu', key: 'time', width: 20 },
    { header: 'Keterangan', key: 'label', width: 42 },
  ]);

  data.updateSchedules.forEach((schedule, index) => {
    worksheet.addRow({
      number: index + 1,
      time: schedule.time,
      label: schedule.label,
    });
  });
};

export async function GET() {
  const data = await getDerivedDashboardData();
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'devANYcode';
  workbook.created = new Date();
  workbook.modified = new Date();

  addSummarySheet(workbook, data);
  addDailyProgressSheet(workbook, data);
  addTeamSheet(workbook, data);
  addSiteSheet(workbook, data);
  addScheduleSheet(workbook, data);

  const file = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(file, {
    headers: {
      'Content-Disposition': `attachment; filename="progress-pekerjaan-${date}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Cache-Control': 'no-store',
    },
  });
}
