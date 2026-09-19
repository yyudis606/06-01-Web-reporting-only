import { getAppDirRequestHandler } from 'supertokens-node/nextjs';
import { ensureSuperTokensInit } from '../../../config/backend';

// Route ini menangani semua endpoint auth SuperTokens (login, signup, logout, refresh token, dll)
// Path: /api/auth/*
ensureSuperTokensInit();

const handleCall = getAppDirRequestHandler();

export async function GET(request) {
  const response = await handleCall(request);
  if (!response.headers.has('Cache-Control')) {
    // Wajib untuk deploy di Vercel, agar token session tidak ke-cache.
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  }
  return response;
}

export async function POST(request) {
  return handleCall(request);
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
