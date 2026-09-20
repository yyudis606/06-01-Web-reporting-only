import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';
import { recordAdminActivity } from '../../../server/activityLog';
import { getDashboardContent, saveDashboardContent } from '../../../server/contentStore';

const SECTION_PERMISSIONS = {
  text: 'content:text',
  project: 'content:project',
  updateSchedules: 'content:schedules',
  teams: 'content:teams',
  dailyWorkInput: 'content:daily-work',
  siteStatuses: 'content:sites',
};

const SECTION_LABELS = {
  text: 'Teks Halaman',
  project: 'Target Project',
  updateSchedules: 'Jadwal Update',
  teams: 'Team',
  dailyWorkInput: 'Input Harian',
  siteStatuses: 'Data Site',
};

const PROJECT_FIELD_LABELS = {
  totalSite: 'Total Site',
  dailyInstallTarget: 'Target Install Harian',
};

const TEXT_FIELD_LABELS = {
  title: 'Judul Dashboard',
  subtitle: 'Subtitle Dashboard',
  exportButton: 'Tombol Export',
  trendSubtitle: 'Subtitle Progress Harian',
  weeklySubtitle: 'Subtitle Produktivitas',
  weeklyTitle: 'Judul Produktivitas',
  divisionSubtitle: 'Subtitle Team',
  divisionTitle: 'Judul Team',
  workSubtitle: 'Subtitle Work Results',
  workTitle: 'Judul Work Results',
  updateSubtitle: 'Subtitle Jadwal',
  updateTitle: 'Judul Jadwal',
  updateDescription: 'Deskripsi Jadwal',
};

function isSameValue(before, after) {
  return JSON.stringify(before ?? '') === JSON.stringify(after ?? '');
}

function getProgressText(item) {
  return `H${item.day} ${item.team} (install ${item.install || 0}, hold ${item.hold || 0}, cancel ${item.cancel || 0})`;
}

function formatChangeValue(value) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return String(value);
}

function createChange(section, type, label, before, after) {
  return {
    section,
    type,
    label,
    before: formatChangeValue(before),
    after: formatChangeValue(after),
  };
}

function formatChangeSummary(change) {
  if (change.type === 'add') {
    return `${change.section}: add ${change.after}`;
  }

  if (change.type === 'delete') {
    return `${change.section}: delete ${change.before}`;
  }

  return `${change.section}: ${change.label} ${change.before} to ${change.after}`;
}

function summarizeObjectChanges(label, before = {}, after = {}, fieldLabels = {}) {
  return Object.keys({ ...before, ...after })
    .filter((field) => !isSameValue(before[field], after[field]))
    .map((field) =>
      createChange(label, 'edit', fieldLabels[field] || field, before[field], after[field])
    );
}

function summarizeArrayChanges(label, beforeItems = [], afterItems = [], getKey, getName, fieldLabels = {}) {
  const changes = [];
  const beforeMap = new Map(beforeItems.map((item, index) => [getKey(item, index), item]));
  const afterMap = new Map(afterItems.map((item, index) => [getKey(item, index), item]));

  afterMap.forEach((afterItem, key) => {
    const beforeItem = beforeMap.get(key);

    if (!beforeItem) {
      changes.push(createChange(label, 'add', getName(afterItem), null, getName(afterItem)));
      return;
    }

    Object.keys({ ...beforeItem, ...afterItem }).forEach((field) => {
      if (field === 'color' || isSameValue(beforeItem[field], afterItem[field])) {
        return;
      }

      changes.push(
        createChange(
          label,
          'edit',
          `${getName(afterItem)} - ${fieldLabels[field] || field}`,
          beforeItem[field],
          afterItem[field],
        ),
      );
    });
  });

  beforeMap.forEach((beforeItem, key) => {
    if (!afterMap.has(key)) {
      changes.push(createChange(label, 'delete', getName(beforeItem), getName(beforeItem), null));
    }
  });

  return changes;
}

function summarizeSectionChange(section, beforeValue, afterValue) {
  const label = SECTION_LABELS[section] || section;

  if (section === 'project') {
    return summarizeObjectChanges(label, beforeValue, afterValue, PROJECT_FIELD_LABELS);
  }

  if (section === 'text') {
    return summarizeObjectChanges(label, beforeValue, afterValue, TEXT_FIELD_LABELS);
  }

  if (section === 'dailyWorkInput') {
    return summarizeArrayChanges(
      label,
      beforeValue,
      afterValue,
      (item, index) => `${index}`,
      getProgressText,
      { day: 'hari', team: 'team', install: 'install', hold: 'hold', cancel: 'cancel' },
    );
  }

  if (section === 'teams') {
    return summarizeArrayChanges(
      label,
      beforeValue,
      afterValue,
      (item, index) => `${index}`,
      (item) => item.name || 'Team tanpa nama',
      { name: 'nama' },
    );
  }

  if (section === 'siteStatuses') {
    return summarizeArrayChanges(
      label,
      beforeValue,
      afterValue,
      (item, index) => `${index}`,
      (item) => item.name || 'Site tanpa nama',
      { name: 'nama', status: 'status', team: 'team', note: 'note' },
    );
  }

  if (section === 'updateSchedules') {
    return summarizeArrayChanges(
      label,
      beforeValue,
      afterValue,
      (item, index) => `${index}`,
      (item) => `${item.time || '-'} ${item.label || ''}`.trim(),
      { time: 'jam', label: 'keterangan' },
    );
  }

  return isSameValue(beforeValue, afterValue)
    ? []
    : [createChange(label, 'edit', 'data', 'Data lama', 'Data baru')];
}

function summarizeContentUpdates(currentContent, updates) {
  const changes = Object.entries(updates).flatMap(([section, value]) =>
    summarizeSectionChange(section, currentContent[section], value)
  );

  return changes.length > 0
    ? {
        changes,
        summaries: changes.map(formatChangeSummary),
      }
    : {
        changes: [],
        summaries: ['Data disimpan tanpa perubahan nilai'],
      };
}

function canEditSection(admin, section) {
  return admin.isAdministrator || admin.permissions.includes(SECTION_PERMISSIONS[section]);
}

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canEditData && !admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini belum punya izin admin.' }, 403);
    }

    const content = await getDashboardContent();

    return jsonResponse({
      content,
      permissions: admin.permissions,
      isAdministrator: admin.isAdministrator,
      editableSections: Object.fromEntries(
        Object.keys(SECTION_PERMISSIONS).map((section) => [section, canEditSection(admin, section)])
      ),
    });
  });
}

export async function PATCH(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    const body = await request.json();
    const updates = body.updates || {};
    const currentContent = await getDashboardContent();
    const nextContent = { ...currentContent };

    for (const [section, value] of Object.entries(updates)) {
      if (!SECTION_PERMISSIONS[section]) {
        return jsonResponse({ error: `Bagian ${section} tidak dikenal.` }, 400);
      }

      if (!canEditSection(admin, section)) {
        return jsonResponse({ error: `Akun ini tidak punya izin edit bagian ${section}.` }, 403);
      }

      nextContent[section] = value;
    }

    const savedContent = await saveDashboardContent(nextContent);
    const updateSummary = summarizeContentUpdates(currentContent, updates);

    await recordAdminActivity(request, admin, 'Edit Website', 'dashboard-content', {
      sections: Object.keys(updates).map((section) => SECTION_LABELS[section] || section),
      changes: updateSummary.changes,
      summaries: updateSummary.summaries,
    });

    return jsonResponse({ content: savedContent });
  });
}
