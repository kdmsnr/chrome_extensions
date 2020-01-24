function save_options() {
  localStorage["copy_all_urls_format"] =
    document.getElementById("copy_all_urls_format").value;

  document.getElementById("status").style.display = 'block';
}

function restore_options() {
  var format = localStorage["copy_all_urls_format"];
  if (!format) { format = "%text% %url%"; }
  document.getElementById("copy_all_urls_format").value = format;
}

function easy_format() {
  var format = this.format;
  if (format == "a_link") {
    format = '<a href="%url%">%text%</a>';
  } else if (format == "new_line") {
    format = '%text%\\n%url%';
  } else if (format == "excel") {
    format = '%text%\t%url%';
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
