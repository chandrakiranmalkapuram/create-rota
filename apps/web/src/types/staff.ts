export interface Skill {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface StaffContract {
  id: string;
  staff_id: string;
  contracted_hours_per_week: number;
  min_hours_per_week: number | null;
  max_hours_per_week: number | null;
  max_shifts_per_week: number | null;
  max_consecutive_days: number | null;
  min_rest_hours_between_shifts: number;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityRule {
  id: string;
  staff_id: string;
  weekday: number; // 0=Mon, 1=Tue, ..., 6=Sun
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  is_recurring_day_off: boolean;
  created_at: string;
}

export type LeaveReasonCategory = "holiday" | "sickness" | "training" | "other";

export interface UnavailabilityBlock {
  id: string;
  staff_id: string;
  reason_category: LeaveReasonCategory;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
}

export type StaffCategory = "full_time" | "restricted_hours";

export interface StaffMember {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  category: StaffCategory;
  is_archived: boolean;
  notes: string | null;
  skills: Skill[];
  contract: StaffContract | null;
  availability_rules: AvailabilityRule[];
  unavailability_blocks: UnavailabilityBlock[];
  created_at: string;
  updated_at: string;
}

export interface StaffMemberListResponse {
  items: StaffMember[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StaffContractInput {
  contracted_hours_per_week: number;
  min_hours_per_week?: number | null;
  max_hours_per_week?: number | null;
  max_shifts_per_week?: number | null;
  max_consecutive_days?: number | null;
  min_rest_hours_between_shifts?: number;
}

export interface AvailabilityRuleInput {
  weekday: number;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  is_recurring_day_off: boolean;
}

export interface UnavailabilityBlockInput {
  reason_category: LeaveReasonCategory;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}

export interface StaffMemberFormData {
  first_name: string;
  last_name: string;
  display_name?: string;
  category: StaffCategory;
  notes?: string;
  skill_ids: string[];
  contract: StaffContractInput;
  availability_rules: AvailabilityRuleInput[];
  unavailability_blocks: UnavailabilityBlockInput[];
}
