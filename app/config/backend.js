// KONFIGURASI BACKEND SUPERTOKENS
// File ini menghubungkan aplikasi ke "Core" SuperTokens (server penyimpan data login).
//
// Command edit:
// - SUPERTOKENS_CONNECTION_URI di .env.local = alamat SuperTokens Core.
//   Default memakai Core demo (https://try.supertokens.com) khusus untuk testing.
//   JANGAN dipakai untuk data user asli/production.
// - SUPERTOKENS_API_KEY di .env.local = wajib diisi kalau pakai Core Managed Service / self-host berbayar.

import SuperTokens from 'supertokens-node';
import EmailPasswordNode from 'supertokens-node/recipe/emailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import UserRolesNode from 'supertokens-node/recipe/userroles';
import { appInfo } from './appInfo';

export const backendConfig = () => ({
  framework: 'custom',
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'https://try.supertokens.com',
    apiKey: process.env.SUPERTOKENS_API_KEY,
  },
  appInfo,
  recipeList: [
    EmailPasswordNode.init({
      override: {
        apis: (originalImplementation) => ({
          ...originalImplementation,
          generatePasswordResetTokenPOST: undefined,
          passwordResetPOST: undefined,
        }),
      },
    }),
    SessionNode.init(),
    UserRolesNode.init(),
  ],
  isInServerlessEnv: true,
});

let initialized = false;

// Panggil fungsi ini di setiap file backend (API route) sebelum memakai SuperTokens.
export function ensureSuperTokensInit() {
  if (!initialized) {
    SuperTokens.init(backendConfig());
    initialized = true;
  }
}
