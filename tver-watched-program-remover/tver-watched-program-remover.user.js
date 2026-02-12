// ==UserScript==
// @name         Remove Watched Programs for TVer
// @namespace    https://kdmsnr.com
// @version      1.0.4
// @description  Remove watched programs from TVer's My Page
// @author       kdmsnr
// @match        https://tver.jp/*
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function (root) {
  'use strict';

  function getEpisodeLinks(doc = document) {
    const links = new Set();

    doc.querySelectorAll('a[class^="EpisodeItem_"]').forEach((link) => links.add(link));
    doc.querySelectorAll('li > a[href^="/episodes/"]').forEach((link) => links.add(link));

    return [...links];
  }

  function applyWatchedVisibility(options = {}) {
    const { featureEnabled = true, doc = document } = options;

    getEpisodeLinks(doc).forEach((anchor) => {
      const progressBar = anchor.querySelector('span[class^="ProgressBar_progress"]');
      const listItem = anchor.closest('li');
      const isWatched = progressBar && progressBar.style.width === '100%';

      if (isWatched) {
        if (listItem) {
          listItem.style.display = featureEnabled ? 'none' : '';
        } else {
          anchor.style.display = featureEnabled ? 'none' : '';
        }
      } else {
        if (listItem) {
          listItem.style.display = '';
        }
        anchor.style.display = '';
      }
    });
  }

  root.TVerWatchedProgramRemoverCore = {
    getEpisodeLinks,
    applyWatchedVisibility,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
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
