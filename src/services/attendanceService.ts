import { api } from './apiClient';
import type { DailyAttendance, AttendanceStatus, AttendanceSession } from '../types/schema';

/** Default the half-day session from the wall clock: before 1pm = morning. */
export const currentSession = (): AttendanceSession =>
    new Date().getHours() < 13 ? 'morning' : 'afternoon';

export interface MarkAttendanceRequest {
    class_section_id: string;
    date: string; // YYYY-MM-DD
    session: AttendanceSession; // which half-day session is being marked
    records: Array<{
        student_id: string; // Changed from student_enrollment_id to match backend
        status: AttendanceStatus;
    }>;
}

export interface AttendanceSummary {
    total_students: number;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    percentage: number;
}

export interface StudentAttendanceRecord {
    date: string;
    status: AttendanceStatus;
    marked_by?: string;
}

export const AttendanceService = {
    /**
     * Get attendance for a class on a specific date
     */
    getClassAttendance: async (
        classSectionId: string,
        date: string
    ): Promise<DailyAttendance[]> => {
        return api.get<DailyAttendance[]>('/attendance', {
            class_section_id: classSectionId,
            date: date,
        });
    },

    /**
     * Mark attendance (bulk)
     */
    markAttendance: async (data: MarkAttendanceRequest): Promise<{ success: boolean; count: number }> => {
        return api.post<{ success: boolean; count: number }>('/attendance', data);
    },

    /**
     * Update single attendance record
     */
    updateAttendance: async (
        id: string,
        status: AttendanceStatus
    ): Promise<DailyAttendance> => {
        return api.put<DailyAttendance>(`/attendance/${id}`, { status });
    },

    /**
     * Get attendance summary for a class/date
     */
    getSummary: async (
        classSectionId: string,
        date: string
    ): Promise<AttendanceSummary> => {
        return api.get<AttendanceSummary>('/attendance/summary', {
            class_section_id: classSectionId,
            attendance_date: date,
        });
    },

    /**
     * Get student attendance history
     */
    getStudentAttendance: async (
        studentId: string,
        params?: { from_date?: string; to_date?: string }
    ): Promise<StudentAttendanceRecord[]> => {
        return api.get<StudentAttendanceRecord[]>(`/students/${studentId}/attendance`, params);
    },

    /**
     * Get the teacher's auto-detected class with student list and today's attendance.
     * Pass staffId when an admin is viewing another staff member's portal.
     */
    getMyClass: async (date?: string, staffId?: string, session?: AttendanceSession): Promise<{
        date: string;
        session: AttendanceSession;
        class_section_id: string;
        class_name: string;
        section_name: string;
        total_students: number;
        marked_count: number;
        morning_marked_count: number;
        afternoon_marked_count: number;
        students: Array<{
            student_id: string;
            admission_no: string;
            student_name: string;
            photo_url: string | null;
            enrollment_id: string;
            attendance_id: string | null;
            status: string | null;
            morning_status: string | null;
            afternoon_status: string | null;
            marked_at: string | null;
        }>;
    } | null> => {
        try {
            const params: Record<string, string> = {};
            if (date) params.date = date;
            if (staffId) params.staff_id = staffId;
            if (session) params.session = session;
            // "No class assigned" is an expected, common 404 (most staff aren't
            // a homeroom/class teacher) — silent so it doesn't pop the generic
            // error alert, and caught below to resolve to null instead of throwing.
            return await api.get('/attendance/my-class', params, { silent: true });
        } catch (error: any) {
            if (error?.status === 404 || error?.statusCode === 404) return null;
            throw error;
        }
    },

    /**
     * Get the logged-in staff member's attendance history
     */
    getMyStaffAttendance: async (params?: { from_date?: string; to_date?: string }): Promise<Array<{
        id: string;
        attendance_date: string;
        status: AttendanceStatus;
        marked_at: string;
    }>> => {
        return api.get('/attendance/staff/me', params);
    },
};
