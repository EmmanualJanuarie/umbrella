export const ROLE = {
  MAIN_SUPER_ADMIN: "MAIN_SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  BRANCH_ADMIN: "BRANCH_ADMIN",
  ORG_OWNER: "ORG_OWNER",
  OFFICER: "OFFICER",
} as const;
export type Role = typeof ROLE[keyof typeof ROLE];

export const REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type RequestStatus = typeof REQUEST_STATUS[keyof typeof REQUEST_STATUS];

export const VIOLATION_SEVERITY = {
  MINIMAL: "MINIMAL",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type ViolationSeverity =
  typeof VIOLATION_SEVERITY[keyof typeof VIOLATION_SEVERITY];

export const VIOLATION_STATUS = {
  IN_PROCESS: "IN_PROCESS",
  COMPLETED: "COMPLETED",
} as const;
export type ViolationStatus =
  typeof VIOLATION_STATUS[keyof typeof VIOLATION_STATUS];


export const OFFICER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type OfficerStatus = typeof OFFICER_STATUS[keyof typeof OFFICER_STATUS];

export const DASHBOARD_TYPE = {
  PLATFORM: "PLATFORM",
  UMBRELLA: "UMBRELLA",
  ORGANIZATION: "ORGANIZATION",
  BRANCH: "BRANCH",
  OFFICER: "OFFICER"
}
export type Dashboard_Type = typeof DASHBOARD_TYPE[keyof typeof DASHBOARD_TYPE];


export const CAMERA_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DAMAGED: "DAMAGED",
  LOST: "LOST",
  IN_STOCK: "IN_STOCK",
  UNASSIGNED: "UNASSIGNED"
} as const;
export type CameraStatus = typeof CAMERA_STATUS[keyof typeof CAMERA_STATUS];

export const SHIFT_STATUS = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  MISSED: "MISSED",
} as const;
export type ShiftStatus = typeof SHIFT_STATUS[keyof typeof SHIFT_STATUS];

export const SESSION_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  INTERRUPTED: "INTERRUPTED",
} as const;
export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

export const VIOLATION_TYPE = {
  CAMERA_OFF: "CAMERA_OFF",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  TAMPERING: "TAMPERING",
  GPS_ANOMALY: "GPS_ANOMALY",
  MISSED_SHIFT: "MISSED_SHIFT",
  SHIFT_MISMATCH: "SHIFT_MISMATCH",
  RECORDING_GAP: "RECORDING_GAP",
  EVIDENCE_IRREGULARITY: "EVIDENCE_IRREGULARITY",
} as const;
export type ViolationType =
  typeof VIOLATION_TYPE[keyof typeof VIOLATION_TYPE];

export const ENTITY_TYPE = {
  OFFICER: "OFFICER",
  OFFICERS: "OFFICERS",
  CAMERA: "CAMERA",
  CAMERAS: "CAMERAS",
  BRANCHES: "BRANCHES",
  BRANCH: "BRANCH",
  SHIFT: "SHIFTS",
  REQUEST: "REQUEST",
  REQUESTS: "REQUESTS",
  SCHEDULES: "SCHEDULES",
  VIDEOS: "VIDEOS",
  VIDEO: "VIDEO",
  VIOLATION: "VIOLATION",
  USER: 'USER',
  CAMERA_INVENTORY: 'CAMERA_INVENTORY',
  ORGANIZATION: "ORGANIZATION",
  ORGANIZATIONS: "ORGANIZATIONS",
  SESSION: "SESSION",
  SESSIONS: "SESSIONS",
  AUDIT_LOGS: "AUDIT_LOGS",
  AUDIT_LOG: "AUDIT_LOG",
  VIDEO_REQUESTS: "VIDEO_REQUESTS",
  PASSWORD_CHANGE_REQUESTS: "PASSWORD_CHANGE_REQUESTS",
  SECURITY: "SECURITY",
  NOTIFICATION: "NOTIFICATION",
  VIOLATIONS: "VIOLATIONS",
  REPORTS: "REPORTS",
  REPORT: "REPORT"
} as const;
export type EntityType = typeof ENTITY_TYPE[keyof typeof ENTITY_TYPE];

export const  USER_DISABLE_REASON = {
  RESIGNED: "RESIGNED",
  RETIRED: "RETIRED",
  TERMINATED: "TERMINATED",
  DISMISSED: "DISMISSED",

  SUSPENDED: "SUSPENDED",
  INVESTIGATION: "INVESTIGATION",
  DISCIPLINARY_ACTION: "DISCIPLINARY_ACTION",

  SECURITY_RISK: "SECURITY_RISK",
  SECURITY_INCIDENT: "SECURITY_INCIDENT",
  UNAUTHORIZED_ACCESS_ATTEMPT: "UNAUTHORIZED_ACCESS_ATTEMPT",
  POLICY_VIOLATION: "POLICY_VIOLATION",

  LICENSE_EXPIRED: "LICENSE_EXPIRED",
  CERTIFICATION_EXPIRED: "CERTIFICATION_EXPIRED",
  TRAINING_EXPIRED: "TRAINING_EXPIRED",

  LEAVE_OF_ABSENCE: "LEAVE_OF_ABSENCE",
  EXTENDED_LEAVE: "EXTENDED_LEAVE",
  MEDICAL_LEAVE: "MEDICAL_LEAVE",

  ACCOUNT_COMPROMISED: "ACCOUNT_COMPROMISED",
  PASSWORD_COMPROMISED: "PASSWORD_COMPROMISED",
  MFA_NON_COMPLIANCE: "MFA_NON_COMPLIANCE",

  INACTIVE_ACCOUNT: "INACTIVE_ACCOUNT",
  DORMANT_ACCOUNT: "DORMANT_ACCOUNT",

  CONTRACT_ENDED: "CONTRACT_ENDED",
  TEMPORARY_CONTRACT_ENDED: "TEMPORARY_CONTRACT_ENDED",

  ORGANIZATIONAL_RESTRUCTURE: "ORGANIZATIONAL_RESTRUCTURE",
  BRANCH_CLOSURE: "BRANCH_CLOSURE",

  ACCESS_REVOKED_BY_ORGANIZATION: "ACCESS_REVOKED_BY_ORGANIZATION",
  ACCESS_REVOKED_BY_UMBRELLA: "ACCESS_REVOKED_BY_UMBRELLA",

  DUPLICATE_ACCOUNT: "DUPLICATE_ACCOUNT",
  ACCOUNT_MERGED: "ACCOUNT_MERGED",

  COURT_ORDER: "COURT_ORDER",
  LEGAL_HOLD_RESTRICTION: "LEGAL_HOLD_RESTRICTION",
  REGULATORY_REQUIREMENT: "REGULATORY_REQUIREMENT",

  OFFICER_STATUS_INACTIVE: "OFFICER_STATUS_INACTIVE",
  EMPLOYMENT_STATUS_CHANGE: "EMPLOYMENT_STATUS_CHANGE",

  ADMIN_ACTION: "ADMIN_ACTION",
  OTHER: "OTHER",
}as const;
export type USER_DISABLE_REASON = typeof USER_DISABLE_REASON[keyof typeof USER_DISABLE_REASON];


export const CAMERA_TYPE = {
  BYOC: "BYOC",
  UMBRELLA: "UMBRELLA",
} as const;
export type CameraType = typeof CAMERA_TYPE[keyof typeof CAMERA_TYPE];

export const VIDEO_STORAGE_STATE = {
  NORMAL: "NORMAL",
  CASE_NEEDED: "CASE_NEEDED",
  AUTO_DELETE: "AUTO_DELETE",
  EMERGENCY_DELETE: "EMERGENCY_DELETE",
} as const;
export type VideoStorageState =
  typeof VIDEO_STORAGE_STATE[keyof typeof VIDEO_STORAGE_STATE];

export const AUDIT_ACTION = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  ACCESS: "ACCESS",
  ASSIGN: "ASSIGN",
  CLICK: "CLICK",
  ALLOCATE: "ALLOCATE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  EXPORT: "EXPORT",
  DOWNLOAD_REPORT: "DOWNLOAD_REPORT",
  HANDLED_REQUEST: "HANDLED_REQUEST",
  VIOLATION_CREATED : "VIOLATION_CREATED",
  VIEW_AUDIT_REPORT: "VIEW_AUDIT_REPORT",
  EXIT_INVENTORY: "EXIT"
} as const;
export type AuditAction = typeof AUDIT_ACTION[keyof typeof AUDIT_ACTION];

export const REQUEST_TYPE = {
  COURT_CASE: "COURT_CASE",
  GOV_DELETE: "GOV_DELETE",
  INTERNAL_INVESTIGATION: "INTERNAL_INVESTIGATION",
  DISCIPLINARY_REVIEW: "DISCIPLINARY_REVIEW",
  LEGAL_DISCLOSURE: "LEGAL_DISCLOSURE",
  INSURANCE_CLAIM: "INSURANCE_CLAIM",
  TRAINING_REVIEW: "TRAINING_REVIEW",
  PUBLIC_COMPLAINT: "PUBLIC_COMPLAINT",
  INCIDENT_REVIEW: "INCIDENT_REVIEW",
  DATA_SUBJECT_REQUEST: "DATA_SUBJECT_REQUEST",
  OTHER: "OTHER",
} as const;
export type RequestType = typeof REQUEST_TYPE[keyof typeof REQUEST_TYPE];

export const USER_STATUS_ACTION = {
  ENABLED: "ENABLED",
  DISABLED: "DISABLED"
} as const;
export type UserStatusAction = typeof USER_STATUS_ACTION[keyof typeof USER_STATUS_ACTION];

// ===== MODELS =====

export type Organization = {
  org_id: string;
  name: string;
  plan?: "STANDARD" | "PREMIUM" | "ENTERPRISE";
  camera_option?: "PURCHASED_ONCE_OFF" | "RENTED";
  active: boolean;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  created_at: string;

  users?: User[];
  branches?: Branch[];
  cameras?: Camera[];
  passwordChangeRequest?: PasswordChangeRequest[];
};

export type EvidenceStorageTier = "TEMPORARY" | "ARCHIVE";
export type EvidenceRetentionStatus =
  | "ACTIVE"
  | "ARCHIVED"
  | "DELETE_PENDING"
  | "RETENTION_EXPIRED"
  | "DELETE_FAILED";

export type Branch = {
  branch_id: string;
  name: string;
  location: string;
  org_id: string;
  created_at: string;

   // Relations
  organizations?: Organization;
  users?: User[];
  sessions?: Session[];
  cameras?: Camera[];
  passwordChangeRequest?: PasswordChangeRequest[];
};

export type UserStatusHistory = {
  history_id: string;
  user_id: string;
  action: UserStatusAction;
  reason?: string;
  performed_by: string;
  created_at: string;

  // Relations
  user?: User;
  performedByUser?: User;
  performer?: User;
}

export type User = {
  user_id: string;
  email: string;
  role: Role;
  org_id: string;
  branch_id?: string;
  user_del_reason?: string;
  active: boolean;
  deleted_at?: string;
  deleted_by?: string;
  password: string;
  created_at: string;

  first_name: string;
  last_name: string;

  // Relations
  organization?: Organization;
  branch?: Branch;
  officers? : Officer | null;
  notifications?: Notification[]
};



export type Officer = {
  officer_id: string;
  badge_number?: string;
  department: string;
  status: OfficerStatus;
  created_at: string;

  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    branch_id: string;
    org_id: string;
    branch?: Branch;
    role: Role;
    organization?: Organization;
    deleted_at: string;
  }

  // Relations
  organizations?: Organization;
  cameras?: Camera[];
  shifts?: Shift[];
};

export type Camera = {
  camera_id: string;
  serial_number: string;
  usb_serial?: string;
  type: CameraType;
  model: string;
  status: CameraStatus;
  assigned_to?: string;
  user_id?: string;
  branch_id?: string;
  org_id?: string;
  purchase_date?: string;
  created_at: string;

  vendor_id?: string;
  product_id?: string;
  manufacturer?: string;
  assigned_to_org_at?: string;
  assigned_to_branch_at?: string;
  assigned_to_officer_at?: string;

  assigned_to_org_by?: string;
  assigned_to_branch_by?: string;
  assigned_to_officer_by?: string;

  // Relations
  officer?: Officer;
  branch?: Branch;
  organization?: Organization;
  branches?: Branch;
  organizations?: Organization;
  violations?: Violation;
  shifts?: Shift;
  users? : User[];
};

export type CameraReassignment = {
  reassignment_id: string;
  camera_id: string;
  old_officer_id?: string | null;
  new_officer_id: string;
  branch_id?: string | null;
  org_id?: string | null;
  reassigned_by: string;
  reason: string;
  created_at: string;

  camera?: Camera;
  oldOfficer?: Officer | null;
  newOfficer?: Officer;
  branch?: Branch | null;
  organization?: Organization | null;
  reassignedBy?: User;
};

export type Shift = {
  shift_id: string;
  officer_id: string;
  camera_id: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;

  off_days: string[];

  shift_del_reason?: string;
  deleted_at?: string;
  deleted_by?: string;

  // Relations
  officers?: Officer[];
  cameras?: Camera[];
};

export type Notification = {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  entity_type?: EntityType;
  entity_id?: string;

  is_read: boolean;
  created_at?: string;

  // Relations
  user?:User;

};

export type Session = {
  session_id: string;
  officer_id: string;
  user_id: string;
  camera_id: string;
  shift_id: string;
  branch_id: string;

  start_time: string;
  end_time: string;
  start_lat: number;
  start_lon: number;
  end_lat?: number;
  end_lon?: number;

  status: SessionStatus;
  hash: string;
  notes?: string;

  // Relations
  officer?: Officer & { user: User};
  camera?: Camera;
  shift?: Shift;
  user?: User;

  videos? : Video[];
  violations: Violation[];
  branch?: Branch;
  organization?: Organization;
};

export type AuditReport = {
  report_id: string;
  scope: "BRANCH" | "ORG" | "SYSTEM";
  scope_id?: string; // branch_id, org_id, or null for system

  period_start: string; // ISO string
  period_end: string;   // ISO string
  entry_count: number;
  generated_at: string; // ISO string

  created_by: string;   // user_id or system
  notes?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: Record<string, any>; // flexible for nested objects
};

export type Video = {
  video_id: string;
  session_id: string;
  user_id: string;

  file_path: string;
  file_name?: string;
  format: string;
  resolution: string;
  duration: number;
  uploaded: boolean;
  tamper_flag: boolean;

  disabled_reason:              USER_DISABLE_REASON;
  disabled_at:                  string;
  disabled_by:                  string;
  active:                       string;

  video_del_reason?: string;
  deleted_at?: string;
  deleted_by?:    string;

  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;

  start_timestamp: string;
  end_timestamp: string;
  gps_accuracy?: number;

  storage_state: VideoStorageState;
  created_at: string;

  legal_hold?: boolean;
  legal_hold_reason?: string;
  legal_hold_at?: string;
  legal_hold_by?: string;

  restore_status?: string;
  restore_requested_at?: string;
  restore_requested_by?: string;
  restore_expires_at?: string;

  retention_until?: string;
  delete_after?: string;
  storage_tier?: EvidenceStorageTier;
  retention_status?: EvidenceRetentionStatus;
  archive_until?: string | null;
  storage_provider?: string | null;
  storage_object_exists?: boolean;

  // Relations
  session?: Session;
  user?: User;
  violations?: Violation[];
};

export type Violation = {
  violation_id: string;
  officer_id: string;
  session_id: string;
  user_id: string;
  video_id: string;
  audit_log_id?: string;

  type: ViolationType;
  description: string;
  reported_at: string;
  resolved: boolean;
  action_taken?: string;
  closure_reason?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  status: ViolationStatus;
  severity: ViolationSeverity;

  location_violation: boolean;
  location_details: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;

  // Relations
  officer?: Officer;
  session?: Session;
  video?: Video;
  auditLog?: AuditLog;
  cameras?: Camera;
  user?: User;
};

export type AuditLog = {
  audit_log_id: string;
  entity_type: EntityType;
  entity_id: string;
  action: AuditAction;

  performed_by: string; // officer_id
  timestamp: string;

  dashboard_type: Dashboard_Type;

  ip_address?: string;
  details?: JSON;

  // Relations
  performer?: User & { officers?: Officer[] }
  user?: User;
  violations?: Violation[];
};

export type VideoRequest = {
  request_id: string;
  video_id: string;
  requested_by: string; // user_id
  request_type: RequestType;
  status: RequestStatus;
  created_at: string;
  handled_at?: string;
  handled_by?: string; // user_id
  requester_note?: string;
  handler_note?: string;
  download_available_at?: string | null;
  download_expires_at?: string | null;
  downloaded_at?: string | null;
  download_count: number;
  export_status?: "NOT_REQUESTED" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  export_last_error?: string | null;
  export_ready_at?: string | null;
  export_estimated_remaining_min?: number | null;
  export_estimated_remaining_max?: number | null;
  export_estimate_delayed?: boolean;
  download_available?: boolean;
  server_time?: string;

  // Relations
  video: Video & {
    session?: Session & {
      officer?: Officer;
      camera?: Camera;
    };
  };

  requester: User;
  handler?: User | null;
}

export type PasswordChangeRequest = {
  request_id: string;
  requested_by: string; // user_id
  branch_id?: string;
  org_id: string;
  status: RequestStatus;
  created_at: Date;
  handled_at?: Date;
  handled_by?: string; // user_id
  requester_note?: string;
  handler_note?: string;

  // Relations
  branches?: Branch;
  organizations? : Organization;

  requester: User;
  handler?: User | null;

}
