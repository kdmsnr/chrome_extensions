function copyAllUrls() {
  chrome.storage.sync.get(['format'], function(value) {
    var format = value.format || "%text% %url%";
    chrome.tabs.query({currentWindow: true}, function(tabs) {
      let result = "";
      for (let i = 0; i < tabs.length; i++) {
        result += format.replace(/%text%/g, tabs[i].title)
                        .replace(/%url%/g, tabs[i].url)
                        .replace(/\\t/g, "\t")
                        .replace(/\\n/g, "\n");
        result += '\n';
      }
      const target = document.getElementById('target');
      target.value = result;
      target.select();

      navigator.clipboard.writeText(result).then(function() {
        console.log('Copied to clipboard successfully!');
      }).catch(function(err) {
        console.error('Could not copy text: ', err);
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', copyAllUrls);
