// ==UserScript==
// @name         Kindle Parent Dashboard Enhancer
// @namespace    https://kdmsnr.com
// @version      1.7.4
// @description  parents.amazon.co.jp add-content: auto collect titles via infinite scroll into a persistent local DB + simple substring search (UI isolated in Shadow DOM).
// @match        https://parents.amazon.co.jp/settings/add-content?isChildSelected=true
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ===== DOM selectors (based on observed HTML) =====
  const CARD_SEL  = '.content-card-container';
  const TITLE_SEL = 'p[mdn-text].two-line-ellipsis, p.two-line-ellipsis[mdn-text], p.two-line-ellipsis';

  // ===== Persistent DB key (FINAL / DO NOT CHANGE) =====
  const DB_KEY = 'kindle_parent_dashboard_enhancer_db';
  const STATE_KEY = 'kindle_parent_dashboard_enhancer_state';
  const AUTO_SCROLL_JUMP_TO_BOTTOM = true;
  const AUTO_SCROLL_STEP_RATIO = 0.9;
  const AUTO_SCROLL_MIN_STEP_PX = 320;

  // ===== utils =====
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const norm = (s) =>
    (s || '')
      .replace(/\u3000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const normalizeDigits = (s) =>
    (s || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const searchNorm = (s) => normalizeDigits(norm(s)).toLowerCase();

  function loadDB() {
    try {
      const v = JSON.parse(localStorage.getItem(DB_KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function saveDB(items) {
    localStorage.setItem(DB_KEY, JSON.stringify(items));
  }

  function enrichDbWithAsin(state) {
    const db = loadDB();
    const titleToAsin = state?.titleToAsin || {};
    let changed = false;
    const byIdentity = new Map();

    for (const item of db) {
      const key = item?.key || item?.title || '';
      const title = item?.title || key;
      const asin = item?.asin || titleToAsin[key] || titleToAsin[title] || '';
      const identity = asin || key;
      if (!identity) continue;

      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, {
          key,
          title,
          asin: asin || undefined,
          seenAt: item?.seenAt || 0
        });
      } else {
        const prev = byIdentity.get(identity);
        if ((item?.seenAt || 0) > (prev.seenAt || 0)) prev.seenAt = item.seenAt;
        if (!prev.asin && asin) prev.asin = asin;
      }

      if (!item?.asin && asin) changed = true;
    }

    if (changed || byIdentity.size !== db.length) {
      saveDB(Array.from(byIdentity.values()));
    }
  }

  function loadState() {
    try {
      const v = JSON.parse(localStorage.getItem(STATE_KEY));
      if (!v || typeof v !== 'object') return {};
      return v;
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  // ===== card helpers (READ ONLY) =====
  function getCards() {
    return Array.from(document.querySelectorAll(CARD_SEL));
  }

  function extractTitle(card) {
    const t = card.querySelector(TITLE_SEL);
    return norm(t ? t.textContent : '');
  }

  function extractKey(card, title) {
    // Prefer aria-label title part if present: "TITLE, 本"
    const input = card.querySelector('input[type="checkbox"][role="switch"][aria-label]');
    const al = input?.getAttribute('aria-label') || '';
    const alTitle = norm((al.split(',')[0] || '').trim());
    return alTitle || title;
  }

  function ingestVisibleIntoDB() {
    const state = loadState();
    const titleToAsin = state?.titleToAsin || {};
    const db = loadDB();
    const known = new Set(db.map(x => x.asin || x.key));

    let added = 0;
    const cards = getCards();

    for (const card of cards) {
      const title = extractTitle(card);
      if (!title) continue;
      const key = extractKey(card, title);
      const asin = titleToAsin[key] || titleToAsin[title] || '';
      const identity = asin || key;
      if (!identity || known.has(identity)) continue;

      db.push({ key, title: key, asin: asin || undefined, seenAt: Date.now() });
      known.add(identity);
      added++;
    }

    if (added) saveDB(db);
    return { total: db.length, added, visible: cards.length };
  }

  function getCookie(name) {
    const cookie = document.cookie || '';
    for (const part of cookie.split(';')) {
      const p = part.trim();
      if (!p.startsWith(name + '=')) continue;
      return decodeURIComponent(p.slice(name.length + 1));
    }
    return '';
  }

  function installApiLearning() {
    if (window.__kpdeApiHookInstalled) return;
    window.__kpdeApiHookInstalled = true;

    const state = loadState();
    state.titleToAsin = state.titleToAsin || {};
    state.asinStatus = state.asinStatus || {};
    state.asinContentType = state.asinContentType || {};
    let pendingTitle = '';

    const capturePendingTitle = (ev) => {
      const card = ev.target && ev.target.closest ? ev.target.closest(CARD_SEL) : null;
      if (!card) return;
      const input = card.querySelector('input[type="checkbox"][role="switch"]');
      if (!input) return;
      const title = extractTitle(card);
      const key = extractKey(card, title);
      pendingTitle = key || title || '';
    };

    document.addEventListener('pointerdown', capturePendingTitle, true);
    document.addEventListener('click', capturePendingTitle, true);
    document.addEventListener('change', capturePendingTitle, true);

    const isAsin = (v) => typeof v === 'string' && /^[A-Z0-9]{10}$/.test(v);
    const pickTitle = (obj) => {
      if (!obj || typeof obj !== 'object') return '';
      const keys = ['title', 'displayTitle', 'itemTitle', 'name', 'activityTitle', 'bookTitle'];
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'string' && norm(v)) return norm(v);
      }
      // one-level deep fallback (e.g. metadata.title)
      for (const v of Object.values(obj)) {
        if (!v || typeof v !== 'object') continue;
        for (const k of keys) {
          const vv = v[k];
          if (typeof vv === 'string' && norm(vv)) return norm(vv);
        }
      }
      return '';
    };

    const learnFromResponseJson = (data) => {
      const seen = new Set();
      const stack = [data];
      let changed = false;
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object') continue;
        if (seen.has(cur)) continue;
        seen.add(cur);

        if (Array.isArray(cur)) {
          for (const x of cur) stack.push(x);
          continue;
        }

        const asin = cur.itemId || cur.asin || cur.contentId;
        const title = pickTitle(cur);
        if (isAsin(asin) && title) {
          state.titleToAsin[title] = asin;
          changed = true;
        }

        for (const v of Object.values(cur)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
      if (changed) saveState(state);
      if (changed) enrichDbWithAsin(state);
    };

    const learnFromPayload = (payload) => {
      const asins = Array.isArray(payload?.asins) ? payload.asins : [];
      const childMap = payload?.childToAllowlistStatusMap || {};
      const asinTypeMap = payload?.asinToContentTypeMap || {};
      const childId = Object.keys(childMap)[0] || '';
      if (childId) state.childDirectedId = childId;
      for (const asin of asins) {
        state.asinStatus[asin] = childMap[childId] || state.asinStatus[asin] || 'ADDED';
        state.asinContentType[asin] = asinTypeMap[asin] || state.asinContentType[asin] || 'EBOOK';
      }
      if (pendingTitle && asins.length === 1) {
        state.titleToAsin[pendingTitle] = asins[0];
      }
      saveState(state);
      enrichDbWithAsin(state);
    };

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch.apply(window, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const init = args[1] || {};
        if (url.includes('/ajax/update-add-content-status-batch') && init.body) {
          learnFromPayload(JSON.parse(init.body));
        }
        if (url.includes('/ajax/')) {
          const cloned = res.clone();
          cloned.json().then(learnFromResponseJson).catch(() => {});
        }
      } catch {
        // no-op: learning is best effort
      }
      return res;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__kpdeUrl = typeof url === 'string' ? url : '';
      return originalOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
      try {
        const url = this.__kpdeUrl || '';
        if (url.includes('/ajax/update-add-content-status-batch') && typeof body === 'string' && body.startsWith('{')) {
          learnFromPayload(JSON.parse(body));
        }
        if (url.includes('/ajax/')) {
          this.addEventListener('loadend', () => {
            try {
              const raw = typeof this.responseText === 'string' ? this.responseText.trim() : '';
              if (this.responseType === 'json' && this.response) {
                learnFromResponseJson(this.response);
                return;
              }
              if (!raw) return;
              const sanitized = raw.startsWith(')]}\'') ? raw.slice(raw.indexOf('\n') + 1).trim() : raw;
              if (!sanitized.startsWith('{') && !sanitized.startsWith('[')) return;
              const json = JSON.parse(sanitized);
              learnFromResponseJson(json);
            } catch {
              // no-op
            }
          }, { once: true });
        }
      } catch {
        // no-op
      }
      return originalSend.call(this, body);
    };
  }

  // ===== infinite scroll =====
  function findScrollContainer() {
    const firstCard = getCards()[0];
    if (!firstCard) return null;

    let el = firstCard.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = window.getComputedStyle(el);
      const overflowY = cs.overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 4;
      if (scrollable) return el;
      el = el.parentElement;
    }
    return null;
  }

  function getScrollInfo(scroller) {
    if (scroller) {
      return {
        top: scroller.scrollTop,
        maxTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
        viewport: scroller.clientHeight
      };
    }

    const d = document.documentElement;
    return {
      top: window.scrollY,
      maxTop: Math.max(0, d.scrollHeight - window.innerHeight),
      viewport: window.innerHeight
    };
  }

  function nearBottom(scroller, px = 250) {
    const s = getScrollInfo(scroller);
    return (s.maxTop - s.top) < px;
  }

  async function scrollStep(scroller) {
    const s = getScrollInfo(scroller);
    const step = Math.max(AUTO_SCROLL_MIN_STEP_PX, Math.floor(s.viewport * AUTO_SCROLL_STEP_RATIO));

    if (AUTO_SCROLL_JUMP_TO_BOTTOM) {
      if (scroller) {
        scroller.scrollTo(0, scroller.scrollHeight);
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
      await sleep(120);
      return;
    }

    // Scroll in smaller steps to reduce UI glitches during virtualization.
    if (scroller) scroller.scrollBy(0, step);
    else window.scrollBy(0, step);
    await sleep(120);

    if (nearBottom(scroller, 500)) {
      if (scroller) {
        scroller.scrollTo(0, scroller.scrollHeight);
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
      await sleep(180);
    }
  }

  // ===== UI (Shadow DOM to avoid CSS collisions) =====
  function mountUI() {
    if (document.getElementById('kpde-host')) return;

    const host = document.createElement('div');
    host.id = 'kpde-host';
    host.style.cssText = 'position:fixed; right:12px; top:12px; z-index:2147483647;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel {
        all: initial;
        display: block;
        width: min(380px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow: hidden;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 10px;
        box-shadow: 0 2px 12px rgba(0,0,0,.18);
        padding: 10px;
        font: 12px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: #111;
        box-sizing: border-box;
      }
      .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .row.space { justify-content:space-between; }
      .row.controls > .btn { flex: 1 1 110px; }
      .btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font: inherit;
        padding: 6px 8px;
        border: 1px solid #bbb;
        border-radius: 8px;
        background: #f8f8f8;
        cursor: pointer;
        user-select: none;
        box-sizing: border-box;
        white-space: nowrap;
      }
      .btn:active { transform: translateY(1px); }
      .btn.primary { flex: 1 1 150px; }
      .btn.small { padding: 2px 6px; }
      .status { margin-top: 8px; color: #333; }
      hr { border: none; border-top: 1px solid #e6e6e6; margin: 10px 0; }
      .input {
        all: initial;
        display: block;
        font: inherit;
        width: 100%;
        box-sizing: border-box;
        padding: 6px;
        border: 1px solid #bbb;
        border-radius: 8px;
        background: #fff;
      }
      .list {
        margin-top: 8px;
        max-height: min(260px, calc(100vh - 250px));
        overflow: auto;
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 6px;
        box-sizing: border-box;
      }
      .item {
        all: initial;
        display: block;
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        line-height: 1.35;
        border-bottom: 1px solid #f3f3f3;
        padding-bottom: 6px;
        margin-bottom: 6px;
        font-weight: 600;
        cursor: pointer;
      }
      .item:hover {
        background: #f5f8ff;
      }
      .item.focused {
        outline: 2px solid #4b6fff;
        border-radius: 6px;
      }
      .itemRow {
        display: flex;
        gap: 6px;
        align-items: stretch;
      }
      .itemText {
        flex: 1 1 auto;
      }
      .btn.add {
        flex: 0 0 auto;
        padding: 4px 8px;
      }
      .hint { margin-top: 8px; color: #666; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="row space">
        <div style="font-weight:700;">Kindle Parent Dashboard Enhancer</div>
      </div>

      <div class="row" style="margin-top:6px;">
        <button id="clear" class="btn small">Clear DB</button>
      </div>

      <div class="row controls" style="margin-top:8px;">
        <button id="autoFast" class="btn primary">Auto (Fast)</button>
        <button id="autoSafe" class="btn">Auto (Safe)</button>
        <button id="stop" class="btn">Stop</button>
      </div>

      <div id="status" class="status">Ready</div>

      <hr>

      <input id="q" class="input" placeholder="Search (substring)">

      <div class="list">
        <div id="list"></div>
      </div>

      <div class="hint">検索結果クリックでカードへ移動。</div>
    `;
    shadow.appendChild(panel);

    const $ = (id) => shadow.getElementById(id);
    const setStatus = (m) => { $('status').textContent = m; };

    let stopFlag = false;
    let focusedResultEl = null;

    function findVisibleCardByKey(key) {
      for (const card of getCards()) {
        const title = extractTitle(card);
        if (!title) continue;
        const k = extractKey(card, title);
        if (k === key) return card;
      }
      return null;
    }

    function findVisibleCardByAsinOrKey(asin, key, state) {
      const byKey = key ? findVisibleCardByKey(key) : null;
      if (byKey) return byKey;
      if (!asin) return null;

      const titleToAsin = state?.titleToAsin || {};
      for (const card of getCards()) {
        const title = extractTitle(card);
        if (!title) continue;
        const k = extractKey(card, title);
        const mapped = titleToAsin[k] || titleToAsin[title] || '';
        if (mapped === asin) return card;
      }
      return null;
    }

    function focusCard(card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.outline = '2px solid #4b6fff';
      card.style.outlineOffset = '2px';
      window.setTimeout(() => {
        card.style.outline = '';
        card.style.outlineOffset = '';
      }, 2000);
    }

    async function ensureCardVisibleByKey(key) {
      let found = findVisibleCardByKey(key);
      if (found) return found;

      const scroller = findScrollContainer();
      const step = () => {
        const s = getScrollInfo(scroller);
        const px = Math.max(AUTO_SCROLL_MIN_STEP_PX, Math.floor(s.viewport * AUTO_SCROLL_STEP_RATIO));
        if (scroller) scroller.scrollBy(0, px);
        else window.scrollBy(0, px);
      };

      if (scroller) scroller.scrollTo(0, 0);
      else window.scrollTo(0, 0);
      await sleep(300);

      let stable = 0;
      let lastTop = getScrollInfo(scroller).top;
      for (let i = 0; i < 1200; i++) {
        found = findVisibleCardByKey(key);
        if (found) return found;

        step();
        await sleep(450);

        const nowTop = getScrollInfo(scroller).top;
        if (nowTop > lastTop + 2) {
          lastTop = nowTop;
          stable = 0;
        } else {
          stable++;
          if (stable >= 8) break;
        }
      }
      return null;
    }

    async function jumpToTitle(key, labelEl) {
      stopFlag = true;
      if (focusedResultEl) focusedResultEl.classList.remove('focused');
      focusedResultEl = labelEl;
      focusedResultEl.classList.add('focused');

      const found = await ensureCardVisibleByKey(key);
      if (found) {
        focusCard(found);
        setStatus('Jump: found');
        return;
      }
      setStatus('Jump: not found on current loaded cards');
    }

    function isCardAlreadyAdded(card) {
      const input = card.querySelector('input[type="checkbox"][role="switch"]');
      if (!input) return null;
      const aria = input.getAttribute('aria-checked');
      if (aria === 'true') return true;
      if (aria === 'false') return false;
      return !!input.checked;
    }

    function detectSwitchVisualClasses() {
      const out = {
        checked: { track: '', knob: '' },
        unchecked: { track: '', knob: '' }
      };
      for (const card of getCards()) {
        const input = card.querySelector('input[type="checkbox"][role="switch"]');
        if (!input) continue;
        const checked = (input.getAttribute('aria-checked') === 'true') || !!input.checked;
        const track = input.nextElementSibling;
        const knob = track?.firstElementChild;
        if (!track || !knob) continue;

        const k = checked ? 'checked' : 'unchecked';
        if (!out[k].track) out[k].track = track.className || '';
        if (!out[k].knob) out[k].knob = knob.className || '';
        if (out.checked.track && out.checked.knob && out.unchecked.track && out.unchecked.knob) break;
      }
      return out;
    }

    function syncSwitchVisual(input, checked) {
      input.checked = checked;
      input.setAttribute('aria-checked', checked ? 'true' : 'false');

      const track = input.nextElementSibling;
      const knob = track?.firstElementChild;
      if (!track || !knob) return;

      const map = detectSwitchVisualClasses();
      const target = checked ? map.checked : map.unchecked;
      if (target.track) track.className = target.track;
      if (target.knob) knob.className = target.knob;
    }

    async function toggleChildKindleByApi(item, labelEl) {
      stopFlag = true;
      if (focusedResultEl) focusedResultEl.classList.remove('focused');
      focusedResultEl = labelEl;
      focusedResultEl.classList.add('focused');

      const state = loadState();
      state.titleToAsin = state.titleToAsin || {};
      state.asinStatus = state.asinStatus || {};
      state.asinContentType = state.asinContentType || {};

      const key = item?.key || item?.title || '';
      const db = loadDB();
      const dbHit = db.find((x) => (x?.key === key || x?.title === key) && x?.asin);
      const asin = item?.asin || state.titleToAsin[key] || dbHit?.asin;
      if (!asin) {
        setStatus('Toggle: asin unknown (not learned yet)');
        return;
      }

      const childId = state.childDirectedId;
      if (!childId) {
        setStatus('Toggle: child id unknown (toggle once on page first)');
        return;
      }

      let currentStatus = state.asinStatus[asin];
      if (!currentStatus) {
        const card = findVisibleCardByKey(key);
        const current = card ? isCardAlreadyAdded(card) : null;
        if (current == null) {
          setStatus('Toggle: current state unknown');
          return;
        }
        currentStatus = current ? 'ADDED' : 'NOT_ADDED';
      }

      const targetStatus = currentStatus === 'ADDED' ? 'NOT_ADDED' : 'ADDED';
      const csrf = getCookie('ft-panda-csrf-token') || getCookie('x-amzn-csrf') || '';
      const contentType = state.asinContentType[asin] || 'EBOOK';
      const body = {
        childToAllowlistStatusMap: { [childId]: targetStatus },
        asins: [asin],
        asinToContentTypeMap: { [asin]: contentType }
      };

      const res = await fetch('/ajax/update-add-content-status-batch', {
        method: 'POST',
        credentials: 'include',
        headers: Object.assign(
          { 'content-type': 'application/json;charset=UTF-8' },
          csrf ? { 'x-amzn-csrf': csrf } : {}
        ),
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        setStatus(`Toggle: request failed (${res.status})`);
        return;
      }

      state.asinStatus[asin] = targetStatus;
      saveState(state);
      const card = findVisibleCardByAsinOrKey(asin, key, state);
      if (card) {
        const input = card.querySelector('input[type="checkbox"][role="switch"]');
        if (input) {
          syncSwitchVisual(input, targetStatus === 'ADDED');
        }
      }
      setStatus(targetStatus === 'ADDED' ? 'Toggle: added' : 'Toggle: removed');
    }

    function render() {
      const db = loadDB();
      const tokens = searchNorm($('q').value).split(' ').filter(Boolean);
      const hits = tokens.length === 0
        ? db
        : db.filter(x => {
          const searchable = searchNorm(x.title || '');
          return tokens.every(t => searchable.includes(t));
        });

      setStatus(`DB: ${db.length} / Hit: ${hits.length} / Visible: ${getCards().length}`);

      const list = $('list');
      list.innerHTML = '';

      hits
        .slice()
        .sort((a,b) => (b.seenAt || 0) - (a.seenAt || 0))
        .slice(0, 200)
        .forEach(it => {
          const row = document.createElement('div');
          row.className = 'itemRow';

          const jumpBtn = document.createElement('button');
          jumpBtn.className = 'item itemText';
          jumpBtn.type = 'button';
          jumpBtn.textContent = it.title;
          jumpBtn.addEventListener('click', () => { jumpToTitle(it.key, jumpBtn); });
          row.appendChild(jumpBtn);

          const addBtn = document.createElement('button');
          addBtn.className = 'btn add';
          addBtn.type = 'button';
          addBtn.textContent = 'Add';
          addBtn.addEventListener('click', () => { toggleChildKindleByApi(it, jumpBtn); });
          row.appendChild(addBtn);

          list.appendChild(row);
        });
    }

    async function autoScrollIngest(mode) {
      stopFlag = false;

      const scroller = findScrollContainer();
      let lastVisible = getCards().length;
      let lastTop = getScrollInfo(scroller).top;
      let stable = 0;

      setStatus(`Auto(${mode}): scrolling... (${scroller ? 'container' : 'window'} scroll)`);
      for (let i = 0; i < 3000; i++) {
        if (stopFlag) {
          const r = ingestVisibleIntoDB();
          const dbTotal = r.total;
          setStatus(`Auto(${mode}): stopped. added=${r.added}, db=${dbTotal}`);
          render();
          return;
        }

        await scrollStep(scroller);
        // Wait longer for React render/network
        await sleep(900);

        const nowVisible = getCards().length;
        const nowTop = getScrollInfo(scroller).top;
        const moved = nowTop > lastTop + 2;
        const gainedVisible = nowVisible > lastVisible;
        const r = mode === 'safe' ? ingestVisibleIntoDB() : null;
        const added = r ? r.added : 0;
        const total = r ? r.total : loadDB().length;

        if (gainedVisible || moved || added > 0) {
          lastVisible = nowVisible;
          lastTop = nowTop;
          stable = 0;
          setStatus(`Auto(${mode}): scrolling. visible=${nowVisible}, added=${added}, db=${total}`);
        } else {
          stable++;
          setStatus(`Auto(${mode}): no change (${stable}/8). visible=${nowVisible}, db=${total}`);
          if (stable >= 8) {
            const fin = ingestVisibleIntoDB();
            const finTotal = fin.total;
            setStatus(`Auto(${mode}): done. added=${fin.added}, db=${finTotal}`);
            render();
            return;
          }
        }
      }

      const r = ingestVisibleIntoDB();
      const dbTotal = r.total;
      setStatus(`Auto(${mode}): done (limit). added=${r.added}, db=${dbTotal}`);
      render();
    }

    $('autoFast').addEventListener('click', () => autoScrollIngest('fast'));
    $('autoSafe').addEventListener('click', () => autoScrollIngest('safe'));
    $('stop').addEventListener('click', () => { stopFlag = true; setStatus('Stopping...'); });
    $('clear').addEventListener('click', () => {
      localStorage.removeItem(DB_KEY);
      setStatus('DB cleared');
      render();
    });
    $('q').addEventListener('input', render);

    render();
  }

  installApiLearning();
  mountUI();
})();
