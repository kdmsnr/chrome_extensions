let observer;
let featureEnabled = true;

function toggleWatchedPrograms() {
  document.querySelectorAll('a[class^="EpisodeItem_"]').forEach(a => {
    const progressBar = a.querySelector('span[class^="ProgressBar_progress"]');
    const li = a.closest('li');
    if (progressBar && progressBar.style.width === '100%') {
      if (li) {
        li.style.display = featureEnabled ? 'none' : '';
      } else {
        a.style.display = featureEnabled ? 'none' : '';
      }
    } else {
      if (li) {
        li.style.display = '';
      }
      a.style.display = '';
    }
  });
}

function initObserver() {
  if (observer) return;
  const observerCallback = () => toggleWatchedPrograms();
  observer = new MutationObserver(observerCallback);
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "toggleFeature") {
    featureEnabled = message.featureEnabled;
    if (featureEnabled) {
      initObserver();
      toggleWatchedPrograms();
    } else {
      stopObserver();
      toggleWatchedPrograms();
    }
  }
});

chrome.storage.sync.get(['featureEnabled'], (result) => {
  featureEnabled = result.featureEnabled ?? true;
  if (featureEnabled) {
    initObserver();
    toggleWatchedPrograms();
  }
});
