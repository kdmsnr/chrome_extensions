chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sortTabs") {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      // ピン留めされたタブと通常タブに分ける
      const pinnedTabs = tabs.filter(tab => tab.pinned);
      const unpinnedTabs = tabs.filter(tab => !tab.pinned);

      // 選択された基準で通常タブをソート
      if (request.criteria === "title") {
        unpinnedTabs.sort((a, b) => a.title.localeCompare(b.title));
      } else if (request.criteria === "url") {
        unpinnedTabs.sort((a, b) => a.url.localeCompare(b.url));
      } else if (request.criteria === "lastAccessed") {
        // 数値のタイムスタンプなので降順（最近アクセスされたタブが先頭）にソート
        unpinnedTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
      }

      // ソート後の順序：ピン留めタブ → ソート済み通常タブ
      const sortedTabs = pinnedTabs.concat(unpinnedTabs);

      // タブの位置を更新
      sortedTabs.forEach((tab, index) => {
        chrome.tabs.move(tab.id, { index: index });
      });
    });
    sendResponse({status: "Tabs sorted by " + request.criteria});
  }
});
