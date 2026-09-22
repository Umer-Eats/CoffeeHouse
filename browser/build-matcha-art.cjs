/* Rebuild original, individually composed pixel drink illustrations. */
const fs=require('node:fs');
const {drinks}=require('../public/matcha-menu');
const rect=(x,y,w,h,c,opacity=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity="${opacity}"/>`;
for(const [index,d] of drinks.entries()){
 const large=d.name.includes('Large'),top=large?27:35,bottom=137;
 let pixels=rect(27,144,91,5,'#4a4d32',.10)+rect(38,149,70,3,'#4a4d32',.05);
 pixels+=rect(82,10,6,40,'#48583b')+rect(84,10,2,40,'#a2b88a');
 pixels+=`<path d="M34 ${top}H111V${top+10}H107V112H103V132H98V139H47V132H42V112H38V${top+10}H34Z" fill="#384937"/>`;
 pixels+=`<path d="M39 ${top+5}H106V${top+12}H102V112H98V130H94V135H51V130H47V112H43V${top+12}H39Z" fill="${d.color}"/>`;
 if(['milk','layer','boba'].includes(d.style))pixels+=`<path d="M43 ${top+32}H102V108H98V129H94V134H52V129H48V108H43Z" fill="#f3e7ce"/>`;
 if(d.style==='layer')pixels+=`<path d="M47 103H98V129H94V134H52V129H47Z" fill="${d.color}"/>`+rect(47,101,28,6,d.color)+rect(73,94,29,8,d.color);
 if(d.style==='cloud')pixels+=rect(39,top+3,67,19,'#fff9e9')+rect(44,top+21,12,5,'#fff9e9')+rect(75,top+20,18,5,'#fff9e9');
 if(d.style==='boba'){
  pixels+=`<path d="M45 48H51V112H55V129H61V91H65V119H73V135H52V130H47V112Z" fill="#96734c" opacity=".65"/>`;
  for(let i=0;i<13;i++){const x=52+((i*17+index*3)%40),y=112+((i*11)%20);pixels+=rect(x,y,5,5,'#4b3a31')+rect(x+1,y,2,1,'#b18c63');}
 }
 if(['fruit','leaf'].includes(d.style))for(let i=0;i<12;i++){
 const x=47+(i*13+index*7)%47,y=top+22+(i*17)%60;
 pixels+=rect(x,y,7,7,i%3?'#fff8d4':'#4d743e',i%3?.28:.45)+rect(x+1,y,3,2,'#fff',.35);
 }
 pixels+=rect(46,top+14,4,61,'#fff',.55)+rect(52,top+17,2,30,'#fff',.3)+rect(97,top+22,4,55,'#384937',.12);
 pixels+=rect(31,top-3,83,5,'#384937')+rect(34,top-8,77,5,'#e4e6d6')+rect(38,top-11,69,3,'#384937')+rect(33,top+2,80,4,'#f8f8e7')+rect(38,top-7,49,2,'#fff');
 pixels+=rect(59,76,30,26,'#fffcdf')+rect(62,73,24,3,'#fffcdf')+rect(65,82,16,3,'#526345')+rect(65,85,3,8,'#526345')+rect(78,85,3,8,'#526345')+rect(68,93,10,3,'#526345');
 const fruit=d.name.match(/Grape|Berry|berry|Guava|Strawberry/)?'#a37aa7':d.name.includes('Mango')?'#efb64c':d.name.includes('Peach')?'#efaf9d':d.color;
 const gx=109+(index%3)*3,gy=114-index%4*4;
 pixels+=rect(gx,gy,15,15,fruit)+rect(gx-3,gy+4,21,7,fruit)+rect(gx+2,gy+2,4,4,'#fff',.4)+rect(gx+6,gy-5,3,6,'#4e6a3d')+rect(gx+9,gy-5,6,3,'#789354');
 if(d.style==='leaf')pixels+=`<path d="M19 128H25V122H31V116H40V122H34V128H28V134H19Z" fill="#789354"/>`;
 pixels+=rect(17+(index%5),44,3,9,'#a3ae75')+rect(14+(index%5),47,9,3,'#a3ae75');
 fs.writeFileSync('public/images/matcha/'+d.id+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 160" shape-rendering="crispEdges" role="img"><title>${d.name.replace(/&/g,'&amp;')}</title>${pixels}</svg>`);
}
console.log('Created '+drinks.length+' individual drink illustrations.');
