export type Period = {
  month: number;
  year: number;
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function currentPeriod(date = new Date()): Period {
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function periodLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`.trim();
}

export function isFuturePeriod(month: number, year: number, referenceDate = new Date()): boolean {
  const current = currentPeriod(referenceDate);
  return year > current.year || (year === current.year && month > current.month);
}

export function isPastPeriod(month: number, year: number, referenceDate = new Date()): boolean {
  const current = currentPeriod(referenceDate);
  return year < current.year || (year === current.year && month < current.month);
}

export function comparePeriods(a: Period, b: Period): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function periodFromDate(date: string | Date): Period {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  return {
    month: value.getMonth() + 1,
    year: value.getFullYear(),
  };
}

export function periodEndDate(month: number, year: number): Date {
  return new Date(year, month, 0);
}

export function daysPastPeriodEnd(month: number, year: number, referenceDate = new Date()): number {
  const end = periodEndDate(month, year);
  const reference = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diff = reference.getTime() - end.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
