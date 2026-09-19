import { bootstrapSuperAdminIfNeeded, jsonResponse, withRequiredSession } from '../../../server/adminAuth';

export async function POST(request) {
  return withRequiredSession(request, async (session) => {
    const result = await bootstrapSuperAdminIfNeeded(session);

    if (result.status === 'UNKNOWN_USER') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (result.status === 'NOT_SUPER_ADMIN_USERNAME') {
      return jsonResponse({ error: 'Username ini bukan administrator utama.' }, 403);
    }

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal membuat administrator: ${result.status}` }, 500);
    }

    return jsonResponse({ user: result.user });
  });
}
