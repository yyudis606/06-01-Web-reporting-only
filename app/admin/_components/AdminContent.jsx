'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doesSessionExist, signOut } from 'supertokens-auth-react/recipe/session';
import { ADMIN_ROLES, SUPER_ADMIN_USERNAME } from '../../config/admin';
import { PASSWORD_REQUIREMENT_NOTE, getPasswordValidationError } from '../../config/password';

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatBytes(bytes = 0) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes) || 0;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function parseLegacySummary(summary) {
  const [section, ...restParts] = String(summary).split(': ');
  const rest = restParts.join(': ');

  if (!section || !rest) {
    return undefined;
  }

  if (rest.startsWith('add ')) {
    const value = rest.slice(4);
    return {
      id: summary,
      type: 'change',
      section,
      changeType: 'add',
      label: value,
      before: '-',
      after: value,
    };
  }

  if (rest.startsWith('delete ')) {
    const value = rest.slice(7);
    return {
      id: summary,
      type: 'change',
      section,
      changeType: 'delete',
      label: value,
      before: value,
      after: '-',
    };
  }

  if (rest.startsWith('edit ') && rest.includes(' to ')) {
    const withoutEdit = rest.slice(5);
    const [leftSide, after] = withoutEdit.split(/\s+to\s+(.+)/);
    const lastSpaceIndex = leftSide.lastIndexOf(' ');
    const label = lastSpaceIndex > -1 ? leftSide.slice(0, lastSpaceIndex) : 'data';
    const before = lastSpaceIndex > -1 ? leftSide.slice(lastSpaceIndex + 1) : leftSide;

    return {
      id: summary,
      type: 'change',
      section,
      changeType: 'edit',
      label,
      before,
      after,
    };
  }

  return undefined;
}

function normalizeLogDetails(details = {}) {
  if (Array.isArray(details.changes) && details.changes.length > 0) {
    return details.changes.map((change, index) => ({
      id: `${change.section}-${change.label}-${index}`,
      type: 'change',
      section: change.section,
      changeType: change.type,
      label: change.label,
      before: change.before || '-',
      after: change.after || '-',
    }));
  }

  if (Array.isArray(details.summaries) && details.summaries.length > 0) {
    return details.summaries.map((summary) =>
      parseLegacySummary(summary) || {
        id: summary,
        type: 'text',
        text: summary,
      }
    );
  }

  if (Array.isArray(details.sections) && details.sections.length > 0) {
    return [{
      id: 'sections',
      type: 'text',
      text: `Bagian diedit: ${details.sections.join(', ')}`,
    }];
  }

  const entries = Object.entries(details)
    .filter(([key, value]) => !['totalShown', 'sections', 'summaries'].includes(key) && value !== undefined && value !== null);

  if (entries.length === 0) {
    return [];
  }

  return entries.map(([key, value]) => ({
    id: key,
    type: 'text',
    text: `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
  }));
}

function getLogActionLabel(action) {
  if (action === 'Melihat history aktivitas') {
    return 'View Only';
  }

  return action;
}

function getChangeTypeLabel(type) {
  if (type === 'add') {
    return 'Tambah';
  }

  if (type === 'delete') {
    return 'Hapus';
  }

  return 'Edit';
}

export default function AdminContent() {
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [storageUsage, setStorageUsage] = useState(null);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState(null);
  const [editableSections, setEditableSections] = useState({});
  const [activeEditor, setActiveEditor] = useState('dailyWorkInput');
  const [message, setMessage] = useState('Memuat data admin...');
  const [passwordInputs, setPasswordInputs] = useState({});
  const [ownPasswordForm, setOwnPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingOwnPassword, setIsChangingOwnPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const roleEntries = useMemo(
    () => Object.entries(ADMIN_ROLES)
      .filter(([role]) => adminInfo?.isAdministrator || role !== 'administrator'),
    [adminInfo?.isAdministrator],
  );
  const adminTitle = adminInfo?.isAdministrator ? 'Manajemen Administrator' : 'Manajemen Admin';

  function showToast(type, title, detail, duration = 3500) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ type, title, detail });

    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, duration);
    }
  }

  async function redirectToLogin(messageText = 'Session login sudah kedaluwarsa. Silakan login ulang.') {
    setMessage(messageText);
    showToast('error', 'Session Berakhir', messageText);
    await signOut();
    router.push('/auth');
  }

  async function fetchAdminJson(url, options) {
    const hasActiveSession = await doesSessionExist();

    if (!hasActiveSession) {
      await redirectToLogin();
      return {
        response: new Response(null, { status: 401 }),
        data: { error: 'SESSION_EXPIRED' },
        sessionExpired: true,
      };
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.status === 401 || response.status === 440) {
      await redirectToLogin();
      return { response, data, sessionExpired: true };
    }

    return { response, data, sessionExpired: false };
  }

  async function loadAdminData() {
    setMessage('Memuat data admin...');

    const { response: meResponse, data: meData, sessionExpired } = await fetchAdminJson('/api/admin/me');

    if (sessionExpired) {
      return;
    }

    if (!meResponse.ok) {
      setMessage(meData.message || meData.error || 'Gagal membaca session admin.');
      return;
    }

    setAdminInfo(meData);

    if (!meData.canManageUsers && !meData.canEditData) {
      setMessage('Akun ini belum punya izin admin. Login sebagai yyudis606 untuk menjadi administrator utama.');
      return;
    }

    if (meData.canEditData || meData.canManageUsers) {
      const {
        response: contentResponse,
        data: contentData,
        sessionExpired: contentSessionExpired,
      } = await fetchAdminJson('/api/admin/content');

      if (contentSessionExpired) {
        return;
      }

      if (!contentResponse.ok) {
        setMessage(contentData.message || contentData.error || 'Gagal memuat editor website.');
        return;
      }

      setContent(contentData.content);
      setEditableSections(contentData.editableSections);
    }

    if (meData.canManageUsers) {
      const {
        response: usersResponse,
        data: usersData,
        sessionExpired: usersSessionExpired,
      } = await fetchAdminJson('/api/admin/users');

      if (usersSessionExpired) {
        return;
      }

      if (!usersResponse.ok) {
        setMessage(usersData.message || usersData.error || 'Gagal memuat user.');
        return;
      }

      setUsers(usersData.users);
    }

    if (meData.isAdministrator || meData.canManageUsers || meData.canEditData) {
      const {
        response: storageResponse,
        data: storageData,
        sessionExpired: storageSessionExpired,
      } = await fetchAdminJson('/api/admin/storage-usage');

      if (storageSessionExpired) {
        return;
      }

      if (storageResponse.ok) {
        setStorageUsage(storageData.usage);
      }
    }

    if (meData.isAdministrator || meData.canManageUsers) {
      const {
        response: logsResponse,
        data: logsData,
        sessionExpired: logsSessionExpired,
      } = await fetchAdminJson('/api/admin/activity-log?limit=100');

      if (logsSessionExpired) {
        return;
      }

      if (logsResponse.ok) {
        setActivityLogs(logsData.logs);
      }
    }

    setMessage('');
  }

  useEffect(() => {
    loadAdminData().catch((error) => {
      console.error('Failed to load admin page:', error);
      setMessage('Terjadi error saat memuat halaman admin.');
    });

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/auth');
  };

  const changeMyPassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = ownPasswordForm;

    if (!currentPassword) {
      showToast('error', 'Password Belum Diganti', 'Password saat ini wajib diisi.');
      return;
    }

    const passwordError = getPasswordValidationError(newPassword);
    if (passwordError) {
      showToast('error', 'Password Belum Diganti', passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('error', 'Password Belum Diganti', 'Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsChangingOwnPassword(true);
    showToast('loading', 'Mengganti Password', 'Mohon tunggu, password sedang diperbarui...', 0);

    const { response, data, sessionExpired } = await fetchAdminJson('/api/admin/change-password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setIsChangingOwnPassword(false);

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal mengganti password.';
      setMessage(errorMessage);
      showToast('error', 'Password Belum Diganti', errorMessage);
      return;
    }

    setOwnPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    showToast('success', 'Password Diganti', 'Password akun Anda berhasil diperbarui.');
  };

  const refreshActivityLogs = async ({ silent = false } = {}) => {
    const { response, data, sessionExpired } = await fetchAdminJson('/api/admin/activity-log?limit=100');

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal memuat history aktivitas.';
      setMessage(errorMessage);
      if (!silent) {
        showToast('error', 'History Gagal Dimuat', errorMessage);
      }
      return;
    }

    setActivityLogs(data.logs);
    if (!silent) {
      showToast('success', 'History Diperbarui', 'Data aktivitas terbaru sudah dimuat.');
    }
  };

  const clearActivityLogs = async () => {
    const confirmed = window.confirm(
      'Yakin ingin menghapus history aktivitas? Aksi ini akan menghapus log lama dan menyisakan catatan bahwa history pernah dihapus.',
    );

    if (!confirmed) {
      return;
    }

    showToast('loading', 'Menghapus History', 'Mohon tunggu, history aktivitas sedang dibersihkan...', 0);

    const { response, data, sessionExpired } = await fetchAdminJson('/api/admin/activity-log', {
      method: 'DELETE',
    });

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal menghapus history aktivitas.';
      setMessage(errorMessage);
      showToast('error', 'History Gagal Dihapus', errorMessage);
      return;
    }

    setActivityLogs(data.logs);
    showToast(
      'success',
      'History Dihapus',
      `${data.deletedRows} log lama dihapus. Catatan penghapusan tetap disimpan.`,
    );
  };

  const toggleRole = async (user, role, checked) => {
    const nextRoles = checked
      ? [...new Set([...user.roles, role])]
      : user.roles.filter((item) => item !== role);

    showToast('loading', 'Memperbarui Hak Akses', `Memproses role ${user.displayName}...`, 0);

    const { response, data, sessionExpired } = await fetchAdminJson(`/api/admin/users/${user.id}/roles`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: nextRoles }),
    });

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal mengubah role user.';
      setMessage(errorMessage);
      showToast('error', 'Hak Akses Gagal Diperbarui', errorMessage);
      if (data.user) {
        setUsers((currentUsers) =>
          currentUsers.map((item) => (item.id === data.user.id ? data.user : item))
        );
      }
      return;
    }

    setMessage('Role user berhasil diperbarui.');
    showToast('success', 'Hak Akses Tersimpan', `Role ${user.displayName} berhasil diperbarui.`);
    setUsers((currentUsers) =>
      currentUsers.map((item) => (item.id === data.user.id ? data.user : item))
    );
  };

  const resetPassword = async (user) => {
    const newPassword = passwordInputs[user.id] || '';

    const passwordError = getPasswordValidationError(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      showToast('error', 'Password Belum Direset', passwordError);
      return;
    }

    showToast('loading', 'Mereset Password', `Memproses password ${user.displayName}...`, 0);

    const { response, data, sessionExpired } = await fetchAdminJson(`/api/admin/users/${user.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal reset password.';
      setMessage(errorMessage);
      showToast('error', 'Reset Password Gagal', errorMessage);
      return;
    }

    setPasswordInputs((current) => ({ ...current, [user.id]: '' }));
    setMessage(`Password ${user.displayName} berhasil di-reset.`);
    showToast('success', 'Password Reset', `Password ${user.displayName} berhasil di-reset.`);
  };

  const getDeleteUserBlockReason = (user) => {
    if (user.id === adminInfo?.user?.id) {
      return 'Akun yang sedang login tidak bisa dihapus.';
    }

    if (user.username === SUPER_ADMIN_USERNAME) {
      return 'Administrator utama tidak bisa dihapus.';
    }

    if (!adminInfo?.isAdministrator && user.roles.includes('administrator')) {
      return 'Admin tidak bisa menghapus akun Administrator.';
    }

    return '';
  };

  const deleteUser = async (user) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus akun ${user.displayName}? Akun akan dihapus dari sistem dan tidak bisa login lagi.`,
    );

    if (!confirmed) {
      return;
    }

    showToast('loading', 'Menghapus Akun', `Menghapus akun ${user.displayName} dari sistem...`, 0);

    const { response, data, sessionExpired } = await fetchAdminJson(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
    });

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal menghapus akun.';
      setMessage(errorMessage);
      showToast('error', 'Akun Gagal Dihapus', errorMessage);
      return;
    }

    setUsers((currentUsers) => currentUsers.filter((item) => item.id !== user.id));
    setPasswordInputs((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });
    setMessage(`Akun ${user.displayName} berhasil dihapus.`);
    showToast('success', 'Akun Dihapus', `Akun ${user.displayName} sudah dihapus dari sistem.`);
    refreshActivityLogs({ silent: true });
  };

  const updateContent = (section, value) => {
    setContent((current) => ({
      ...current,
      [section]: value,
    }));
  };

  const saveSection = async (section, nextValue = content[section]) => {
    showToast('loading', 'Menyimpan Perubahan', 'Mohon tunggu, data sedang disimpan...', 0);

    const { response, data, sessionExpired } = await fetchAdminJson('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { [section]: nextValue } }),
    });

    if (sessionExpired) {
      return;
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || 'Gagal menyimpan perubahan.';
      setMessage(errorMessage);
      showToast('error', 'Perubahan Gagal Disimpan', errorMessage);
      return;
    }

    setContent(data.content);
    setMessage('Perubahan berhasil disimpan. Dashboard publik otomatis memakai data terbaru.');
    showToast('success', 'Perubahan Tersimpan', 'Dashboard publik sudah memakai data terbaru.');
  };

  return (
    <main className="admin-page">
      {toast ? (
        <div
          className={`admin-toast admin-toast--${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="admin-toast__icon" aria-hidden="true">
            {toast.type === 'loading' ? '' : toast.type === 'success' ? '✓' : '!'}
          </span>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.detail}</p>
          </div>
          {toast.type !== 'loading' ? (
            <button
              type="button"
              className="admin-toast__close"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Admin Area</p>
          <h1>{adminTitle}</h1>
          {adminInfo?.user?.displayName ? (
            <p className="admin-owner-name">Pemilik akun: {adminInfo.user.displayName}</p>
          ) : null}
          <p>
            Dashboard publik tetap bisa dilihat semua orang. Halaman ini khusus untuk
            mengatur user, role, dan reset password.
          </p>
        </div>

        <div className="admin-actions">
          <Link href="/dashboard">Lihat Dashboard</Link>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {adminInfo ? (
        <section className="admin-current-user">
          <strong>Login sebagai: {adminInfo.user.displayName}</strong>
          <span>
            Role: {adminInfo.user.roles.length ? adminInfo.user.roles.join(', ') : 'Belum ada role admin'}
          </span>
        </section>
      ) : null}

      {message ? <div className="admin-message">{message}</div> : null}

      {adminInfo ? (
        <ChangeMyPasswordPanel
          form={ownPasswordForm}
          isSubmitting={isChangingOwnPassword}
          onChange={(field, value) =>
            setOwnPasswordForm((current) => ({ ...current, [field]: value }))
          }
          onSubmit={changeMyPassword}
        />
      ) : null}

      {storageUsage ? <StorageUsagePanel usage={storageUsage} /> : null}

      {content && adminInfo?.canEditData ? (
        <WebsiteEditor
          activeEditor={activeEditor}
          content={content}
          editableSections={editableSections}
          onChange={updateContent}
          onSave={saveSection}
          setActiveEditor={setActiveEditor}
        />
      ) : null}

      {adminInfo?.isAdministrator || adminInfo?.canManageUsers ? (
        <ActivityLogPanel
          canClear={adminInfo.isAdministrator}
          logs={activityLogs}
          onClear={clearActivityLogs}
          onRefresh={refreshActivityLogs}
        />
      ) : null}

      {adminInfo?.canManageUsers ? (
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <p className="admin-eyebrow">Users</p>
              <h2>Daftar Pengguna</h2>
            </div>
          </div>

          <div className="admin-users">
            {users.map((user) => (
              <article key={user.id} className="admin-user-card">
                <div className="admin-user-card__title">
                  <div>
                    <strong>{user.displayName}</strong>
                    <span>Dibuat: {formatDate(user.timeJoined)}</span>
                  </div>
                  <small>{user.roles.length ? user.roles.join(', ') : 'User biasa'}</small>
                </div>

                <div className="admin-role-list">
                  {roleEntries.map(([role, config]) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        checked={user.roles.includes(role)}
                        onChange={(event) => toggleRole(user, role, event.target.checked)}
                      />
                      <span>
                        <strong>{config.label}</strong>
                        <small>{config.description}</small>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="admin-password-reset">
                  <input
                    type="password"
                    placeholder="Password baru (min 8 karakter, ada angka)"
                    value={passwordInputs[user.id] || ''}
                    onChange={(event) =>
                      setPasswordInputs((current) => ({
                        ...current,
                        [user.id]: event.target.value,
                      }))
                    }
                  />
                  <button type="button" onClick={() => resetPassword(user)}>
                    Reset Password
                  </button>
                </div>
                <p className="admin-password-hint">{PASSWORD_REQUIREMENT_NOTE}</p>

                {(() => {
                  const deleteBlockReason = getDeleteUserBlockReason(user);

                  return (
                    <div className="admin-user-danger-zone">
                      <div>
                        <strong>Hapus Akun</strong>
                        <span>
                          {deleteBlockReason || 'Membersihkan akun dari sistem agar tidak tersimpan di cloud.'}
                        </span>
                      </div>
                      {deleteBlockReason ? null : (
                        <button type="button" className="admin-danger-button" onClick={() => deleteUser(user)}>
                          Hapus Akun
                        </button>
                      )}
                    </div>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ChangeMyPasswordPanel({ form, isSubmitting, onChange, onSubmit }) {
  return (
    <section className="admin-panel admin-change-password">
      <div className="admin-panel__header">
        <div>
          <p className="admin-eyebrow">Akun Saya</p>
          <h2>Ganti Password</h2>
          <p>
            Gunakan ini untuk mengganti password akun Anda sendiri, misalnya setelah
            password sempat di-reset oleh pengelola user.
          </p>
        </div>
      </div>

      <form
        className="admin-change-password__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          Password Saat Ini
          <input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => onChange('currentPassword', event.target.value)}
          />
        </label>

        <label>
          Password Baru
          <input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => onChange('newPassword', event.target.value)}
          />
        </label>

        <label>
          Konfirmasi Password Baru
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => onChange('confirmPassword', event.target.value)}
          />
        </label>

        <p className="admin-password-hint">{PASSWORD_REQUIREMENT_NOTE}</p>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Ganti Password'}
        </button>
      </form>
    </section>
  );
}

function StorageUsagePanel({ usage }) {
  const usedPercent = Math.min(Math.max(Number(usage.usedPercent) || 0, 0), 100);
  const remainingBytes = Math.max((Number(usage.capacityBytes) || 0) - (Number(usage.usedBytes) || 0), 0);

  return (
    <section className="admin-panel admin-storage">
      <div className="admin-panel__header admin-panel__header--split">
        <div>
          <p className="admin-eyebrow">Cloud Storage</p>
          <h2>Kapasitas Data Website</h2>
          <p>Data aktual dari database website dan history aktivitas.</p>
        </div>
        <span className="admin-storage__badge">{usedPercent}% terpakai</span>
      </div>

      <div className="admin-storage__meter" aria-label={`Storage terpakai ${usedPercent}%`}>
        <span style={{ width: `${usedPercent}%` }} />
      </div>

      <div className="admin-storage__grid">
        <div>
          <small>Terpakai</small>
          <strong>{formatBytes(usage.usedBytes)}</strong>
        </div>
        <div>
          <small>Kapasitas</small>
          <strong>{formatBytes(usage.capacityBytes)}</strong>
        </div>
        <div>
          <small>Sisa</small>
          <strong>{formatBytes(remainingBytes)}</strong>
        </div>
        <div>
          <small>History</small>
          <strong>{usage.tables.activityLogRows} / {usage.maxActivityRows}</strong>
        </div>
      </div>

      <div className="admin-storage__details">
        <span>Konten dashboard: {formatBytes(usage.tables.appContentBytes)}</span>
        <span>History aktivitas: {formatBytes(usage.tables.activityLogBytes)}</span>
        <span>Database: {usage.databaseName || '-'}</span>
        <span>Update: {formatDate(usage.measuredAt)}</span>
      </div>
    </section>
  );
}

function ActivityLogPanel({ canClear, logs, onClear, onRefresh }) {
  return (
    <section className="admin-panel admin-activity">
      <div className="admin-panel__header admin-panel__header--split">
        <div>
          <p className="admin-eyebrow">History</p>
          <h2>History Aktivitas Admin</h2>
          <p>Admin bisa melihat history aktivitas. Hapus history hanya tersedia untuk Administrator.</p>
        </div>
        <div className="admin-activity__actions">
          <button type="button" className="admin-secondary-button" onClick={onRefresh}>
            Refresh History
          </button>
          {canClear ? (
            <button type="button" className="admin-danger-button" onClick={onClear}>
              Hapus History
            </button>
          ) : null}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="admin-empty-state">Belum ada aktivitas yang tercatat.</div>
      ) : (
        <div className="admin-activity__list">
          {logs.map((log) => {
            const details = normalizeLogDetails(log.details);

            return (
              <article key={log.id} className="admin-activity__item">
                <div className="admin-activity__time">
                  <strong>{formatDate(log.createdAt)}</strong>
                  <span>{log.ipAddress || 'IP tidak tersedia'}</span>
                </div>
                <div className="admin-activity__content">
                  <strong>{getLogActionLabel(log.action)}</strong>
                  <span>
                    {log.actorUsername}
                    {log.actorRoles?.length ? ` • ${log.actorRoles.join(', ')}` : ''}
                  </span>
                  {details.length > 0 ? (
                    <div className="admin-activity__details">
                      {details.map((detail) => (
                        detail.type === 'change' ? (
                          <div
                            key={detail.id}
                            className={`admin-activity-change admin-activity-change--${detail.changeType}`}
                          >
                            <div className="admin-activity-change__title">
                              <strong>{detail.section}</strong>
                              <span>{getChangeTypeLabel(detail.changeType)} • {detail.label}</span>
                            </div>
                            <div className="admin-activity-change__compare">
                              <div>
                                <small>Data Lama</small>
                                <p>{detail.before}</p>
                              </div>
                              <span aria-hidden="true">→</span>
                              <div>
                                <small>Data Baru</small>
                                <p>{detail.after}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <small key={detail.id} className="admin-activity__text-detail">
                            {detail.text}
                          </small>
                        )
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WebsiteEditor({
  activeEditor,
  content,
  editableSections,
  onChange,
  onSave,
  setActiveEditor,
}) {
  const sections = [
    { id: 'dailyWorkInput', label: 'Input Harian', description: 'Isi install, hold, dan cancel tiap team.', step: '1' },
    { id: 'project', label: 'Target Project', description: 'Ubah total site dan target harian.', step: '2' },
    { id: 'teams', label: 'Team', description: 'Ubah nama dan warna team.', step: '3' },
    { id: 'siteStatuses', label: 'Data Site', description: 'Atur nama, status, team lokasi, dan catatan site.', step: '4' },
    { id: 'updateSchedules', label: 'Jadwal Update', description: 'Atur jam reminder update data.', step: '5' },
    { id: 'text', label: 'Teks Halaman', description: 'Ubah judul dan keterangan dashboard.', step: '6' },
  ].filter((section) => editableSections[section.id]);

  if (sections.length === 0) {
    return (
      <section className="admin-panel">
        <p>Akun ini belum punya izin edit website. Minta administrator memilih izin edit yang diperlukan.</p>
      </section>
    );
  }

  const selectedSection = sections.some((section) => section.id === activeEditor)
    ? activeEditor
    : sections[0].id;
  const selectedSectionInfo = sections.find((section) => section.id === selectedSection);

  return (
    <section className="admin-panel admin-editor">
      <div className="admin-panel__header">
        <div>
          <p className="admin-eyebrow">Website Editor</p>
          <h2>Silahkan Edit Website</h2>
          <p>Pilih menu di kiri, isi form, lalu klik simpan.</p>
        </div>
      </div>

      <div className="editor-shell">
        <aside className="editor-tabs" aria-label="Menu editor website">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={selectedSection === section.id ? 'is-active' : ''}
              onClick={() => setActiveEditor(section.id)}
            >
              <span className="editor-tabs__step">{section.step}</span>
              <span>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="editor-workspace">
          <div className="editor-section-title">
            <p className="admin-eyebrow">Sedang diedit</p>
            <h3>{selectedSectionInfo?.label}</h3>
            <p>{selectedSectionInfo?.description}</p>
          </div>

          {selectedSection === 'text' ? (
            <TextEditor
              text={content.text}
              onChange={(text) => onChange('text', text)}
              onSave={() => onSave('text')}
            />
          ) : null}

          {selectedSection === 'project' ? (
            <ProjectEditor
              project={content.project}
              onChange={(project) => onChange('project', project)}
              onSave={() => onSave('project')}
            />
          ) : null}

          {selectedSection === 'updateSchedules' ? (
            <ScheduleEditor
              schedules={content.updateSchedules}
              onChange={(schedules) => onChange('updateSchedules', schedules)}
              onSave={() => onSave('updateSchedules')}
            />
          ) : null}

          {selectedSection === 'teams' ? (
            <TeamEditor
              teams={content.teams}
              onChange={(teams) => onChange('teams', teams)}
              onSave={() => onSave('teams')}
            />
          ) : null}

          {selectedSection === 'siteStatuses' ? (
            <SiteEditor
              sites={content.siteStatuses}
              teams={content.teams}
              onChange={(sites) => onChange('siteStatuses', sites)}
              onSave={() => onSave('siteStatuses')}
            />
          ) : null}

          {selectedSection === 'dailyWorkInput' ? (
            <DailyWorkEditor
              rows={content.dailyWorkInput}
              teams={content.teams}
              onChange={(rows) => onChange('dailyWorkInput', rows)}
              onSave={(rows) => onSave('dailyWorkInput', rows)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EditorActions({ onSave, label = 'Simpan Perubahan' }) {
  return (
    <div className="editor-actions">
      <span>Perubahan belum masuk dashboard sebelum disimpan.</span>
      <button type="button" onClick={onSave}>{label}</button>
    </div>
  );
}

function TextEditor({ text, onChange, onSave }) {
  const fields = [
    ['title', 'Judul Utama'],
    ['subtitle', 'Sub Judul'],
    ['exportButton', 'Teks Tombol Export'],
    ['trendSubtitle', 'Label Panel Trend'],
    ['weeklySubtitle', 'Label Panel Produktivitas'],
    ['weeklyTitle', 'Judul Panel Produktivitas'],
    ['divisionSubtitle', 'Label Panel Team'],
    ['divisionTitle', 'Judul Panel Team'],
    ['workSubtitle', 'Label Panel Hasil Kerja'],
    ['workTitle', 'Judul Panel Hasil Kerja'],
    ['updateSubtitle', 'Label Reminder'],
    ['updateTitle', 'Judul Reminder'],
    ['updateDescription', 'Keterangan Reminder'],
  ];

  return (
    <div className="editor-form editor-form--grid">
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            value={text[key] || ''}
            onChange={(event) => onChange({ ...text, [key]: event.target.value })}
          />
        </label>
      ))}
      <EditorActions onSave={onSave} />
    </div>
  );
}

function ProjectEditor({ project, onChange, onSave }) {
  return (
    <div className="editor-form editor-form--grid">
      <label>
        Total Site
        <input
          type="number"
          min="0"
          value={project.totalSite}
          onChange={(event) => onChange({ ...project, totalSite: Number(event.target.value) })}
        />
      </label>
      <label>
        Target Install Per Hari
        <input
          type="number"
          min="0"
          value={project.dailyInstallTarget}
          onChange={(event) => onChange({ ...project, dailyInstallTarget: Number(event.target.value) })}
        />
      </label>
      <EditorActions onSave={onSave} />
    </div>
  );
}

function ScheduleEditor({ schedules, onChange, onSave }) {
  const updateRow = (index, nextRow) => {
    onChange(schedules.map((row, rowIndex) => (rowIndex === index ? nextRow : row)));
  };

  return (
    <div className="editor-form">
      {schedules.map((schedule, index) => (
        <div key={`${schedule.time}-${index}`} className="editor-row">
          <label>
            Jam
            <input
              type="time"
              value={schedule.time}
              onChange={(event) => updateRow(index, { ...schedule, time: event.target.value })}
            />
          </label>
          <label>
            Label
            <input
              value={schedule.label}
              onChange={(event) => updateRow(index, { ...schedule, label: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => onChange(schedules.filter((_, rowIndex) => rowIndex !== index))}>
            Hapus
          </button>
        </div>
      ))}
      <button type="button" className="editor-secondary" onClick={() => onChange([...schedules, { time: '10:00', label: 'Update baru' }])}>
        + Tambah Jadwal
      </button>
      <EditorActions onSave={onSave} />
    </div>
  );
}

function TeamEditor({ teams, onChange, onSave }) {
  const updateRow = (index, nextRow) => {
    onChange(teams.map((row, rowIndex) => (rowIndex === index ? nextRow : row)));
  };

  return (
    <div className="editor-form">
      {teams.map((team, index) => (
        <div key={`${team.name}-${index}`} className="editor-row">
          <label>
            Nama Team
            <input
              value={team.name}
              onChange={(event) => updateRow(index, { ...team, name: event.target.value })}
            />
          </label>
          <label>
            Warna
            <input
              type="color"
              value={team.color}
              onChange={(event) => updateRow(index, { ...team, color: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => onChange(teams.filter((_, rowIndex) => rowIndex !== index))}>
            Hapus
          </button>
        </div>
      ))}
      <button type="button" className="editor-secondary" onClick={() => onChange([...teams, { name: `Team ${teams.length + 1}`, color: '#3b82f6' }])}>
        + Tambah Team
      </button>
      <EditorActions onSave={onSave} />
    </div>
  );
}

function SiteEditor({ sites, teams, onChange, onSave }) {
  const updateRow = (index, nextRow) => {
    onChange(sites.map((site, siteIndex) => (siteIndex === index ? nextRow : site)));
  };

  return (
    <div className="editor-form">
      <p className="editor-help">
        Status Done untuk site selesai, Open untuk belum dikerjakan, Hold untuk tertunda,
        dan Cancel untuk dibatalkan. Isi note jika ada alasan khusus.
      </p>

      {sites.map((site, index) => {
        const currentTeam = site.team || teams[0]?.name || 'Belum ditentukan';
        const availableTeams = teams.some((team) => team.name === currentTeam)
          ? teams
          : [{ name: currentTeam }, ...teams];

        return (
          <div key={`${site.name}-${index}`} className="editor-row editor-row--site">
            <label>
              Nama Site
              <input
                value={site.name || ''}
                placeholder="Contoh: Site A"
                onChange={(event) => updateRow(index, { ...site, name: event.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={site.status || 'Open'}
                onChange={(event) => updateRow(index, { ...site, status: event.target.value })}
              >
                <option value="Open">Open</option>
                <option value="Done">Done</option>
                <option value="Hold">Hold</option>
                <option value="Cancel">Cancel</option>
              </select>
            </label>
            <label>
              Team ke Lokasi
              <select
                value={currentTeam}
                onChange={(event) => updateRow(index, { ...site, team: event.target.value })}
              >
                {availableTeams.map((team) => (
                  <option key={team.name} value={team.name}>{team.name}</option>
                ))}
              </select>
            </label>
            <label>
              Note
              <input
                value={site.note || ''}
                placeholder="Kosongkan jika tidak ada catatan"
                onChange={(event) => updateRow(index, { ...site, note: event.target.value })}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(sites.filter((_, siteIndex) => siteIndex !== index))}
            >
              Hapus
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className="editor-secondary"
        onClick={() => onChange([
          ...sites,
          {
            name: `Site ${sites.length + 1}`,
            status: 'Open',
            team: teams[0]?.name || 'Belum ditentukan',
            note: '',
          },
        ])}
      >
        + Tambah Site
      </button>
      <EditorActions onSave={onSave} />
    </div>
  );
}

function DailyWorkEditor({ rows, teams, onChange, onSave }) {
  const maxDay = rows.length ? Math.max(...rows.map((row) => Number(row.day || 0))) : 0;
  const [newRow, setNewRow] = useState({
    day: maxDay + 1 || 1,
    team: teams[0]?.name || 'Team A',
    install: 0,
    hold: 0,
    cancel: 0,
  });
  const totals = rows.reduce(
    (sum, row) => ({
      install: sum.install + Number(row.install || 0),
      hold: sum.hold + Number(row.hold || 0),
      cancel: sum.cancel + Number(row.cancel || 0),
    }),
    { install: 0, hold: 0, cancel: 0 },
  );
  const rowsWithIndex = rows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => Number(a.day) - Number(b.day) || a.team.localeCompare(b.team));

  const updateRow = (index, nextRow) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row)));
  };

  const normalizeDraftRow = () => ({
    day: Number(newRow.day || 1),
    team: newRow.team || teams[0]?.name || 'Team A',
    install: Number(newRow.install || 0),
    hold: Number(newRow.hold || 0),
    cancel: Number(newRow.cancel || 0),
  });

  const hasDraftData = () => {
    const draft = normalizeDraftRow();
    return draft.install > 0 || draft.hold > 0 || draft.cancel > 0;
  };

  const getNextDraft = (currentDraft) => ({
    day: Number(currentDraft.day || 0) + 1,
    team: currentDraft.team,
    install: 0,
    hold: 0,
    cancel: 0,
  });

  const addRow = () => {
    const draft = normalizeDraftRow();
    onChange([...rows, draft]);
    setNewRow(getNextDraft(draft));
  };

  const saveRows = () => {
    const draft = normalizeDraftRow();
    const nextRows = hasDraftData() ? [...rows, draft] : rows;

    if (hasDraftData()) {
      onChange(nextRows);
      setNewRow(getNextDraft(draft));
    }

    onSave(nextRows);
  };

  return (
    <div className="editor-form editor-daily">
      <div className="editor-summary-grid">
        <div>
          <span>Total Baris</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Total Install</span>
          <strong>{totals.install}</strong>
        </div>
        <div>
          <span>Total Hold</span>
          <strong>{totals.hold}</strong>
        </div>
        <div>
          <span>Total Cancel</span>
          <strong>{totals.cancel}</strong>
        </div>
      </div>

      <div className="editor-quick-add">
        <div>
          <h4>Tambah Update Harian</h4>
          <p>Isi data baru di sini, lalu klik simpan. Data yang masih di form ini ikut tersimpan otomatis.</p>
          <code>jam 10:00, 16:00, atau 21:00</code>
        </div>
        <label>
          Hari
          <input
            type="number"
            min="1"
            value={newRow.day}
            onChange={(event) => setNewRow({ ...newRow, day: Number(event.target.value) })}
          />
        </label>
        <label>
          Team
          <select
            value={newRow.team}
            onChange={(event) => setNewRow({ ...newRow, team: event.target.value })}
          >
            {teams.map((team) => (
              <option key={team.name} value={team.name}>{team.name}</option>
            ))}
          </select>
        </label>
        <label>
          Install
          <input
            type="number"
            min="0"
            value={newRow.install}
            onChange={(event) => setNewRow({ ...newRow, install: Number(event.target.value) })}
          />
        </label>
        <label>
          Hold
          <input
            type="number"
            min="0"
            value={newRow.hold}
            onChange={(event) => setNewRow({ ...newRow, hold: Number(event.target.value) })}
          />
        </label>
        <label>
          Cancel
          <input
            type="number"
            min="0"
            value={newRow.cancel}
            onChange={(event) => setNewRow({ ...newRow, cancel: Number(event.target.value) })}
          />
        </label>
        <button type="button" className="editor-secondary" onClick={addRow}>
          + Tambah ke Daftar
        </button>
      </div>

      <div className="editor-table-card">
        <div className="editor-table-title">
          <div>
            <h4>Daftar Input yang Sudah Ada</h4>
            <p>Data diurutkan berdasarkan hari. Kamu tetap bisa edit angka lama jika ada koreksi.</p>
          </div>
        </div>

        <div className="editor-daily-header">
          <span>Hari</span>
          <span>Team</span>
          <span>Install</span>
          <span>Hold</span>
          <span>Cancel</span>
          <span>Aksi</span>
        </div>

        <div className="editor-daily-list">
          {rowsWithIndex.map((row) => (
            <div key={`${row.day}-${row.team}-${row.index}`} className="editor-row editor-row--daily">
              <label>
                <span>Hari</span>
                <input
                  type="number"
                  min="1"
                  value={row.day}
                  onChange={(event) => updateRow(row.index, { ...rows[row.index], day: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Team</span>
                <select
                  value={row.team}
                  onChange={(event) => updateRow(row.index, { ...rows[row.index], team: event.target.value })}
                >
                  {teams.map((team) => (
                    <option key={team.name} value={team.name}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Install</span>
                <input
                  type="number"
                  min="0"
                  value={row.install}
                  onChange={(event) => updateRow(row.index, { ...rows[row.index], install: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Hold</span>
                <input
                  type="number"
                  min="0"
                  value={row.hold}
                  onChange={(event) => updateRow(row.index, { ...rows[row.index], hold: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Cancel</span>
                <input
                  type="number"
                  min="0"
                  value={row.cancel}
                  onChange={(event) => updateRow(row.index, { ...rows[row.index], cancel: Number(event.target.value) })}
                />
              </label>
              <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== row.index))}>
                Hapus
              </button>
            </div>
          ))}
        </div>
      </div>

      <EditorActions onSave={saveRows} label="Simpan Input Harian" />
    </div>
  );
}
