if (!globalThis.__tverWatchedRemoverInitialized) {
  globalThis.__tverWatchedRemoverInitialized = true;

  let observer;
  let featureEnabled = true;
  let lastHref = location.href;
  let routeWatchTimer;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function applyVisibility() {
    if (!isTargetPage()) return;
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

  function syncStateWithPage() {
    if (!isTargetPage()) {
      stopObserver();
      return;
    }

    if (featureEnabled) {
      initObserver();
    } else {
      stopObserver();
    }
    applyVisibility();
  }

  function startRouteWatcher() {
    if (routeWatchTimer) return;
    routeWatchTimer = setInterval(() => {
      if (lastHref === location.href) return;
      lastHref = location.href;
      syncStateWithPage();
    }, 500);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggleFeature') {
      featureEnabled = message.featureEnabled;
      syncStateWithPage();
    }
  });

  chrome.storage.sync.get(['featureEnabled'], (result) => {
    featureEnabled = result.featureEnabled ?? true;
    startRouteWatcher();
    syncStateWithPage();
  });
}
