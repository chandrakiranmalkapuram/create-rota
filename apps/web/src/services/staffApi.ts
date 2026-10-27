import {
  Skill,
  StaffMember,
  StaffMemberListResponse,
  StaffMemberFormData,
  UnavailabilityBlock,
  UnavailabilityBlockInput,
} from "../types/staff";

interface FetchStaffParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  isArchived?: boolean;
}

export const fetchStaffList = async (
  workspaceId: string,
  token: string,
  params: FetchStaffParams = {}
): Promise<StaffMemberListResponse> => {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.pageSize) query.append("page_size", params.pageSize.toString());
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.category && params.category !== "all") query.append("category", params.category);
  if (params.isArchived !== undefined) query.append("is_archived", params.isArchived.toString());

  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch staff members.");
  }
  return res.json();
};

export const fetchStaffDetail = async (
  workspaceId: string,
  staffId: string,
  token: string
): Promise<StaffMember> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to load staff details.");
  }
  return res.json();
};

export const createStaffMember = async (
  workspaceId: string,
  token: string,
  data: StaffMemberFormData
): Promise<StaffMember> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to create staff member.");
  }
  return res.json();
};

export const updateStaffMember = async (
  workspaceId: string,
  staffId: string,
  token: string,
  data: Partial<StaffMemberFormData> & { is_archived?: boolean }
): Promise<StaffMember> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to update staff member.");
  }
  return res.json();
};

export const archiveStaffMember = async (
  workspaceId: string,
  staffId: string,
  token: string
): Promise<StaffMember> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}/archive`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to archive staff member.");
  }
  return res.json();
};

export const reactivateStaffMember = async (
  workspaceId: string,
  staffId: string,
  token: string
): Promise<StaffMember> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}/reactivate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to reactivate staff member.");
  }
  return res.json();
};

export const deleteStaffMember = async (
  workspaceId: string,
  staffId: string,
  token: string
): Promise<void> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete staff member.");
  }
};

export const fetchSkills = async (
  workspaceId: string,
  token: string
): Promise<Skill[]> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/skills`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch skills.");
  }
  return res.json();
};

export const createSkill = async (
  workspaceId: string,
  token: string,
  data: { name: string; color: string }
): Promise<Skill> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/skills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to create skill.");
  }
  return res.json();
};

export const addStaffLeave = async (
  workspaceId: string,
  staffId: string,
  token: string,
  data: UnavailabilityBlockInput
): Promise<UnavailabilityBlock> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to add leave or unavailability record.");
  }
  return res.json();
};

export const removeStaffLeave = async (
  workspaceId: string,
  staffId: string,
  blockId: string,
  token: string
): Promise<void> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/staff/${staffId}/leave/${blockId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete leave record.");
  }
};
