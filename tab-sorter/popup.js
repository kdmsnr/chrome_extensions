document.getElementById('sortButton').addEventListener('click', function() {
  const criteria =
document.querySelector('input[name="sortCriteria"]:checked').value;
  chrome.runtime.sendMessage({ action: "sortTabs", criteria: criteria },
function(response) {
    window.close(); // 並び替え後にポップアップを閉じる
  });
});
