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

export const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export const monthStartInput = () => {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const todayDateInput = () => toDateInput(new Date());
