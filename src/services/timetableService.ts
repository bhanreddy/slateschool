import { api } from './apiClient';

/** School-level scheduling mode. 'uniform' = one schedule for all 6 days; 'per_day' = distinct per weekday. */
export type TimetableMode = 'uniform' | 'per_day';

/** Weekday identifiers used by the timetable (Mon–Sat). Matches the backend day_of_week_enum. */
export type DayOfWeek =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday';

/** Ordered Mon–Sat list for grids and day pickers. */
export const TIMETABLE_DAYS: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

/** Short labels for day headers. Index 0 = Monday. */
export const TIMETABLE_DAY_LABELS: Record<DayOfWeek, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
};

export interface TimetableConfig {
    timetable_mode: TimetableMode;
}

export interface TimetableSlot {
    id: string;
    period_number: number;
    day_of_week?: DayOfWeek;
    start_time: string; // "09:00:00"
    end_time: string;
    subject_id: string;
    subject_name?: string;
    subject_name_te?: string;
    teacher_id?: string;
    teacher_name?: string;
    room_no?: string;
    class_name?: string; // For teacher view
    section_name?: string; // For teacher view
}

export interface CreateSlotRequest {
    class_section_id: string;
    academic_year_id: string;
    period_number: number;
    subject_id: string;
    teacher_id?: string;
    start_time: string;
    end_time: string;
    /** Required in per_day mode; ignored (template stored on Monday) in uniform mode. */
    day_of_week?: DayOfWeek;
}

export interface Period {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    sort_order: number;
    is_break?: boolean;
}

export interface TimetableTeacher {
    id: string;
    person_id: string;
    staff_code: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
}

export const TimetableService = {
    // ── Scheduling mode (per school) ────────────────────────────────────
    getConfig: async (): Promise<TimetableConfig> => {
        return api.get<TimetableConfig>('/timetable/config');
    },

    /**
     * Switch the school's scheduling mode.
     *  - uniform → per_day : non-destructive (fans the template into Tue–Sat).
     *  - per_day → uniform : destructive; pass confirm:true and an optional
     *    sourceDay (defaults to Monday on the server).
     */
    setConfig: async (
        mode: TimetableMode,
        opts?: { confirm?: boolean; sourceDay?: DayOfWeek }
    ): Promise<TimetableConfig & { changed: boolean }> => {
        return api.patch<TimetableConfig & { changed: boolean }>('/timetable/config', {
            timetable_mode: mode,
            ...(opts?.confirm ? { confirm: true } : {}),
            ...(opts?.sourceDay ? { source_day: opts.sourceDay } : {}),
        });
    },

    // ── Admin grid editing ──────────────────────────────────────────────
    // Get slots for a class. Pass dayOfWeek to fetch a single weekday (per_day).
    getClassSlots: async (
        classSectionId: string,
        academicYearId?: string,
        options?: { fresh?: boolean; dayOfWeek?: DayOfWeek }
    ): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>(`/timetable/${classSectionId}/slots`, {
            academic_year_id: academicYearId,
            ...(options?.dayOfWeek ? { day_of_week: options.dayOfWeek } : {}),
            ...(options?.fresh ? { fresh: '1' } : {}),
        });
    },

    // Admin: Create/upsert slot (silent — caller shows contextual alerts)
    createSlot: async (data: CreateSlotRequest): Promise<TimetableSlot> => {
        return api.post<TimetableSlot>('/timetable', data, { silent: true });
    },

    // Admin: Delete slot
    deleteSlot: async (id: string): Promise<void> => {
        return api.delete(`/timetable/${id}`);
    },

    // ── Student / teacher reads ─────────────────────────────────────────
    // Student: Get my timetable (all weekdays; uniform schools return one template).
    getMyTimetable: async (): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>('/timetable/my-timetable');
    },

    // Teacher: Get my schedule across all sections. Pass staffId when an admin
    // is viewing another staff member's portal.
    getTeacherTimetable: async (academicYearId?: string, staffId?: string): Promise<TimetableSlot[]> => {
        return api.get<TimetableSlot[]>('/timetable/teacher-timetable', {
            academic_year_id: academicYearId,
            staff_id: staffId,
        });
    },

    getTeacherOptions: async (): Promise<TimetableTeacher[]> => {
        return api.get<TimetableTeacher[]>('/timetable/teacher-options');
    },

    // ── Period structure ("format") ─────────────────────────────────────
    getPeriods: async (): Promise<Period[]> => {
        return api.get<Period[]>('/timetable/periods/list');
    },

    updatePeriods: async (periods: Period[]): Promise<void> => {
        return api.put('/timetable/periods', { periods });
    },

    deletePeriod: async (id: string): Promise<void> => {
        return api.delete(`/timetable/periods/${id}`);
    },

    createPeriod: async (data: {
        name: string;
        start_time: string;
        end_time: string;
        is_break?: boolean;
    }): Promise<Period> => {
        return api.post<Period>('/timetable/periods/create', data);
    },
};
