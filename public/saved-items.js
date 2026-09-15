'use strict';
window.SavedItems = {
  actions(item, endpoint, refresh, downloadable = false) {
    const group = document.createElement('div');
    group.className = 'saved-actions';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    if (downloadable) {
      const download = document.createElement('button');
      download.type = 'button'; download.className = 'btn'; download.textContent = 'Download';
      download.setAttribute('aria-label', 'Download ' + item.title);
      download.addEventListener('click', () => {
        try { SavedItems.download(item); } catch { status.textContent = 'Download failed. Please try again.'; }
      });
      group.appendChild(download);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'btn'; remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Delete ' + (item.title || item.topic));
    remove.addEventListener('click', async () => {
      if (!confirm('Permanently delete “' + (item.title || item.topic) + '”? This cannot be undone.')) return;
      remove.disabled = true; status.textContent = 'Deleting…';
      try {
        await api(endpoint + '/' + encodeURIComponent(item.id), {method:'DELETE'});
        await refresh();
      } catch { status.textContent = 'Could not delete. Please try again.'; remove.disabled = false; }
    });
    group.appendChild(remove); group.appendChild(status);
    return group;
  },
  download(doc) {
    const content = document.createElement('div');
    content.innerHTML = AIFormat.render(doc.body);
    content.querySelectorAll('.katex-html').forEach(node => node.remove());
    const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(doc.title) + '</title><style>@page{margin:0.75in}body{max-width:7in;margin:0 auto;padding:0;font:12pt/1.5 Georgia,serif;color:#222}h1{font-size:18pt;margin:0 0 6pt}p.src{color:#666;font-size:10pt;margin:0 0 12pt}hr{border:none;border-top:1px solid #ccc;margin:12pt 0}pre{white-space:pre-wrap;font:10pt/1.4 monospace;background:#f7f5f0;padding:10px;border:1px solid #ddd}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:5px 8px;font-size:10pt}blockquote{border-left:3px solid #b99a74;padding-left:12px;color:#555}small{color:#888;font-size:9pt}a{color:#59411f}</style>' +
      '<body><h1>' + esc(doc.title) + '</h1><p class="src">Source: ' + esc(doc.src || 'Study notes') + ' &middot; Saved from CoffeeHouse</p>' +
      content.innerHTML + '<hr><small>AI can make mistakes \u2014 check your class materials.</small></body></html>';
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to download PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }
};
