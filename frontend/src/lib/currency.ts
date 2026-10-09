'use client';

import { useEffect, useState } from 'react';

const FALLBACK_INR_PER_USD = 84;

export function useUsdToInrRate() {
  const [rate, setRate] = useState(FALLBACK_INR_PER_USD);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Exchange-rate service returned HTTP ${response.status}`);
        }
        const data = (await response.json()) as { rates?: Record<string, unknown> };
        const inrRate = data.rates?.INR;
        if (typeof inrRate !== 'number' || !Number.isFinite(inrRate) || inrRate <= 0) {
          throw new Error('Exchange-rate service returned an invalid INR rate');
        }
        if (isMounted) setRate(inrRate);
      })
      .catch((error: unknown) => {
        console.error('Unable to load the INR exchange rate; using the approximate fallback rate.', error);
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { rate, isLoaded, hasError };
}

export function formatInr(amount: number, usdToInrRate: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount * usdToInrRate);
}
