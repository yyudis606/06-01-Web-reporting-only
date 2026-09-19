import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    return jsonResponse({
      user: admin.summary,
      isAdministrator: admin.isAdministrator,
      canManageUsers: admin.canManageUsers,
      canEditData: admin.canEditData,
    });
  });
}
