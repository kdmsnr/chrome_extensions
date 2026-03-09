// ==UserScript==
// @name         U-NEXT Magazine Sort by Release Date
// @namespace    https://kdmsnr.com
// @version      0.2.0
// @description  Build an all-category sorted list by release date found in title text like (yyyy-mm-dd).
// @match        https://video.unext.jp/book/genre/magazine
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAGAZINE_BLOCK_SELECTOR = 'div[data-testid="magazineBlock"]';
  const TITLE_LINK_SELECTOR = 'a[data-testid="playableBookCard-title-link"]';
  const GLOBAL_BLOCK_ID = 'unext-magazine-global-sort';
  const GLOBAL_LIST_ID = 'unext-magazine-global-sort-list';
  const GLOBAL_STYLE_ID = 'unext-magazine-global-sort-style';
  const DATE_PATTERN = /[（(]\s*(\d{4}-\d{2}-\d{2})\s*[）)]/;
  const SORT_DESC = true; // true: newest first, false: oldest first

  let isSorting = false;
  let isScheduled = false;
  let lastRenderSignature = '';

  function extractDateString(text) {
    if (!text) {
      return null;
    }
    const match = text.match(DATE_PATTERN);
    return match ? match[1] : null;
  }

  function getReleaseTimestamp(li) {
    const titleText = li.querySelector(TITLE_LINK_SELECTOR)?.textContent?.trim() || '';
    const titleDate = extractDateString(titleText);
    if (titleDate) {
      return Date.parse(`${titleDate}T00:00:00Z`);
    }

    const altText = li.querySelector('img[alt]')?.getAttribute('alt') || '';
    const altDate = extractDateString(altText);
    if (altDate) {
      return Date.parse(`${altDate}T00:00:00Z`);
    }

    return Number.NEGATIVE_INFINITY;
  }

  function getCardKey(li) {
    const href = li.querySelector(TITLE_LINK_SELECTOR)?.getAttribute('href');
    if (href) {
      return href;
    }

    return li.querySelector(TITLE_LINK_SELECTOR)?.textContent?.trim() || '';
  }

  function extractCardData(li) {
    const titleAnchor = li.querySelector(TITLE_LINK_SELECTOR);
    const thumbAnchor = li.querySelector('a[data-testid="playableBookCard-thumbnail-link"]');
    const img = li.querySelector('img');

    const title = titleAnchor?.textContent?.trim() || img?.getAttribute('alt') || '';
    const titleHref = titleAnchor?.getAttribute('href') || '';
    const thumbHref = thumbAnchor?.getAttribute('href') || titleHref || '';
    const imageSrc = img?.getAttribute('src') || '';
    const imageSrcset = img?.getAttribute('srcset') || '';
    const imageAlt = img?.getAttribute('alt') || title || 'magazine cover';
    const timestamp = getReleaseTimestamp(li);

    return {
      key: titleHref || thumbHref || title,
      title,
      titleHref,
      thumbHref,
      imageSrc,
      imageSrcset,
      imageAlt,
      timestamp
    };
  }

  function collectCards() {
    const cards = [];
    const seenLi = new Set();
    const seenCardKey = new Set();

    const links = document.querySelectorAll(TITLE_LINK_SELECTOR);
    for (const link of links) {
      if (link.closest(`#${GLOBAL_BLOCK_ID}`)) {
        continue;
      }

      const li = link.closest('li');
      if (!li || seenLi.has(li)) {
        continue;
      }
      seenLi.add(li);

      const card = extractCardData(li);
      const key = card.key;
      if (key && seenCardKey.has(key)) {
        continue;
      }
      if (key) {
        seenCardKey.add(key);
      }

      cards.push(card);
    }

    return cards;
  }

  function rankCards(items) {
    const ranked = items.map((card, originalIndex) => ({
      ...card,
      originalIndex
    }));

    ranked.sort((a, b) => {
      const delta = SORT_DESC
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
      if (delta !== 0) {
        return delta;
      }
      return a.originalIndex - b.originalIndex;
    });

    return ranked;
  }

  function ensureGlobalStyle() {
    if (document.getElementById(GLOBAL_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = GLOBAL_STYLE_ID;
    style.textContent = `
      #${GLOBAL_BLOCK_ID} {
        position: relative;
        margin: 12px 0 28px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 8px;
        background: rgba(20, 24, 28, 0.92);
        color: #f5f7fa;
      }
      #${GLOBAL_BLOCK_ID} h2 {
        margin: 0 0 12px;
        font-size: 18px;
        line-height: 1.4;
        color: #ffffff;
      }
      #${GLOBAL_LIST_ID} {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
        gap: 12px;
      }
      #${GLOBAL_LIST_ID} li {
        min-width: 0;
      }
      #${GLOBAL_LIST_ID} .ums-card {
        color: #f5f7fa;
        text-decoration: none;
        display: block;
      }
      #${GLOBAL_LIST_ID} .ums-card:visited {
        color: #dbe2ea;
      }
      #${GLOBAL_LIST_ID} .ums-thumb {
        aspect-ratio: 3 / 4;
        border-radius: 6px;
        overflow: hidden;
        background: #2a3036;
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      #${GLOBAL_LIST_ID} .ums-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      #${GLOBAL_LIST_ID} .ums-title {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.4;
        word-break: break-word;
        color: #f1f4f8;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureGlobalList() {
    const firstBlock = document.querySelector(MAGAZINE_BLOCK_SELECTOR);
    if (!firstBlock) {
      return null;
    }

    const container = firstBlock.parentElement;
    if (!container) {
      return null;
    }

    ensureGlobalStyle();

    let block = document.getElementById(GLOBAL_BLOCK_ID);
    if (!block) {
      block = document.createElement('section');
      block.id = GLOBAL_BLOCK_ID;
      block.innerHTML = `<h2>雑誌（全カテゴリ新着順）</h2><ul id="${GLOBAL_LIST_ID}"></ul>`;
      container.insertBefore(block, firstBlock);
    }

    return block.querySelector(`#${GLOBAL_LIST_ID}`);
  }

  function renderGlobalList(ranked) {
    const list = ensureGlobalList();
    if (!list) {
      return false;
    }

    const signature = ranked.map((entry) => `${entry.key}|${entry.timestamp}`).join('||');
    if (signature && signature === lastRenderSignature) {
      return false;
    }

    const fragment = document.createDocumentFragment();
    for (const card of ranked) {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.className = 'ums-card';
      anchor.href = card.thumbHref || card.titleHref || '#';

      const thumb = document.createElement('div');
      thumb.className = 'ums-thumb';

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = card.imageSrc;
      img.alt = card.imageAlt;
      if (card.imageSrcset) {
        img.setAttribute('srcset', card.imageSrcset);
      }

      const title = document.createElement('div');
      title.className = 'ums-title';
      title.textContent = card.title;

      thumb.appendChild(img);
      anchor.appendChild(thumb);
      anchor.appendChild(title);
      li.appendChild(anchor);

      fragment.appendChild(li);
    }

    list.textContent = '';
    list.appendChild(fragment);
    lastRenderSignature = signature;

    return true;
  }

  function sortAll() {
    if (isSorting) {
      return;
    }

    isSorting = true;
    try {
      const cards = collectCards();
      if (cards.length === 0) {
        return;
      }

      const ranked = rankCards(cards);
      renderGlobalList(ranked);
    } finally {
      isSorting = false;
    }
  }

  function scheduleSort() {
    if (isScheduled) {
      return;
    }

    isScheduled = true;
    window.setTimeout(() => {
      isScheduled = false;
      sortAll();
    }, 100);
  }

  const observer = new MutationObserver((mutations) => {
    if (isSorting) {
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        scheduleSort();
        return;
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  scheduleSort();
})();
