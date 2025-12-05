// content.js
// ページ読み込み時に、現在のURLがユーザー設定のパターンに一致するかチェックし、一致すればオーバーレイを表示します。
chrome.storage.sync.get({ blockEnabled: true, blockPatterns: [] }, (data) => {
  if (!data.blockEnabled) return;
  const url = window.location.href;
  for (const pattern of data.blockPatterns) {
    try {
      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        showBlockOverlay();
        break;
      }
    } catch (e) {
      console.error("Invalid regex pattern:", pattern, e);
    }
  }
});

function showBlockOverlay() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "2147483647"; // 最前面に表示するための最大値
  overlay.style.backgroundColor = "white";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  // block.html の内容を表示するための iframe を生成
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("block.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  overlay.appendChild(iframe);
  document.documentElement.appendChild(overlay);
}
