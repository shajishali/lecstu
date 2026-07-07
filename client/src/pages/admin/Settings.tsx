import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import { useAuthStore } from '@store/authStore';
import { useLanguageStore, type UiLanguage } from '@store/languageStore';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  KeyRound,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  Server,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface ServiceStatus {
  label: string;
  healthy: boolean;
  url?: string;
  enabled?: boolean;
}

interface EmailVerificationStatus extends ServiceStatus {
  mode: 'smtp' | 'console' | 'unconfigured';
  configured: boolean;
  passwordResetReady: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
  smtpUser: string;
  mailFrom: string;
  senderMasked: string;
  smtpDisabled: boolean;
  hasAppPassword: boolean;
  universitySmtpConfigured?: boolean;
}

interface AdminSettings {
  platform: {
    name: string;
    subtitle: string;
    environment: string;
    clientUrl: string;
    uploadMaxMb: number;
    jwtAccessExpiry: string;
    appointmentMinNoticeHours: number;
  };
  services: {
    api: ServiceStatus;
    asr: ServiceStatus;
    indoorNavigation: ServiceStatus;
    floorplanVision: ServiceStatus;
    email: EmailVerificationStatus;
  };
  facultySetup: {
    ready: boolean;
    allBuildingsExist: boolean;
    phase: string;
    activeFloors: number[];
    totalExpectedFloors: number;
    totalUploaded: number;
    phase11Target: number;
    phase11Uploaded: number;
    phase11Published: number;
    buildings: Array<{
      code: string;
      name: string;
      exists: boolean;
      uploadedCount: number;
      floors: number;
      phase11PublishedCount: number;
      phase11MissingFloors: number[];
    }>;
  };
}

const LANGUAGE_OPTIONS: { value: UiLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'si', label: 'සිංහල (Sinhala)' },
];

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }`}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label ?? (ok ? 'Online' : 'Offline')}
    </span>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user } = useAuthStore();
  const uiLanguage = useLanguageStore((s) => s.uiLanguage);
  const setUiLanguage = useLanguageStore((s) => s.setUiLanguage);

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);
  const [emailForm, setEmailForm] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    mailFrom: 'LECSTU <lecstu.system@gmail.com>',
    smtpDisabled: false,
  });

  const loadSettings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get<{ success: boolean; data: AdminSettings }>('/admin/settings');
      setSettings(res.data.data);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const email = settings?.services.email;
    if (!email) return;
    setEmailForm({
      smtpHost: email.smtpHost && email.smtpHost !== '(console log)' ? email.smtpHost : 'smtp.gmail.com',
      smtpPort: String(email.smtpPort || 587),
      smtpUser: email.smtpUser || '',
      smtpPass: '',
      mailFrom: email.mailFrom || 'LECSTU <lecstu.system@gmail.com>',
      smtpDisabled: email.smtpDisabled ?? false,
    });
  }, [settings?.services.email]);

  const handleSeedFaculty = async () => {
    setSeeding(true);
    try {
      await api.post('/admin/buildings/seed-faculty');
      showToast('success', 'Faculty buildings seeded successfully');
      await loadSettings(true);
    } catch (err) {
      showApiErrorToast(err, 'Failed to seed faculty buildings');
    } finally {
      setSeeding(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/admin/settings/test-email');
      showToast('success', res.data.message);
    } catch (err) {
      showApiErrorToast(err, 'Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSaveEmailSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingEmailSettings(true);
    try {
      const res = await api.patch<{ success: boolean; message: string; data: { email: EmailVerificationStatus } }>(
        '/admin/settings/email',
        {
          smtpHost: emailForm.smtpHost.trim(),
          smtpPort: parseInt(emailForm.smtpPort, 10) || 587,
          smtpUser: emailForm.smtpUser.trim(),
          mailFrom: emailForm.mailFrom.trim(),
          smtpDisabled: emailForm.smtpDisabled,
          ...(emailForm.smtpPass.trim() ? { smtpPass: emailForm.smtpPass.trim() } : {}),
        },
      );
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              services: { ...prev.services, email: res.data.data.email },
            }
          : prev,
      );
      setEmailForm((prev) => ({ ...prev, smtpPass: '' }));
      showToast('success', res.data.message || 'Email settings saved');
    } catch (err) {
      showApiErrorToast(err, 'Failed to save email settings');
    } finally {
      setSavingEmailSettings(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('error', 'New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await api.patch('/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('success', 'Password updated successfully');
    } catch (err) {
      showApiErrorToast(err, 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading settings...</p>
      </div>
    );
  }

  const serviceEntries = settings
    ? (Object.entries(settings.services).filter(([key]) => key !== 'email') as [
        keyof Omit<AdminSettings['services'], 'email'>,
        ServiceStatus,
      ][])
    : [];

  const emailVerification = settings?.services.email;

  const emailModeLabel: Record<EmailVerificationStatus['mode'], string> = {
    smtp: 'SMTP (live send)',
    console: 'Console log (dev)',
    unconfigured: 'Not configured',
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your admin account, platform preferences, and monitor system health.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSettings(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh status
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Account security"
          description="Signed in as administrator"
          icon={<Shield size={20} />}
        >
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-800">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-slate-500">{user?.email}</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                Current password
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                className={inputCls}
                required
                minLength={8}
              />
              <p className="mt-1 text-xs text-slate-500">
                At least 8 characters with one uppercase letter and one number.
              </p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className={inputCls}
                required
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {changingPassword ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <KeyRound size={16} />
              )}
              Update password
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Display & language"
          description="Default UI language for translation across the platform"
          icon={<Globe size={20} />}
        >
          <label htmlFor="uiLanguage" className="mb-1.5 block text-sm font-medium text-slate-700">
            Interface language
          </label>
          <select
            id="uiLanguage"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
            className={inputCls}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm text-slate-500">
            This preference is saved in your browser and applies to translatable UI text. Students and
            lecturers can set their own language from the header.
          </p>
          <Link
            to="/profile"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Edit profile details
          </Link>
        </SectionCard>
      </div>

      {emailVerification && (
        <SectionCard
          title="Email verification (password reset)"
          description="System sender for forgot-password codes - saved on the server (admin only)"
          icon={<Mail size={20} />}
          action={
            <StatusBadge
              ok={emailVerification.passwordResetReady}
              label={emailVerification.passwordResetReady ? 'Ready' : 'Not ready'}
            />
          }
        >
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Phase 12 - sender mailbox (Gmail or Outlook)</p>
            <p className="mt-1 text-amber-800">
              Users receive codes at their <strong>registered email</strong> (Gmail, Outlook) or at a
              personal <strong>recovery email</strong> when they register with @stu.kln.ac.lk.
            </p>
            <p className="mt-2 text-amber-800">
              Gmail often cannot deliver to university Outlook inboxes (Microsoft quarantines external
              senders). To send codes directly to @stu.kln.ac.lk, set{' '}
              <code className="rounded bg-amber-100 px-1">SMTP_UNIVERSITY_*</code> in{' '}
              <code className="rounded bg-amber-100 px-1">server/.env</code> with an Office 365
              @kln.ac.lk mailbox from IT.
              {emailVerification.universitySmtpConfigured ? (
                <span className="mt-1 block font-medium text-emerald-800">
                  University SMTP is configured - @stu.kln.ac.lk registration codes use Office 365.
                </span>
              ) : (
                <span className="mt-1 block font-medium">
                  University SMTP is not configured - students must add a personal recovery email.
                </span>
              )}
            </p>
          </div>

          <form onSubmit={handleSaveEmailSettings} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="smtpHost" className="mb-1.5 block text-sm font-medium text-slate-700">
                  SMTP host
                </label>
                <input
                  id="smtpHost"
                  type="text"
                  value={emailForm.smtpHost}
                  onChange={(e) => setEmailForm((p) => ({ ...p, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label htmlFor="smtpPort" className="mb-1.5 block text-sm font-medium text-slate-700">
                  SMTP port
                </label>
                <input
                  id="smtpPort"
                  type="number"
                  min={1}
                  max={65535}
                  value={emailForm.smtpPort}
                  onChange={(e) => setEmailForm((p) => ({ ...p, smtpPort: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label htmlFor="senderEmail" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Sender email (SMTP_USER)
                </label>
                <input
                  id="senderEmail"
                  type="email"
                  value={emailForm.smtpUser}
                  onChange={(e) => setEmailForm((p) => ({ ...p, smtpUser: e.target.value }))}
                  placeholder="lecstu.system@gmail.com"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label htmlFor="smtpPass" className="mb-1.5 block text-sm font-medium text-slate-700">
                  App password
                </label>
                <input
                  id="smtpPass"
                  type="password"
                  value={emailForm.smtpPass}
                  onChange={(e) => setEmailForm((p) => ({ ...p, smtpPass: e.target.value }))}
                  placeholder={
                    emailVerification.hasAppPassword
                      ? 'Leave blank to keep current password'
                      : 'Gmail App Password (16 characters)'
                  }
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="mailFrom" className="mb-1.5 block text-sm font-medium text-slate-700">
                  From display name (MAIL_FROM)
                </label>
                <input
                  id="mailFrom"
                  type="text"
                  value={emailForm.mailFrom}
                  onChange={(e) => setEmailForm((p) => ({ ...p, mailFrom: e.target.value }))}
                  placeholder='LECSTU <lecstu.system@gmail.com>'
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <input
                type="checkbox"
                checked={emailForm.smtpDisabled}
                onChange={(e) => setEmailForm((p) => ({ ...p, smtpDisabled: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Console mode (do not send real email)</span>
                <span className="mt-0.5 block text-slate-500">
                  Log emails to the API terminal instead of SMTP - useful for local testing.
                </span>
              </span>
            </label>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery mode</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">
                  {emailModeLabel[emailVerification.mode]}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Forgot-password flow</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">
                  {emailVerification.configured
                    ? 'SMTP ready - Phase 12.2+ will enable user reset'
                    : emailVerification.mode === 'console'
                      ? 'Dev mode - codes log to API terminal'
                      : 'Add app password and save, or enable console mode'}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingEmailSettings}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
              >
                {savingEmailSettings ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save size={16} />
                )}
                Save email settings
              </button>
              <button
                type="button"
                onClick={() => void handleSendTestEmail()}
                disabled={sendingTestEmail || !emailVerification.passwordResetReady}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingTestEmail ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <Mail size={16} />
                )}
                Send test email to my inbox
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard
        title="AI & platform services"
        description="Live health checks for backend and Python microservices"
        icon={<Server size={20} />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {serviceEntries.map(([key, svc]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{svc.label}</p>
                <p className="truncate text-xs text-slate-500" title={svc.url}>
                  {svc.url || '-'}
                </p>
                {svc.enabled === false && (
                  <p className="mt-1 text-xs text-amber-700">Disabled in server config</p>
                )}
              </div>
              <StatusBadge ok={svc.healthy} />
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          Start offline services from the project root: <code className="rounded bg-slate-100 px-1">npm run asr</code>,{' '}
          <code className="rounded bg-slate-100 px-1">npm run floorplan-vision</code>,{' '}
          <code className="rounded bg-slate-100 px-1">npm run indoor-navigation</code>
        </p>
      </SectionCard>

      {settings && (
        <SectionCard
          title="Campus navigation setup"
          description={`Phase ${settings.facultySetup.phase} - Academic, Administration & Laboratory buildings`}
          icon={<MapPin size={20} />}
          action={
            <StatusBadge
              ok={settings.facultySetup.ready}
              label={settings.facultySetup.ready ? 'Ready' : 'Incomplete'}
            />
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">Floor plans uploaded</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {settings.facultySetup.phase11Uploaded}/{settings.facultySetup.phase11Target}
              </p>
              <p className="text-xs text-slate-500">Active floors (G-F2)</p>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">Published floors</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {settings.facultySetup.phase11Published}/{settings.facultySetup.phase11Target}
              </p>
              <p className="text-xs text-slate-500">Ready for student navigation</p>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">All buildings</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {settings.facultySetup.allBuildingsExist ? 'Seeded' : 'Missing'}
              </p>
              <p className="text-xs text-slate-500">ACAD · ADMIN · LAB</p>
            </div>
          </div>

          <div className="space-y-2">
            {settings.facultySetup.buildings.map((b) => (
              <div
                key={b.code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[var(--color-primary)]" />
                  <span className="text-sm font-medium text-slate-800">
                    {b.code} - {b.name}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {b.uploadedCount}/{b.floors} floors · {b.phase11PublishedCount} published (phase)
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!settings.facultySetup.allBuildingsExist && (
              <button
                type="button"
                onClick={() => void handleSeedFaculty()}
                disabled={seeding}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {seeding ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <Sparkles size={16} />
                )}
                Seed faculty buildings
              </button>
            )}
            <Link
              to="/admin/navigation"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              <MapPin size={16} />
              Open indoor navigation admin
            </Link>
          </div>
        </SectionCard>
      )}

      {settings && (
        <SectionCard
          title="Platform configuration"
          description="Read-only summary of current server settings"
          icon={<Save size={20} />}
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['Platform', `${settings.platform.name} - ${settings.platform.subtitle}`],
              ['Environment', settings.platform.environment],
              ['Client URL', settings.platform.clientUrl],
              ['Max upload size', `${settings.platform.uploadMaxMb} MB`],
              ['JWT access expiry', settings.platform.jwtAccessExpiry],
              [
                'Appointment notice',
                `${settings.platform.appointmentMinNoticeHours} hours minimum advance booking`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      )}
    </div>
  );
}
