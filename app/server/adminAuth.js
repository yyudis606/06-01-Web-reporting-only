import SuperTokens from 'supertokens-node';
import EmailPasswordNode from 'supertokens-node/recipe/emailpassword';
import UserRolesNode from 'supertokens-node/recipe/userroles';
import { withSession } from 'supertokens-node/nextjs';
import { ensureSuperTokensInit } from '../config/backend';
import {
  ADMIN_ROLE_IDS,
  ADMIN_ROLES,
  emailToUsername,
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
        console.error('Session verification failed:', error);
        return jsonResponse({ error: 'SESSION_INVALID' }, 440);
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
  const rolesResponse = await UserRolesNode.getRolesForUser(TENANT_ID, user.id);
  const roles = rolesResponse.status === 'OK' ? rolesResponse.roles : [];

  return {
    id: user.id,
    username: emailToUsername(email),
    email,
    roles,
    permissions: getPermissionsFromRoles(roles),
    timeJoined: user.timeJoined,
  };
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

export async function bootstrapSuperAdminIfNeeded(session) {
  await ensureAdminRoles();

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
