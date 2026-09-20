import {
  deleteUserAccount,
  getCurrentAdmin,
  getUserSummary,
  jsonResponse,
  withRequiredSession,
} from '../../../../server/adminAuth';
import { SUPER_ADMIN_USERNAME, emailToUsername } from '../../../../config/admin';
import { recordAdminActivity } from '../../../../server/activityLog';
import SuperTokens from 'supertokens-node';

export async function DELETE(request, { params }) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini tidak punya izin Pengelola User.' }, 403);
    }

    const { userId } = await params;

    if (userId === admin.user.id) {
      return jsonResponse({ error: 'Akun yang sedang login tidak bisa menghapus dirinya sendiri.' }, 400);
    }

    const targetUser = await SuperTokens.getUser(userId);
    const targetSummary = targetUser ? await getUserSummary(targetUser) : undefined;

    if (!targetSummary) {
      return jsonResponse({ error: 'Target user tidak ditemukan.' }, 404);
    }

    if (emailToUsername(targetSummary.email) === SUPER_ADMIN_USERNAME) {
      return jsonResponse({ error: 'Administrator utama tidak boleh dihapus.' }, 403);
    }

    if (!admin.isAdministrator && targetSummary.roles.includes('administrator')) {
      return jsonResponse({ error: 'Admin tidak bisa menghapus akun Administrator.' }, 403);
    }

    const result = await deleteUserAccount(userId);

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal hapus akun: ${result.status}` }, 400);
    }

    await recordAdminActivity(request, admin, 'Hapus akun user', targetSummary.username, {
      targetUserId: userId,
      summaries: [
        `User: ${targetSummary.displayName || targetSummary.username}`,
        `Role terakhir: ${targetSummary.roles.length ? targetSummary.roles.join(', ') : 'User biasa'}`,
        'Data akun dihapus dari sistem SuperTokens',
      ],
    });

    return jsonResponse({ status: 'OK', deletedUser: targetSummary });
  });
}
