import { getAppDirRequestHandler } from 'supertokens-node/nextjs';
import { ensureSuperTokensInit } from '../../../config/backend';
import { emailToUsername } from '../../../config/admin';
import { recordActivity } from '../../../server/activityLog';

// Route ini menangani semua endpoint auth SuperTokens (login, signup, logout, refresh token, dll)
// Path: /api/auth/*
ensureSuperTokensInit();

const handleCall = getAppDirRequestHandler();

async function readAuthEmail(request) {
  try {
    const body = await request.clone().json();
    const emailField = body.formFields?.find((field) => field.id === 'email');
    return String(emailField?.value || '');
  } catch {
    return '';
  }
}

export async function GET(request) {
  const response = await handleCall(request);
  if (!response.headers.has('Cache-Control')) {
    // Wajib untuk deploy di Vercel, agar token session tidak ke-cache.
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  }
  return response;
}

export async function POST(request) {
  const pathname = new URL(request.url).pathname;
  const isSignIn = pathname.endsWith('/signin');
  const isSignUp = pathname.endsWith('/signup');
  const email = isSignIn || isSignUp ? await readAuthEmail(request) : '';
  const response = await handleCall(request);

  if (!(isSignIn || isSignUp) || !email) {
    return response;
  }

  const responseText = await response.text();
  let responseBody = {};

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = {};
  }

  if (response.ok && responseBody.status === 'OK') {
    await recordActivity({
      request,
      actorUsername: emailToUsername(email),
      action: isSignIn ? 'Login berhasil' : 'Akun dibuat',
      target: 'auth',
      details: {
        method: 'username-password',
      },
    });
  }

  return new Response(responseText, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function DELETE(request) {
  return handleCall(request);
}

export async function PUT(request) {
  return handleCall(request);
}

export async function PATCH(request) {
  return handleCall(request);
}

export async function HEAD(request) {
  return handleCall(request);
}
