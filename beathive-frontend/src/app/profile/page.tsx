'use client';
import { useState, useRef } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/utils';

const BANKS = [
  { code: 'BCA',       name: 'BCA — Bank Central Asia' },
  { code: 'BRI',       name: 'BRI — Bank Rakyat Indonesia' },
  { code: 'BNI',       name: 'BNI — Bank Negara Indonesia' },
  { code: 'Mandiri',   name: 'Bank Mandiri' },
  { code: 'BSI',       name: 'BSI — Bank Syariah Indonesia' },
  { code: 'CIMB',      name: 'CIMB Niaga' },
  { code: 'Permata',   name: 'Bank Permata' },
  { code: 'BTN',       name: 'BTN — Bank Tabungan Negara' },
  { code: 'Danamon',   name: 'Bank Danamon' },
  { code: 'OCBC',      name: 'OCBC NISP' },
  { code: 'Maybank',   name: 'Maybank Indonesia' },
  { code: 'Mega',      name: 'Bank Mega' },
  { code: 'Panin',     name: 'Bank Panin' },
  { code: 'Jenius',    name: 'Jenius / BTPN' },
  { code: 'Jago',      name: 'Bank Jago' },
  { code: 'SeaBank',   name: 'SeaBank' },
  { code: 'Neo',       name: 'Bank Neo Commerce' },
  { code: 'Allo',      name: 'Allo Bank' },
  { code: 'BJB',       name: 'Bank BJB' },
  { code: 'Bukopin',   name: 'Bank Bukopin' },
  { code: 'Muamalat',  name: 'Bank Muamalat' },
  { code: 'Sinarmas',  name: 'Bank Sinarmas' },
  { code: 'GoPay',     name: 'GoPay' },
  { code: 'OVO',       name: 'OVO' },
  { code: 'DANA',      name: 'DANA' },
  { code: 'LinkAja',   name: 'LinkAja' },
  { code: 'ShopeePay', name: 'ShopeePay' },
];

export default function ProfilePage() {
  const isAuth = useRequireAuth();
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [bankName, setBankName] = useState(user?.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(user?.bankAccount ?? '');
  const [bankAccountName, setBankAccountName] = useState(user?.bankAccountName ?? '');
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  if (!isAuth || !user) return null;

  const avatarSrc = mediaUrl(user.avatarUrl) ?? null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await apiClient.post('/auth/avatar', form, {
        headers: { 'Content-Type': undefined },
      });
      setUser({ ...user, avatarUrl: data.avatarUrl });
    } catch (err: any) {
      setProfileMsg({ type: 'err', text: err.response?.data?.message || 'Failed to upload photo. Make sure the file is max 5MB and in JPG/PNG/WebP format.' });
    } finally {
      setUploadingAvatar(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { data } = await apiClient.patch('/auth/profile', {
        name: name.trim(),
        bio,
        bankName,
        bankAccount,
        bankAccountName,
      });
      setUser({
        ...user,
        name: data.name,
        bio: data.bio,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankAccountName: data.bankAccountName,
      });
      setProfileMsg({ type: 'ok', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'err', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'err', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSavingPw(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ type: 'ok', text: 'Password changed successfully.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ type: 'err', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="px-6 lg:px-8 py-8 pb-28 max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Profile</h1>
        <p className="text-sm text-[#6b6f82] mt-1">Manage your public profile, payout details, and security.</p>
      </div>

      <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
        <section className="card rounded-2xl p-5 border border-rim space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden border border-white/20">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-accent-bright">{user.name?.[0]?.toUpperCase()}</span>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Account</h2>
              <p className="text-xs text-[#6b6f82] truncate">{user.email}</p>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                className="mt-2 px-3 py-1.5 text-xs font-medium border border-rim rounded-lg text-[#c4c6d8] hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              >
                {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Display Name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2.5 input-dark rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Email</label>
              <input
                type="email" value={user.email} disabled
                className="w-full px-3 py-2.5 border border-rim rounded-xl text-sm bg-surface/[0.03] text-[#6b6f82] cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Bio</label>
            <textarea
              value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Tell people a bit about yourself..."
              className="w-full px-3 py-2.5 input-dark rounded-xl text-sm resize-none"
            />
          </div>
        </section>

        <section className="card rounded-2xl p-5 border border-rim space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Payout</h2>
            <p className="text-xs text-[#6b6f82] mt-0.5">Used for creator withdrawals. Make sure it matches your bank records.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Bank</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2.5 input-dark rounded-xl text-sm bg-surface"
            >
              <option value="">Select bank...</option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Account Number</label>
            <input
              type="text" value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="e.g. 1234567890"
              className="w-full px-3 py-2.5 input-dark rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8b8fa8] mb-1">Account Holder</label>
            <input
              type="text" value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              placeholder="Full name on bank account"
              className="w-full px-3 py-2.5 input-dark rounded-xl text-sm"
            />
          </div>

          {profileMsg && (
            <p className={profileMsg.type === 'ok' ? 'text-xs px-3 py-2 rounded-lg bg-teal/10 text-teal' : 'text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400'}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit" disabled={savingProfile}
            className="w-full py-2.5 btn-accent text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
          >
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </section>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card rounded-2xl p-5 border border-rim">
          <h2 className="text-sm font-semibold text-white mb-4">Password</h2>
          {user.provider === 'google' ? (
            <p className="text-sm text-[#6b6f82]">This account uses Google login. Password changes are not available.</p>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {[
                { label: 'Current Password', value: currentPw, onChange: setCurrentPw },
                { label: 'New Password', value: newPw, onChange: setNewPw },
                { label: 'Confirm Password', value: confirmPw, onChange: setConfirmPw },
              ].map(({ label, value, onChange }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-[#8b8fa8] mb-1">{label}</label>
                  <input
                    type="password" value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required placeholder="Password"
                    className="w-full px-3 py-2.5 input-dark rounded-xl text-sm"
                  />
                </div>
              ))}
              {pwMsg && (
                <p className={pwMsg.type === 'ok' ? 'text-xs px-3 py-2 rounded-lg bg-teal/10 text-teal' : 'text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400'}>
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit" disabled={savingPw}
                className="w-full py-2.5 btn-accent text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {savingPw ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </section>

        <TwoFactorSection isTwoFactorEnabled={!!user.isTwoFactorEnabled} />
      </div>
    </div>
  );
}

function TwoFactorSection({ isTwoFactorEnabled }: { isTwoFactorEnabled: boolean }) {
  const [enabled, setEnabled] = useState(isTwoFactorEnabled);
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiClient.post('/auth/2fa/setup');
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setStep('setup');
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Failed to start 2FA setup' });
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await apiClient.post('/auth/2fa/verify', { token });
      setEnabled(true);
      setStep('idle');
      setQrCode(null);
      setSecret(null);
      setToken('');
      setMsg({ type: 'ok', text: '2FA enabled successfully!' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Invalid code, try again' });
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await apiClient.post('/auth/2fa/disable', { password });
      setEnabled(false);
      setPassword('');
      setStep('idle');
      setMsg({ type: 'ok', text: '2FA disabled.' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Failed to disable 2FA' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card rounded-2xl p-5 border border-rim">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Two-Factor Authentication</h2>
          <p className="text-xs text-[#6b6f82] mt-0.5">Add an extra layer of security.</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${enabled ? 'bg-teal/10 text-teal' : 'bg-surface/[0.05] text-[#6b6f82]'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg mb-4 ${msg.type === 'ok' ? 'bg-teal/10 text-teal' : 'bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </p>
      )}

      {!enabled && step === 'idle' && (
        <button
          onClick={startSetup}
          disabled={loading}
          className="w-full py-2.5 btn-accent text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading...' : 'Enable 2FA'}
        </button>
      )}

      {step === 'setup' && qrCode && (
        <div className="space-y-4">
          <p className="text-sm text-[#8b8fa8]">Scan this QR code with your authenticator app.</p>
          <img src={qrCode} alt="2FA QR Code" className="w-40 h-40 border border-rim rounded-xl" />
          {secret && (
            <div className="bg-surface/[0.03] rounded-xl px-3 py-2">
              <p className="text-xs text-[#6b6f82] mb-0.5">Or enter manually:</p>
              <p className="font-mono text-xs text-[#c4c6d8] break-all">{secret}</p>
            </div>
          )}
          <form onSubmit={verifySetup} className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
              maxLength={6}
              placeholder="6-digit code"
              className="flex-1 px-3 py-2.5 border border-rim rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={loading || token.length !== 6}
              className="px-4 py-2.5 btn-accent text-sm font-medium rounded-xl hover:bg-accent-dim disabled:opacity-50"
            >
              {loading ? '...' : 'Verify'}
            </button>
          </form>
          <button onClick={() => setStep('idle')} className="text-sm text-[#6b6f82] hover:text-[#8b8fa8]">Cancel</button>
        </div>
      )}

      {enabled && step === 'idle' && (
        <div>
          {step === 'idle' && (
            <button
              onClick={() => setStep('verify')}
              className="text-sm text-red-500 hover:text-red-400 hover:underline"
            >
              Disable 2FA
            </button>
          )}
        </div>
      )}

      {enabled && step === 'verify' && (
        <form onSubmit={disable2FA} className="space-y-3">
          <p className="text-sm text-[#8b8fa8]">Enter your password to confirm disabling 2FA:</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Your password"
            className="w-full px-3 py-2.5 border border-rim rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Confirm Disable'}
            </button>
            <button type="button" onClick={() => setStep('idle')} className="px-4 py-2 text-sm text-[#6b6f82] hover:text-[#c4c6d8]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
