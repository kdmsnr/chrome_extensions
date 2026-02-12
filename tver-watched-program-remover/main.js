let observer;
let featureEnabled = true;

function applyVisibility() {
  const core = globalThis.TVerWatchedProgramRemoverCore;
  if (!core) return;
  core.applyWatchedVisibility({ featureEnabled });
}

function initObserver() {
  if (observer) return;
  observer = new MutationObserver(applyVisibility);
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'toggleFeature') {
    featureEnabled = message.featureEnabled;
    if (featureEnabled) {
      initObserver();
      applyVisibility();
    } else {
      stopObserver();
      applyVisibility();
    }
  }
});

chrome.storage.sync.get(['featureEnabled'], (result) => {
  featureEnabled = result.featureEnabled ?? true;
  if (featureEnabled) {
    initObserver();
  }
  applyVisibility();
});
