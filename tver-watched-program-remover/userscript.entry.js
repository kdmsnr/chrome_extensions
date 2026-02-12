(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  const core = root.TVerWatchedProgramRemoverCore;
  if (!core) return;
  let scheduled = false;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function scheduleHideWatched() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      hideWatched();
    }, 0);
  }

  function hideWatched() {
    if (!isTargetPage()) return;
    core.applyWatchedVisibility({ featureEnabled: true });
  }

  const observer = new MutationObserver(scheduleHideWatched);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const notifyRouteChange = () => scheduleHideWatched();
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    notifyRouteChange();
    return result;
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    notifyRouteChange();
    return result;
  };
  window.addEventListener('popstate', notifyRouteChange);

  setInterval(() => {
    if (isTargetPage()) scheduleHideWatched();
  }, 1500);

  hideWatched();
})();
