const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

if (!root.__tverWatchedRemoverInitialized) {
  root.__tverWatchedRemoverInitialized = true;

  let observer;
  let featureEnabled = true;
  let scheduled = false;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function applyVisibility() {
    const core = root.TVerWatchedProgramRemoverCore;
    if (!core) return;
    if (!isTargetPage()) return;
    core.applyWatchedVisibility({ featureEnabled });
  }

  function scheduleApplyVisibility() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyVisibility();
    });
  }

  function initObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!isTargetPage()) return;
      scheduleApplyVisibility();
    });

    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggleFeature') {
      featureEnabled = message.featureEnabled;
      applyVisibility();
    }
  });

  chrome.storage.sync.get(['featureEnabled'], (result) => {
    featureEnabled = result.featureEnabled ?? true;
    initObserver();
    applyVisibility();
  });
}
