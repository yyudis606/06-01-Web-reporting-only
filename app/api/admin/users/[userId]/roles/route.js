import SuperTokens from 'supertokens-node';
import {
  getCurrentAdmin,
  getUserSummary,
  jsonResponse,
  setUserRoles,
  withRequiredSession,
} from '../../../../../server/adminAuth';
import { SUPER_ADMIN_USERNAME, emailToUsername } from '../../../../../config/admin';
import { recordAdminActivity } from '../../../../../server/activityLog';

export async function PATCH(request, { params }) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini tidak punya izin Pengelola User.' }, 403);
    }

    const body = await request.json();
    const roles = Array.isArray(body.roles) ? body.roles : [];
    const { userId } = await params;

    if (!admin.isAdministrator && roles.includes('administrator')) {
      return jsonResponse({ error: 'Admin tidak bisa memberi role Administrator.' }, 403);
    }

    const targetUser = await SuperTokens.getUser(userId);
    const targetSummary = targetUser ? await getUserSummary(targetUser) : undefined;

    if (!targetSummary) {
      return jsonResponse({ error: 'Target user tidak ditemukan.' }, 404);
    }

    if (!admin.isAdministrator && targetSummary.roles.includes('administrator')) {
      return jsonResponse({ error: 'Admin tidak bisa melihat atau mengubah akun Administrator.' }, 403);
    }

    const currentSummary = await setUserRoles(userId, roles);

    if (!currentSummary) {
      return jsonResponse({ error: 'Target user tidak ditemukan.' }, 404);
    }

    if (
      emailToUsername(currentSummary.email) === SUPER_ADMIN_USERNAME &&
      !currentSummary.roles.includes('administrator')
    ) {
      const restoredSummary = await setUserRoles(userId, [...currentSummary.roles, 'administrator']);
      return jsonResponse({
        error: 'Administrator utama tidak boleh kehilangan role Administrator.',
        user: restoredSummary,
      }, 400);
    }

    await recordAdminActivity(request, admin, 'Mengubah role user', currentSummary.username, {
      roles: currentSummary.roles,
      summaries: [
        `User: ${currentSummary.displayName || currentSummary.username}`,
        `Role aktif: ${currentSummary.roles.length ? currentSummary.roles.join(', ') : 'User biasa'}`,
      ],
    });

    return jsonResponse({ user: currentSummary });
  });
}
