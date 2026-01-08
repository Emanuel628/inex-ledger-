import { GPSInput } from "../types";

export const isThrivingMomentum = (input: GPSInput): boolean =>
  input.bufferMonths >= 1 && input.leftoverTrend >= 0 && !input.driftFlag;

export const isThrivingIntent = (input: GPSInput): boolean =>
  input.bufferMonths >= 1 && input.improvements && input.timeInTierDays >= 30;

export const isThrivingStewardship = (input: GPSInput): boolean =>
  input.bufferMonths >= 1.4 || input.timeInTierDays >= 90;
