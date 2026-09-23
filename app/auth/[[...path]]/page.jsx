'use client';

import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { normalizeUsername, usernameToEmail } from '../../config/admin';
import { PASSWORD_REQUIREMENT_NOTE, getPasswordValidationError } from '../../config/password';
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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Kadang ada gangguan jaringan sesaat antara server kita dan SuperTokens Core
// (misalnya saat maintenance singkat di sisi provider), yang membuat satu
// request gagal dengan error jaringan sementara. Coba ulang beberapa kali
// dengan jeda singkat sebelum menampilkan error ke pengguna.
async function withRetry(action, { retries = 2, delayMs = 700 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(delayMs * (attempt + 1));
      }
    }
  }

  throw lastError;
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

    const displayUsername = username.trim();
    const normalizedUsername = normalizeUsername(displayUsername);

    if (!normalizedUsername) {
      setMessage('Username wajib diisi.');
      setIsLoading(false);
      return;
    }

    if (mode === 'signup') {
      const passwordError = getPasswordValidationError(password);
      if (passwordError) {
        setMessage(passwordError);
        setIsLoading(false);
        return;
      }
    } else if (!password) {
      setMessage('Password wajib diisi.');
      setIsLoading(false);
      return;
    }

    const formFields = [
      { id: 'email', value: usernameToEmail(normalizedUsername) },
      { id: 'password', value: password },
    ];

    try {
      const response = await withRetry(() => (
        mode === 'signin'
          ? EmailPassword.signIn({ formFields })
          : EmailPassword.signUp({ formFields })
      ));

      if (response.status === 'OK') {
        await fetch('/api/admin/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: displayUsername }),
        });
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
              placeholder="Minimal 8 karakter, ada angka"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>

          {mode === 'signup' ? (
            <p className="auth-hint">{PASSWORD_REQUIREMENT_NOTE}</p>
          ) : null}

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
