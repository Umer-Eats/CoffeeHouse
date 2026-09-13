/* CoffeeHouse shared frontend helpers. */
'use strict';

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || (res.status + ' ' + res.statusText));
    err.status = res.status;
    throw err;
  }
  return data;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function initials(name) {
  return String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function nowTime() {
  const d = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return nowTime();
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

const AVATAR_COLORS = ['#7a4a2b', '#4a7a9b', '#8f4a9b', '#3f9b6a', '#c05c5c', '#5c7ac0', '#b58f3a', '#4a9b8f', '#9b6a4a', '#6a4a9b'];

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarHTML(u, cls) {
  const color = colorFor(u && u.name);
  const style = u && u.picture
    ? `background:${color};`
    : `background:${color};`;
  const inner = u && u.picture
    ? `<img src="${esc(u.picture)}" alt="">`
    : esc(initials(u && u.name));
  return `<span class="avatar ${cls || ''}" style="${style}">${inner}</span>`;
}