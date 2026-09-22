import { bootstrapSuperAdminIfNeeded, jsonResponse, withRequiredSession } from '../../../server/adminAuth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const providedSecret = request.headers.get('x-bootstrap-secret') || body?.secret;

  return withRequiredSession(request, async (session) => {
    const result = await bootstrapSuperAdminIfNeeded(session, providedSecret);

    if (result.status === 'BOOTSTRAP_DISABLED') {
      return jsonResponse({ error: 'Bootstrap administrator dinonaktifkan. Set BOOTSTRAP_SECRET untuk mengaktifkan.' }, 403);
    }

    if (result.status === 'INVALID_BOOTSTRAP_SECRET') {
      return jsonResponse({ error: 'Kode rahasia bootstrap salah atau tidak diisi.' }, 403);
    }

    if (result.status === 'UNKNOWN_USER') {
      return jsonResponse({ error: 'User tidak ditemukan.' }, 404);
    }

    if (result.status === 'NOT_SUPER_ADMIN_USERNAME') {
      return jsonResponse({ error: 'Username ini bukan administrator utama.' }, 403);
    }

    if (result.status === 'ADMINISTRATOR_ALREADY_EXISTS') {
      return jsonResponse({ error: 'Administrator sudah ada. Role hanya bisa diubah oleh Administrator.' }, 403);
    }

    if (result.status !== 'OK') {
      return jsonResponse({ error: `Gagal membuat administrator: ${result.status}` }, 500);
    }

    return jsonResponse({ user: result.user });
  });
}
