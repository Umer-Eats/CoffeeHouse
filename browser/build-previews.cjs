/* Build public, sandboxed previews from the actual product page markup. */
'use strict';
const fs=require('node:fs');
fs.mkdirSync('public/previews',{recursive:true});
for(const [kind,source] of Object.entries({study:'ai-assistant',chat:'student',profile:'settings',matcha:'student'})){
 let html=fs.readFileSync(`public/${source}.html`,'utf8');
 // Never ship live auth, AI, chat, account, analytics, or persistence scripts.
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 html=html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,'<div class="preview-radio"><strong>♫ A little background music</strong><span>Your study playlist lives here.</span></div>');
 html=html.replace(/<body([^>]*)>/,`<body$1 data-preview="${kind}"${kind==='matcha'?' data-matcha-preview="true"':''}><div class="preview-label">${kind==='matcha'?'Matcha Mode demo · no progress is saved':'Sample account · scroll to explore'}</div>`);
 html=html.replace('</head>','<link rel="stylesheet" href="/product-preview.css?v=1">\n</head>');
 if(kind==='matcha')html=html.replace(/<body[\s\S]*?<\/body>/,'<body data-preview="matcha" data-matcha-preview="true"><div class="preview-label">Matcha Mode demo · no progress is saved</div><main style="padding:40px;text-align:center"><h1>Your next quiet moment</h1><p>Pick a drink and try the receipt ritual.</p><button id="matchaModeButton" class="btn" type="button">Open Matcha Mode demo</button></main></body>');
 const scripts=kind==='matcha'?'<script src="/matcha-menu.js?v=1"></script><script src="/matcha-core.js?v=2"></script><script src="/matcha-mode.js?v=2"></script>':'';
 html=html.replace('</body>',`<script src="/product-preview.js?v=1"></script>${scripts}</body>`);
 fs.writeFileSync(`public/previews/${kind}.html`,html);
}
console.log('Built four isolated product previews.');
