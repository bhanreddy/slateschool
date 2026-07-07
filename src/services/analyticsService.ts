/**
 * analyticsService.ts
 * Full DB-driven analytics service layer.
 * Calls the backend REST API and returns strongly-typed data.
 */

import { api as apiClient } from './apiClient';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TimeRange = 'month' | 'quarter' | 'year';

export interface TrendPoint {
  label: string;   // e.g. "Jan", "Week 1", "2024-03-01"
  value: number;
}

// ── Financials ──────────────────────────────────────────────────────────────
export interface FeeCollectionSummary {
  total_collected: number;        // ₹ amount (selected range)
  today_collection: number;       // ₹ collected today
  lifetime_collected: number;     // ₹ collected all-time
  outstanding_dues: number;       // ₹ amount
  collection_efficiency: number;  // 0-100 %
  total_invoiced: number;         // total billed
  discount_given: number;         // total discounts
  refunds_issued: number;         // total refunds
  new_enrollments: number;        // students enrolled this period
  trend: TrendPoint[];            // time-series for chart
  by_class: ClassFeeBreakdown[];  // per-class breakdown
  top_pending: PendingStudent[];  // top defaulters
}

export interface ClassFeeBreakdown {
  class_name: string;
  section_name: string;
  collected: number;
  outstanding: number;
  efficiency: number;
}

export interface PendingStudent {
  student_name: string;
  class_section: string;
  amount_due: number;
  overdue_days: number;
}

// ── Attendance ──────────────────────────────────────────────────────────────
export interface AttendancePeriod {
  from: string;   // ISO date (inclusive) — window start
  to: string;     // ISO date (inclusive) — window end (today)
  label: string;  // e.g. "2026-27" (academic year code) or "Jul 2026"
}

export interface AttendanceSummary {
  period: AttendancePeriod;        // window the cards describe
  // number | null — null means NO attendance data exists for the window.
  // Render "—" / "No data", NEVER "0%". 0 is only for a genuine zero.
  avg_attendance: number | null;   // 0-100 %
  chronic_absentees: number;       // count of active students < 75% YTD (0 is real)
  total_present_days: number;      // aggregate student-days present
  total_working_days: number | null; // school working days in range (null = no data)
  staff_attendance: number | null; // 0-100 % for staff (null = not tracked / no data)
  trend: TrendPoint[];             // daily/weekly %
  by_class: ClassAttendanceRow[];  // per class breakdown
  low_attendance_students: LowAttendanceStudent[];
}

export interface ClassAttendanceRow {
  class_name: string;
  section_name: string;
  avg_pct: number;
  total_students: number;
  below_threshold: number;
}

export interface LowAttendanceStudent {
  student_name: string;
  class_section: string;
  attendance_pct: number;
  absent_days: number;
}

// ── Academics ───────────────────────────────────────────────────────────────
export interface AcademicSummary {
  avg_score: number;               // overall avg exam score
  pass_rate: number;               // % students passing
  top_subject: string;
  weakest_subject: string;
  exams_conducted: number;
  trend: TrendPoint[];
  by_subject: SubjectPerformance[];
}

export interface SubjectPerformance {
  subject_name: string;
  avg_score: number;
  pass_rate: number;
  highest: number;
  lowest: number;
}

// ── Staff ────────────────────────────────────────────────────────────────────
export interface StaffSummary {
  total_staff: number;
  active_staff: number;
  on_leave_today: number;
  avg_staff_attendance: number;
  new_joinings: number;
  resignations: number;
}

// ── Insights ────────────────────────────────────────────────────────────────
export interface Insight {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'finance' | 'attendance' | 'academic' | 'staff';
  message: string;
  action_label?: string;
  action_route?: string;
  created_at: string;
}

// ── Full Analytics Response ─────────────────────────────────────────────────
export interface AnalyticsData {
  range: TimeRange;
  generated_at: string;
  financials: FeeCollectionSummary;
  attendance: AttendanceSummary;
  academics: AcademicSummary;
  staff: StaffSummary;
  insights: Insight[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const AnalyticsService = {

  /**
   * Fetch the full analytics snapshot for a given time range.
   * GET /admin/analytics?range=month|quarter|year
   */
  async getAnalytics(range: TimeRange): Promise<AnalyticsData> {
    // Silent: useAnalytics/reports screens surface errors inline (retry cards),
    // not via the global apiClient "Network Error" modal.
    const data = await apiClient.get<AnalyticsData>('/admin/analytics', { range }, { silent: true });
    return data;
  },

  /**
   * Fetch only the financial summary (lighter call).
   * GET /admin/analytics/financials?range=...
   */
  async getFinancials(range: TimeRange): Promise<FeeCollectionSummary> {
    const data = await apiClient.get<FeeCollectionSummary>('/admin/analytics/financials', { range });
    return data;
  },

  /**
   * Fetch only the attendance summary.
   * GET /admin/analytics/attendance?range=...
   */
  async getAttendance(range: TimeRange): Promise<AttendanceSummary> {
    const data = await apiClient.get<AttendanceSummary>('/admin/analytics/attendance', { range });
    return data;
  },

  /**
   * Fetch academic performance summary.
   * GET /admin/analytics/academics?range=...
   */
  async getAcademics(range: TimeRange): Promise<AcademicSummary> {
    const data = await apiClient.get<AcademicSummary>('/admin/analytics/academics', { range });
    return data;
  },

  /**
   * Fetch staff summary.
   * GET /admin/analytics/staff?range=...
   */
  async getStaff(range: TimeRange): Promise<StaffSummary> {
    const data = await apiClient.get<StaffSummary>('/admin/analytics/staff', { range });
    return data;
  },

  /**
   * Fetch AI-generated insights and anomalies.
   * GET /admin/analytics/insights?range=...
   */
  async getInsights(range: TimeRange): Promise<Insight[]> {
    const data = await apiClient.get<Insight[]>('/admin/analytics/insights', { range });
    return data;
  },

  /**
   * Mark an insight as resolved/dismissed.
   * PATCH /admin/analytics/insights/:id/dismiss
   */
  async dismissInsight(id: string): Promise<void> {
    await apiClient.patch(`/admin/analytics/insights/${id}/dismiss`);
  },

  /**
   * Export analytics report as PDF (returns download URL).
   * POST /admin/analytics/export
   */
  async exportReport(range: TimeRange): Promise<{ download_url: string }> {
    const data = await apiClient.post<{ download_url: string }>('/admin/analytics/export', { range });
    return data;
  },
};
