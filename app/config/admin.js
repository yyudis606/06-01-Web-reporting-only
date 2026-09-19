export const AUTH_EMAIL_DOMAIN = 'devanycode.local';
export const SUPER_ADMIN_USERNAME = 'yyudis606';

export const ADMIN_ROLES = {
  administrator: {
    label: 'Administrator',
    description: 'Bisa edit semuanya, mengatur admin, dan reset password user.',
    permissions: [
      'content:text',
      'content:project',
      'content:schedules',
      'content:teams',
      'content:daily-work',
      'content:sites',
      'users:manage',
    ],
  },
  textEditor: {
    label: 'Edit Teks Dashboard',
    description: 'Bisa mengubah judul, subtitle, dan teks panel dashboard.',
    permissions: ['content:text'],
  },
  projectEditor: {
    label: 'Edit Target Project',
    description: 'Bisa mengubah total site dan target install per hari.',
    permissions: ['content:project'],
  },
  scheduleEditor: {
    label: 'Edit Jadwal Update',
    description: 'Bisa mengatur jam pemberitahuan update harian.',
    permissions: ['content:schedules'],
  },
  teamEditor: {
    label: 'Edit Team',
    description: 'Bisa menambah, mengubah, dan menghapus nama team.',
    permissions: ['content:teams'],
  },
  dailyWorkEditor: {
    label: 'Input Hasil Harian',
    description: 'Bisa input install, hold, dan cancel harian tiap team.',
    permissions: ['content:daily-work'],
  },
  siteEditor: {
    label: 'Edit Data Site',
    description: 'Bisa mengatur nama site, status, team lokasi, dan catatan site.',
    permissions: ['content:sites'],
  },
  userManager: {
    label: 'Pengelola User',
    description: 'Bisa mengangkat admin dan reset password user.',
    permissions: ['users:manage'],
  },
};

export const ADMIN_ROLE_IDS = Object.keys(ADMIN_ROLES);

export function normalizeUsername(username = '') {
  return username.trim().toLowerCase();
}

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email = '') {
  return email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)
    ? email.slice(0, -(`@${AUTH_EMAIL_DOMAIN}`.length))
    : email;
}

export function isSuperAdminUsername(username) {
  return normalizeUsername(username) === SUPER_ADMIN_USERNAME;
}

export function getRoleDefinition(role) {
  return ADMIN_ROLES[role];
}

export function getPermissionsFromRoles(roles = []) {
  return [...new Set(roles.flatMap((role) => ADMIN_ROLES[role]?.permissions || []))];
}
