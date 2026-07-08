'use client';

import { useState } from 'react';

const ZOOM_STEP = 0.5;
const ZOOM_MAX = 3;

// Generated try-on image with pinned bottom-right controls: download + zoom toggle.
// Zoom scales the img inside an overflow-auto box, so panning is just scrolling.
export function TryonImageViewer({ src, downloadName }: { src: string; downloadName: string }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-base text-surface hover:bg-ink/80';

  return (
    <div className="relative">
      <div className="max-h-[70vh] overflow-auto rounded-[--radius-card]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Virtual try-on preview"
          className="mx-auto"
          style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none' } : { maxHeight: '70vh', objectFit: 'contain' }}
        />
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        {zoomOpen && (
          <>
            <button type="button" className={btn} aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - ZOOM_STEP))}>
              −
            </button>
            <button type="button" className={btn} aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}>
              +
            </button>
          </>
        )}
        <button
          type="button"
          className={btn}
          aria-label="Toggle zoom controls"
          onClick={() => {
            setZoomOpen((o) => !o);
            setZoom(1);
          }}
        >
          🔍
        </button>
        <a className={btn} aria-label="Download image" href={src} download={downloadName}>
          ⬇
        </a>
      </div>
    </div>
  );
}
