// ==UserScript==
// @name         Just Watch リストから削除
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  aria-labelが一致なら親を非表示（遅延を減らす）
// @author       You
// @match        https://www.justwatch.com/jp/%E3%83%86%E3%83%AC%E3%83%93%E7%95%AA%E7%B5%84*
// @match        https://www.justwatch.com/jp/%E6%98%A0%E7%94%BB*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const selector =
    '.title-poster-quick-actions-content__bubbles[aria-label="リストから削除"],' +
    '.title-poster-quick-actions-content__bubbles[aria-label="Mark as unseen"],' +
    '.title-poster-quick-actions-content__bubbles[aria-label="「嫌い」から削除する"]';

  function hideParents(root = document) {
    const bubbles = root.querySelectorAll ? root.querySelectorAll(selector) : [];
    bubbles.forEach((bubble) => {
      const parent = bubble.closest('.title-list-grid__item');
      if (parent) parent.style.display = 'none';
    });
  }

  // 初回（DOMや属性が遅れて反映されるケースを考慮して複数タイミングで実行）
  hideParents();

  // 連続発火を1フレームにまとめる（全体スキャン連打による遅延を減らす）
  let scheduled = false;
  const pending = new Set();

  function scheduleHide(target) {
    pending.add(target);
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      // 追加された断片だけ優先的に処理
      for (const t of pending) hideParents(t);
      pending.clear();
      // 念のため全体も一回だけスキャン（aria-labelが後から付くケース対策）
      hideParents();
    });
  }

  // 動的な追加や属性更新に対応
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scheduleHide(n);
        });
      }
      if (m.type === 'attributes' && m.target.nodeType === 1) {
        scheduleHide(m.target);
      }
    }
  });

  // bodyがまだ無いタイミングでも動かす
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label'],
  });

  // 初回ロード時の取りこぼし対策
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleHide(document), {
      once: true,
    });
  } else {
    scheduleHide(document);
  }
  window.addEventListener('load', () => scheduleHide(document), { once: true });
})();
