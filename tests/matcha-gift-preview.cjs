// Local UI fixture only; never connects to production accounts or data.
const express=require('express'),fs=require('fs'),path=require('path');
const app=express();app.use(express.json());
app.get('/api/me',(_,r)=>r.json({user:{id:'gift-ui-test',name:'Alex'},school:{name:'Preview'}}));
app.get('/api/matcha/rewards',(_,r)=>r.json([]));
let startedAt=null;
const sample=()=>({id:'sample',drink_id:'m5-0',instructions:'Extra sago from Jamie',minutes:25,started_at:startedAt,completed:0});
app.get('/api/matcha/gifts/sample',(_,r)=>r.json(sample()));
app.post('/api/matcha/gifts/sample/start',(_,r)=>{startedAt=Date.now();r.json(sample());});
app.post('/api/matcha/gifts/sample/cancel',(_,r)=>{startedAt=null;r.json({ok:true});});
app.get('/api/students',(_,r)=>r.json([{id:2,name:'Jamie Lee'},{id:3,name:'Taylor Chen'}]));
app.post('/api/matcha/gifts',(q,r)=>r.json({id:'preview-gift'}));
app.get('/',(_,r)=>{let page=fs.readFileSync(path.join(__dirname,'../public/student.html'),'utf8').replace(/<script>[\s\S]*?<\/script>/g,'');page=page.replace('</body>','<button onclick="window.openMatchaGift(&quot;sample&quot;)">Open sample drink gift</button></body>');r.type('html').send(page);});
app.use(express.static(path.join(__dirname,'../public')));app.listen(3109,'127.0.0.1',()=>console.log('Gift UI fixture on 3109'));
