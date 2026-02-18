export enum UserRole {
  ADMIN = 'ADMIN',
  LECTURER = 'LECTURER',
  STUDENT = 'STUDENT',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum NotificationType {
  APPOINTMENT_REQUEST = 'APPOINTMENT_REQUEST',
  APPOINTMENT_ACCEPTED = 'APPOINTMENT_ACCEPTED',
  APPOINTMENT_REJECTED = 'APPOINTMENT_REJECTED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  TIMETABLE_CHANGE = 'TIMETABLE_CHANGE',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum MapMarkerType {
  HALL = 'HALL',
  OFFICE = 'OFFICE',
  LAB = 'LAB',
  AMENITY = 'AMENITY',
  ENTRANCE = 'ENTRANCE',
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
