import { detectJobPage } from "../utils/jobDetector.js";
import { getToken, login, trackApplication, clearToken } from "../utils/api.js";

const views = {
  noJob: document.getElementById("view-no-job") as HTMLElement,
  login: document.getElementById("view-login") as HTMLElement,
  track: document.getElementById("view-track") as HTMLElement,
  settings: document.getElementById("view-settings") as HTMLElement,
};

const feedback = document.getElementById("feedback") as HTMLDivElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const trackManualBtn = document.getElementById("track-manual-btn") as HTMLButtonElement;

const loginForm = document.getElementById("login-form") as HTMLFormElement;
const loginEmail = document.getElementById("login-email") as HTMLInputElement;
const loginPass = document.getElementById("login-password") as HTMLInputElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const demoBtn = document.getElementById("demo-btn") as HTMLButtonElement;

const trackForm = document.getElementById("track-form") as HTMLFormElement;
const trackComp = document.getElementById("track-company") as HTMLInputElement;
const trackRole = document.getElementById("track-role") as HTMLInputElement;
const trackUrl = document.getElementById("track-url") as HTMLInputElement;
const trackBtn = document.getElementById("track-btn") as HTMLButtonElement;

const settingsForm = document.getElementById("settings-form") as HTMLFormElement;
const settingsApiUrl = document.getElementById("settings-api-url") as HTMLInputElement;
const settingsBackBtn = document.getElementById("settings-back-btn") as HTMLButtonElement;

let currentTabId: number | undefined;
let previousView: keyof typeof views = "noJob";

function showView(viewName: keyof typeof views): void {
  Object.keys(views).forEach((key) => {
    views[key as keyof typeof views].hidden = key !== viewName;
  });
  logoutBtn.hidden = viewName !== "track";
  settingsBtn.hidden = viewName === "settings";
}

function showFeedback(message: string, isError = true): void {
  feedback.textContent = message;
  feedback.className = `feedback ${isError ? "error" : "success"}`;
  feedback.hidden = false;
}

function clearFeedback(): void {
  feedback.textContent = "";
  feedback.hidden = true;
}

function setFormLoading(btn: HTMLButtonElement, loading: boolean): void {
  btn.disabled = loading;
  if (loading) {
    btn.classList.add("btn-loading");
  } else {
    btn.classList.remove("btn-loading");
  }
}

async function init(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab || !activeTab.url) {
    showView("noJob");
    return;
  }

  currentTabId = activeTab.id;
  const { isJobPage, inferredCompany, inferredRole } = detectJobPage(
    activeTab.url,
    activeTab.title || ""
  );

  if (!isJobPage) {
    showView("noJob");
    return;
  }

  trackComp.value = inferredCompany || "";
  trackRole.value = inferredRole || "";
  trackUrl.value = activeTab.url;

  const token = await getToken();
  if (!token) {
    showView("login");
  } else {
    showView("track");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();
  setFormLoading(loginBtn, true);

  const res = await login({ email: loginEmail.value, password: loginPass.value });
  setFormLoading(loginBtn, false);

  if (res.ok) {
    showView("track");
  } else {
    showFeedback(res.error === "unauthorized" ? "Invalid email or password" : "Could not reach DevBoard. Is it running?");
  }
});

demoBtn.addEventListener("click", async () => {
  clearFeedback();
  await chrome.storage.local.set({ devboard_token: "demo-token" });
  showView("track");
});

trackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();
  setFormLoading(trackBtn, true);

  const res = await trackApplication({
    company: trackComp.value,
    role: trackRole.value,
    jdUrl: trackUrl.value,
  });

  setFormLoading(trackBtn, false);

  if (res.ok) {
    showFeedback("Tracked! ✓", false);
    if (currentTabId !== undefined) {
      chrome.runtime.sendMessage({ type: "SUBMIT_SUCCESS", tabId: currentTabId });
    }
    setTimeout(() => window.close(), 1500);
  } else {
    if (res.error === "unauthorized") {
      showFeedback("Session expired. Please log in again.");
      showView("login");
    } else if (res.error === "duplicate") {
      showFeedback(`Already tracking this role at ${trackComp.value}`);
    } else {
      showFeedback("Could not reach DevBoard. Is it running?");
    }
  }
});

logoutBtn.addEventListener("click", async () => {
  clearFeedback();
  await clearToken();
  showView("login");
});

settingsBtn.addEventListener("click", async () => {
  const currentActive = Object.keys(views).find(
    (key) => !views[key as keyof typeof views].hidden
  ) as keyof typeof views;
  if (currentActive && currentActive !== "settings") {
    previousView = currentActive;
  }
  const stored = (await chrome.storage.local.get("devboard_api_url")) as { devboard_api_url?: string };
  settingsApiUrl.value = stored.devboard_api_url || "http://localhost:3001";
  showView("settings");
});

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();
  const url = settingsApiUrl.value.trim().replace(/\/$/, "");
  await chrome.storage.local.set({ devboard_api_url: url });
  showFeedback("API URL saved!", false);
  setTimeout(() => {
    clearFeedback();
    showView(previousView);
  }, 1000);
});

settingsBackBtn.addEventListener("click", () => {
  clearFeedback();
  showView(previousView);
});

trackManualBtn.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (activeTab && activeTab.url) {
    trackUrl.value = activeTab.url;
    
    // Guess company from domain name
    try {
      const parsed = new URL(activeTab.url);
      const host = parsed.hostname.replace(/^www\./, "");
      const domainParts = host.split(".");
      if (domainParts.length >= 2) {
        const rawName = domainParts[domainParts.length - 2];
        trackComp.value = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }
    } catch {}
    
    // Guess role from title
    if (activeTab.title) {
      const cleanTitle = activeTab.title
        .replace(/\s*[|\u2013\-\u2014]\s*(?:Jobs|Careers|LinkedIn|Indeed|Home|Hiring).*$/i, "")
        .trim();
      trackRole.value = cleanTitle;
    }
  }
  
  const token = await getToken();
  if (!token) {
    showView("login");
  } else {
    showView("track");
  }
});

init();
