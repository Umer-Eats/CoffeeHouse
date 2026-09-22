// Isolated manual UI fixture: no production database, accounts, or AI calls.
const express=require('express'),fs=require('fs'),path=require('path');
const app=express();
app.get('/api/me',(_,res)=>res.json({user:{id:'matcha-ui-test'},school:{name:'Preview'}}));
app.get('/',(_,res)=>{let page=fs.readFileSync(path.join(__dirname,'../public/student.html'),'utf8');page=page.replace(/<script>[\s\S]*?<\/script>/g,'');res.type('html').send(page);});
app.use(express.static(path.join(__dirname,'../public')));
app.listen(3108,'127.0.0.1',()=>console.log('Isolated Matcha UI preview: http://localhost:3108'));
