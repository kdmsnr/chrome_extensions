let featureEnabled = true; // 初期状態はオン

// アイコンをクリックしたときの動作
chrome.action.onClicked.addListener(() => {
  featureEnabled = !featureEnabled; // 機能をオン/オフ切り替え

  // 現在のタブにメッセージを送信して機能の状態を通知
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "toggleFeature", featureEnabled });
    }
  });

  // 状態をストレージに保存
  chrome.storage.sync.set({ featureEnabled });
});

// 初期化時に状態を復元
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['featureEnabled'], (result) => {
    featureEnabled = result.featureEnabled ?? true; // ストレージが空ならデフォルトでオン
  });
});
