'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('every café page uses the shared scene and transition files', () => {
  for (const file of ['public/index.html','public/student.html','public/settings.html','public/ai-assistant.html','public/chat.html','public/study.html','public/profile.html']) {
    const html = read(file);
    assert.match(html, /href="\/motion.css"/);
    assert.match(html, /src="\/scenery.js" defer/);
  }
  for (const file of ['public/scenery.js','public/companions.js']) new vm.Script(read(file));
  assert.match(read('public/motion.css'), /--scene-fade:450ms/);
  assert.match(read('public/motion.css'), /prefers-reduced-motion:reduce/);
});

test('provider labels are absent from the AI UI', () => {
  const html = read('public/ai-assistant.html');
  assert.match(html, /id="engineStatus">Barista · Brewer</);
  assert.doesNotMatch(html, /Baristi =|Barista =|Brewer =|class="engine"/);
});

// Exercise the real inline request handlers with deferred API promises. This
// verifies waiting/success/error without making paid requests or editing users.
function harness(attachments = []) {
  class Element {
    constructor() { this.value=''; this.disabled=false; this.listeners={}; this.children=[]; this.dataset={}; this.style={}; }
    addEventListener(name,fn) { this.listeners[name]=fn; }
    appendChild(child) { this.children.push(child); }
    querySelector() { return null; }
    remove() { this.removed=true; }
    setAttribute() {}
  }
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id,new Element()); return elements.get(id); };
  const states=[]; const requests=[]; const imageState={images:attachments}; let resolve, reject;
  const document = {getElementById:element, querySelectorAll:()=>[], createElement:()=>new Element(),body:new Element()};
  let blobUploads = [];
  const context = vm.createContext({document,localStorage:{getItem:()=>null,setItem:()=>{}},Art:{initTheme(){},refreshAll(){}},
    AIImages:{create:()=>({get:()=>imageState.images,ready:()=>true,setBusy(){},clear(){imageState.images=[];}})},
    CoffeeCompanions:{setBusy:(name,busy)=>states.push([name,busy])},AIFormat:require('../public/ai-format.js'),location:{},esc:String,nowTime:()=>'',
    VercelBlob:{upload:async(file)=>{const url='https://test.blob.vercel-storage.com/uploads/'+(file.name||'file');blobUploads.push({file,url});return{url:url};},uploadBase64:async(attachment)=>{const url='https://test.blob.vercel-storage.com/uploads/'+(attachment.name||'file');blobUploads.push({attachment,url});return{url:url};}},
    api:(url,options)=>url==='/api/me'?new Promise(()=>{}):url==='/api/ai/baristi'||url==='/api/ai/brewer'
      ?new Promise((yes,no)=>{requests.push({url,options});resolve=yes;reject=no;}):Promise.resolve([])});
  const html=read('public/ai-assistant.html');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  vm.runInContext(scripts.at(-1)[1],context);
  return {element,states,requests,imageState,blobUploads,resolve:value=>resolve(value),reject:err=>reject(err)};
}
for (const kind of ['barista','brewer']) {
  for (const outcome of ['success','failure']) {
    test(`${kind} submits images without text and ${outcome==='success'?'clears':'retains'} attachments on ${outcome}`, async () => {
      const h=harness([{mimeType:'image/jpeg',data:'test-image',name:'worksheet.jpg'}]);
      const trigger=h.element(kind==='barista'?'barForm':'brewBtn');
      const run=trigger.listeners[kind==='barista'?'submit':'click']({preventDefault(){}});
      await new Promise(r=>setTimeout(r,0));
      assert.equal(h.requests.length,1);
      const body=JSON.parse(JSON.stringify(h.requests[0].options.body));
      assert.equal(body.text,'');
      assert.deepEqual(body.images,[{mimeType:'image/jpeg',url:'https://test.blob.vercel-storage.com/uploads/worksheet.jpg'}]);
      if(outcome==='success') h.resolve({reply:'Answer',doc:'Notes'}); else h.reject(new Error('Unavailable'));
      await run;
      assert.equal(h.imageState.images.length,outcome==='success'?0:1);
    });
  }
}
for (const kind of ['barista','brewer']) {
  for (const outcome of ['success','failure']) {
    test(`${kind} animation lasts through pending request and stops on ${outcome}`, async () => {
      const h=harness();
      h.element(kind==='barista'?'barInput':'brewText').value='A genuine test input';
      const trigger=h.element(kind==='barista'?'barForm':'brewBtn');
      const button=h.element(kind==='barista'?'barSend':'brewBtn');
      const run=trigger.listeners[kind==='barista'?'submit':'click']({preventDefault(){}});
      assert.equal(button.disabled,true);
      assert.deepEqual(h.states,[[kind,true]]);
      if(outcome==='success') h.resolve({reply:'Answer',doc:'Notes'}); else h.reject(new Error('Unavailable'));
      await run;
      assert.equal(button.disabled,false);
      assert.deepEqual(h.states,[[kind,true],[kind,false]]);
    });
  }
}
