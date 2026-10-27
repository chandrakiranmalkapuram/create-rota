import { Skill } from "./staff";

export interface StaffingRequirementBand {
  id: string;
  requirement_id: string;
  start_time: string; // "09:00"
  end_time: string; // "17:00"
  target_staff_count: number;
  skill_id: string | null;
  skill?: Skill | null;
  created_at: string;
  updated_at: string;
}

export interface StaffingRequirement {
  id: string;
  rota_id: string;
  date: string; // "YYYY-MM-DD"
  bands: StaffingRequirementBand[];
  created_at: string;
  updated_at: string;
}

export interface ShiftOverrideAudit {
  id: string;
  shift_id: string;
  user_id: string | null;
  warning_codes: string[];
  status: string;
  overridden_at: string;
}

export interface Shift {
  id: string;
  rota_id: string;
  staff_id: string;
  staff_name: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "09:00"
  end_time: string; // "17:00"
  unpaid_break_minutes: number;
  paid_hours: number;
  skill_id: string | null;
  skill_name: string | null;
  status: "draft" | "published" | "cancelled";
  notes: string | null;
  active_override?: ShiftOverrideAudit | null;
  created_at: string;
}

export interface DiagnosticItem {
  type: "error" | "warning" | "info";
  message: string;
  date?: string | null;
  band?: string | null;
  staff_name?: string | null;
  is_proven?: boolean;
}

export interface RelaxationSuggestion {
  id: string;
  category: "skill" | "max_shifts" | "max_hours" | "availability" | "workforce_capacity" | "rest_period" | string;
  is_confirmed: boolean; // True if confirmed mathematical finding; False if heuristic recommendation
  title: string;
  description: string;
  affected_date?: string | null;
  affected_band?: string | null;
  affected_staff_id?: string | null;
  affected_staff_name?: string | null;
  potential_impact: string;
}

export interface Assumptions {
  break_policy_name: string;
  break_tiers_summary: string;
  rest_period_hours: number;
  random_seed: number;
  compliance_disclaimer: string;
}

export type SolverOutcomeStatus = "feasible" | "partially_feasible" | "infeasible" | "timeout" | "unknown";

export interface GenerationRun {
  id: string;
  rota_id: string;
  status: SolverOutcomeStatus;
  solve_time_seconds: number;
  shifts_created: number;
  coverage_score: number;
  diagnostics: DiagnosticItem[];
  relaxation_suggestions?: RelaxationSuggestion[];
  assumptions?: Assumptions | null;
  created_at: string;
}

export interface Rota {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string; // "YYYY-MM-DD"
  status: "draft" | "published" | "archived";
  total_shifts: number;
  total_paid_hours: number;
  latest_generation_status: SolverOutcomeStatus | null;
  created_at: string;
  updated_at: string;
}

export interface RotaDetail extends Rota {
  requirements: StaffingRequirement[];
  shifts: Shift[];
  latest_run: GenerationRun | null;
  snapshots_count?: number;
}

export interface RotaCreateInput {
  name: string;
  start_date: string;
  end_date: string;
  default_band_start?: string;
  default_band_end?: string;
  default_staff_count?: number;
}

export interface StaffingRequirementBandInput {
  start_time: string;
  end_time: string;
  target_staff_count: number;
  skill_id?: string | null;
}

export interface StaffingRequirementInput {
  date: string;
  bands: StaffingRequirementBandInput[];
}

export interface BreakTierInput {
  threshold_minutes: number;
  break_minutes: number;
  is_unpaid: boolean;
}

export interface BreakPolicyInput {
  name: string;
  description: string;
  tiers: BreakTierInput[];
  compliance_disclaimer?: string;
}

export interface GenerateRotaInput {
  time_limit_seconds?: number;
  random_seed?: number;
  break_policy?: BreakPolicyInput;
}

export interface RotaSnapshot {
  id: string;
  rota_id: string;
  workspace_id: string;
  created_by_id?: string | null;
  snapshot_reason: string;
  description?: string | null;
  shifts_count: number;
  coverage_score: number;
  created_at: string;
}

export interface RestoreSnapshotResponse {
  message: string;
  restored_shifts_count: number;
  safety_snapshot_id?: string | null;
  rota: RotaDetail;
}

// ---------------------------------------------------------
// Manual Shift Management Types (Milestone 6)
// ---------------------------------------------------------

export interface ShiftCreateInput {
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  skill_id?: string | null;
  unpaid_break_minutes?: number | null;
  notes?: string | null;
  override_warnings?: boolean;
}

export interface ShiftUpdateInput {
  staff_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  skill_id?: string | null;
  unpaid_break_minutes?: number | null;
  notes?: string | null;
  override_warnings?: boolean;
}

export interface ShiftCopyInput {
  target_date: string;
  target_staff_id?: string | null;
  override_warnings?: boolean;
}

export interface ShiftValidationFinding {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  date?: string | null;
  shift_id?: string | null;
}

export interface CoverageSummaryItem {
  date: string;
  target_staff_count: number;
  scheduled_staff_count: number;
  is_understaffed: boolean;
  is_overstaffed: boolean;
}

export interface ShiftValidationInput {
  shift_id?: string | null;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  skill_id?: string | null;
  unpaid_break_minutes?: number | null;
}

export interface ShiftValidationResponse {
  is_valid: boolean;
  has_warnings: boolean;
  can_override: boolean;
  findings: ShiftValidationFinding[];
  gross_hours: number;
  unpaid_break_minutes: number;
  paid_hours: number;
  assumptions_summary: string;
  daily_coverage?: CoverageSummaryItem | null;
  adjacent_rest_checks?: Record<string, string>;
}

export interface ShiftMutationResponse {
  shift: Shift;
  warnings: ShiftValidationFinding[];
  message: string;
  rota: RotaDetail;
}

