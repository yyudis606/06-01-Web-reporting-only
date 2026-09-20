import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';
import {
  clearActivityLogs,
  listActivityLogs,
  recordAdminActivity,
} from '../../../server/activityLog';

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.isAdministrator && !admin.canManageUsers && !admin.canEditData) {
      return jsonResponse({ error: 'Akun ini belum punya izin melihat history aktivitas.' }, 403);
    }

    const { searchParams } = new URL(request.url);
    const logs = await listActivityLogs(searchParams.get('limit') || 100);

    await recordAdminActivity(request, admin, 'View Only');

    return jsonResponse({ logs });
  });
}

export async function DELETE(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.isAdministrator) {
      return jsonResponse({ error: 'Hanya administrator yang bisa menghapus history aktivitas.' }, 403);
    }

    const deletedRows = await clearActivityLogs();
    await recordAdminActivity(request, admin, 'Hapus History', 'activity-log', {
      summaries: [`Hapus ${deletedRows} log lama`],
    });

    const logs = await listActivityLogs(100);

    return jsonResponse({ logs, deletedRows });
  });
}
