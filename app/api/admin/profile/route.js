import {
  jsonResponse,
  updateCurrentUserDisplayName,
  withRequiredSession,
} from '../../../server/adminAuth';

export async function PATCH(request) {
  return withRequiredSession(request, async (session) => {
    const body = await request.json();
    const result = await updateCurrentUserDisplayName(session, body.displayName);

    if (result.status !== 'OK') {
      return jsonResponse({ error: 'Nama akun tidak boleh kosong.' }, 400);
    }

    return jsonResponse({ status: 'OK' });
  });
}
