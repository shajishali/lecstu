import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { Camera, Save, AlertCircle, CheckCircle, User } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function Profile() {
  const { user, getMe } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        departmentId: user.department?.id || '',
      });
    }
  }, [user]);

  useEffect(() => {
    api.get<{ success: boolean; data: { departments: Department[] } }>('/profile/departments')
      .then((res) => setDepartments(res.data.data.departments))
      .catch(() => {});
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/profile', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        departmentId: form.departmentId || null,
      });
      await getMe();
      showMessage('success', 'Profile updated successfully');
    } catch (err: any) {
      showMessage('error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await getMe();
      showMessage('success', 'Avatar updated');
    } catch (err: any) {
      showMessage('error', err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <h1>My Profile</h1>

      {message && (
        <div className={`profile-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="profile-grid">
        {/* Avatar section */}
        <div className="profile-card avatar-card">
          <div className="avatar-wrapper" onClick={handleAvatarClick}>
            {user.profileImage ? (
              <img src={user.profileImage} alt="Profile" className="avatar-large" />
            ) : (
              <div className="avatar-placeholder-large">
                <User size={48} />
              </div>
            )}
            <div className="avatar-overlay">
              {uploading ? <span className="spinner-sm" /> : <Camera size={20} />}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              hidden
            />
          </div>
          <h3>{user.firstName} {user.lastName}</h3>
          <span className={`badge badge-${user.role.toLowerCase()}`}>{user.role}</span>
          <p className="avatar-email">{user.email}</p>
        </div>

        {/* Edit form */}
        <div className="profile-card edit-card">
          <h2>Edit Profile</h2>
          <form onSubmit={handleSave} className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pFirstName">First Name</label>
                <input
                  id="pFirstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pLastName">Last Name</label>
                <input
                  id="pLastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="pEmail">Email</label>
              <input id="pEmail" type="email" value={user.email} disabled />
            </div>

            <div className="form-group">
              <label htmlFor="pPhone">Phone</label>
              <input
                id="pPhone"
                type="text"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="e.g. +94 77 123 4567"
              />
            </div>

            <div className="form-group">
              <label htmlFor="pDept">Department</label>
              <select
                id="pDept"
                value={form.departmentId}
                onChange={(e) => update('departmentId', e.target.value)}
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Role</label>
              <input type="text" value={user.role} disabled />
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="spinner-sm" /> : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
