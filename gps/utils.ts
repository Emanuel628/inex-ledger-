import { GPSInput } from "./types";

const stableHash = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
};

export const clampBuffer = (value: number): number => Math.max(0, value);

export const hasPositiveLeftover = (input: GPSInput): boolean => input.leftoverTrend >= 0;

export const isNewFragileArrival = (input: GPSInput): boolean =>
  input.timeInTierDays <= 21 || input.improvements;

export const pickVariant = (variants: string[], key: string, input: GPSInput): string => {
  if (!variants || !variants.length) return "";
  const seed =
    Math.abs(
      stableHash(key) +
        Math.round(input.bufferMonths * 100) +
        input.timeInTierDays * 3 +
        (input.leftoverTrend || 0) * 5 +
        (input.improvements ? 7 : 0)
    ) % variants.length;
  return variants[seed];
};
