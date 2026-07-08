'use client';

import { useState } from 'react';

import { COUPLE_LOOKS } from '@/lib/couple-looks';
import { Button } from '@/components/ui/Button';
import { PhotoModal, TryonModal, resizePhoto, type TryonState } from '@/components/dress/tryon-ui';
import { saveCustomerPhoto, createAdhocSession } from '@/app/(app)/explore/[id]/actions';

// Couple looks gallery — each look can be tried on: upload a couple photo and
// gpt-image-2 transfers both the bride's and groom's outfits in one generation.
export function CoupleLooks({ sessionId }: { sessionId: string | null }) {
  const [activeSession, setActiveSession] = useState<string | null>(sessionId);
  const [hasPhoto, setHasPhoto] = useState(false); // ponytail: assume no photo; worst case one re-upload
  const [pendingLook, setPendingLook] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [tryon, setTryon] = useState<TryonState>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function onTryLook(img: string) {
    setError('');
    setPendingLook(img);
    let sid = activeSession;
    if (!sid) {
      const res = await createAdhocSession('female'); // shopping_for is irrelevant for previews
      if (!res.ok) {
        setError(res.error);
        return;
      }
      sid = res.sessionId;
      setActiveSession(sid);
    }
    if (!hasPhoto) {
      setPhotoOpen(true);
      return;
    }
    void generate(img, sid);
  }

  async function generate(img = pendingLook, sid = activeSession) {
    if (!img || !sid) return;
    setTryon('generating');
    setResult(null);
    try {
      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, lookImg: img }),
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
      setHasPhoto(true);
      setPhotoOpen(false);
      void generate();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Couple Look Inspiration</h2>
        <p className="text-xs text-ink-muted">Coordinated bride & groom outfits to spark ideas.</p>
      </div>
      {error && <p className="text-sm text-status-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {COUPLE_LOOKS.map((look) => (
          <div key={look.img} className="overflow-hidden rounded-[--radius-card] border border-border bg-surface">
            <div className="aspect-[3/4] w-full overflow-hidden bg-surface-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={look.img} alt="Couple look" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-1 p-2.5 text-xs text-ink-secondary">
              <span>
                <span className="font-semibold text-ink">Bride:</span> {look.bride.color} {look.bride.garment}
              </span>
              <span>
                <span className="font-semibold text-ink">Groom:</span> {look.groom.color} {look.groom.garment}
              </span>
              <Button variant="ghost" onClick={() => onTryLook(look.img)}>
                ✨ Try This Look
              </Button>
            </div>
          </div>
        ))}
      </div>

      {photoOpen && <PhotoModal onClose={() => setPhotoOpen(false)} onChoose={onPhotoChosen} />}
      {tryon !== 'idle' && (
        <TryonModal state={tryon} result={result} onRetry={generate} onClose={() => setTryon('idle')} />
      )}
    </div>
  );
}
