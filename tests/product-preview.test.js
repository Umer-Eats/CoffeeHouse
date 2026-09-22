const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
for(const kind of ['study','chat','profile','matcha'])test(kind+' preview is scrollable, isolated, and does not include live account scripts',()=>{
 const page=fs.readFileSync('public/'+kind+'.html','utf8');
 assert.match(page,new RegExp('src="/previews/'+kind+'\\.html"'));
 assert.match(page,kind==='matcha'?/sandbox="allow-scripts allow-forms"/:/sandbox="allow-scripts"/);assert.doesNotMatch(page,/allow-same-origin/);
 const preview=fs.readFileSync('public/previews/'+kind+'.html','utf8');
 const scripts=[...preview.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
 assert.ok(scripts.every(s=>['/product-preview.js','/matcha-menu.js','/matcha-core.js','/matcha-mode.js'].includes(s)));
 assert.doesNotMatch(preview,/<script\s*>/);
 assert.match(preview,/name="robots" content="noindex, nofollow"/);
});
test('public sample content does not fetch API data or write user storage',()=>{
 const s=fs.readFileSync('public/product-preview.js','utf8');assert.doesNotMatch(s,/fetch\(|localStorage|\/api\//);
});
