import { getCurrentAdmin, jsonResponse, listAllUsers, withRequiredSession } from '../../../server/adminAuth';

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini tidak punya izin Pengelola User.' }, 403);
    }

    const users = await listAllUsers();
    const visibleUsers = admin.isAdministrator
      ? users
      : users.filter((user) => !user.roles.includes('administrator'));

    return jsonResponse({ users: visibleUsers });
  });
}
