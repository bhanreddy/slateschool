export type ExpenseStatus = 'pending' | 'approved' | 'paid';

export interface Expense {
    id: string;
    created_by: string;
    title: string;
    category: string;
    amount: number;
    expense_date: string; // ISO Date string YYYY-MM-DD
    status: ExpenseStatus;
    description?: string;
    receipt_url?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateExpenseRequest {
    title: string;
    category: string;
    amount: number;
    expense_date: string;
    description?: string;
    receipt_url?: string;
    status?: ExpenseStatus;
}

export interface UpdateExpenseStatusRequest {
    status: ExpenseStatus;
}
