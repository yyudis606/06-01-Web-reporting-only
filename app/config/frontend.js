// KONFIGURASI FRONTEND SUPERTOKENS
// File ini mengatur tampilan login/signup bawaan SuperTokens (email + password).
// Command edit:
// - Kalau mau tambah metode login lain (Google, Github, dll), tambahkan recipe di sini.

'use client';

import EmailPasswordReact from 'supertokens-auth-react/recipe/emailpassword';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui';
import SessionReact from 'supertokens-auth-react/recipe/session';
import { appInfo } from './appInfo';

const routerInfo = {};

export function setRouter(router, pathName) {
  routerInfo.router = router;
  routerInfo.pathName = pathName;
}

export const frontendConfig = () => ({
  appInfo,
  recipeList: [
    EmailPasswordReact.init(),
    SessionReact.init({
      maxRetryAttemptsForSessionRefresh: 1,
    }),
  ],
  windowHandler: (original) => ({
    ...original,
    location: {
      ...original.location,
      getPathName: () => routerInfo.pathName,
      assign: (url) => routerInfo.router.push(url.toString()),
      setHref: (url) => routerInfo.router.push(url.toString()),
    },
  }),
});

// Daftar UI bawaan yang dipakai. Halaman /auth memakai daftar ini untuk render form login.
export const PreBuiltUIList = [EmailPasswordPreBuiltUI];
