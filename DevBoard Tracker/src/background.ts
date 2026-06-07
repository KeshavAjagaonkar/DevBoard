import { detectJobPage } from "./utils/jobDetector.js";

const BADGE_JOB = "#6366f1";
const BADGE_SUCCESS = "#22c55e";

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "PAGE_DATA" && sender.tab?.id) {
    const { isJobPage } = detectJobPage(message.url, message.title);
    updateBadge(sender.tab.id, isJobPage);
  }

  if (message.type === "SUBMIT_SUCCESS" && typeof message.tabId === "number") {
    flashSuccessBadge(message.tabId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.title) {
    const { isJobPage } = detectJobPage(tab.url, tab.title);
    updateBadge(tabId, isJobPage);
  }
});

function updateBadge(tabId: number, isJobPage: boolean): void {
  if (isJobPage) {
    chrome.action.setBadgeText({ text: "●", tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_JOB, tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

function flashSuccessBadge(tabId: number): void {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_SUCCESS, tabId });
  setTimeout(() => {
    chrome.action.setBadgeBackgroundColor({ color: BADGE_JOB, tabId });
  }, 1500);
}
