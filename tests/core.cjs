'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
global.window={};
const core=require('../app.js');
const lessons=[...JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../lessons.json'),'utf8')),...JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../catalog.json'),'utf8'))];
if(process.argv.includes('--fixture')){
  const s=core.newState();s.progress.L01=core.newProgress();
  s.generated=[{...lessons[0],id:'G_test',generated:true}];
  s.vocabulary=[{id:'w_test',term:'in',context:'In the morning, check in.',meaning:'在……里',lessonId:'L01',due:'2026-11-18',seen:0,streak:0}];
  s.reviews=[{key:'L01_0',lessonId:'L01',phraseIndex:0,due:'2026-11-18',seen:0,streak:0}];
  s.journals=[{id:'J_test',date:'2026-11-18',scenario:'daily',rating:3,note:'虚构测试'}];s.drafts.L01='A fictional note.';
  console.log(JSON.stringify(s));
}else if(process.argv.includes('--validate')){
  const states=JSON.parse(fs.readFileSync(0,'utf8'));
  console.log(JSON.stringify(states.map(s=>{try{core.stateValid(s);return true;}catch{return false;}})));
}else{
  let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name);};
  check('36 unique valid lessons and 23 themes',()=>{assert.equal(lessons.length,36);assert.equal(new Set(lessons.map(l=>l.id)).size,36);assert.equal(new Set(lessons.map(l=>l.theme)).size,23);lessons.forEach(l=>core.lessonValid(l));});
  check('empty state roundtrip',()=>assert.deepEqual(core.stateValid(core.newState()),core.newState()));
  check('range merge preserves gaps',()=>assert.deepEqual(core.mergeRanges([[0,1],[3,4]],.8,2),[[0,2],[3,4]]));
  check('partial listen is not full',()=>assert.equal(core.fullyHeard([[0,1],[8,10]],10),false));
  check('continuous listen counts full',()=>assert.equal(core.fullyHeard([[.1,9.9]],10),true));
  check('seek to end is not full',()=>assert.equal(core.fullyHeard([[9,10]],10),false));
  check('old completion remains valid',()=>{const s=core.newState(),p=core.newProgress();Object.assign(p,{heard:true,read:true,checked:true,answers:[0,0,0,0],completedAt:'2026-11-18T00:00:00.000Z'});s.progress.L01=p;assert.equal(core.stateValid(s).progress.L01.heard,true);});
  check('reading only completion scope',()=>{const p=core.newProgress();Object.assign(p,{mode:'reading',read:true,readingChecked:true,checked:true,answers:[null,null,0,0]});assert.equal(core.readyToFinish(p),true);p.mode='both';assert.equal(core.readyToFinish(p),false);});
  check('recall known schedules 3 days',()=>assert.equal(core.scheduleReview({streak:0,seen:0},true,'2026-11-18').due,'2026-11-21'));
  check('recall forgotten resets tomorrow',()=>{const r=core.scheduleReview({streak:5,seen:9},false,'2026-11-18');assert.equal(r.due,'2026-11-19');assert.equal(r.streak,0);});
  check('invalid date rejected',()=>assert.equal(core.validDate('2026-02-30'),false));
  check('unsafe text escaped',()=>assert.equal(core.esc('<script>'),'&lt;script&gt;'));
  console.log(`Core: ${count}/${count} checks passed`);
}
