import { monthName } from './domain/periods';

export function formatPHP(amount: number | null | undefined): string {
  if (amount == null) return '₱0.00';
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getMonthName(month: number): string {
  return monthName(month);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function avatarColor(name: string): string {
  const colors = [
    '#2F4A7D', '#1E3158', '#637FB1', '#8FA8D1',
    '#C34A1A', '#A43A12', '#FFB14A', '#D99A2B',
  ];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
