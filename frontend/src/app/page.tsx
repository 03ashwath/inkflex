"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import BodyAreaPicker from '../components/BodyAreaPicker';
import TattooSizePicker from '../components/TattooSizePicker';
import { formatInr } from '../lib/currency';
import { INDIAN_CITIES, INDIAN_CITY_ALIASES, resolveIndianCity } from '../lib/indian-cities';
import {
  PROPORTIONS,
  nearestProportion,
  recommendedDimensions,
  refitDimensions,
  validateDimensions,
  type Complexity,
  type TattooDimensions,
} from '../lib/tattoo-dimensions';

const navItems: string[] = [];
const complexityOptions: Complexity[] = ['Simple', 'Medium', 'Complex'];
type TattooColor = 'Black_Gray' | 'Colored';

type LocationOption = {
  label: string;
  value: string;
  kind: string;
  state?: string;
  locationType?: string;
};

type ApiLocation = {
  name: string;
  state: string;
  location_type: string;
  parent_city: string | null;
};

type PriceExample = {
  label: string;
  location: string;
  dimensions: TattooDimensions;
  placement: string;
  complexity: Complexity;
  color: TattooColor;
};

type DatasetPricePrediction = {
  predicted_price_min: number;
  predicted_price_max: number;
  predicted_price_mid: number;
  extrapolated: boolean;
  location_matched: boolean;
  factors: string[];
};

type ReferenceImageMetadata = {
  complexity: Complexity;
  color: TattooColor;
  min_width_in: number;
  min_height_in: number;
  pixel_width: number;
  pixel_height: number;
};

function isReferenceImageMetadata(value: unknown): value is ReferenceImageMetadata {
  return typeof value === 'object' && value !== null &&
    'complexity' in value &&
    ['Simple', 'Medium', 'Complex'].includes(String(value.complexity)) &&
    'color' in value &&
    ['Black_Gray', 'Colored'].includes(String(value.color)) &&
    'pixel_width' in value && typeof value.pixel_width === 'number' &&
    'pixel_height' in value && typeof value.pixel_height === 'number';
}

const LOCATION_KIND_LABELS: Record<string, string> = {
  'Popular Locality': 'Locality',
  'City/Town': 'City',
  District: 'District',
  'State/UT': 'State',
};

function toLocationOption(location: ApiLocation): LocationOption {
  const suffix = location.location_type === 'Popular Locality' && location.parent_city
    ? `${location.parent_city}, ${location.state}`
    : location.state;
  const name = location.location_type === 'District' ? `${location.name} district` : location.name;
  return {
    label: location.location_type === 'State/UT' ? `${location.name} (state average)` : `${name}, ${suffix}`,
    value: location.name,
    kind: LOCATION_KIND_LABELS[location.location_type] ?? 'Place',
    state: location.state,
    locationType: location.location_type,
  };
}

function getReferenceImageFilename(imageUrl: string): string {
  return decodeURIComponent(imageUrl.split('/').pop()?.split('?')[0] ?? '');
}

const priceExamples: PriceExample[] = [
  {
    label: 'Tiny wrist tattoo',
    location: 'Mumbai',
    dimensions: { width: 2, height: 2, proportion: '1:1' },
    placement: 'Wrist',
    complexity: 'Simple',
    color: 'Black_Gray',
  },
  {
    label: 'Medium forearm tattoo',
    location: 'Bengaluru',
    dimensions: { width: 3, height: 4, proportion: '3:4' },
    placement: 'Forearm',
    complexity: 'Medium',
    color: 'Black_Gray',
  },
  {
    label: 'Half sleeve custom tattoo',
    location: 'Pune',
    dimensions: { width: 10, height: 12, proportion: 'custom' },
    placement: 'Half Sleeve',
    complexity: 'Complex',
    color: 'Colored',
  },
];

// Used when the API location list cannot be loaded.
const fallbackLocationOptions: LocationOption[] = [
  ...INDIAN_CITIES,
  ...Object.keys(INDIAN_CITY_ALIASES),
].map((city) => ({ label: `${city}, India`, value: city, kind: 'City' }));

type PlacementSection = {
  label: string;
  options: string[];
};

const placementSections: PlacementSection[] = [
  {
    label: 'Arms and legs',
    options: ['Forearm', 'Full Sleeve', 'Half Sleeve', 'Thigh', 'Hand', 'Wrist', 'Band', 'Calf', 'Finger', 'Ankle'],
  },
  {
    label: 'Torso and sensitive areas',
    options: ['Shoulder', 'Back', 'Chest', 'Sternum', 'Ribs', 'Neck'],
  },
];

const placementSectionsByArea: Record<string, PlacementSection[]> = {
  Back: [{
    label: 'Back placements',
    options: [
      'Upper Back',
      'Lower Back',
      'Full Back',
      'Left Upper Back',
      'Right Upper Back',
      'Left Lower Back',
      'Right Lower Back',
      'Left Shoulder Blade',
      'Right Shoulder Blade',
      'Along the Spine',
      'Left Side of Back',
      'Right Side of Back',
    ],
  }],
  'Chest & Torso': [{
    label: 'Chest and torso placements',
    options: [
      'Upper Chest',
      'Lower Chest',
      'Left Chest',
      'Right Chest',
      'Center Chest',
      'Sternum',
      'Left Ribs',
      'Right Ribs',
      'Upper Abdomen',
      'Lower Abdomen',
      'Left Side of Torso',
      'Right Side of Torso',
    ],
  }],
  Arm: [{
    label: 'Arm placements',
    options: [
      'Left Upper Arm',
      'Right Upper Arm',
      'Left Bicep',
      'Right Bicep',
      'Left Forearm',
      'Right Forearm',
      'Left Inner Forearm',
      'Right Inner Forearm',
      'Left Outer Forearm',
      'Right Outer Forearm',
      'Left Wrist',
      'Right Wrist',
      'Half Sleeve',
      'Full Sleeve',
    ],
  }],
  Leg: [{
    label: 'Leg placements',
    options: [
      'Left Thigh',
      'Right Thigh',
      'Left Knee',
      'Right Knee',
      'Left Calf',
      'Right Calf',
      'Left Shin',
      'Right Shin',
      'Left Ankle',
      'Right Ankle',
      'Half Leg',
      'Full Leg',
    ],
  }],
  Hand: [{
    label: 'Hand placements',
    options: [
      'Left Hand',
      'Right Hand',
      'Left Palm',
      'Right Palm',
      'Left Fingers',
      'Right Fingers',
      'Left Knuckles',
      'Right Knuckles',
    ],
  }],
  'Foot & Ankle': [{
    label: 'Foot and ankle placements',
    options: [
      'Left Foot',
      'Right Foot',
      'Top of Left Foot',
      'Top of Right Foot',
      'Left Heel',
      'Right Heel',
      'Left Ankle',
      'Right Ankle',
      'Left Toes',
      'Right Toes',
    ],
  }],
  'Neck & Behind Ear': [{
    label: 'Neck and ear placements',
    options: [
      'Front of Neck',
      'Left Side of Neck',
      'Right Side of Neck',
      'Back of Neck',
      'Behind Left Ear',
      'Behind Right Ear',
    ],
  }],
};

type GuideTableProps = {
  headers: string[];
  rows: string[][];
  formatPrice?: (amount: number) => string;
};

function GuideTable({ headers, rows, formatPrice }: GuideTableProps) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#e5e5e5] text-[#555]">
            {headers.map((header) => (
              <th key={header} className="px-2 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-[#e9e9e9] last:border-b-0">
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`} className="px-2 py-2 align-top">
                  {formatPrice
                    ? cell.replace(/\$([\d,]+)(?:\s*-\s*\$?([\d,]+))?/g, (_range, min: string, max?: string) => {
                        const minimum = formatPrice(Number(min.replace(/,/g, '')));
                        return max
                          ? `${minimum} - ${formatPrice(Number(max.replace(/,/g, '')))}`
                          : minimum;
                      })
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
  const [query, setQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [isBodyAreaOpen, setIsBodyAreaOpen] = useState(false);
  const [selectedBodyArea, setSelectedBodyArea] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageUploadError, setImageUploadError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [placementSearch, setPlacementSearch] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState('');
  const [showPlacementOptions, setShowPlacementOptions] = useState(false);
  const [selectedComplexity, setSelectedComplexity] = useState<Complexity>('Medium');
  const [dimensions, setDimensions] = useState<TattooDimensions>(() => recommendedDimensions(PROPORTIONS[0], 'Medium'));
  const [selectedColor, setSelectedColor] = useState<TattooColor | ''>('');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>(fallbackLocationOptions);
  const [selectedLocationOption, setSelectedLocationOption] = useState<LocationOption | null>(null);
  const [datasetPricePrediction, setDatasetPricePrediction] = useState<DatasetPricePrediction | null>(null);
  const [pricePredictionError, setPricePredictionError] = useState('');
  const [isPredictingPrice, setIsPredictingPrice] = useState(false);
  const [isImageGeneratorOpen, setIsImageGeneratorOpen] = useState(false);
  const [generatedReferenceImages, setGeneratedReferenceImages] = useState<string[]>([]);
  const [referenceImageMetadata, setReferenceImageMetadata] = useState<Record<string, ReferenceImageMetadata>>({});
  const [pendingGeneratedImage, setPendingGeneratedImage] = useState<string | null>(null);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);
  const [isLoadingGeneratedImages, setIsLoadingGeneratedImages] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState('');
  useEffect(() => {
    return () => {
      if (uploadedImage) URL.revokeObjectURL(uploadedImage.previewUrl);
    };
  }, [uploadedImage]);

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE_URL}/api/locations`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Location list request failed with status ${response.status}.`);
        const locations = await response.json() as ApiLocation[];
        if (isMounted && Array.isArray(locations) && locations.length > 0) {
          setLocationOptions(locations.map(toLocationOption));
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load dataset locations; using the built-in city list.', error);
      });
    return () => {
      isMounted = false;
    };
  }, [API_BASE_URL]);

  const sizeErrors = validateDimensions(dimensions.width, dimensions.height, selectedComplexity, selectedPlacement);
  const estimateInputsComplete = Boolean(
    selectedLocation && selectedPlacement && selectedColor && sizeErrors.length === 0
  );
  const outputDesignImage = uploadedImage?.previewUrl ?? selectedGeneratedImage;
  const clearPricePrediction = () => {
    setDatasetPricePrediction(null);
    setPricePredictionError('');
  };

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return locationOptions.slice(0, 14);
    }

    return locationOptions.filter((item) => {
      const text = `${item.label} ${item.value}`.toLowerCase();
      return text.includes(normalized);
    }).slice(0, 14);
  }, [query, locationOptions]);

  const availablePlacementSections = selectedBodyArea
    ? placementSectionsByArea[selectedBodyArea] ?? placementSections
    : placementSections;
  const filteredPlacementSections = availablePlacementSections
    .map((section) => ({
      ...section,
      options: section.options.filter((option) => option.toLowerCase().includes(placementSearch.trim().toLowerCase())),
    }))
    .filter((section) => section.options.length > 0);

  const handleSelectLocation = (value: string, option?: LocationOption) => {
    const city = option ? option.value : resolveIndianCity(value) ?? value;
    clearPricePrediction();
    setSelectedLocation(city);
    setSelectedLocationOption(option ?? null);
    setQuery(option?.label ?? city);
    setShowSuggestions(false);
  };

  const handleSelectComplexity = (complexity: Complexity) => {
    clearPricePrediction();
    setSelectedComplexity(complexity);
    setDimensions((current) => refitDimensions(current, complexity, selectedPlacement));
  };

  const handleSelectPlacement = (placement: string) => {
    clearPricePrediction();
    setSelectedPlacement(placement);
    setPlacementSearch('');
    setShowPlacementOptions(false);
    setDimensions((current) => refitDimensions(current, selectedComplexity, placement));
  };

  const handleApplyPriceExample = (example: PriceExample) => {
    handleSelectLocation(example.location);
    clearPricePrediction();
    setSelectedBodyArea('');
    setDimensions(example.dimensions);
    setSelectedPlacement(example.placement);
    setPlacementSearch('');
    setSelectedComplexity(example.complexity);
    setSelectedColor(example.color);
  };

  const handleCalculatePrice = async () => {
    if (!estimateInputsComplete) return;

    clearPricePrediction();
    setIsPredictingPrice(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/price/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: 'India',
          city: selectedLocation,
          state: selectedLocationOption?.state,
          location_type: selectedLocationOption?.locationType,
          width_in: dimensions.width,
          height_in: dimensions.height,
          complexity: selectedComplexity,
          color: selectedColor,
          placement: selectedPlacement,
        }),
      });
      const result = await response.json() as DatasetPricePrediction & { detail?: string };
      if (!response.ok) {
        throw new Error(result.detail || `Price prediction failed with status ${response.status}.`);
      }
      if (
        !Number.isFinite(result.predicted_price_min) ||
        !Number.isFinite(result.predicted_price_max) ||
        !Number.isFinite(result.predicted_price_mid) ||
        !Array.isArray(result.factors)
      ) {
        throw new Error('The price prediction service returned an invalid estimate.');
      }
      setDatasetPricePrediction(result);
    } catch (error) {
      setPricePredictionError(error instanceof Error ? error.message : 'Unable to predict this tattoo price.');
    } finally {
      setIsPredictingPrice(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Choose an image file to use as a tattoo reference.');
      event.target.value = '';
      return;
    }

    setImageUploadError('');
    setSelectedGeneratedImage(null);
    setUploadedImage({ file, previewUrl: URL.createObjectURL(file) });
  };

  const handleRemoveUploadedImage = () => {
    setUploadedImage(null);
    setImageUploadError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleConfirmGeneratedImage = () => {
    if (!pendingGeneratedImage) return;
    setUploadedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setSelectedGeneratedImage(pendingGeneratedImage);
    setPendingGeneratedImage(null);
    setIsImageGeneratorOpen(false);
    if (estimateInputsComplete) {
      void handleCalculatePrice();
    }
  };

  const handleSelectGeneratedImage = (imageUrl: string) => {
    const filename = getReferenceImageFilename(imageUrl);
    const metadata = referenceImageMetadata[filename];
    if (!metadata) {
      setImageGenerationError('Complexity and color labels are unavailable for this image.');
      return;
    }

    setImageGenerationError('');
    clearPricePrediction();
    setPendingGeneratedImage(imageUrl);
    setSelectedComplexity(metadata.complexity);
    setSelectedColor(metadata.color);
    // Match the image's shape and start at the dataset's recommended size for its complexity.
    setDimensions(recommendedDimensions(
      nearestProportion(metadata.pixel_width, metadata.pixel_height),
      metadata.complexity,
      selectedPlacement,
    ));
  };

  const handleRandomImageRequest = async () => {
    setIsLoadingGeneratedImages(true);
    setImageGenerationError('');
    setGeneratedReferenceImages([]);
    setReferenceImageMetadata({});
    setPendingGeneratedImage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/images/random`);
      const result = await response.json() as { images?: unknown; metadata?: unknown; detail?: string };
      if (!response.ok) {
        throw new Error(result.detail || `Image request failed with status ${response.status}.`);
      }
      if (!Array.isArray(result.images) || result.images.length !== 6 || !result.images.every((url): url is string => typeof url === 'string')) {
        throw new Error('The local image dataset did not return six valid images.');
      }
      if (!result.metadata || typeof result.metadata !== 'object' || Array.isArray(result.metadata)) {
        throw new Error('The local image dataset did not return image complexity and color labels.');
      }
      const metadata = result.metadata as Record<string, unknown>;
      const taggedImages: Record<string, ReferenceImageMetadata> = {};
      for (const imageUrl of result.images) {
        const filename = getReferenceImageFilename(imageUrl);
        const imageMetadata = metadata[filename];
        if (!isReferenceImageMetadata(imageMetadata)) {
          throw new Error(`The local image dataset is missing valid complexity and color labels for ${filename || 'an image'}.`);
        }
        taggedImages[filename] = imageMetadata;
      }
      setReferenceImageMetadata(taggedImages);
      setGeneratedReferenceImages(result.images);
    } catch (error) {
      setImageGenerationError(error instanceof Error ? error.message : 'Unable to load random tattoo images.');
    } finally {
      setIsLoadingGeneratedImages(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Location access is not available in this browser.');
      return;
    }

    setGeoStatus('Finding your location...');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
          );
          if (!response.ok) {
            throw new Error(`Location lookup failed with HTTP ${response.status}.`);
          }
          const location = await response.json() as {
            city?: string;
            locality?: string;
            countryCode?: string;
          };
          if (location.countryCode?.toUpperCase() !== 'IN') {
            setGeoStatus('GPS location must be in India. Search for an Indian city instead.');
            return;
          }
          const city = location.city?.trim() || location.locality?.trim();
          if (!city) {
            setGeoStatus('Could not identify a city at your GPS location. Enter an Indian city instead.');
            return;
          }
          const resolvedCity = resolveIndianCity(city) ?? city;
          handleSelectLocation(resolvedCity);
          setGeoStatus(`Using your current location: ${resolvedCity}, India.`);
        } catch (error) {
          console.error('Unable to determine the current city from GPS coordinates.', error);
          setGeoStatus('Could not look up your GPS location. Enter an Indian city instead.');
        }
      },
      (error) => {
        setGeoStatus(`Could not access GPS location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <main className="min-h-screen bg-[#efefef] text-[#1a1a1a]">
      <header className="border-b border-[#d9d9d9] bg-[#f7f7f7]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">InkFlex</span>
          </div>

        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-10">
        <div className="mb-7 text-center text-[15px] text-[#4d4d4d]">Plan the budget before the appointment</div>

        <h1 className="text-center text-5xl font-black tracking-[-0.06em] text-[#171717] md:text-[66px]">
          Tattoo Price Calculator
        </h1>

        <p className="mx-auto mt-5 max-w-[760px] text-center text-[18px] leading-[1.55] text-[#5c5c5c]">
          See what your tattoo may cost before booking.
        </p>

        <div className="mt-11 grid items-start gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[22px] border border-[#d7d7d7] bg-[#f2f2f2] p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#111111] px-3 py-3 text-sm font-semibold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[11px]">✦</span>
              Tattoo details
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666] md:col-span-2">
                <span className="block">Indian city or town</span>

                <div className="relative mt-2">
                  <input
                    value={query}
                    onChange={(event) => {
                      clearPricePrediction();
                      setQuery(event.target.value);
                      setSelectedLocation('');
                      setSelectedLocationOption(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder="Search any Indian city or town..."
                    className="w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-3 text-[15px] text-[#282828] outline-none transition focus:border-[#999]"
                  />

                  {showSuggestions && (
                    <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[#d4d4d4] bg-white shadow-lg">
                      <div className="border-b border-[#efefef] bg-[#f7f7f7] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6a]">
                        Indian cities
                      </div>

                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <button
                            key={`${option.label}-${option.value}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectLocation(option.value, option)}
                            className="flex w-full items-center justify-between border-b border-[#f1f1f1] px-3 py-2.5 text-left text-sm text-[#2a2a2a] last:border-b-0 hover:bg-[#f9f9f9]"
                          >
                            <span>{option.label}</span>
                            <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#5f5f5f]">
                              {option.kind}
                            </span>
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectLocation(query.trim())}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-[#2a2a2a] hover:bg-[#f9f9f9]"
                        >
                          <span>Use &ldquo;{query.trim()}&rdquo;, India</span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-[#6a6a6a]">Indian city</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-2.5 py-2 text-[11px] font-medium text-[#3d3d3d] transition hover:border-[#bdbdbd]"
                  >
                    <span aria-hidden="true">📍</span>
                    Use my location
                  </button>

                  {selectedLocation && (
                    <span className="text-[11px] font-medium text-[#2d2d2d]">Selected: {selectedLocationOption?.label ?? selectedLocation}</span>
                  )}
                </div>

                {geoStatus && (
                  <p className="mt-2 text-[11px] text-[#5f5f5f]">{geoStatus}</p>
                )}
              </div>

              <div className="rounded-lg border border-[#dedede] bg-[#f8f8f8] p-3 md:col-span-2">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    {selectedBodyArea && <p className="mt-2 text-xs font-medium text-[#285d49]">Selected: {selectedBodyArea}</p>}
                  </div>
                  <button type="button" onClick={() => setIsBodyAreaOpen(true)} className="shrink-0 rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-medium text-[#252525] transition hover:border-[#aaa] hover:bg-[#fbfbfb]">
                    Choose body area
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] md:col-span-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Choose an image file"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
                {uploadedImage ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#d0d0d0] bg-[#f6f6f6] p-3 sm:flex-row sm:items-center">
                    <img
                      src={uploadedImage.previewUrl}
                      alt={`Preview of ${uploadedImage.file.name}`}
                      className="h-20 w-20 rounded-lg border border-[#dedede] bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#333]">Image added as a tattoo reference</p>
                      <p className="mt-1 truncate text-xs text-[#666]" title={uploadedImage.file.name}>{uploadedImage.file.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-medium text-[#252525] transition hover:border-[#aaa]"
                      >
                        Change image
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveUploadedImage}
                        className="rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-medium text-[#555] transition hover:border-[#aaa]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-dashed border-[#d0d0d0] bg-[#f6f6f6] px-4 py-5 text-left text-[#555] transition hover:border-[#999] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#777]"
                  >
                    <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center text-base">▧</span>
                    <span className="text-sm font-medium">Upload from an image</span>
                    <span className="ml-auto text-xs text-[#777]">Choose image file</span>
                  </button>
                )}
                {selectedGeneratedImage && (
                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#d0d0d0] bg-[#f6f6f6] p-3 sm:flex-row sm:items-center">
                    <img
                      src={selectedGeneratedImage}
                      alt="Selected tattoo design"
                      className="h-20 w-20 rounded-lg border border-[#dedede] bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#333]">Selected tattoo design</p>
                      <p className="mt-1 text-xs text-[#666]">This design will be used as a reference for your estimate.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsImageGeneratorOpen(true);
                        setImageGenerationError('');
                        void handleRandomImageRequest();
                      }}
                      className="rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-medium text-[#252525] transition hover:border-[#aaa]"
                    >
                      Change design
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGeneratedImage(null);
                      }}
                      className="rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-medium text-[#555] transition hover:border-[#aaa]"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsImageGeneratorOpen(true);
                    setImageGenerationError('');
                    void handleRandomImageRequest();
                  }}
                  className="flex min-h-[76px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#d0d0d0] bg-white px-5 py-4 text-sm font-medium text-[#252525] transition hover:border-[#999] hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#777] md:col-span-2"
                >
                  <span aria-hidden="true">✦</span>
                  <span>Choose from dataset</span>
                </button>
                {imageUploadError && <p role="alert" className="mt-2 text-xs text-red-700">{imageUploadError}</p>}
                {uploadedImage && <p className="mt-2 text-xs text-[#666]">Use the image as a visual reference while completing the tattoo details.</p>}
              </div>

              <div className="md:col-span-2">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">Tattoo size</div>
                <TattooSizePicker
                  value={dimensions}
                  complexity={selectedComplexity}
                  placement={selectedPlacement}
                  onChange={(next) => {
                    clearPricePrediction();
                    setDimensions(next);
                  }}
                />
              </div>

              <div className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">
                <label htmlFor="placement-search">Body placement</label>
                <div className="relative mt-2">
                  <input
                    id="placement-search"
                    type="search"
                    role="combobox"
                    aria-expanded={showPlacementOptions}
                    aria-controls="placement-options"
                    aria-autocomplete="list"
                    value={showPlacementOptions ? placementSearch : selectedPlacement}
                    onChange={(event) => {
                      clearPricePrediction();
                      setPlacementSearch(event.target.value);
                      setSelectedPlacement('');
                      setShowPlacementOptions(true);
                    }}
                    onFocus={() => {
                      setPlacementSearch('');
                      setShowPlacementOptions(true);
                    }}
                    onBlur={() => window.setTimeout(() => setShowPlacementOptions(false), 150)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setShowPlacementOptions(false);
                      if (event.key === 'Enter' && filteredPlacementSections[0]?.options[0]) {
                        event.preventDefault();
                        handleSelectPlacement(filteredPlacementSections[0].options[0]);
                      }
                    }}
                    placeholder={selectedBodyArea ? `Choose a placement in ${selectedBodyArea}...` : 'Search placements...'}
                    className="w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-3 text-[15px] font-normal normal-case tracking-normal text-[#282828] outline-none transition focus:border-[#999]"
                  />

                  {showPlacementOptions && (
                    <div id="placement-options" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[#dedede] bg-white py-1 shadow-lg">
                      {filteredPlacementSections.length > 0 ? filteredPlacementSections.map((section) => (
                        <div key={section.label}>
                          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold normal-case tracking-normal text-[#707070]">{section.label}</div>
                          {section.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              role="option"
                              aria-selected={selectedPlacement === option}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectPlacement(option)}
                              className="block w-full px-3 py-1.5 text-left text-sm font-normal normal-case tracking-normal text-[#252525] hover:bg-[#f3f3f3]"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )) : (
                        <p className="px-3 py-3 text-xs font-normal normal-case tracking-normal text-[#707070]">No placements found.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">
                Color
                <select
                  value={selectedColor}
                  onChange={(event) => {
                    clearPricePrediction();
                    setSelectedColor(event.target.value as TattooColor);
                  }}
                  className="mt-2 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-3 text-[15px] text-[#282828] outline-none ring-0 transition focus:border-[#999]"
                >
                  <option value="" disabled>Select color</option>
                  <option value="Black_Gray">Black and grey</option>
                  <option value="Colored">Color</option>
                </select>
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">
                Design complexity
              </div>
              <div className="grid grid-cols-4 gap-3">
                {complexityOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selectedComplexity === option}
                    onClick={() => handleSelectComplexity(option)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      selectedComplexity === option
                        ? 'border-[#2e2e2e] bg-[#fbfbfb] text-[#1d1d1d] shadow-sm'
                        : 'border-[#d2d2d2] bg-[#f8f8f8] text-[#4d4d4d] hover:border-[#b9b9b9]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!estimateInputsComplete || isPredictingPrice}
              onClick={handleCalculatePrice}
              className="mt-6 w-full rounded-lg border border-[#d2d2d2] bg-[#ececec] px-4 py-3 text-base font-semibold text-[#1d1d1d] transition hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:bg-[#d8d8d8] disabled:text-[#777]"
            >
              {isPredictingPrice ? 'Predicting price...' : 'Calculate tattoo price'}
            </button>
            {pricePredictionError && <p role="alert" className="mt-2 text-center text-xs text-red-700">{pricePredictionError}</p>}
            {!estimateInputsComplete && (
              <p className="mt-2 text-center text-xs text-[#666]">
                {sizeErrors.length > 0
                  ? 'Fix the tattoo size above to calculate.'
                  : 'Complete location, placement, and color to calculate.'}
              </p>
            )}
          </div>

          <aside className="self-start overflow-hidden rounded-xl border border-[#dedede] bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] lg:sticky lg:top-6">
            <div className="flex items-center gap-2 bg-[#111111] px-6 py-3 text-white">
              <span aria-hidden="true" className="text-base">₹</span>
              <h2 className="text-sm font-semibold">Tattoo price estimate</h2>
            </div>

            <div className="p-5">
              {outputDesignImage && (
                <div className="mb-5">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#555]">Selected design</h3>
                  <img
                    src={outputDesignImage}
                    alt={uploadedImage ? `Uploaded design ${uploadedImage.file.name} used for this price estimate` : 'Selected tattoo design used for this price estimate'}
                    className="mx-auto aspect-square w-full max-w-[240px] rounded-lg border border-[#dedede] bg-[#f7f7f7] object-contain"
                  />
                  {uploadedImage && (
                    <p className="mt-2 truncate text-center text-xs text-[#666]" title={uploadedImage.file.name}>
                      Uploaded: {uploadedImage.file.name}
                    </p>
                  )}
                </div>
              )}
              {datasetPricePrediction ? (
                <div>
                  <p className="text-center text-xs font-medium uppercase tracking-[0.12em] text-[#6b6b6b]">Estimated tattoo price</p>
                  <p className="mt-1 text-center text-3xl font-bold tracking-[-0.04em] text-[#171717]">
                    {formatInr(datasetPricePrediction.predicted_price_mid)}
                  </p>
                  <p className="mt-1 text-center text-sm text-[#555]">
                    {formatInr(datasetPricePrediction.predicted_price_min)} - {formatInr(datasetPricePrediction.predicted_price_max)}
                  </p>

                  <div className="mt-4 border-t border-[#e7e7e7] pt-3">
                    <h3 className="text-xs font-semibold text-[#333]">Included pricing factors</h3>
                    <ul className="mt-2 space-y-1 text-xs leading-4 text-[#666]">
                      {datasetPricePrediction.factors.map((factor) => <li key={factor}>{factor}</li>)}
                    </ul>
                  </div>
                  <p className="mt-4 text-[11px] leading-4 text-[#777]">
                    Prices in Indian rupees (INR). Estimated from published and estimated studio rates; confirm with your artist for a quote.
                  </p>
                </div>
              ) : (
                <>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-[#dedede] bg-[#fafafa] text-[#555]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 stroke-current" strokeWidth="1.7">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M8 7h8M8 11h2m2 0h1m2 0h1m-8 3h2m2 0h1m2 0h1m-8 3h2m2 0h1m2 0h1" />
                </svg>
              </div>
              <p className="mx-auto mt-4 max-w-[320px] text-center text-sm leading-5 text-[#555]">
                {outputDesignImage
                  ? 'Complete the required details for this selected design, then calculate its tattoo price.'
                  : 'Complete the required details manually or add an image as a visual reference, then calculate your tattoo price.'}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {[
                  { label: 'Location', complete: Boolean(selectedLocation) },
                  { label: 'Size and placement', complete: Boolean(selectedPlacement && sizeErrors.length === 0) },
                  { label: 'Design details', complete: Boolean(selectedComplexity && selectedColor) },
                ].map(({ label, complete }) => (
                  <span
                    key={label}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      complete ? 'border-[#bdbdbd] bg-[#f5f5f5] text-[#252525]' : 'border-[#e5e5e5] bg-white text-[#333]'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>

                </>
              )}
            </div>
          </aside>
        </div>
      </section>
      {isBodyAreaOpen && (
        <BodyAreaPicker
          onClose={() => setIsBodyAreaOpen(false)}
          onApply={(area) => {
            clearPricePrediction();
            setSelectedBodyArea(area);
            setSelectedPlacement('');
            setPlacementSearch('');
          }}
        />
      )}
      {isImageGeneratorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsImageGeneratorOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-generator-title"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#dedede] bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[#e8e8e8] px-5 py-4">
              <div>
                <h2 id="image-generator-title" className="text-lg font-semibold text-[#171717]">Choose a tattoo image</h2>
                <p className="mt-1 text-sm text-[#666]">Upload your own image or choose from six random images in the local dataset.</p>
              </div>
              <button
                type="button"
                aria-label="Close image generator"
                onClick={() => setIsImageGeneratorOpen(false)}
                className="rounded-md px-2 py-1 text-xl text-[#555] hover:bg-[#f3f3f3]"
              >
                ×
              </button>
            </header>

            <div className="overflow-y-auto p-5">
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isLoadingGeneratedImages}
                  onClick={handleRandomImageRequest}
                  className="rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333] disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoadingGeneratedImages ? 'Loading images...' : 'Show six random dataset images'}
                </button>
              </div>

              {imageGenerationError && <p role="alert" className="mt-3 text-sm text-red-700">{imageGenerationError}</p>}

              {generatedReferenceImages.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-[#333]">Local dataset tattoo references</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {generatedReferenceImages.map((imageUrl, index) => {
                      const filename = getReferenceImageFilename(imageUrl);
                      const metadata = referenceImageMetadata[filename];
                      return (
                        <button
                          key={imageUrl}
                          type="button"
                          onClick={() => handleSelectGeneratedImage(imageUrl)}
                          className={`overflow-hidden rounded-lg border bg-[#f7f7f7] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#777] ${
                            pendingGeneratedImage === imageUrl ? 'border-[#171717] ring-2 ring-[#777]' : 'border-[#e2e2e2]'
                          }`}
                        >
                          <img src={imageUrl} alt={`Tattoo dataset reference ${index + 1}`} className="aspect-square w-full object-cover" />
                          <span className="block px-2 py-1.5 text-center text-xs text-[#555]">
                            {metadata
                              ? `${metadata.complexity} · ${metadata.color === 'Colored' ? 'Color' : 'Black and grey'}`
                              : `Select design ${index + 1}`}
                          </span>
                          {pendingGeneratedImage === imageUrl && (
                            <span className="block border-t border-[#e2e2e2] px-2 py-1.5 text-center text-xs font-medium text-[#333]">
                              Selected — confirm below
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {pendingGeneratedImage && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#dedede] bg-[#f8f8f8] p-3">
                  <p className="text-sm text-[#333]">Use this image as your tattoo design?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingGeneratedImage(null)}
                      className="rounded-md border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-medium text-[#333] hover:border-[#aaa]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmGeneratedImage}
                      className="rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
