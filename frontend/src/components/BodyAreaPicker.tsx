"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';

const bodyViews = [
  { id: 'back', label: 'Back' },
  { id: 'torso', label: 'Chest & Torso' },
  { id: 'arm', label: 'Arm' },
  { id: 'leg', label: 'Leg' },
  { id: 'hand', label: 'Hand' },
  { id: 'foot', label: 'Foot & Ankle' },
  { id: 'neck', label: 'Neck & Behind Ear' },
] as const;

type BodyViewId = (typeof bodyViews)[number]['id'];

const thumbnailImages: Record<BodyViewId, string> = {
  back: '/body-templates/thumb-back.jpg',
  torso: '/body-templates/thumb-torso.jpg',
  arm: '/body-templates/thumb-arm.jpg',
  leg: '/body-templates/thumb-leg.jpg',
  hand: '/body-templates/thumb-hand.jpg',
  foot: '/body-templates/thumb-foot.jpg',
  neck: '/body-templates/thumb-neck.jpg',
};

function BodyImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return <Image src={src} alt={alt} fill sizes="(max-width: 640px) 50vw, 500px" className={className} />;
}

export default function BodyAreaPicker({ onClose, onApply }: { onClose: () => void; onApply: (area: string) => void }) {
  const [activeView, setActiveView] = useState<BodyViewId>('back');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const chooseView = (view: BodyViewId) => {
    setActiveView(view);
  };

  const selectedViewLabel = bodyViews.find((item) => item.id === activeView)?.label ?? 'Body area';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 backdrop-blur-[3px] sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="body-picker-title" className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-[#d6d6d6] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7">
          <div>
            <h2 id="body-picker-title" className="text-lg font-semibold text-[#171717]">Where will the tattoo go?</h2>
            <p className="mt-1 text-sm text-[#656565]">Choose the body view that best matches your tattoo placement.</p>
          </div>
          <button type="button" aria-label="Close body area picker" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xl text-[#444] hover:bg-[#f1f1f1]">×</button>
        </header>

        <div className="overflow-y-auto px-5 pb-5 sm:px-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {bodyViews.map((view) => (
              <button
                key={view.id}
                type="button"
                aria-pressed={activeView === view.id}
                onClick={() => chooseView(view.id)}
                className={`overflow-hidden rounded-lg border bg-[#fafafa] transition hover:border-[#999] ${activeView === view.id ? 'border-2 border-[#171717]' : 'border-[#e0e0e0]'}`}
              >
                <span className="relative flex h-[110px] items-center justify-center overflow-hidden px-2 pt-2">
                  <BodyImage src={thumbnailImages[view.id]} alt={`${view.label} template`} className="object-contain" />
                </span>
                <span className="block border-t border-[#e5e5e5] px-1 py-2 text-center text-[11px] font-medium leading-tight text-[#252525]">{view.label}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#e5e5e5] bg-[#fafafa] px-5 py-3 sm:px-7">
          <button type="button" onClick={onClose} className="rounded-md border border-[#d8d8d8] bg-white px-4 py-2 text-sm font-medium text-[#252525] hover:bg-[#f7f7f7]">Cancel</button>
          <button type="button" onClick={() => { onApply(selectedViewLabel); onClose(); }} className="rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]">Use this view</button>
        </footer>
      </section>
    </div>
  );
}