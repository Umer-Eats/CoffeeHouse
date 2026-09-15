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
    // Use native MathML offline, without external KaTeX fonts or scripts.
    content.querySelectorAll('.katex-html').forEach(node => node.remove());
    const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(doc.title) + '</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;font:18px/1.65 system-ui,sans-serif;color:#28221c}pre{overflow:auto;background:#f5f2ed;padding:16px}table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:8px}math[display="block"]{overflow:auto;margin:1em 0}a{color:#59411f}blockquote{border-left:3px solid #b99a74;padding-left:16px}@media print{body{margin:0;max-width:none}}</style>' +
      '<body><h1>' + esc(doc.title) + '</h1><p>Source: ' + esc(doc.src || 'Study notes') + '</p>' + content.innerHTML + '<hr><small>Saved from CoffeeHouse. AI can make mistakes—check your class materials.</small></body></html>';
    const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url;
    link.download = (String(doc.title || 'Brewer notes').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0,80) || 'Brewer notes') + '.html';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
};
