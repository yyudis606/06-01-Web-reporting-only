// KONFIGURASI DASAR SUPERTOKENS
// Command edit:
// - appName = nama aplikasi yang tampil di halaman login.
// - apiDomain / websiteDomain = alamat website saat dev dan production.
// - Nilai domain diambil dari .env.local, isi env var sebelum deploy.

export const appInfo = {
  appName: 'Dashboard Progress Instalasi Site',
  apiDomain: process.env.NEXT_PUBLIC_API_DOMAIN || 'http://localhost:3000',
  websiteDomain: process.env.NEXT_PUBLIC_WEBSITE_DOMAIN || 'http://localhost:3000',
  apiBasePath: '/api/auth',
  websiteBasePath: '/auth',
};
