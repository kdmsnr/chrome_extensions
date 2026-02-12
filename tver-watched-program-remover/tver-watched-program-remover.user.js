// ==UserScript==
// @name         Remove Watched Programs for TVer
// @namespace    https://kdmsnr.com
// @version      1.0.4
// @description  Remove watched programs from TVer's My Page
// @author       kdmsnr
// @match        https://tver.jp/mypage/fav*
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function (global) {
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

  global.TVerWatchedProgramRemoverCore = {
    getEpisodeLinks,
    applyWatchedVisibility,
  };
})(globalThis);
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
