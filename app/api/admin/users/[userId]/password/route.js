import { getCurrentAdmin, jsonResponse, updateUserPassword, withRequiredSession } from '../../../../../server/adminAuth';

export async function PATCH(request, { params }) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini tidak punya izin reset password.' }, 403);
    }

    const body = await request.json();
    const newPassword = String(body.newPassword || '');

    if (newPassword.length < 8) {
      return jsonResponse({ error: 'Password baru minimal 8 karakter.' }, 400);
    }

    const { userId } = await params;
    const result = await updateUserPassword(userId, newPassword);

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal reset password: ${result.status}` }, 400);
    }

    return jsonResponse({ status: 'OK' });
  });
}
