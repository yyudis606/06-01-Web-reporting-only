import { getCurrentAdmin, jsonResponse, setUserRoles, withRequiredSession } from '../../../../../server/adminAuth';
import { SUPER_ADMIN_USERNAME, emailToUsername } from '../../../../../config/admin';

export async function PATCH(request, { params }) {
  return withRequiredSession(request, async (session) => {
    const admin = await getCurrentAdmin(session);

    if (admin.status !== 'OK') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (!admin.canManageUsers) {
      return jsonResponse({ error: 'Akun ini tidak punya izin mengelola user.' }, 403);
    }

    const body = await request.json();
    const roles = Array.isArray(body.roles) ? body.roles : [];
    const { userId } = await params;
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

    return jsonResponse({ user: currentSummary });
  });
}
