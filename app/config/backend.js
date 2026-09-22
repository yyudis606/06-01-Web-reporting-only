// KONFIGURASI BACKEND SUPERTOKENS
// File ini menghubungkan aplikasi ke "Core" SuperTokens (server penyimpan data login).
//
// Command edit:
// - SUPERTOKENS_CONNECTION_URI di .env.local = WAJIB diisi, alamat SuperTokens Core Anda sendiri.
//   Tidak ada fallback ke Core demo publik — jika kosong, aplikasi akan gagal (fail closed)
//   supaya data login tidak pernah tanpa sengaja terkirim ke server pihak ketiga.
// - SUPERTOKENS_API_KEY di .env.local = wajib diisi kalau pakai Core Managed Service / self-host berbayar.

import SuperTokens from 'supertokens-node';
import EmailPasswordNode from 'supertokens-node/recipe/emailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import UserMetadataNode from 'supertokens-node/recipe/usermetadata';
import UserRolesNode from 'supertokens-node/recipe/userroles';
import { appInfo } from './appInfo';
import { getPasswordValidationError } from './password';

export const backendConfig = () => {
  const connectionURI = process.env.SUPERTOKENS_CONNECTION_URI;

  if (!connectionURI) {
    // Jangan pernah diam-diam memakai Core demo publik (try.supertokens.com) di production —
    // itu bisa membocorkan data akun/login ke pihak ketiga. Gagal secara jelas sebagai gantinya.
    throw new Error(
      'SUPERTOKENS_CONNECTION_URI belum diisi. Set environment variable ini ke alamat SuperTokens Core Anda sendiri.'
    );
  }

  return {
    framework: 'custom',
    supertokens: {
      connectionURI,
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo,
    recipeList: [
      EmailPasswordNode.init({
        signUpFeature: {
          formFields: [
            {
              id: 'password',
              validate: async (value) => {
                const error = getPasswordValidationError(value);
                return error ? error : undefined;
              },
            },
          ],
        },
        override: {
          apis: (originalImplementation) => ({
            ...originalImplementation,
            generatePasswordResetTokenPOST: undefined,
            passwordResetPOST: undefined,
          }),
        },
      }),
      SessionNode.init(),
      UserMetadataNode.init(),
      UserRolesNode.init(),
    ],
    isInServerlessEnv: true,
  };
};

let initialized = false;

// Panggil fungsi ini di setiap file backend (API route) sebelum memakai SuperTokens.
export function ensureSuperTokensInit() {
  if (!initialized) {
    SuperTokens.init(backendConfig());
    initialized = true;
  }
}
