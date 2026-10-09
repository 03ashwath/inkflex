"use client";

import { useState } from 'react';
import {
  CUSTOM_PROPORTION,
  PROPORTIONS,
  SIZE_STEP_IN,
  TRAINED_MAX_AREA_SQ_IN,
  findProportion,
  fitCustom,
  fitToProportion,
  formatInches,
  proportionScaleRange,
  stepProportion,
  validateDimensions,
  type Complexity,
  type Proportion,
  type TattooDimensions,
} from '../lib/tattoo-dimensions';

type Side = 'width' | 'height';

type TattooSizePickerProps = {
  value: TattooDimensions;
  complexity: Complexity;
  placement?: string;
  onChange: (value: TattooDimensions) => void;
  variant?: 'light' | 'dark';
};

const styles = {
  light: {
    label: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]',
    chip: 'border-[#d2d2d2] bg-[#f8f8f8] text-[#4d4d4d] hover:border-[#b9b9b9]',
    chipActive: 'border-[#2e2e2e] bg-white text-[#1d1d1d] shadow-sm',
    input: 'border-[#d4d4d4] bg-white text-[#282828] focus:border-[#999]',
    stepper: 'border-[#d4d4d4] bg-white text-[#333] hover:border-[#999] disabled:opacity-40',
    preview: 'border-[#cfcfcf] bg-[#fafafa]',
    shape: 'border-[#2e2e2e] bg-[#e9e9e9]',
    text: 'text-[#555]',
    note: 'text-[#666]',
    error: 'text-red-700',
  },
  dark: {
    label: 'text-sm font-medium text-slate-300',
    chip: 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700',
    chipActive: 'border-purple-500 bg-purple-600 text-white',
    input: 'border-slate-700 bg-slate-950 text-slate-200 focus:ring-2 focus:ring-purple-500',
    stepper: 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40',
    preview: 'border-slate-700 bg-slate-950',
    shape: 'border-purple-400 bg-purple-900/40',
    text: 'text-slate-300',
    note: 'text-slate-400',
    error: 'text-red-400',
  },
};

export default function TattooSizePicker({ value, complexity, placement, onChange, variant = 'light' }: TattooSizePickerProps) {
  const s = styles[variant];
  const [editing, setEditing] = useState<{ side: Side; text: string } | null>(null);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const lockedProportion = findProportion(value.proportion);
  const errors = validateDimensions(value.width, value.height, complexity, placement);
  const area = value.width * value.height;
  const scaleRange = lockedProportion ? proportionScaleRange(lockedProportion, complexity, placement) : null;
  const currentScale = lockedProportion ? Math.round(value.width / (lockedProportion.width * SIZE_STEP_IN)) : 0;

  const update = (next: TattooDimensions, requested?: { side: Side; value: number }) => {
    setAdjustmentNote(
      requested && Math.abs(next[requested.side] - requested.value) > 1e-9
        ? `Adjusted to ${formatInches(next.width)} x ${formatInches(next.height)} in to keep a valid ${next.proportion === CUSTOM_PROPORTION ? 'size' : `${next.proportion} proportion`}.`
        : '',
    );
    onChange(next);
  };

  const commit = (side: Side, text: string) => {
    setEditing(null);
    const requested = Number.parseFloat(text);
    if (!Number.isFinite(requested) || requested <= 0) return;
    const request = { side, value: requested };
    update(
      lockedProportion
        ? fitToProportion(lockedProportion, request, complexity, placement)
        : fitCustom(
            side === 'width' ? requested : value.width,
            side === 'height' ? requested : value.height,
            side,
            complexity,
            placement,
          ),
      request,
    );
  };

  const chooseProportion = (proportion: Proportion | null) => {
    if (!proportion) {
      update({ ...value, proportion: CUSTOM_PROPORTION });
      return;
    }
    // Keep the long side about the same size when switching proportion.
    const side: Side = proportion.width >= proportion.height ? 'width' : 'height';
    update(fitToProportion(proportion, { side, value: Math.max(value.width, value.height) }, complexity, placement));
  };

  // Scale the preview so the long side is 96px.
  const previewScale = 96 / Math.max(value.width, value.height);

  const sideInput = (side: Side) => (
    <label className={`block ${s.label}`}>
      {side === 'width' ? 'Width (in)' : 'Height (in)'}
      <input
        type="number"
        inputMode="decimal"
        min={0.5}
        step={0.5}
        value={editing?.side === side ? editing.text : formatInches(value[side])}
        onFocus={() => setEditing({ side, text: formatInches(value[side]) })}
        onChange={(event) => setEditing({ side, text: event.target.value })}
        onBlur={(event) => commit(side, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className={`mt-2 w-full rounded-lg border px-3 py-3 text-[15px] font-normal normal-case tracking-normal outline-none transition ${s.input}`}
      />
    </label>
  );

  return (
    <div>
      <div className={s.label}>Proportion</div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Tattoo proportion">
        {[...PROPORTIONS, null].map((proportion) => {
          const label = proportion?.label ?? 'Custom';
          const active = proportion ? value.proportion === proportion.label : value.proportion === CUSTOM_PROPORTION;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => chooseProportion(proportion)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${active ? s.chipActive : s.chip}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        {sideInput('width')}
        {sideInput('height')}
        {lockedProportion && scaleRange && (
          <div className="flex gap-2" role="group" aria-label="Change size keeping the proportion">
            <button
              type="button"
              aria-label="Smaller"
              disabled={currentScale <= scaleRange.min}
              onClick={() => update(stepProportion(value, -1, complexity, placement))}
              className={`h-[50px] w-11 rounded-lg border text-lg font-semibold transition ${s.stepper}`}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Larger"
              disabled={currentScale >= scaleRange.max}
              onClick={() => update(stepProportion(value, 1, complexity, placement))}
              className={`h-[50px] w-11 rounded-lg border text-lg font-semibold transition ${s.stepper}`}
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className={`mt-4 flex items-center gap-4 rounded-lg border p-3 ${s.preview}`}>
        <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center">
          <div
            aria-hidden="true"
            className={`rounded-sm border-2 ${s.shape}`}
            style={{ width: value.width * previewScale, height: value.height * previewScale }}
          />
        </div>
        <div className={`text-sm ${s.text}`}>
          <p className="font-semibold">
            {formatInches(value.width)} x {formatInches(value.height)} in
          </p>
          <p>{formatInches(area)} sq in · {lockedProportion ? `${lockedProportion.label} proportion` : 'custom proportion'}</p>
          {area > TRAINED_MAX_AREA_SQ_IN && (
            <p className={`mt-1 text-xs ${s.note}`}>Larger than the 5 x 5 in designs in the price data; the estimate is scaled by area.</p>
          )}
        </div>
      </div>

      {adjustmentNote && errors.length === 0 && <p className={`mt-2 text-xs ${s.note}`}>{adjustmentNote}</p>}
      {errors.map((error) => (
        <p key={error} role="alert" className={`mt-2 text-xs ${s.error}`}>{error}</p>
      ))}
    </div>
  );
}
