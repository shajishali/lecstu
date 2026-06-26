export type UserRole = 'ADMIN' | 'LECTURER' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  recoveryEmail?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string | null;
  profileImage: string | null;
  designation?: string | null;
  timetableCode?: string | null;
  isActive: boolean;
  department: { id: string; name: string; code?: string } | null;
  lecturerOffice?: { id: string; roomNumber: string; building: string; floor: number } | null;
  studentGroupMemberships?: { group: { id: string; name: string; batchYear: number; batchLabel?: string | null; pathway?: { id: string; name: string; code: string } | null } }[];
  createdAt: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  verificationCode: string;
  recoveryEmail?: string;
  departmentId?: string;
  phone?: string;
  /** Student only */
  programCode?: string;
  studyYear?: string;
  pathwayCode?: string;
  groupId?: string;
}

export interface RegisterOptionsProgram {
  code: string;
  name: string;
  years: string[];
  pathways: { code: string; name: string }[];
  groups: {
    id: string;
    name: string;
    studyYear: string;
    pathwayCode?: string;
    batchYearLabel?: string;
  }[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken?: string;
  };
}

export interface ApiError {
  success: false;
  message: string;
}
