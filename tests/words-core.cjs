'use strict';
const assert=require('node:assert/strict'),E=require('../word-engine.js'),D=require('../words.js');
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
const code=(fragment='cons',extra={})=>({id:'C_'+fragment,fragment,title:'康熙',note:'拿着奏折认真考虑',kind:'fragment',rootMeaning:'',match:'any',enabled:true,imageData:'',created:'2026-11-19',updated:'2026-11-19',...extra});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XWfkAAAAASUVORK5CYII=';
check('180 unique words / 540 bilingual examples, 30 primary words per topic',()=>{
  E.catalogValid(D.words);assert.equal(D.words.length,180);assert.equal(D.words.reduce((n,w)=>n+w.examples.length,0),540);
  for(const topic of Object.keys(E.TOPICS))assert.equal(D.words.filter(w=>w.topics[0]===topic).length,30);
  assert.equal(new Set(D.words.map(w=>E.termKey(w.term))).size,180);assert.equal(new Set(D.words.map(w=>w.id)).size,180);
});
check('each word has at least two distinct collocations and reversible first example',()=>{for(const w of D.words){assert.equal(new Set(w.collocations).size,w.collocations.length);assert.ok(w.collocations.length>=2);assert.notEqual(E.mask(w.examples[0].en,w.term),w.examples[0].en);}});
check('cross-topic tags share one canonical word',()=>{const w=D.words.filter(w=>w.term==='invoice');assert.equal(w.length,1);assert.ok(w[0].topics.includes('accounting')&&w[0].topics.includes('business'));assert.equal(w[0].id,E.wordId('Invoice'));});
check('safe term normalization',()=>assert.equal(E.termKey('  Someone’s   idea '),"someone's idea"));
check('literal matching is case insensitive and respects enabled/position',()=>{
  assert.equal(E.matches('Consider',[code()]).length,1);assert.equal(E.matches('reconsider',[code()]).length,1);
  assert.equal(E.matches('reconsider',[code('cons',{match:'start'})]).length,0);assert.equal(E.matches('icons',[code('cons',{match:'end'})]).length,1);
  assert.equal(E.matches('consider',[code('cons',{enabled:false})]).length,0);
});
check('longest codes first; no automatic root inference',()=>{const result=E.matches('consider',[code('con'),code('cons')]);assert.deepEqual(result.map(c=>c.fragment),['cons','con']);assert.equal(result[0].kind,'fragment');});
check('all matched segments highlighted without changing word',()=>assert.deepEqual(E.segments('ConsCONS','cons'),[{text:'Cons',match:true},{text:'CONS',match:true}]));
check('whole word gap does not damage longer words or regex punctuation',()=>{assert.equal(E.mask('In the morning, check in.','in'),'_____ the morning, check _____.');assert.equal(E.mask('a+b is not aaab.','a+b'),'_____ is not aaab.');assert.equal(E.mask('resume and resumes','resume'),'_____ and resumes');});
check('known interval progression, again reset, hard lowers streak',()=>{
  let s=null;for(const days of [3,7,14,30,60]){s=E.schedule(s,'good','2026-11-19');assert.equal((Date.parse(s.due)-Date.parse(s.last))/86400000,days);}
  const hard=E.schedule(s,'hard','2026-11-19'),again=E.schedule(s,'again','2026-11-19');assert.equal(hard.due,'2026-11-20');assert.equal(hard.streak,4);assert.equal(again.streak,0);
});
check('using an image hint cannot count as independent good',()=>{const s=E.schedule(null,'good','2026-11-19',true);assert.equal(s.grade,'hard');assert.equal(s.due,'2026-11-20');assert.equal(s.hinted,true);});
check('scheduling handles leap days and bounds seen count',()=>{assert.equal(E.schedule(null,'again','2028-02-28').due,'2028-02-29');assert.equal(E.schedule({seen:100000,streak:5},'good','2026-11-19').seen,100000);});
check('en and zh records stay independent',()=>{const en=E.schedule(null,'good','2026-11-19'),zh=E.schedule(null,'again','2026-11-19');const s=E.collectionsValid({wordStudy:{V_consider:{en,zh}}});assert.equal(s.wordStudy.V_consider.en.due,'2026-11-22');assert.equal(s.wordStudy.V_consider.zh.due,'2026-11-20');});
check('queue limits and due priority',()=>{
  const rows=Array.from({length:35},(_,i)=>({id:'V_'+i}));assert.equal(E.queue(rows,{},'mix','2026-11-19').length,10);
  const records=Object.fromEntries(rows.map(w=>[w.id,{seen:1,due:'2026-11-18'}]));assert.equal(E.queue(rows,records,'due','2026-11-19').length,20);
  const mixed=E.queue(rows,{V_22:{seen:1,due:'2026-11-18'},V_21:{seen:1,due:'2026-11-17'}},'mix','2026-11-19');assert.deepEqual(mixed.slice(0,2).map(w=>w.id),['V_21','V_22']);assert.equal(mixed.length,12);
});
check('future records excluded from normal queue, allowed for early practice',()=>{const rows=[{id:'V_a'}],records={V_a:{seen:1,due:'2026-11-22'}};assert.equal(E.queue(rows,records,'mix','2026-11-19').length,0);assert.equal(E.queue(rows,records,'all','2026-11-19').length,1);});
check('early practice also limits fresh words and fills remaining slots with future words',()=>{
  const rows=Array.from({length:35},(_,i)=>({id:'V_'+i}));assert.equal(E.queue(rows,{},'all','2026-11-19').length,10);
  const records=Object.fromEntries(rows.slice(20).map(w=>[w.id,{seen:1,due:'2026-11-22'}]));
  const batch=E.queue(rows,records,'all','2026-11-19');assert.equal(batch.length,20);assert.equal(batch.filter(w=>!records[w.id]).length,10);
  assert.deepEqual(batch.slice(0,10).map(w=>w.id),rows.slice(0,10).map(w=>w.id));
});
check('legacy records accept absent new collections',()=>assert.deepEqual(E.collectionsValid({}),{wordStudy:{},wordCodes:[]}));
check('dates reject overflow, missing year zero and non ISO',()=>{for(const d of ['0000-01-01','2026-02-30','20261119','2026-11-19T00:00:00Z',null])assert.equal(E.date(d),false);assert.equal(E.date('2026-11-19'),true);});
check('valid image types and signatures only',()=>{assert.ok(E.imageValid(png));assert.ok(E.imageValid(''));for(const x of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,ZmFrZQ==',png.replace('png','jpeg'),png+'%'])assert.equal(E.imageValid(x),false);});
check('duplicate codes / reserved identifiers / invalid fragment refused',()=>{
  for(const wordCodes of [[code(),code('cons',{id:'C_second'})],[code('cons',{id:'__proto__'})],[code('cons',{id:undefined})],[code('cons',{fragment:'co-ns'})],[code('cons',{fragment:'COns'})],[code('cons',{imageData:'data:image/svg+xml;base64,PHN2Zz4='})]])assert.throws(()=>E.collectionsValid({wordCodes}));
  assert.equal(E.collectionsValid({wordCodes:[code(),code('cons',{id:'C_prefix',match:'start'})]}).wordCodes.length,2);
});
check('collection and image aggregate quotas enforced',()=>{
  assert.throws(()=>E.collectionsValid({wordCodes:Array.from({length:501},(_,i)=>code('cons',{id:'C_'+i}))}));
  assert.throws(()=>E.collectionsValid({wordStudy:Object.fromEntries(Array.from({length:6001},(_,i)=>['V_'+i,{en:E.schedule(null,'good','2026-11-19')}]))}));
  const large=png.slice(0,png.indexOf(',')+1)+Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.alloc(11000)]).toString('base64');assert.ok(E.imageValid(large));
  const codes=Array.from({length:60},(_,i)=>code('c'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),{imageData:large}));assert.throws(()=>E.collectionsValid({wordCodes:codes}));
});
check('malformed schedules and incomplete examples rejected',()=>{assert.throws(()=>E.collectionsValid({wordStudy:{V_test:{en:{due:'2026-11-20'}}}}));const broken=structuredClone(D.words);broken[0].examples.pop();assert.throws(()=>E.catalogValid(broken));});
console.log(`Words core: ${count}/${count} checks passed`);
