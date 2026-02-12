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
