// background.js
// 拡張アイコンをクリックすると、blockEnabledの状態をトグルします。
chrome.action.onClicked.addListener(() => {
  chrome.storage.sync.get({ blockEnabled: true }, (data) => {
    const newState = !data.blockEnabled;
    chrome.storage.sync.set({ blockEnabled: newState }, () => {
      chrome.action.setIcon({
        path: newState ? "icon.png" : "icon_disabled.png"
      });
    });
  });
});
