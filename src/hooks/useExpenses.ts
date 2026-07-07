import { useState, useCallback, useRef } from 'react';
import { api } from '../services/apiClient';
import { supabase } from '../services/supabaseConfig';
import { Expense, CreateExpenseRequest, ExpenseStatus } from '../types/expenses';
import { alertCompat } from '../utils/crossPlatformAlert';

export type FetchExpensesOptions = {
  accountsScope?: boolean;
  fromDate?: string;
  toDate?: string;
};

export type BulkCreateResult = {
  ok: boolean;
  count?: number;
  errors?: { row: number; error: string }[];
};

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchParams = useRef<{ search: string; options?: FetchExpensesOptions }>({ search: '' });

  const fetchExpenses = useCallback(async (
    searchQuery: string = '',
    options?: FetchExpensesOptions
  ) => {
    lastFetchParams.current = { search: searchQuery, options };
    setLoading(true);
    setError(null);
    try {
      if (options?.accountsScope) {
        const params: Record<string, string> = { scope: 'accounts' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (options.fromDate) params.from_date = options.fromDate;
        if (options.toDate) params.to_date = options.toDate;
        const data = await api.get<Expense[] | { data: Expense[] }>('/expenses', params);
        setExpenses(Array.isArray(data) ? data : (data?.data ?? []));
        return;
      }

      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }
      if (options?.fromDate) {
        query = query.gte('expense_date', options.fromDate);
      }
      if (options?.toDate) {
        query = query.lte('expense_date', options.toDate);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setExpenses(data as Expense[]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch expenses');
      alertCompat('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshExpenses = useCallback(async () => {
    const { search, options } = lastFetchParams.current;
    await fetchExpenses(search, options);
  }, [fetchExpenses]);

  const createExpense = async (expenseData: CreateExpenseRequest) => {
    try {
      await api.post('/expenses', expenseData);
      await refreshExpenses();
      return true;
    } catch {
      return false;
    }
  };

  const createBulkExpenses = async (items: CreateExpenseRequest[]): Promise<BulkCreateResult> => {
    try {
      const res = await api.post<{ count?: number; errors?: { row: number; error: string }[] }>(
        '/expenses/bulk',
        { expenses: items }
      );
      await refreshExpenses();
      return {
        ok: true,
        count: res?.count ?? items.length,
        errors: res?.errors,
      };
    } catch {
      return { ok: false };
    }
  };

  const updateStatus = async (id: string, newStatus: ExpenseStatus) => {
    try {
      await api.put(`/expenses/${id}/status`, { status: newStatus });
      setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, status: newStatus } : e));
      return true;
    } catch {
      return false;
    }
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    createBulkExpenses,
    updateStatus,
  };
}
