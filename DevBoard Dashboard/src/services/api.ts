const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface StatusLog {
  id: string;
  applicationId: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  source: string;
}

export interface Application {
  id: string;
  userId: string;
  company: string;
  role: string;
  jdUrl: string | null;
  status: string;
  appliedAt: string;
  updatedAt: string;
  notes: string | null;
  statusLogs?: StatusLog[];
}

export interface AnalyticsData {
  total: number;
  byStatus: Record<string, number>;
  interviewRate: number;
}

const STORAGE_KEY = "devboard_dashboard_token";

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "An error occurred");
  }

  return response.json() as Promise<T>;
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string }> {
    const res = await request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    return res;
  },

  async register(email: string, password: string): Promise<void> {
    await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getApplications(): Promise<Application[]> {
    return request<Application[]>("/applications");
  },

  async createApplication(payload: {
    company: string;
    role: string;
    jdUrl?: string;
    notes?: string;
  }): Promise<Application> {
    return request<Application>("/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateApplication(
    id: string,
    payload: { status?: string; notes?: string }
  ): Promise<Application> {
    return request<Application>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteApplication(id: string): Promise<void> {
    await request(`/applications/${id}`, {
      method: "DELETE",
    });
  },

  async getAnalytics(): Promise<AnalyticsData> {
    return request<AnalyticsData>("/analytics");
  },
};
