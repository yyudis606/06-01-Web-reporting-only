'use client';

import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { normalizeUsername, usernameToEmail } from '../../config/admin';
import './style.scss';

function toUsernameMessage(message) {
  return message
    .replace(/This email already exists\. Please sign in instead\./gi, 'Username sudah terdaftar. Silakan login.')
    .replace(/email address/gi, 'username')
    .replace(/email/gi, 'username');
}

function getFieldError(response, fallback) {
  if (response.status === 'FIELD_ERROR') {
    return response.formFields.map((field) => toUsernameMessage(field.error)).join(' ');
  }

  return fallback;
}

async function bootstrapAdministratorIfAllowed() {
  const response = await fetch('/api/admin/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.ok;
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectToPath = searchParams.get('redirectToPath') || '/admin';
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername) {
      setMessage('Username wajib diisi.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setMessage('Password minimal 8 karakter.');
      setIsLoading(false);
      return;
    }

    const formFields = [
      { id: 'email', value: usernameToEmail(normalizedUsername) },
      { id: 'password', value: password },
    ];

    try {
      const response = mode === 'signin'
        ? await EmailPassword.signIn({ formFields })
        : await EmailPassword.signUp({ formFields });

      if (response.status === 'OK') {
        await bootstrapAdministratorIfAllowed();
        router.push(redirectToPath);
        return;
      }

      if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        setMessage('Username atau password salah.');
      } else {
        setMessage(getFieldError(response, 'Login gagal. Coba lagi.'));
      }
    } catch (error) {
      console.error('Username/password auth failed:', error);
      setMessage('Terjadi error saat login. Pastikan SuperTokens Core sedang berjalan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <Image
            src="/images/brand/devanycode(1).svg"
            alt="devANYcode"
            width={180}
            height={44}
            className="auth-brand__logo"
            priority
          />
          <p className="auth-eyebrow">Admin</p>
        </div>
        <h1>{mode === 'signin' ? 'Login Administrator' : 'Buat User Baru'}</h1>
        <p>
          Website dashboard tetap bisa dilihat publik. Login ini hanya untuk admin yang
          akan mengedit data dan mengelola user.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="contoh: devANYcode"
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>

          {message ? <div className="auth-message">{message}</div> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Memproses...'
              : mode === 'signin'
                ? 'Login'
                : 'Buat User'}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMessage('');
            setMode(mode === 'signin' ? 'signup' : 'signin');
          }}
        >
          {mode === 'signin'
            ? 'Belum punya user? Buat user baru'
            : 'Sudah punya user? Login'}
        </button>

        <p className="auth-note">
          Catatan: lupa password tidak memakai email. Password user hanya bisa di-reset oleh
          administrator.
        </p>
      </section>
    </main>
  );
}
