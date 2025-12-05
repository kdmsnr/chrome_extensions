// options.js
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('regexList');
  const saveButton = document.getElementById('saveButton');

  // 保存済みの禁止パターンを読み込む
  chrome.storage.sync.get({ blockPatterns: [] }, (data) => {
    textarea.value = data.blockPatterns.join('\n');
  });

  // 保存ボタンがクリックされたときにパターンを保存
  saveButton.addEventListener('click', () => {
    const patterns = textarea.value.split('\n')
                      .map(line => line.trim())
                      .filter(line => line !== '');
    chrome.storage.sync.set({ blockPatterns: patterns }, () => {
      alert('Settings saved successfully!');
    });
  });
});
