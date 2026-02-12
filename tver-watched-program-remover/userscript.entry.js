(function () {
  'use strict';

  const core = globalThis.TVerWatchedProgramRemoverCore;
  if (!core) return;

  function hideWatched() {
    core.applyWatchedVisibility({ featureEnabled: true });
  }

  hideWatched();

  const observer = new MutationObserver(hideWatched);
  observer.observe(document.body, { childList: true, subtree: true });
})();
