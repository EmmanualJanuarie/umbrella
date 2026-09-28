import axios from "axios";

interface AuditContent {
  action: string;
  user_id: string;
  branch_name?: string;
  org_name?: string;
  pane_accessed?: string;
  camera_used_today?: string | null;
  video_uploaded_today?: string | null;
  shift?: string | null;
  requests?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface AuditLogParams {
  scope: 'BRANCH' | 'ORG' | 'SYSTEM';
  scope_id?: string;
  entry_count?: number;
  content: AuditContent;
}

export const logAudit = async (params: AuditLogParams) => {
  try {
    await axios.post('/audit-report', {
      scope: params.scope,
      scope_id: params.scope_id,
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      entry_count: params.entry_count || 1,
      content: params.content,
    });
  } catch (err) {
    console.error('Audit log failed', err);
  }
};