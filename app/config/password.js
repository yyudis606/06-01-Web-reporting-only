// ATURAN PASSWORD (dipakai di semua tempat: login/signup, ganti password sendiri,
// dan reset password oleh admin) supaya konsisten dan mudah diubah dari satu tempat.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENT_NOTE =
  `Password minimal ${PASSWORD_MIN_LENGTH} karakter dan wajib mengandung minimal 1 angka.`;

export function getPasswordValidationError(password) {
  const value = String(password || '');

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }

  if (!/[0-9]/.test(value)) {
    return 'Password wajib mengandung minimal 1 angka.';
  }

  return undefined;
}
