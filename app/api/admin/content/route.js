import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';
import { getDashboardContent, saveDashboardContent } from '../../../server/contentStore';

const SECTION_PERMISSIONS = {
  text: 'content:text',
  project: 'content:project',
  updateSchedules: 'content:schedules',
  teams: 'content:teams',
  dailyWorkInput: 'content:daily-work',
};

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

    await saveDashboardContent(nextContent);

    return jsonResponse({ content: nextContent });
  });
}
