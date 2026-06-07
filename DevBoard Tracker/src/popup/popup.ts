import { detectJobPage } from "../utils/jobDetector.js";
import { getToken, login, trackApplication, clearToken } from "../utils/api.js";

const views = {
  noJob: document.getElementById("view-no-job") as HTMLElement,
  login: document.getElementById("view-login") as HTMLElement,
  track: document.getElementById("view-track") as HTMLElement,
};

const feedback = document.getElementById("feedback") as HTMLDivElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

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

let currentTabId: number | undefined;

function showView(viewName: keyof typeof views): void {
  Object.keys(views).forEach((key) => {
    views[key as keyof typeof views].hidden = key !== viewName;
  });
  logoutBtn.hidden = viewName !== "track";
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

init();
