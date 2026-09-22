import SuperTokens from 'supertokens-node';
import EmailPasswordNode from 'supertokens-node/recipe/emailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import UserMetadataNode from 'supertokens-node/recipe/usermetadata';
import UserRolesNode from 'supertokens-node/recipe/userroles';
import { withSession } from 'supertokens-node/nextjs';
import { ensureSuperTokensInit } from '../config/backend';
import {
  ADMIN_ROLE_IDS,
  ADMIN_ROLES,
  emailToUsername,
  formatUsernameForDisplay,
  getPermissionsFromRoles,
  isSuperAdminUsername,
} from '../config/admin';

const TENANT_ID = 'public';

export function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}

export async function ensureAdminRoles() {
  ensureSuperTokensInit();

  await Promise.all(
    Object.entries(ADMIN_ROLES).map(([role, config]) =>
      UserRolesNode.createNewRoleOrAddPermissions(role, config.permissions)
    )
  );
}

export function withRequiredSession(request, handler) {
  ensureSuperTokensInit();

  return withSession(
    request,
    async (error, session) => {
      if (error) {
        if (error instanceof SessionNode.Error) {
          console.error('Session verification failed:', error);
          return jsonResponse({ error: 'SESSION_INVALID' }, 440);
        }

        console.error('Admin request failed:', error);
        return jsonResponse(
          {
            error: 'SERVER_ERROR',
            message: error.message === 'DATABASE_URL is not configured.'
              ? 'Database belum dikonfigurasi untuk environment ini.'
              : 'Terjadi error saat memproses permintaan admin.',
          },
          500
        );
      }

      if (!session) {
        return jsonResponse({ error: 'LOGIN_REQUIRED' }, 440);
      }

      return handler(session);
    },
    { sessionRequired: false }
  );
}

export async function getUserSummary(user) {
  const email = user.emails[0] || '';
  const username = emailToUsername(email);
  const metadataResponse = await UserMetadataNode.getUserMetadata(user.id);
  const displayName = String(metadataResponse.metadata.displayName || '').trim()
    || formatUsernameForDisplay(username);
  const rolesResponse = await UserRolesNode.getRolesForUser(TENANT_ID, user.id);
  const roles = rolesResponse.status === 'OK' ? rolesResponse.roles : [];

  return {
    id: user.id,
    username,
    displayName,
    email,
    roles,
    permissions: getPermissionsFromRoles(roles),
    timeJoined: user.timeJoined,
  };
}

export async function updateCurrentUserDisplayName(session, displayName) {
  const safeDisplayName = String(displayName || '').trim().slice(0, 80);

  if (!safeDisplayName) {
    return { status: 'EMPTY_DISPLAY_NAME' };
  }

  await UserMetadataNode.updateUserMetadata(session.getUserId(), {
    displayName: safeDisplayName,
  });

  return { status: 'OK' };
}

export async function getSessionUser(session) {
  const userId = session.getUserId();
  const user = await SuperTokens.getUser(userId);

  if (!user) {
    return undefined;
  }

  return user;
}

export async function getCurrentAdmin(session) {
  await ensureAdminRoles();

  const user = await getSessionUser(session);
  if (!user) {
    return { status: 'UNKNOWN_USER' };
  }

  const summary = await getUserSummary(user);
  const isAdministrator = summary.roles.includes('administrator');
  const canManageUsers = summary.permissions.includes('users:manage');
  const canEditData = summary.permissions.some((permission) => permission.startsWith('content:'));

  return {
    status: 'OK',
    user,
    summary,
    isAdministrator,
    canManageUsers,
    canEditData,
    permissions: summary.permissions,
  };
}

// Bootstrap hanya boleh dijalankan jika pemilik deployment memasang BOOTSTRAP_SECRET
// di environment variable (Vercel) dan mengirimkan nilai yang sama persis saat memanggil
// endpoint ini. Ini mencegah orang lain mendaftar dengan username "yyudis606" lalu
// mengklaim role administrator sebelum pemilik asli sempat melakukannya (race condition).
export async function bootstrapSuperAdminIfNeeded(session, providedSecret) {
  await ensureAdminRoles();

  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return { status: 'BOOTSTRAP_DISABLED' };
  }

  if (!providedSecret || providedSecret !== bootstrapSecret) {
    return { status: 'INVALID_BOOTSTRAP_SECRET' };
  }

  const existingAdministrators = await UserRolesNode.getUsersThatHaveRole(TENANT_ID, 'administrator');
  if (existingAdministrators.status !== 'OK') {
    return { status: existingAdministrators.status };
  }

  if (existingAdministrators.users.length > 0) {
    return { status: 'ADMINISTRATOR_ALREADY_EXISTS' };
  }

  const user = await getSessionUser(session);
  if (!user) {
    return { status: 'UNKNOWN_USER' };
  }

  const username = emailToUsername(user.emails[0] || '');
  if (!isSuperAdminUsername(username)) {
    return { status: 'NOT_SUPER_ADMIN_USERNAME' };
  }

  const response = await UserRolesNode.addRoleToUser(TENANT_ID, user.id, 'administrator');
  if (response.status !== 'OK') {
    return { status: response.status };
  }

  return { status: 'OK', user: await getUserSummary(user) };
}

export async function listAllUsers() {
  const result = await SuperTokens.getUsersNewestFirst({
    tenantId: TENANT_ID,
    limit: 200,
    includeRecipeIds: ['emailpassword'],
  });

  return Promise.all(result.users.map((user) => getUserSummary(user)));
}

export async function setUserRoles(targetUserId, roles) {
  await ensureAdminRoles();

  const safeRoles = roles.filter((role) => ADMIN_ROLE_IDS.includes(role));
  const currentRolesResponse = await UserRolesNode.getRolesForUser(TENANT_ID, targetUserId);
  const currentRoles = currentRolesResponse.status === 'OK' ? currentRolesResponse.roles : [];

  await Promise.all(
    currentRoles
      .filter((role) => ADMIN_ROLE_IDS.includes(role) && !safeRoles.includes(role))
      .map((role) => UserRolesNode.removeUserRole(TENANT_ID, targetUserId, role))
  );

  await Promise.all(
    safeRoles
      .filter((role) => !currentRoles.includes(role))
      .map((role) => UserRolesNode.addRoleToUser(TENANT_ID, targetUserId, role))
  );

  const user = await SuperTokens.getUser(targetUserId);
  return user ? getUserSummary(user) : undefined;
}

export async function deleteUserAccount(targetUserId) {
  const user = await SuperTokens.getUser(targetUserId);
  if (!user) {
    return { status: 'UNKNOWN_USER_ID_ERROR' };
  }

  const summary = await getUserSummary(user);
  await SuperTokens.deleteUser(targetUserId, true);

  return { status: 'OK', user: summary };
}

export async function updateUserPassword(targetUserId, newPassword) {
  const user = await SuperTokens.getUser(targetUserId);
  if (!user) {
    return { status: 'UNKNOWN_USER_ID_ERROR' };
  }

  const emailPasswordLoginMethod = user.loginMethods.find(
    (method) => method.recipeId === 'emailpassword'
  );

  if (!emailPasswordLoginMethod) {
    return { status: 'NO_EMAIL_PASSWORD_LOGIN_METHOD' };
  }

  return EmailPasswordNode.updateEmailOrPassword({
    recipeUserId: emailPasswordLoginMethod.recipeUserId,
    password: newPassword,
    applyPasswordPolicy: true,
    tenantIdForPasswordPolicy: TENANT_ID,
  });
}

// Ganti password akun sendiri (self-service), setelah verifikasi password lama.
// Dipakai setiap akun (Administrator, Admin, editor) untuk mengganti password milik
// mereka sendiri, misalnya setelah password sempat di-reset oleh pengelola user.
export async function changeOwnPassword(session, currentPassword, newPassword) {
  const user = await getSessionUser(session);
  if (!user) {
    return { status: 'UNKNOWN_USER' };
  }

  const email = user.emails[0] || '';
  if (!email) {
    return { status: 'NO_EMAIL_PASSWORD_LOGIN_METHOD' };
  }

  const verifyResponse = await EmailPasswordNode.verifyCredentials(TENANT_ID, email, currentPassword);
  if (verifyResponse.status !== 'OK') {
    return { status: 'WRONG_CURRENT_PASSWORD' };
  }

  const result = await updateUserPassword(user.id, newPassword);
  if (result.status !== 'OK') {
    return result;
  }

  return { status: 'OK', user: await getUserSummary(user) };
}
