// ==UserScript==
// @name         U-NEXT Magazine Sort by Release Date
// @namespace    https://kdmsnr.com
// @version      0.2.13
// @description  Build an all-category sorted list by release date found in title text like (yyyy-mm-dd).
// @match        https://video.unext.jp/book/genre/magazine
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAGAZINE_BLOCK_SELECTOR = 'div[data-testid="magazineBlock"]';
  const TITLE_LINK_SELECTOR = 'a[data-testid="playableBookCard-title-link"], a[href^="/book/title/"]';
  const THUMB_LINK_SELECTOR = 'a[data-testid="playableBookCard-thumbnail-link"], a[href^="/book/view/"]';
  const GLOBAL_BLOCK_ID = 'unext-magazine-global-sort';
  const GLOBAL_LIST_ID = 'unext-magazine-global-sort-list';
  const GLOBAL_STYLE_ID = 'unext-magazine-global-sort-style';
  const DATE_PATTERN = /[（(]\s*(\d{4}-\d{2}-\d{2})\s*[）)]/;
  const SORT_DESC = true; // true: newest first, false: oldest first
  const AUTO_SCROLL_ENABLED = true; // 初回のみ自動スクロールで収集
  const AUTO_SCROLL_INTERVAL_MS = 350;
  const AUTO_SCROLL_IDLE_LIMIT = 12;
  const AUTO_SCROLL_MAX_STEPS = 140;
  const SHOW_AT_BOTTOM_ONLY = false;
  const BOTTOM_THRESHOLD_PX = 160;
  const INNER_FRAME_HEIGHT_PX = 1000;

  let isSorting = false;
  let isScheduled = false;
  let lastRenderSignature = '';
  let isCacheReady = false;
  let needsFullRescan = false;
  let nearBottomTriggerHeight = 0;
  let isAutoScrolling = false;
  let hasAutoScrolled = false;
  let isCollectionCompleted = !AUTO_SCROLL_ENABLED;
  const cardStore = new Map();
  const liKeyMap = new WeakMap();

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

  function getCardDigest(card) {
    return [
      card.timestamp,
      card.title,
      card.sortTitle,
      card.titleHref,
      card.thumbHref,
      card.imageSrc,
      card.imageSrcset,
      card.imageAlt
    ].join('|');
  }

  function extractCardData(li) {
    const titleAnchor = li.querySelector(TITLE_LINK_SELECTOR);
    const thumbAnchor = li.querySelector(THUMB_LINK_SELECTOR);
    const img = li.querySelector('img');

    const title = titleAnchor?.textContent?.trim() || img?.getAttribute('alt') || '';
    const sortTitle = title.replace(DATE_PATTERN, '').trim();
    const titleHref = titleAnchor?.getAttribute('href') || '';
    const thumbHref = thumbAnchor?.getAttribute('href') || titleHref || '';
    const imageSrc = img?.getAttribute('src') || '';
    const imageSrcset = img?.getAttribute('srcset') || '';
    const imageAlt = img?.getAttribute('alt') || title || 'magazine cover';
    const timestamp = getReleaseTimestamp(li);

    return {
      key: titleHref || thumbHref || title,
      title,
      sortTitle,
      titleHref,
      thumbHref,
      imageSrc,
      imageSrcset,
      imageAlt,
      timestamp
    };
  }

  function upsertCard(li) {
    if (!li || !li.querySelector?.(TITLE_LINK_SELECTOR)) {
      return false;
    }

    const card = extractCardData(li);
    if (!card.key) {
      return false;
    }

    const digest = getCardDigest(card);
    const prev = cardStore.get(card.key);
    const changed = !prev || prev.digest !== digest;

    liKeyMap.set(li, card.key);
    cardStore.set(card.key, { card, digest, sourceLi: li });

    return changed;
  }

  function forEachCardLiInNode(node, callback) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node;
    if (isInGlobalBlock(element)) {
      return;
    }

    const seen = new Set();
    const visit = (li) => {
      if (!li || seen.has(li)) {
        return;
      }
      if (!li.querySelector?.(TITLE_LINK_SELECTOR)) {
        return;
      }
      seen.add(li);
      callback(li);
    };

    if (element.matches?.(TITLE_LINK_SELECTOR)) {
      visit(element.closest('li'));
    }
    if (element.matches?.('li')) {
      visit(element);
    }

    const links = element.querySelectorAll?.(TITLE_LINK_SELECTOR) || [];
    for (const link of links) {
      visit(link.closest('li'));
    }
  }

  function rebuildCardStore() {
    const links = document.querySelectorAll(TITLE_LINK_SELECTOR);
    for (const link of links) {
      if (link.closest(`#${GLOBAL_BLOCK_ID}`)) {
        continue;
      }
      const li = link.closest('li');
      if (!li) {
        continue;
      }
      upsertCard(li);
    }

    isCacheReady = true;
  }

  function getCachedCards() {
    return Array.from(cardStore.values(), (entry) => entry.card);
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

      const titleDelta = a.sortTitle.localeCompare(b.sortTitle, 'ja');
      if (titleDelta !== 0) {
        return titleDelta;
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
        margin: 24px 0 36px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 8px;
        background: rgba(20, 24, 28, 0.92);
        color: #f5f7fa;
        height: ${INNER_FRAME_HEIGHT_PX}px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #${GLOBAL_BLOCK_ID} h2 {
        margin: 0 0 12px;
        font-size: 18px;
        line-height: 1.4;
        color: #ffffff;
        flex: 0 0 auto;
      }
      #${GLOBAL_LIST_ID} {
        margin: 0;
        padding: 0 4px 0 0;
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
        gap: 12px;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
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

    const allBlocks = document.querySelectorAll(MAGAZINE_BLOCK_SELECTOR);
    const lastBlock = allBlocks[allBlocks.length - 1] || firstBlock;
    const container = lastBlock.parentElement;
    if (!container) {
      return null;
    }

    ensureGlobalStyle();

    let block = document.getElementById(GLOBAL_BLOCK_ID);
    if (!block) {
      block = document.createElement('section');
      block.id = GLOBAL_BLOCK_ID;
      block.innerHTML = `<h2>雑誌（全カテゴリ新着順）</h2><ul id="${GLOBAL_LIST_ID}"></ul>`;
    }
    const needsMove = block.parentElement !== container || block.previousElementSibling !== lastBlock;
    if (needsMove) {
      container.insertBefore(block, lastBlock.nextSibling);
    }

    updateGlobalBlockVisibility();
    return block.querySelector(`#${GLOBAL_LIST_ID}`);
  }

  function renderGlobalList(ranked) {
    const list = ensureGlobalList();
    if (!list) {
      return false;
    }

    const signature = ranked.map((entry) => `${entry.key}|${entry.timestamp}|${entry.sortTitle}`).join('||');
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
      if (!isCacheReady || needsFullRescan) {
        rebuildCardStore();
        needsFullRescan = false;
      }

      const cards = getCachedCards();
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
    }, 150);
  }

  function isInGlobalBlock(node) {
    if (!node) {
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return Boolean(node.closest?.(`#${GLOBAL_BLOCK_ID}`));
    }
    const parent = node.parentElement || node.parentNode;
    return Boolean(parent?.closest?.(`#${GLOBAL_BLOCK_ID}`));
  }

  function isRelevantMutation(mutation) {
    if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
      return false;
    }

    for (const node of mutation.addedNodes) {
      if (isInGlobalBlock(node)) {
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const element = node;
      if (element.matches?.(TITLE_LINK_SELECTOR) || element.querySelector?.(TITLE_LINK_SELECTOR)) {
        return true;
      }
    }

    return false;
  }

  function setupLazyLoadHooks() {
    window.addEventListener('scroll', () => {
      updateGlobalBlockVisibility();

      const viewportBottom = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      const nearBottom = pageHeight - viewportBottom < window.innerHeight * 1.2;

      if (!nearBottom) {
        return;
      }
      if (nearBottomTriggerHeight === pageHeight) {
        return;
      }

      nearBottomTriggerHeight = pageHeight;
      needsFullRescan = true;
      scheduleSort();
    }, { passive: true });

    window.addEventListener('load', () => {
      updateGlobalBlockVisibility();
      needsFullRescan = true;
      scheduleSort();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updateGlobalBlockVisibility();
        needsFullRescan = true;
        scheduleSort();
      }
    });
  }

  function maybeStartAutoScroll() {
    if (!AUTO_SCROLL_ENABLED || hasAutoScrolled || isAutoScrolling) {
      return;
    }

    hasAutoScrolled = true;
    isAutoScrolling = true;
    isCollectionCompleted = false;
    updateGlobalBlockVisibility();

    let previousHeight = document.documentElement.scrollHeight;
    let previousLinkCount = countSourceTitleLinks();
    let idleCount = 0;
    let stepCount = 0;

    const finish = () => {
      isAutoScrolling = false;
      isCollectionCompleted = true;
      needsFullRescan = true;
      scheduleSort();
      updateGlobalBlockVisibility();
    };

    const tick = () => {
      const doc = document.documentElement;
      const viewport = window.innerHeight;
      const pageHeight = doc.scrollHeight;
      const maxY = Math.max(0, pageHeight - viewport);
      const step = Math.max(260, Math.floor(viewport * 0.9));
      const nextY = Math.min(maxY, window.scrollY + step);

      window.scrollTo(0, nextY);

      needsFullRescan = true;
      scheduleSort();

      const newHeight = doc.scrollHeight;
      const newLinkCount = countSourceTitleLinks();
      const atBottom = window.scrollY >= maxY - 2;
      const grew = newHeight > previousHeight + 2 || newLinkCount > previousLinkCount;
      if (grew) {
        idleCount = 0;
      } else if (atBottom) {
        idleCount += 1;
      }

      previousHeight = Math.max(previousHeight, newHeight);
      previousLinkCount = Math.max(previousLinkCount, newLinkCount);
      stepCount += 1;

      if (idleCount >= AUTO_SCROLL_IDLE_LIMIT || stepCount >= AUTO_SCROLL_MAX_STEPS) {
        finish();
        return;
      }

      window.setTimeout(tick, AUTO_SCROLL_INTERVAL_MS);
    };

    window.setTimeout(tick, AUTO_SCROLL_INTERVAL_MS);
  }

  function countSourceTitleLinks() {
    const links = document.querySelectorAll(TITLE_LINK_SELECTOR);
    let count = 0;
    for (const link of links) {
      if (!link.closest(`#${GLOBAL_BLOCK_ID}`)) {
        count += 1;
      }
    }
    return count;
  }

  function isNearPageBottom() {
    const viewportBottom = window.scrollY + window.innerHeight;
    const pageHeight = document.documentElement.scrollHeight;
    return pageHeight - viewportBottom <= BOTTOM_THRESHOLD_PX;
  }

  function updateGlobalBlockVisibility() {
    const block = document.getElementById(GLOBAL_BLOCK_ID);
    if (!block) {
      return;
    }

    const shouldShow = !SHOW_AT_BOTTOM_ONLY || isNearPageBottom();
    block.style.display = shouldShow ? 'flex' : 'none';
  }

  const observer = new MutationObserver((mutations) => {
    if (isSorting) {
      return;
    }

    let changed = false;
    let shouldRescan = false;

    for (const mutation of mutations) {
      if (isInGlobalBlock(mutation.target)) {
        continue;
      }

      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          forEachCardLiInNode(node, (li) => {
            if (upsertCard(li)) {
              changed = true;
            }
          });
        }

        if (isRelevantMutation(mutation)) {
          shouldRescan = true;
        }
        continue;
      }

      if (mutation.type === 'attributes') {
        const element = mutation.target;
        const li = element.closest?.('li');
        if (li && upsertCard(li)) {
          changed = true;
        } else {
          shouldRescan = true;
        }
      }
    }

    if (shouldRescan) {
        needsFullRescan = true;
    }
    if (changed || shouldRescan) {
      scheduleSort();
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'alt', 'href']
    });
  }

  setupLazyLoadHooks();
  needsFullRescan = true;
  scheduleSort();
  maybeStartAutoScroll();
})();
