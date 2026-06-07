(() => {
  if (!chrome.runtime?.id) return;

  chrome.runtime.sendMessage({
    type: "PAGE_DATA",
    url: location.href,
    title: document.title,
  });
})();
