import { api } from './apiClient';

export interface ApprovalRequest {
  id: string;
  school_id: number;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payload: Record<string, unknown>;
  reason?: string | null;
  requested_by: string;
  requested_by_name?: string;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export const ApprovalService = {
  listPending: async (params?: { status?: string; type?: string }): Promise<ApprovalRequest[]> => {
    return api.get<ApprovalRequest[]>('/approvals', params);
  },

  approve: async (id: string): Promise<{ message: string; request: ApprovalRequest; result?: unknown }> => {
    return api.post(`/approvals/${id}/approve`, {});
  },

  reject: async (id: string, reason?: string): Promise<{ message: string; request: ApprovalRequest }> => {
    return api.post(`/approvals/${id}/reject`, { reason });
  },
};
