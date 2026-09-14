'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/scenery.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(0,source.indexOf('(function () {')),context);
test('cursor coordinates follow cropped/scaled canvas',()=>{
  const point=context.sceneryPoint(400,225,{left:-100,top:25,width:1000,height:500});
  assert.equal(point.x,875.5);assert.equal(point.y,359.2);
});
test('leaves repel in either direction and ignore distant cursors',()=>{
  const region=[100,0,100,200];
  assert.ok(context.leafRepulsion({x:105,y:100},region).x>0);
  assert.ok(context.leafRepulsion({x:195,y:100},region).x<0);
  assert.equal(context.leafRepulsion({x:600,y:100},region).x,0);
  assert.equal(context.leafRepulsion(null,region).x,0);
});
test('center hover remains finite and pointer force tapers outside leaves',()=>{
  assert.ok(Number.isFinite(context.leafRepulsion({x:150,y:100},[100,0,100,200]).x));
  assert.ok(Math.abs(context.leafRepulsion({x:60,y:100},[100,0,100,200]).x)<18);
});
