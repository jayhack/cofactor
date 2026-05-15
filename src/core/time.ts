import type { ActivityTrend } from "../types.js";

const dayMs = 24 * 60 * 60 * 1000;

export function ageInDays(dateIso: string, now = new Date()): number {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, (now.getTime() - date.getTime()) / dayMs);
}

export function recencyScore(dateIso: string, halfLifeDays: number, now = new Date()): number {
  return Math.exp((-Math.log(2) * ageInDays(dateIso, now)) / Math.max(1, halfLifeDays));
}

export function quarterLabel(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function inferTrend(dates: string[], now = new Date()): ActivityTrend {
  if (dates.length === 0) {
    return "stable";
  }

  const ages = dates.map((date) => ageInDays(date, now));
  const recent = ages.filter((age) => age <= 90).length;
  const previous = ages.filter((age) => age > 90 && age <= 365).length;
  const freshest = Math.min(...ages);

  if (recent >= Math.max(2, previous * 1.35)) {
    return "rising";
  }
  if (freshest <= 120) {
    return "active";
  }
  if (freshest > 365) {
    return "dormant";
  }

  return "stable";
}

export function frequencyInLastYear(dates: string[], now = new Date()): number {
  return dates.filter((date) => ageInDays(date, now) <= 365).length;
}

export function minIso(dates: string[]): string {
  return dates.reduce((min, value) => (value < min ? value : min), dates[0] ?? new Date(0).toISOString());
}

export function maxIso(dates: string[]): string {
  return dates.reduce((max, value) => (value > max ? value : max), dates[0] ?? new Date(0).toISOString());
}
