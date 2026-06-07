const STORAGE_KEYS = {
  token: "devboard_token",
  apiUrl: "devboard_api_url",
} as const;

const DEFAULT_API_URL = "http://localhost:3001";

interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
}

interface TrackPayload {
  company: string;
  role: string;
  jdUrl: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "unauthorized" | "duplicate" | "network" | "unknown" };

async function getApiUrl(): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.apiUrl);
  return (stored[STORAGE_KEYS.apiUrl] as string) || DEFAULT_API_URL;
}

async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.token);
  return (stored[STORAGE_KEYS.token] as string) || null;
}

async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.token);
}

async function login(payload: LoginPayload): Promise<ApiResult<{ token: string }>> {
  const baseUrl = await getApiUrl();

  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data: { token: string } = await res.json();
      await chrome.storage.local.set({ [STORAGE_KEYS.token]: data.token });
      return { ok: true, data };
    }

    if (res.status === 401) {
      return { ok: false, error: "unauthorized" };
    }

    return { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
}

async function trackApplication(
  payload: TrackPayload
): Promise<ApiResult<Application>> {
  const token = await getToken();
  if (!token) return { ok: false, error: "unauthorized" };

  // Intercept for local demo/testing mode without backend running
  if (token === "demo-token") {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate latency
    
    if (payload.role.toLowerCase().trim() === "duplicate") {
      return { ok: false, error: "duplicate" };
    }
    
    return {
      ok: true,
      data: {
        id: "demo-" + Math.random().toString(36).substring(2, 9),
        company: payload.company,
        role: payload.role,
        status: "APPLIED",
      },
    };
  }

  const baseUrl = await getApiUrl();

  try {
    const res = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...payload, status: "APPLIED" }),
    });

    if (res.status === 201) {
      const data: Application = await res.json();
      return { ok: true, data };
    }

    if (res.status === 401) {
      await clearToken();
      return { ok: false, error: "unauthorized" };
    }

    if (res.status === 409) {
      return { ok: false, error: "duplicate" };
    }

    return { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export { login, trackApplication, getToken, clearToken };
export type { ApiResult, Application, TrackPayload, LoginPayload };
