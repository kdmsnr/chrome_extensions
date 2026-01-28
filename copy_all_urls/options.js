function save_options() {
  var f = document.getElementById('copy_all_urls_format').value;
  chrome.storage.sync.set({
    format: f
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restore_options() {
  chrome.storage.sync.get(['format'], function(items) {
    var format = items.format;
    if (!format) { format = "%text% %url%"; }
    document.getElementById("copy_all_urls_format").value = format;
  });
}

function easy_format(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  var format = this.format;
  if (format == "a_link") {
    format = '<a href="%url%">%text%</a>';
  } else if (format == "new_line") {
    format = '%text%\\n%url%';
  } else if (format == "excel") {
    format = '%text%\\t%url%';
  } else if (format == "markdown") {
    format = '[%text%](%url%)';
  } else {
    format = '%text% %url%';
  }

  document.getElementById("copy_all_urls_format").value = format;
  save_options();
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

document.querySelectorAll(".es").forEach(function(e) {
  e.addEventListener('click', {handleEvent: easy_format, format: e.name});
});
