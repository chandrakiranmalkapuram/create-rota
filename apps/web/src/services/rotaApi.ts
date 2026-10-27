import {
  Rota,
  RotaCreateInput,
  RotaDetail,
  StaffingRequirementInput,
} from "../types/rota";

export interface FetchRotasResponse {
  items: Rota[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const fetchRotas = async (
  workspaceId: string,
  token: string,
  page: number = 1,
  pageSize: number = 20,
  statusFilter?: string
): Promise<FetchRotasResponse> => {
  const query = new URLSearchParams();
  query.append("page", page.toString());
  query.append("page_size", pageSize.toString());
  if (statusFilter && statusFilter !== "all") {
    query.append("status", statusFilter);
  }

  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch rotas.");
  }
  return res.json();
};

export const fetchRotaDetail = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to load rota details.");
  }
  return res.json();
};

export const createRota = async (
  workspaceId: string,
  input: RotaCreateInput,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to create rota.");
  }
  return res.json();
};

export const updateRota = async (
  workspaceId: string,
  rotaId: string,
  updates: { name?: string; status?: string },
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to update rota.");
  }
  return res.json();
};

export const deleteRota = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<void> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete rota.");
  }
};

export const updateRequirements = async (
  workspaceId: string,
  rotaId: string,
  requirements: StaffingRequirementInput[],
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/requirements`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requirements }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to update staffing requirements.");
  }
  return res.json();
};

export const copyRequirements = async (
  workspaceId: string,
  rotaId: string,
  sourceDate: string,
  targetDates: string[],
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/copy-requirements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source_date: sourceDate,
      target_dates: targetDates,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to copy requirements.");
  }
  return res.json();
};

export const generateRota = async (
  workspaceId: string,
  rotaId: string,
  timeLimitSeconds: number = 10.0,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ time_limit_seconds: timeLimitSeconds }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to generate rota.");
  }
  return res.json();
};
