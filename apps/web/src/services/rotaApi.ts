import {
  ExportOptions,
  Rota,
  RotaCreateInput,
  RotaDetail,
  RotaDuplicateInput,
  RotaSnapshot,
  ShiftCopyInput,
  ShiftCreateInput,
  ShiftMutationResponse,
  ShiftUpdateInput,
  ShiftValidationInput,
  ShiftValidationResponse,
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
  updates: { name?: string },
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
  options: {
    timeLimitSeconds?: number;
    randomSeed?: number;
    breakPolicy?: any;
  } | number = 10.0,
  token: string
): Promise<RotaDetail> => {
  let bodyPayload: any;
  if (typeof options === "number") {
    bodyPayload = { time_limit_seconds: options };
  } else {
    bodyPayload = {
      time_limit_seconds: options.timeLimitSeconds ?? 10.0,
      random_seed: options.randomSeed ?? 42,
      ...(options.breakPolicy ? { break_policy: options.breakPolicy } : {}),
    };
  }

  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to generate rota.");
  }
  return res.json();
};

export const fetchRotaSnapshots = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaSnapshot[]> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/snapshots`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch snapshots.");
  }
  return res.json();
};

export const restoreRotaSnapshot = async (
  workspaceId: string,
  rotaId: string,
  snapshotId: string,
  token: string
): Promise<{ message: string; restored_shifts_count: number; safety_snapshot_id?: string | null; rota: RotaDetail }> => {
  const res = await fetch(
    `/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/snapshots/${snapshotId}/restore`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to restore snapshot.");
  }
  return res.json();
};

// ---------------------------------------------------------
// Manual Shift Management Client Functions (Milestone 6)
// ---------------------------------------------------------

export const validateShift = async (
  workspaceId: string,
  rotaId: string,
  data: ShiftValidationInput,
  token: string
): Promise<ShiftValidationResponse> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/shifts/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = typeof error.detail === "object" ? error.detail.message : error.detail;
    throw new Error(message || "Validation failed.");
  }
  return res.json();
};

export const createShift = async (
  workspaceId: string,
  rotaId: string,
  data: ShiftCreateInput,
  token: string
): Promise<ShiftMutationResponse> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/shifts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = typeof error.detail === "object" ? error.detail.message : error.detail;
    const err = new Error(message || "Failed to create shift.") as Error & { details?: any };
    err.details = error.detail;
    throw err;
  }
  return res.json();
};

export const updateShift = async (
  workspaceId: string,
  rotaId: string,
  shiftId: string,
  data: ShiftUpdateInput,
  token: string
): Promise<ShiftMutationResponse> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/shifts/${shiftId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = typeof error.detail === "object" ? error.detail.message : error.detail;
    const err = new Error(message || "Failed to update shift.") as Error & { details?: any };
    err.details = error.detail;
    throw err;
  }
  return res.json();
};

export const deleteShift = async (
  workspaceId: string,
  rotaId: string,
  shiftId: string,
  token: string
): Promise<{ message: string; rota: RotaDetail }> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/shifts/${shiftId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete shift.");
  }
  return res.json();
};

export const copyShift = async (
  workspaceId: string,
  rotaId: string,
  shiftId: string,
  data: ShiftCopyInput,
  token: string
): Promise<ShiftMutationResponse> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/shifts/${shiftId}/copy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = typeof error.detail === "object" ? error.detail.message : error.detail;
    const err = new Error(message || "Failed to copy shift.") as Error & { details?: any };
    err.details = error.detail;
    throw err;
  }
  return res.json();
};

export const duplicateRota = async (
  workspaceId: string,
  rotaId: string,
  input: RotaDuplicateInput,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/duplicate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to duplicate rota.");
  }
  return res.json();
};

export const approveRota = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to publish rota.");
  }
  return res.json();
};

export const unpublishRota = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/unpublish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to unpublish rota.");
  }
  return res.json();
};

export const archiveRota = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/archive`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to archive rota.");
  }
  return res.json();
};

export const unarchiveRota = async (
  workspaceId: string,
  rotaId: string,
  token: string
): Promise<RotaDetail> => {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/unarchive`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to unarchive rota.");
  }
  return res.json();
};

export const downloadRotaExport = async (
  workspaceId: string,
  rotaId: string,
  options: ExportOptions,
  token: string,
  filenameFallback?: string
): Promise<void> => {
  const query = new URLSearchParams();
  query.append("format", options.format);
  if (options.view) query.append("view", options.view);
  if (options.include_notes !== undefined) {
    query.append("include_notes", options.include_notes ? "true" : "false");
  }

  const res = await fetch(
    `/api/v1/workspaces/${workspaceId}/rotas/${rotaId}/export?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to download export.");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition");
  let filename = filenameFallback;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  if (!filename) {
    filename = `rota_${rotaId}.${options.format}`;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

