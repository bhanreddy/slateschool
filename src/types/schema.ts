// ============================================================================
// DATABASE-ALIGNED TYPES (PostgreSQL Schema)
// ============================================================================

// Reference Types (Enums/Lookup Tables)
export interface Gender {
    id: number;
    name: string;
}

export interface StudentCategory {
    id: number;
    name: string;
}

export interface Religion {
    id: number;
    name: string;
}

export interface BloodGroup {
    id: number;
    name: string;
}

export interface RelationshipType {
    id: number;
    name: string;
}

export interface StaffDesignation {
    id: number;
    name: string;
}

export interface Country {
    code: string; // 2-char code
    name: string;
}

export type ContactType = 'email' | 'phone' | 'address';
export type AccountStatus = 'active' | 'locked' | 'disabled';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

/** Half-day attendance sessions: morning (first period) & afternoon (post-lunch). */
export type AttendanceSession = 'morning' | 'afternoon';
export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn';

export interface StudentStatus {
    id: number;
    code: string;
    is_terminal: boolean;
}

// Core Entity: Person
export interface Person {
    id: string; // UUID
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    display_name?: string | null;
    dob?: string | null; // ISO date
    gender_id: number;
    nationality_code?: string | null;
    photo_url?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// Person Contacts
export interface PersonContact {
    id: string; // UUID
    person_id: string;
    contact_type: ContactType;
    contact_value: string;
    is_primary: boolean;
    is_emergency: boolean;
    is_verified: boolean;
    verified_at?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// RBAC
export interface Role {
    id: string; // UUID
    code: string;
    name: string;
    is_system: boolean;
}

export interface Permission {
    id: string; // UUID
    code: string;
    name: string;
}

export interface RolePermission {
    role_id: string;
    permission_id: string;
}

// User (Authentication)
export interface User {
    id: string; // UUID
    person_id: string;
    account_status: AccountStatus;
    created_at: string;
    last_login_at?: string | null;
    failed_login_attempts: number;
    locked_until?: string | null;
    updated_at: string;
}

export interface UserRole {
    user_id: string;
    role_id: string;
    granted_by?: string | null;
    granted_at: string;
}

// Student
export interface Student {
    id: string; // UUID
    person_id: string;
    admission_no: string;
    pen_number?: string | null;
    admission_date: string; // ISO date
    category_id?: number | null;
    religion_id?: number | null;
    blood_group_id?: number | null;
    status_id: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// Parent
export interface Parent {
    id: string; // UUID
    person_id: string;
    occupation?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface StudentParent {
    id: string; // UUID
    student_id: string;
    parent_id: string;
    relationship_id?: number | null;
    is_primary_contact: boolean;
    is_legal_guardian: boolean;
    valid_from?: string | null;
    valid_to?: string | null;
    created_at: string;
    deleted_at?: string | null;
}

// Academics
export interface AcademicYear {
    id: string; // UUID
    code: string;
    start_date: string;
    end_date: string;
}

export interface Class {
    id: string; // UUID
    name: string;
    code?: string | null;
}

export interface Section {
    id: string; // UUID
    name: string;
    code?: string | null;
}

export interface ClassSection {
    id: string; // UUID
    class_id: string;
    section_id: string;
    academic_year_id: string;
}

export interface StudentEnrollment {
    id: string; // UUID
    student_id: string;
    academic_year_id: string;
    class_section_id: string;
    status: EnrollmentStatus;
    start_date: string;
    end_date?: string | null;
    roll_number?: number | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// Attendance
export interface DailyAttendance {
    id: string; // UUID
    student_enrollment_id: string;
    attendance_date: string; // ISO date
    status: AttendanceStatus; // derived overall day status (both sessions combined)
    morning_status?: AttendanceStatus | null; // first-period (half-day) session
    afternoon_status?: AttendanceStatus | null; // post-lunch (half-day) session
    marked_by?: string | null; // User ID
    marked_at?: string | null;
    updated_at: string;
    deleted_at?: string | null;
}

// ============================================================================
// LEGACY TYPES (Deprecated - For Backward Compatibility)
// ============================================================================

/** @deprecated Use Person + User instead */
export interface BaseUser {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    role: 'admin' | 'staff' | 'teacher' | 'student' | 'parent' | 'accountant';
    createdAt?: any;
    updatedAt?: any;
}

/** @deprecated Use Person + Student + StudentEnrollment instead */
export interface LegacyStudent extends BaseUser {
    role: 'student';
    firstName: string;
    lastName: string;
    admissionNo: string;
    classId: string;
    section: string;
    rollNo?: string;
    parentName?: string;
    parentPhone?: string;
    dob?: string;
    address?: string;
    isActive: boolean;
}

/** @deprecated Use Person + User (with staff role) instead */
export interface Staff extends BaseUser {
    role: 'staff' | 'teacher' | 'admin' | 'accountant';
    firstName: string;
    lastName: string;
    employeeId?: string;
    designation?: string;
    department?: string;
    phone?: string;
    classIds?: string[];
    isActive: boolean;
}

/** @deprecated Use ClassSection instead */
export interface LegacyClass {
    id: string;
    name: string;
    section: string;
    classTeacherId?: string;
    academicYear: string;
}

/** @deprecated Use DailyAttendance instead */
export interface Attendance {
    id: string;
    classId: string;
    date: string;
    recordedBy: string;
    records: {
        studentId: string;
        status: 'present' | 'absent' | 'late' | 'excused';
        remarks?: string;
    }[];
    createdAt?: any;
}

export interface Fee {
    id: string;
    studentId: string;
    classId: string;
    amount: number;
    dueDate: string;
    type: string;
    status: 'pending' | 'paid' | 'partial' | 'overdue';
    paidAmount: number;
    transactions?: {
        amount: number;
        date: any;
        method: string;
        transactionId?: string;
    }[];
}

export interface Notice {
    id: string;
    title: string;
    content: string;
    targetRoles: string[];
    targetClassIds?: string[];
    authorId: string;
    createdAt?: any;
    expiresAt?: any;
}

export interface Complaint {
    id: string;
    studentId: string;
    title: string;
    description: string;
    status: 'pending' | 'resolved' | 'dismissed';
    priority: 'low' | 'medium' | 'high';
    createdAt?: any;
    updatedAt?: any;
    resolvedBy?: string;
    resolutionNotes?: string;
}

// ============================================================================
// DTO TYPES (For API Responses with Joined Data)
// ============================================================================

export interface StudentWithPerson extends Student {
    person: Person;
}

export interface StudentWithDetails extends Student {
    person: Person;
    current_enrollment?: StudentEnrollment & {
        class_section: ClassSection & {
            class: Class;
            section: Section;
        };
    };
    parents?: (StudentParent & {
        parent: Parent & {
            person: Person;
        };
    })[];
}

export interface UserWithPerson extends User {
    person: Person;
    roles?: (UserRole & { role: Role })[];
}

export interface AttendanceWithStudent extends DailyAttendance {
    enrollment: StudentEnrollment & {
        student: Student & {
            person: Person;
        };
    };
}
