window.addEventListener("load", main, false);

function main(e) {
  const jsInitCheckTimer = setInterval(jsLoaded, 1000);
  function jsLoaded() {
    var t = document.querySelector(".ebookBuyboxDeliverToDropdown").children[1];
    if (t != null) {
      clearInterval(jsInitCheckTimer);

      chrome.storage.sync.get(['device'], function(result) {
        var name = result.device;
        var c = t.parentNode.children;
        for (var i = 0; i < c.length; i++) {
          if (c[i].label == name) {
            c[i].selected = true;
            document.querySelector(".a-dropdown-prompt").innerText = name;
          }
        }
      });
    }
  }
}
