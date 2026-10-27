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
  created_at: string;
}

export interface DiagnosticItem {
  type: "error" | "warning" | "info";
  message: string;
  date?: string | null;
  band?: string | null;
  staff_name?: string | null;
}

export type SolverOutcomeStatus = "feasible" | "partially_feasible" | "infeasible" | "timeout";

export interface GenerationRun {
  id: string;
  rota_id: string;
  status: SolverOutcomeStatus;
  solve_time_seconds: number;
  shifts_created: number;
  coverage_score: number;
  diagnostics: DiagnosticItem[];
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
