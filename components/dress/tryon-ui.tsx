'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { TryonImageViewer } from '@/components/dress/TryonImageViewer';

const MAX_EDGE = 1024;

export async function resizePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

export type TryonState = 'idle' | 'generating' | 'ready' | 'failed';

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[--radius-card] bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function PhotoModal({ onClose, onChoose }: { onClose: () => void; onChoose: (f: File) => void }) {
  const takeRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);

  function onPick(file: File | undefined) {
    if (!file) return;
    setPreview({ url: URL.createObjectURL(file), file });
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-ink">Add a photo to preview the outfit</h2>
      <p className="mt-1 text-xs text-ink-muted">
        This photo is only used for outfit previews during this store visit.
      </p>

      {preview ? (
        <div className="mt-4 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="mx-auto max-h-72 rounded-[--radius-input] object-contain" />
          <div className="flex gap-3">
            <Button
              onClick={async () => {
                setBusy(true);
                onChoose(preview.file);
              }}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Use Photo'}
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
              Retake
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          <Button onClick={() => takeRef.current?.click()}>Take Photo</Button>
          <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
            Upload Photo
          </Button>
          <input
            ref={takeRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>
      )}
    </Overlay>
  );
}

const LOADING_COPY = ['Draping the outfit…', 'Adjusting the fit…', 'Almost ready…'];

export function TryonModal({
  state,
  result,
  onRetry,
  onClose,
}: {
  state: TryonState;
  result: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      {state === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="aspect-[3/4] w-40 animate-pulse rounded-[--radius-card] bg-surface-soft" />
          <p className="text-sm text-ink-secondary">{LOADING_COPY[0]}</p>
        </div>
      )}
      {state === 'ready' && result && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-ink">Your Preview</h2>
          <TryonImageViewer src={result} downloadName="tryon.jpg" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
      {state === 'failed' && (
        <div className="flex flex-col gap-4 py-6 text-center">
          <p className="text-sm text-ink-secondary">Couldn&apos;t create this preview. Try again.</p>
          <div className="flex justify-center gap-3">
            <Button onClick={onRetry}>Retry</Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Overlay>
  );
}
