import { GPSInput } from "../types";
import { clampBuffer, hasPositiveLeftover, isNewFragileArrival } from "../utils";

export const isFragilePhase3 = (input: GPSInput): boolean =>
  input.driftFlag || input.leftoverTrend < 0 || input.bufferMonths < 0;

export const isFragilePhase2 = (input: GPSInput): boolean =>
  input.bufferMonths >= 0.25 &&
  input.bufferMonths < 0.75 &&
  !input.driftFlag &&
  hasPositiveLeftover(input);

export const isFragilePhase1 = (input: GPSInput): boolean =>
  input.bufferMonths < 0.25 && hasPositiveLeftover(input) && isNewFragileArrival(input);

export const normalizedBuffer = (input: GPSInput): number => clampBuffer(input.bufferMonths);
