let observer; // MutationObserverの参照を保持
let featureEnabled = true; // 初期状態はオン

// 視聴済み番組を表示/非表示にする処理
function toggleWatchedPrograms() {
  const elements = document.querySelectorAll("[class^='mypage-content-item_container']");
  elements.forEach(element => {
    const progressBar = element.querySelector("[class^='ProgressBar_progress']");
    if (progressBar && progressBar.style.width === '100%') {
      element.style.display = featureEnabled ? 'none' : ''; // Onなら非表示、Offなら表示
    }
  });
}

// MutationObserverの初期化
function initObserver() {
  if (observer) return; // すでに開始していれば何もしない

  const observerCallback = (mutationsList) => {
    mutationsList.forEach(() => toggleWatchedPrograms());
  };

  observer = new MutationObserver(observerCallback);
  observer.observe(document.body, { childList: true, subtree: true });
}

// MutationObserverを停止
function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Background Scriptからのメッセージを受け取る
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "toggleFeature") {
    featureEnabled = message.featureEnabled; // 機能の状態を更新
    if (featureEnabled) {
      initObserver(); // 機能をオン
      toggleWatchedPrograms(); // 現在の状態に応じて表示を更新
    } else {
      stopObserver(); // 機能をオフ
      toggleWatchedPrograms(); // すべての要素を表示
    }
  }
});

// 初期化時にストレージの状態を確認して機能を有効化
chrome.storage.sync.get(['featureEnabled'], (result) => {
  featureEnabled = result.featureEnabled ?? true; // デフォルトで有効
  if (featureEnabled) {
    initObserver(); // デフォルトで監視を開始
    toggleWatchedPrograms(); // 初期状態を反映
  }
});
