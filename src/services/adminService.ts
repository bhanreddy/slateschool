import { api } from './apiClient';

// --- Types ---

export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';

export interface StudentRiskProfile {
    id: string;
    name: string;
    class: string;
    riskLevel: RiskLevel;
    /** Composite urgency 0–100 (higher = contact sooner) */
    riskScore?: number;
    attendancePct?: number;
    failedCount?: number;
    factors: string[]; // e.g., ["Attendance 67%", "Marks ↓ 15%"]
    primaryFactor?: string;
    recommendation?: string;
    trend: number[]; // Last 5 test scores, oldest → newest
}

export interface HeatmapData {
    classes: string[];
    subjects: string[];
    data: Record<string, Record<string, number>>;
}

export interface AdminDashboardStats {
    totalStudents: number;
    staffPresent: number;
    totalStaff: number;
    collection: number;
    complaints: number;
    // Add other relevant stats
}

export interface AccountsPortalStaffMember {
    staff_id: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    staff_code?: string;
    designation?: string | null;
    email?: string | null;
    user_id?: string | null;
    has_login: boolean;
    has_accounts_access: boolean;
    is_elevated: boolean;
}

export interface AccountsStaffCreationSetting {
    enabled: boolean;
    message?: string;
}

export interface PartialFeePaymentSetting {
    enabled: boolean;
    message?: string;
}

export interface AdminFinanceStats {
    today_collection: number;
    monthly_collection: number;
    collected_total: number;
    pending_dues: number;
    defaulter_count: number;
    recent_transactions?: {
        id: string;
        amount: number;
        payment_method?: string;
        paid_at?: string;
        student_name?: string;
    }[];
}

// --- Mock Data (Temporary until Backend Endpoints are ready) ---



export interface TalkingPointsResult {
    points: string[];
    source: 'ai' | 'fallback';
}

export const AdminService = {
    /**
     * Get main dashboard statistics
     */
    getDashboardStats: async (options?: any): Promise<AdminDashboardStats> => {
        return api.get<AdminDashboardStats>('/admin/dashboard-stats', undefined, options);
    },

    /**
     * Finance summary for /admin/finance — always returns full stats (not visibility-gated).
     */
    getFinanceStats: async (): Promise<AdminFinanceStats> => {
        return api.get<AdminFinanceStats>('/admin/finance-stats');
    },

    /**
     * Get Student Risk Analysis
     */
    getRiskProfiles: async (filters?: any): Promise<StudentRiskProfile[]> => {
        return api.get<StudentRiskProfile[]>('/analytics/risk', filters);
    },

    /**
     * Get Academic Performance Heatmap
     */
    getAcademicHeatmap: async (): Promise<HeatmapData> => {
        return api.get<HeatmapData>('/analytics/heatmap');
    },

    /**
     * Generate AI Talking Points for a student (Telugu)
     */
    generateTalkingPoints: async (studentId: string): Promise<TalkingPointsResult> => {
        const data = await api.get<TalkingPointsResult | string[]>(`/analytics/talking-points/${studentId}`);
        if (Array.isArray(data)) {
            const isFallback = data[0]?.startsWith('[Rule-based') || data[0]?.startsWith('[విశ్లేషణ]');
            return { points: data, source: isFallback ? 'fallback' : 'ai' };
        }
        return data;
    },

    /**
     * Get accounts dashboard visibility config
     */
    getAccountsDashboardConfig: async (): Promise<{ config: Record<string, boolean> }> => {
        return api.get<{ config: Record<string, boolean> }>('/admin/accounts-dashboard-config');
    },

    /**
     * Update accounts dashboard visibility config
     */
    updateAccountsDashboardConfig: async (config: Record<string, boolean>): Promise<{ config: Record<string, boolean> }> => {
        return api.put<{ config: Record<string, boolean> }>('/admin/accounts-dashboard-config', { config });
    },

    getAccountsPortalStaff: async (): Promise<AccountsPortalStaffMember[]> => {
        const res = await api.get<{ staff: AccountsPortalStaffMember[] }>('/admin/accounts-portal-staff');
        return Array.isArray(res?.staff) ? res.staff : [];
    },

    setAccountsPortalAccess: async (
        staffId: string,
        enabled: boolean,
    ): Promise<{ staff_id: string; has_accounts_access: boolean; message: string }> => {
        return api.put<{ staff_id: string; has_accounts_access: boolean; message: string }>(
            `/admin/accounts-portal-staff/${staffId}`,
            { enabled },
        );
    },

    getAccountsStaffCreationSetting: async (): Promise<AccountsStaffCreationSetting> => {
        return api.get<AccountsStaffCreationSetting>('/admin/accounts-staff-creation');
    },

    setAccountsStaffCreationEnabled: async (enabled: boolean): Promise<AccountsStaffCreationSetting> => {
        return api.put<AccountsStaffCreationSetting>('/admin/accounts-staff-creation', { enabled });
    },

    getPartialFeePaymentSetting: async (): Promise<PartialFeePaymentSetting> => {
        return api.get<PartialFeePaymentSetting>('/admin/partial-fee-payment');
    },

    setPartialFeePaymentEnabled: async (enabled: boolean): Promise<PartialFeePaymentSetting> => {
        return api.put<PartialFeePaymentSetting>('/admin/partial-fee-payment', { enabled });
    },

    getStaffPayslipsSetting: async (): Promise<{ enabled: boolean }> => {
        return api.get<{ enabled: boolean }>('/admin/staff-payslips');
    },

    setStaffPayslipsEnabled: async (enabled: boolean): Promise<{ enabled: boolean; message?: string }> => {
        return api.put<{ enabled: boolean; message?: string }>('/admin/staff-payslips', { enabled });
    },
};
