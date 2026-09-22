import { getCurrentAdmin, jsonResponse, withRequiredSession } from '../../../server/adminAuth';

export async function GET(request) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      // Sesi masih tersimpan di browser tapi akunnya sudah dihapus dari sistem
      // (misalnya lewat fitur hapus akun). Perlakukan seperti sesi tidak valid
      // supaya client otomatis membersihkan status login, bukan menampilkan error.
      return jsonResponse({ error: 'SESSION_INVALID' }, 440);
    }

    return jsonResponse({
      user: admin.summary,
      isAdministrator: admin.isAdministrator,
      canManageUsers: admin.canManageUsers,
      canEditData: admin.canEditData,
    });
  });
}
