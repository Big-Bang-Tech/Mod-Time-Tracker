
export enum View {
  DASHBOARD = 'DASHBOARD',
  PROJECT_LIST = 'PROJECT_LIST',
  REPORTS = 'REPORTS',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_PROJECTS = 'ADMIN_PROJECTS',
  ADMIN_USER_DETAIL = 'ADMIN_USER_DETAIL',
  ADMIN_STATS = 'ADMIN_STATS',
  WEEKLY_HISTORY = 'WEEKLY_HISTORY',
  PROFILE = 'PROFILE',
  MOVEMENTS = 'MOVEMENTS'
}

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  avatarSeed: string;
  lastLogin: string;
  projectOrder?: string[];
  canModifyLogs?: boolean;
}

// Fixed: Added creatorId and isHiddenForUser to the Project interface to satisfy TypeScript checks in App.tsx and reflect the backend data structure
export interface Project {
  id: string;
  userId: string | null; 
  creatorId?: string;
  name: string;
  category: string;
  description?: string;
  color: string;
  lastTracked: string;
  usageLevel: number;
  totalHours: string;
  status: 'Active' | 'On Hold' | 'Running';
  department: string;
  currentDaySeconds: number;
  isGlobal: boolean;
  hiddenBy: string[];
  isActive?: boolean;
  isHiddenForUser?: boolean;
  sessionComment?: string;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  projectId: string;
  projectName: string;
  durationSeconds: number;
  status: 'NORMAL' | 'PRESET' | 'MANUAL';
  comment?: string;
}

export interface LogModificationRecord {
  id: string;
  log_id: string;
  modified_at: string;
  modified_by_user_id: string;
  old_duration_seconds: number;
  new_duration_seconds: number;
  old_date_str: string;
  new_date_str: string;
  old_comment: string | null;
  new_comment: string | null;
}

export interface ActivityLog {
  id: string;
  projectName: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: string;
  color: string;
}
