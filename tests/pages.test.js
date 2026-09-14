'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const file of ['index.html', 'student.html', 'settings.html', 'ai-assistant.html']) {
  test(file + ' matches its public copy and has valid scripts', () => {
    const html = read(file);
    assert.equal(html, read('public/' + file));
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      new vm.Script(match[1], { filename: file });
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate element IDs');
  });
}
for (const name of ['chat', 'study', 'profile']) {
  test(name + ' is a public explanation page with working entry points', () => {
    const html = read('public/' + name + '.html');
    assert.match(html, new RegExp('href="/' + name + '\\.html" aria-current="page"'));
    assert.match(html, /data-login/);
    assert.match(html, /id="accountDialog"/);
    assert.match(html, /\/home.js/);
    for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) {
      const target = match[1].slice(1);
      if (target === 'app.js') continue; // Explicit server route serves client.js.
      assert.ok(fs.existsSync(path.join(root, 'public', target)) || fs.existsSync(path.join(root, target)), target);
    }
  });
}
test('fake course and group data is not served', () => {
  const server = read('server.js');
  assert.doesNotMatch(server, /GROUP_TEMPLATES|BIO-301|Mitosis Masterminds|Team Sigma/);
  assert.match(server, /res.json\(\[\]\)/);
  assert.match(read('db.js'), /COFFEEHOUSE_SCHOOLS/);
});
test('shared browser scripts parse', () => {
  for (const file of ['public/home.js', 'client.js', 'art.js']) new vm.Script(read(file));
});
