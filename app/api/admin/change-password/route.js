import {
  changeOwnPassword,
  getCurrentAdmin,
  jsonResponse,
  withRequiredSession,
} from '../../../server/adminAuth';
import { recordAdminActivity } from '../../../server/activityLog';
import { getPasswordValidationError } from '../../../config/password';

export async function PATCH(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword) {
      return jsonResponse({ error: 'Password saat ini wajib diisi.' }, 400);
    }

    const passwordError = getPasswordValidationError(newPassword);
    if (passwordError) {
      return jsonResponse({ error: passwordError }, 400);
    }

    if (newPassword === currentPassword) {
      return jsonResponse({ error: 'Password baru tidak boleh sama dengan password saat ini.' }, 400);
    }

    const result = await changeOwnPassword(session, currentPassword, newPassword);

    if (result.status === 'WRONG_CURRENT_PASSWORD') {
      return jsonResponse({ error: 'Password saat ini salah.' }, 400);
    }

    if (result.status === 'NO_EMAIL_PASSWORD_LOGIN_METHOD') {
      return jsonResponse({ error: 'Akun ini tidak menggunakan login username/password.' }, 400);
    }

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal mengganti password: ${result.status}` }, 400);
    }

    await recordAdminActivity(request, admin, 'Ganti password sendiri', admin.summary?.username, {
      summaries: ['Password akun sendiri diperbarui'],
    });

    return jsonResponse({ status: 'OK' });
  });
}
