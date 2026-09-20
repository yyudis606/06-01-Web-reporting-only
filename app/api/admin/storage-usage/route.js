import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';
import { getStorageUsage } from '../../../server/storageUsage';

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers && !admin.canEditData) {
      return jsonResponse({ error: 'Akun ini belum punya izin admin.' }, 403);
    }

    const usage = await getStorageUsage();

    return jsonResponse({ usage });
  });
}
