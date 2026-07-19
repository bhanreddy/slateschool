export const EXPENSE_CATEGORIES = [
  'Education',
  'Maintenance',
  'Sports',
  'Utility',
  'Events',
  'Salary',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export const toDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const monthStartInput = () => {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const todayDateInput = () => toDateInput(new Date());

export const daysAgoInput = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateInput(d);
};

export const lastMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toDateInput(start), to: toDateInput(end) };
};

/** Short human label: "18 Jul" or "18 Jul 2025" when year differs from current. */
export const formatDateShort = (iso: string) => {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  } catch {
    return iso;
  }
};
