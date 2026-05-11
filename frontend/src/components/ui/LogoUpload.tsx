// PingFlow — Logo Upload Component
// Upload, preview, and delete gym logo

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';

interface Props {
  currentLogoUrl?: string;
  onUpdate: (url: string | null) => void;
}

export default function LogoUpload({ currentLogoUrl, onUpdate }: Props) {
  const { user } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    // Validate
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('Image must be under 2MB', 'error'); return; }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `gyms/${user.uid}/logo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'gyms', user.uid), { logoUrl: url });
      setPreview(url);
      onUpdate(url);
      toast('Logo uploaded!', 'success');
    } catch (err: any) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!user?.uid) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `gyms/${user.uid}/logo`);
      try { await deleteObject(storageRef); } catch { /* file might not exist */ }
      await updateDoc(doc(db, 'gyms', user.uid), { logoUrl: '' });
      setPreview(null);
      onUpdate(null);
      toast('Logo removed', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to remove', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Preview */}
      <div
        onClick={() => !isUploading && fileRef.current?.click()}
        style={{
          width: '72px', height: '72px', borderRadius: '16px',
          border: '2px dashed #E2E8F0', backgroundColor: '#F8FAFC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isUploading ? 'wait' : 'pointer', overflow: 'hidden',
          transition: 'all 200ms',
        }}
      >
        {preview ? (
          <img src={preview} alt="Gym logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        )}
      </div>

      <div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          style={{
            padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
            backgroundColor: '#FFF', fontSize: '12px', fontWeight: '700',
            color: '#334155', cursor: 'pointer', marginBottom: '4px',
          }}
        >
          {isUploading ? 'Uploading...' : preview ? 'Change Logo' : 'Upload Logo'}
        </button>
        {preview && (
          <button onClick={handleRemove} disabled={isUploading} style={{
            display: 'block', background: 'none', border: 'none',
            fontSize: '11px', color: '#EF4444', fontWeight: '600', cursor: 'pointer',
          }}>Remove</button>
        )}
        <p style={{ fontSize: '10px', color: '#94A3B8', margin: '4px 0 0' }}>PNG, JPG up to 2MB</p>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
    </div>
  );
}
