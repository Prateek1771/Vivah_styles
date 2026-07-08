'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { TryOnGalleryModal } from '@/components/dress/TryOnGalleryModal';
import { PhotoModal, TryonModal, resizePhoto, type TryonState } from '@/components/dress/tryon-ui';
import { saveCustomerPhoto, createAdhocSession } from '@/app/(app)/explore/[id]/actions';
import type { StaffRole } from '@/lib/constants';

interface DressActionsProps {
  role: StaffRole;
  dressId: string;
  itemId: string;
  sessionId: string | null;
  gender: 'men' | 'women';
  hasPhoto: boolean;
}

export function DressActions({ role, dressId, itemId, sessionId, gender, hasPhoto }: DressActionsProps) {
  const [copied, setCopied] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [hasPhotoNow, setHasPhotoNow] = useState(hasPhoto);
  const [tryon, setTryon] = useState<TryonState>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Effective session: the real one, or a walk-in session created on first preview.
  const [activeSession, setActiveSession] = useState<string | null>(sessionId);
  const [starting, setStarting] = useState(false);
  const [previewError, setPreviewError] = useState('');

  async function copyId() {
    try {
      await navigator.clipboard.writeText(dressId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  }

  async function onPreview() {
    setPreviewError('');
    let sid = activeSession;
    if (!sid) {
      setStarting(true);
      const res = await createAdhocSession(gender === 'men' ? 'male' : 'female');
      setStarting(false);
      if (!res.ok) {
        setPreviewError(res.error);
        return;
      }
      sid = res.sessionId;
      setActiveSession(sid);
    }
    if (!hasPhotoNow) {
      setPhotoOpen(true);
      return;
    }
    void generate(sid);
  }

  async function generate(sid = activeSession) {
    if (!sid) return;
    setTryon('generating');
    setResult(null);
    try {
      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, itemId }),
      });
      const body = await res.json();
      if (!body.ok) {
        setTryon('failed');
        return;
      }
      setResult(body.data.image);
      setTryon('ready');
    } catch {
      setTryon('failed');
    }
  }

  async function onPhotoChosen(file: File) {
    if (!activeSession) return;
    const resized = await resizePhoto(file);
    const fd = new FormData();
    fd.set('sessionId', activeSession);
    fd.set('photo', resized);
    const res = await saveCustomerPhoto(fd);
    if (res.ok) {
      setHasPhotoNow(true);
      setPhotoOpen(false);
      void generate(activeSession);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onPreview} disabled={starting}>
          {starting ? 'Starting…' : '✨ Preview My Look'}
        </Button>

        {(role === 'cashier' || role === 'owner') && (
          <Link href={`/billing?item=${encodeURIComponent(dressId)}`}>
            <Button variant="secondary">Add to Bill</Button>
          </Link>
        )}
        {role === 'stylist' && (
          <Button variant="secondary" onClick={copyId}>
            {copied ? 'Copied!' : 'Copy Dress ID'}
          </Button>
        )}
        {activeSession && (
          <Button variant="ghost" onClick={() => setGalleryOpen(true)}>
            📷 Try-On Gallery
          </Button>
        )}
      </div>
      {previewError && <p className="text-sm text-status-danger">{previewError}</p>}

      {photoOpen && <PhotoModal onClose={() => setPhotoOpen(false)} onChoose={onPhotoChosen} />}
      {tryon !== 'idle' && (
        <TryonModal
          state={tryon}
          result={result}
          onRetry={generate}
          onClose={() => setTryon('idle')}
        />
      )}
      {galleryOpen && activeSession && (
        <TryOnGalleryModal sessionId={activeSession} onClose={() => setGalleryOpen(false)} />
      )}
    </>
  );
}
