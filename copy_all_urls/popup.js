function copyAllUrls() {
  chrome.storage.sync.get(['format'], function(value) {
    var format = value.format;
    chrome.windows.getCurrent(function(win) {
      chrome.tabs.getAllInWindow(win.id, function(tabs) {
        var result = "";
        for (i = 0; i < tabs.length; i++) {
          result += format.replace(/%text%/g, tabs[i].title).
                           replace(/%url%/g, tabs[i].url).
                           replace(/\\t/g, "\t").
                           replace(/\\n/g, "\n");
          result += '\n';
        }
        var target = document.getElementById('target');
        target.value = result;
        target.select();
        document.execCommand("copy", false, null);
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', copyAllUrls);
