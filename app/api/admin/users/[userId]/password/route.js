import {
  getCurrentAdmin,
  getUserSummary,
  jsonResponse,
  updateUserPassword,
  withRequiredSession,
} from '../../../../../server/adminAuth';
import SuperTokens from 'supertokens-node';
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
    const newPassword = String(body.newPassword || '');

    if (newPassword.length < 8) {
      return jsonResponse({ error: 'Password baru minimal 8 karakter.' }, 400);
    }

    const { userId } = await params;
    const targetUser = await SuperTokens.getUser(userId);
    const targetSummary = targetUser ? await getUserSummary(targetUser) : undefined;

    if (!targetSummary) {
      return jsonResponse({ error: 'Target user tidak ditemukan.' }, 404);
    }

    if (!admin.isAdministrator && targetSummary.roles.includes('administrator')) {
      return jsonResponse({ error: 'Admin tidak bisa reset password akun Administrator.' }, 403);
    }

    const result = await updateUserPassword(userId, newPassword);

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal reset password: ${result.status}` }, 400);
    }

    await recordAdminActivity(request, admin, 'Reset password user', targetSummary?.username || userId, {
      targetUserId: userId,
      summaries: [`User: ${targetSummary?.displayName || targetSummary?.username || userId}`],
    });

    return jsonResponse({ status: 'OK' });
  });
}
