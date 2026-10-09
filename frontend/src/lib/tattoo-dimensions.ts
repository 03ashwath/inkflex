// Tattoo size rules. Keep in sync with ml/pricing.py, which the API uses to reject invalid sizes.

export type Complexity = 'Simple' | 'Medium' | 'Complex';

export type Proportion = { label: string; width: number; height: number };

// 'custom' means width and height are edited independently (still limited to MAX ratio).
export type ProportionChoice = string;

export type TattooDimensions = {
  width: number;
  height: number;
  proportion: ProportionChoice;
};

export const SIZE_STEP_IN = 0.5;
export const MAX_SIDE_IN = 34;
export const DEFAULT_MAX_RATIO = 3;
const ELONGATED_MAX_RATIO = 4;
// Largest square size in the training data; bigger sizes are scaled estimates.
export const TRAINED_MAX_AREA_SQ_IN = 25;
// Minimum readable size per complexity, from the dataset's minimum_width_in/minimum_height_in.
export const COMPLEXITY_MIN_SIDE_IN: Record<Complexity, number> = { Simple: 1, Medium: 2, Complex: 3 };

export const CUSTOM_PROPORTION = 'custom';
export const PROPORTIONS: Proportion[] = [
  { label: '1:1', width: 1, height: 1 },
  { label: '4:3', width: 4, height: 3 },
  { label: '3:4', width: 3, height: 4 },
  { label: '3:2', width: 3, height: 2 },
  { label: '2:3', width: 2, height: 3 },
  { label: '2:1', width: 2, height: 1 },
  { label: '1:2', width: 1, height: 2 },
];

// [match keywords, long side max, short side max, max ratio]. First match wins, so order matters.
const PLACEMENT_LIMITS: [string[], number, number, number][] = [
  [['finger', 'knuckle', 'toe'], 2.5, 1, DEFAULT_MAX_RATIO],
  [['behind'], 3, 2, DEFAULT_MAX_RATIO],
  [['wrist'], 4, 3, DEFAULT_MAX_RATIO],
  [['ankle'], 4, 3, DEFAULT_MAX_RATIO],
  [['palm', 'hand'], 5, 4, DEFAULT_MAX_RATIO],
  [['foot', 'heel'], 6, 4, DEFAULT_MAX_RATIO],
  [['neck'], 5, 4, DEFAULT_MAX_RATIO],
  [['knee'], 6, 6, DEFAULT_MAX_RATIO],
  [['band'], 14, 3.5, ELONGATED_MAX_RATIO],
  [['spine'], 16, 4, ELONGATED_MAX_RATIO],
  [['full sleeve'], 26, 12, DEFAULT_MAX_RATIO],
  [['half sleeve'], 14, 12, DEFAULT_MAX_RATIO],
  [['full leg'], 34, 14, DEFAULT_MAX_RATIO],
  [['half leg'], 16, 12, DEFAULT_MAX_RATIO],
  [['forearm'], 10, 5, DEFAULT_MAX_RATIO],
  [['upper arm', 'bicep', 'shoulder blade'], 8, 7, DEFAULT_MAX_RATIO],
  [['shoulder'], 8, 7, DEFAULT_MAX_RATIO],
  [['calf', 'shin'], 12, 6, DEFAULT_MAX_RATIO],
  [['thigh'], 14, 9, DEFAULT_MAX_RATIO],
  [['full back'], 20, 18, DEFAULT_MAX_RATIO],
  [['upper back'], 14, 8, DEFAULT_MAX_RATIO],
  [['lower back'], 12, 6, DEFAULT_MAX_RATIO],
  [['side of back', 'back'], 14, 10, DEFAULT_MAX_RATIO],
  [['sternum'], 8, 6, DEFAULT_MAX_RATIO],
  [['rib', 'side of torso'], 12, 8, DEFAULT_MAX_RATIO],
  [['abdomen'], 10, 8, DEFAULT_MAX_RATIO],
  [['chest', 'torso'], 10, 8, DEFAULT_MAX_RATIO],
];

export type PlacementLimits = { longMax: number; shortMax: number; maxRatio: number };

export function placementLimits(placement?: string): PlacementLimits {
  const name = (placement ?? '').trim().toLowerCase();
  if (name) {
    for (const [keywords, longMax, shortMax, maxRatio] of PLACEMENT_LIMITS) {
      if (keywords.some((keyword) => name.includes(keyword))) return { longMax, shortMax, maxRatio };
    }
  }
  return { longMax: MAX_SIDE_IN, shortMax: MAX_SIDE_IN, maxRatio: DEFAULT_MAX_RATIO };
}

const snap = (value: number) => Math.round(value / SIZE_STEP_IN) * SIZE_STEP_IN;
const snapUp = (value: number) => Math.ceil(value / SIZE_STEP_IN - 1e-9) * SIZE_STEP_IN;
const snapDown = (value: number) => Math.floor(value / SIZE_STEP_IN + 1e-9) * SIZE_STEP_IN;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function formatInches(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function findProportion(choice: ProportionChoice): Proportion | undefined {
  return PROPORTIONS.find((proportion) => proportion.label === choice);
}

export function validateDimensions(width: number, height: number, complexity: Complexity, placement?: string): string[] {
  const errors: string[] = [];
  for (const [label, value] of [['Width', width], ['Height', height]] as const) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${label} must be a positive number of inches.`);
    else if (Math.abs(value / SIZE_STEP_IN - Math.round(value / SIZE_STEP_IN)) > 1e-6) errors.push(`${label} must be in ${SIZE_STEP_IN} inch steps.`);
  }
  if (errors.length) return errors;

  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const minSide = COMPLEXITY_MIN_SIDE_IN[complexity];
  const { longMax, shortMax, maxRatio } = placementLimits(placement);
  if (shortSide < minSide) {
    errors.push(`${complexity} designs need at least ${minSide} x ${minSide} in to stay readable.`);
  }
  if (longSide / shortSide > maxRatio + 1e-9) {
    errors.push(`Proportion ${formatInches(longSide)}:${formatInches(shortSide)} is too stretched; keep the long side within ${maxRatio}x the short side.`);
  }
  if (longSide > longMax || shortSide > shortMax) {
    const where = placement?.trim() ? ` on ${placement.trim()}` : '';
    errors.push(`${formatInches(longSide)} x ${formatInches(shortSide)} in is too large${where}; the maximum is ${formatInches(longMax)} x ${formatInches(shortMax)} in.`);
  }
  return errors;
}

// A locked proportion only allows sizes where both sides land exactly on the 0.5 in grid:
// (w * 0.5 * k, h * 0.5 * k) for whole k. These are the allowed k values.
export function proportionScaleRange(proportion: Proportion, complexity: Complexity, placement?: string) {
  const unitLong = Math.max(proportion.width, proportion.height) * SIZE_STEP_IN;
  const unitShort = Math.min(proportion.width, proportion.height) * SIZE_STEP_IN;
  const { longMax, shortMax } = placementLimits(placement);
  return {
    min: Math.ceil(COMPLEXITY_MIN_SIDE_IN[complexity] / unitShort - 1e-9),
    max: Math.floor(Math.min(longMax / unitLong, shortMax / unitShort) + 1e-9),
  };
}

function sizeAtScale(proportion: Proportion, scale: number): TattooDimensions {
  return {
    width: proportion.width * SIZE_STEP_IN * scale,
    height: proportion.height * SIZE_STEP_IN * scale,
    proportion: proportion.label,
  };
}

// Nearest valid size in a locked proportion to the requested side length.
export function fitToProportion(
  proportion: Proportion,
  requested: { side: 'width' | 'height'; value: number },
  complexity: Complexity,
  placement?: string,
): TattooDimensions {
  const range = proportionScaleRange(proportion, complexity, placement);
  const unit = proportion[requested.side] * SIZE_STEP_IN;
  const scale = range.min > range.max ? range.min : clamp(Math.round(requested.value / unit), range.min, range.max);
  return sizeAtScale(proportion, scale);
}

export function stepProportion(dimensions: TattooDimensions, direction: 1 | -1, complexity: Complexity, placement?: string): TattooDimensions {
  const proportion = findProportion(dimensions.proportion);
  if (!proportion) return dimensions;
  const range = proportionScaleRange(proportion, complexity, placement);
  const current = Math.round(dimensions.width / (proportion.width * SIZE_STEP_IN));
  return sizeAtScale(proportion, clamp(current + direction, range.min, Math.max(range.min, range.max)));
}

// Free width/height editing: snap to the grid, keep within the placement and complexity limits,
// and move the side that was not edited when the proportion gets too stretched.
export function fitCustom(
  width: number,
  height: number,
  edited: 'width' | 'height',
  complexity: Complexity,
  placement?: string,
): TattooDimensions {
  const minSide = COMPLEXITY_MIN_SIDE_IN[complexity];
  const { longMax, shortMax, maxRatio } = placementLimits(placement);
  const sides = {
    width: clamp(snap(width), minSide, longMax),
    height: clamp(snap(height), minSide, longMax),
  };
  const other = edited === 'width' ? 'height' : 'width';

  if (Math.min(sides.width, sides.height) > shortMax) sides[other] = shortMax;

  if (sides[edited] >= sides[other]) {
    if (sides[edited] / sides[other] > maxRatio) sides[other] = Math.min(shortMax, snapUp(sides[edited] / maxRatio));
    if (sides[edited] / sides[other] > maxRatio) sides[edited] = snapDown(sides[other] * maxRatio);
  } else if (sides[other] / sides[edited] > maxRatio) {
    sides[other] = snapDown(sides[edited] * maxRatio);
  }
  return { ...sides, proportion: CUSTOM_PROPORTION };
}

// Re-apply the rules after complexity or placement changes.
export function refitDimensions(dimensions: TattooDimensions, complexity: Complexity, placement?: string): TattooDimensions {
  const proportion = findProportion(dimensions.proportion);
  return proportion
    ? fitToProportion(proportion, { side: 'width', value: dimensions.width }, complexity, placement)
    : fitCustom(dimensions.width, dimensions.height, 'width', complexity, placement);
}

// The dataset's "recommended" size is the minimum readable size plus 1 in on each side.
export function recommendedDimensions(proportion: Proportion, complexity: Complexity, placement?: string): TattooDimensions {
  const shortUnit = Math.min(proportion.width, proportion.height) * SIZE_STEP_IN;
  const target = (COMPLEXITY_MIN_SIDE_IN[complexity] + 1) / shortUnit;
  const range = proportionScaleRange(proportion, complexity, placement);
  const scale = range.min > range.max ? range.min : clamp(Math.ceil(target - 1e-9), range.min, range.max);
  return sizeAtScale(proportion, scale);
}

export function nearestProportion(pixelWidth: number, pixelHeight: number): Proportion {
  const ratio = Math.log(pixelWidth / pixelHeight);
  return PROPORTIONS.reduce((best, proportion) =>
    Math.abs(Math.log(proportion.width / proportion.height) - ratio) < Math.abs(Math.log(best.width / best.height) - ratio)
      ? proportion
      : best,
  );
}
