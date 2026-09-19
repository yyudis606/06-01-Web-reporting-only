'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doesSessionExist, SessionAuth, signOut } from 'supertokens-auth-react/recipe/session';
import { ADMIN_ROLES } from '../config/admin';
import './style.scss';

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function AdminPage() {
  return (
    <SessionAuth>
      <AdminContent />
    </SessionAuth>
  );
}

function AdminContent() {
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState(null);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState(null);
  const [editableSections, setEditableSections] = useState({});
  const [activeEditor, setActiveEditor] = useState('dailyWorkInput');
  const [message, setMessage] = useState('Memuat data admin...');
  const [passwordInputs, setPasswordInputs] = useState({});
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const roleEntries = useMemo(() => Object.entries(ADMIN_ROLES), []);

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

  const toggleRole = async (user, role, checked) => {
    const nextRoles = checked
      ? [...new Set([...user.roles, role])]
      : user.roles.filter((item) => item !== role);

    showToast('loading', 'Memperbarui Hak Akses', `Memproses role ${user.username}...`, 0);

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
    showToast('success', 'Hak Akses Tersimpan', `Role ${user.username} berhasil diperbarui.`);
    setUsers((currentUsers) =>
      currentUsers.map((item) => (item.id === data.user.id ? data.user : item))
    );
  };

  const resetPassword = async (user) => {
    const newPassword = passwordInputs[user.id] || '';

    if (newPassword.length < 8) {
      setMessage('Password baru minimal 8 karakter.');
      showToast('error', 'Password Belum Direset', 'Password baru minimal 8 karakter.');
      return;
    }

    showToast('loading', 'Mereset Password', `Memproses password ${user.username}...`, 0);

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
    setMessage(`Password ${user.username} berhasil di-reset.`);
    showToast('success', 'Password Reset', `Password ${user.username} berhasil di-reset.`);
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
          <h1>Manajemen Administrator</h1>
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
          <strong>Login sebagai: {adminInfo.user.username}</strong>
          <span>
            Role: {adminInfo.user.roles.length ? adminInfo.user.roles.join(', ') : 'Belum ada role admin'}
          </span>
        </section>
      ) : null}

      {message ? <div className="admin-message">{message}</div> : null}

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
                    <strong>{user.username}</strong>
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
                    placeholder="Password baru"
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
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
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
