'use strict';
/* Destructive QA only: use a temporary account database and a separate Chrome profile. */
const {CDP,wait}=require('./cdp.cjs');
const E=require('../word-engine.js'),D=require('../words.js');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),equal=require('node:util').isDeepStrictEqual;
if(process.env.UNFOLD_QA_ISOLATED!=='1')throw Error('Confirm isolated server/profile with UNFOLD_QA_ISOLATED=1 first');
const ORIGIN=process.env.UNFOLD_QA_ORIGIN||'http://127.0.0.1:8792';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(ORIGIN)||ORIGIN==='http://127.0.0.1:8791')throw Error('Never run against the user service');
const OUT=path.join(process.env.TEMP||os.tmpdir(),'unfold-words-audit-20261119');fs.mkdirSync(OUT,{recursive:true});
const GUEST='unfold.workspace.v1',checks=[],layouts=[],screens=[];let c,serial=Date.now(),key=GUEST,today='';
const term='consider',id='V_consider',word=D.words.find(w=>w.id===id);
function check(name,pass,detail){checks.push({name,pass:!!pass,detail:pass?undefined:detail});console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(detail)));}
async function reload(hash='words'){await c.navigate(`${ORIGIN}/?wordqa=${++serial}#${hash}`);await c.until('!!document.querySelector(".nav-button")',11000);}
async function route(hash){await c.eval(`location.hash=${JSON.stringify('#'+hash)}`);await wait(140);}
async function fresh(hash='words'){await c.call('Network.clearBrowserCookies');await reload('settings');await c.eval('localStorage.clear()');key=GUEST;await reload(hash);}
async function value(selector,v,event='input'){await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');e.value=${JSON.stringify(v)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);await wait(100);}
async function view(v){await c.click(`[data-action="wc-view"][data-view="${v}"]`);}
async function state(){return c.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);}
async function seed(s,hash='words'){await c.eval(`localStorage.setItem(${JSON.stringify(key)},JSON.stringify(${JSON.stringify(s)}))`);await reload(hash);}
async function empty(){return c.eval('UnfoldCore.newState()');}
async function end(){if(await c.eval('!!document.querySelector("[data-action=wc-view][data-view=study]")'))await view('study');if(await c.eval('!!document.querySelector("[data-action=wc-end]")'))await c.click('[data-action=wc-end]');}
async function detail(t=term){await view('library');await value('#wc-search',t);await c.click(`[data-action="wc-view-word"][data-id="${E.wordId(t)}"]`);}
async function practice(t=term){await end();await detail(t);await c.click('[data-action=wc-practice-one]');await c.until('!!document.querySelector(".wc-session")');}
async function selectText(selector,text){
  await c.eval(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const p=n.textContent.indexOf(${JSON.stringify(text)});if(p>=0){const r=document.createRange();r.setStart(n,p);r.setEnd(n,p+${text.length});getSelection().removeAllRanges();getSelection().addRange(r);el.scrollIntoView({block:'center'});return;}}throw Error('QA selected text missing')})()`);
  await c.until('!!document.querySelector(".sel-toolbar")');
}
async function editor(fragment='cons',title='康熙',note='虚构联想：康熙拿着奏折，认真考虑。'){
  await c.click('[data-action=wc-code-new]');await value('#wc-code-fragment',fragment);await value('#wc-code-title',title);await value('#wc-code-note',note);
}
async function saveEditor(){await c.click('#wc-code-submit');await wait(150);}
async function close(){if(await c.eval('document.querySelector("#modal").open'))await c.key('Escape','Escape',27);}
async function image(kind='png',name='image.png'){
  await c.eval(`(()=>{const kind=${JSON.stringify(kind)},dt=new DataTransfer();let bytes,type='image/png';
    if(kind==='svg'){bytes='<svg xmlns="http://www.w3.org/2000/svg"></svg>';type='image/svg+xml';}
    else if(kind==='large')bytes=new Uint8Array(8*1024*1024+1);
    else if(kind==='corrupt')bytes='not a valid image';
    else if(kind==='huge'){bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);const v=new DataView(bytes.buffer);v.setUint32(16,9000);v.setUint32(20,20);}
    else{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle=kind==='blue'?'#3355dd':'#cc4422';ctx.fillRect(0,0,160,100);ctx.fillStyle='#ffffff';ctx.font='28px sans-serif';ctx.fillText('cons',20,60);const raw=atob(canvas.toDataURL('image/png').split(',')[1]);bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));}
    dt.items.add(new File([bytes],${JSON.stringify(name)},{type}));const e=document.querySelector('#wc-code-image');e.closest('details').open=true;e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function holdImages(){await c.eval(`window.qaReadFile=File.prototype.arrayBuffer;window.qaHeld=[];File.prototype.arrayBuffer=function(){return this.name.startsWith('delay')?new Promise(r=>window.qaHeld.push(()=>window.qaReadFile.call(this).then(r))):window.qaReadFile.call(this)};`);}
async function releaseImages(){await c.eval('window.qaHeld.splice(0).forEach(f=>f());File.prototype.arrayBuffer=window.qaReadFile');await wait(500);}
async function addWord(t,meaning='',context='An original fictional context.'){
  await route('review');await c.click('[data-action=review-tab][data-tab=words]');await c.click('[data-action=add-word]');
  await value('#word-term',t);await value('#word-meaning',meaning);await value('#word-context',context);await c.click('#word-form [type=submit]');await wait(150);
}
async function login(username,register=false){
  await route('settings');await c.click(`[data-action="account-${register?'register':'login'}"]`);
  await value('#account-name',username);await value('#account-password','fictional-words-qa-password');await c.click('#account-form [type=submit]');
  await c.until('!document.querySelector("#modal").open&&!!document.querySelector("[data-action=account-logout]")');
  const info=await c.eval('fetch("/api/account/status").then(r=>r.json()).then(d=>({id:d.user.id,cloud:d.cloud}))');key=GUEST+'.account.'+info.id;
  await c.click('[data-action=sync-now]');await c.until('document.querySelector("#sync-status").textContent.includes("已保存")');return info;
}
async function logout(){await route('settings');await c.until('!document.querySelector("#sync-status").textContent.includes("正在同步")');await c.click('[data-action=account-logout]');await c.until('!!document.querySelector("[data-action=account-login]")&&!document.querySelector("[data-action=account-logout]")');key=GUEST;}
async function importState(s){await c.eval(`(()=>{const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(${JSON.stringify(s)})],'qa-backup.json',{type:'application/json'}));const e=document.querySelector('#backup-file');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await c.until('document.querySelector("#modal").open&&!!document.querySelector("[data-action=restore-confirm]")');}
async function editorGeometry(){
  return c.eval(`(()=>{const e=document.querySelector('#modal'),r=e.getBoundingClientRect(),button=document.querySelector('#wc-code-submit'),s=button.getBoundingClientRect(),targets=[...document.querySelectorAll('#wc-code-form button,#wc-code-form input:not([type=checkbox]),#wc-code-form textarea,#wc-code-form select,#wc-code-form summary,#wc-code-form .self-check')].filter(t=>t.getClientRects().length).map(t=>({id:t.id||t.dataset.action||t.tagName,height:t.getBoundingClientRect().height,font:parseFloat(getComputedStyle(t).fontSize),input:t.matches('input,textarea,select')}));return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,client:e.clientWidth,scroll:e.scrollWidth,submit:{top:s.top,bottom:s.bottom,height:s.height,hit:document.elementFromPoint(s.x+s.width/2,s.y+s.height/2)?.closest('#wc-code-submit')===button},targets}})()`);
}
async function shot(file){const full=path.join(OUT,file);await c.capture(full);screens.push(full);}
(async()=>{
  c=await CDP.connect(Number(process.env.UNFOLD_QA_CDP||9252));await c.call('Network.enable');await c.size(1440,900);await fresh();today=await c.eval('UnfoldCore.day()');
  check('English-to-Chinese is the default; six primary topics available',await c.eval('document.querySelector("#wc-direction").value==="en"&&document.querySelector("#wc-topic").options.length===8'));
  check('six usable main navigation targets',await c.eval('document.querySelectorAll(".nav-button").length===6'));
  await route('lesson/L01/0');await c.click('[data-action=play]');await c.until('UnfoldPlayback?.currentTime>.2');const position=await c.eval('UnfoldPlayback.currentTime');await route('words');await wait(350);
  check('entering silent words pauses and preserves audio position',await c.eval(`UnfoldPlayback.paused&&UnfoldPlayback.currentTime>=${position}&&UnfoldPlayback.currentTime<${position}+1&&!document.querySelector("#continued-player").getClientRects().length`));
  await route('library');await c.click('[data-action=continued-toggle]');await c.until('!UnfoldPlayback.paused');check('intentional resume elsewhere still works',await c.eval('!UnfoldPlayback.paused'));
  await route('lesson/L01/0');await c.click('[data-action=transcript]');await selectText('.turn-text','Hey');await c.click('[data-sel=code]');
  check('listening selection has a functioning encoding editor',await c.eval('document.querySelector("#wc-code-fragment").value==="hey"&&document.querySelector("#wc-code-preview").textContent==="Hey"'));await close();
  await route('lesson/L01/1');await selectText('.reading-text','Th');await c.click('[data-sel=code]');
  check('reading substring selection pre-fills fragment and retains whole word preview',await c.eval('document.querySelector("#wc-code-fragment").value==="th"&&document.querySelector("#wc-code-preview").textContent==="The"'));await close();await route('words');
  await c.click('[data-action=wc-start]');check('first normal batch contains ten fresh words',await c.eval('document.querySelector(".wc-session-header p").textContent.includes("/ 10")'));
  await c.click('[data-action=wc-skip]');check('skip advances without scheduling or counting the skipped word',await c.eval('document.querySelector(".wc-session").dataset.wordId!=="V_consider"')&&!((await state()).wordStudy[id]));await practice();
  check('single-word practice is not mislabeled as my saved vocabulary',await c.eval('document.querySelector(".wc-session-footer").textContent.includes("单词自练")'));
  await selectText('.wc-term','cons');check('word workspace selection toolbar omits speech actions',await c.eval('!!document.querySelector("[data-sel=code]")&&!document.querySelector("[data-sel=speak]")'));await c.click('[data-sel=code]');
  check('partial word selection creates the requested cons spelling code',await c.eval('document.querySelector("#wc-code-fragment").value==="cons"&&document.querySelector("#wc-code-preview").textContent==="consider"'));await close();
  check('no answer or examples before flipping',await c.eval(`!document.querySelector('#wc-answer')&&!document.querySelector('.wc-examples')&&!document.querySelector('.wc-recall-face').textContent.includes(${JSON.stringify(word.meaning)})`));
  check('starting and revealing do not count as learned',!((await state()).wordStudy[id]));
  await value('#wc-draft','qa-ephemeral-thought');check('practice draft is not saved in account state',!JSON.stringify(await state()).includes('qa-ephemeral-thought'));await c.eval('document.querySelector("#wc-draft").focus()');await c.key(' ','Space',32);check('Space in the optional input does not flip the card',await c.eval('!document.querySelector("#wc-answer")'));
  await c.eval('document.querySelector("#main").focus()');await c.key(' ','Space',32);await c.until('!!document.querySelector("#wc-answer")');
  check('Space flips from non-input focus; three bilingual examples and collocations appear',await c.eval('document.querySelectorAll(".wc-examples li").length===3&&document.querySelectorAll(".wc-collocations li").length>=2'));
  await c.click('[data-action=wc-save-word]');check('a saved built-in example is not repeated as a second original sentence',await c.eval('!document.querySelector(".wc-original")'));await c.eval('document.querySelector("#main").focus()');await c.key('3','Digit3',51);await c.until(`JSON.parse(localStorage.getItem('${GUEST}')).wordStudy.${id}?.en?.seen===1`);
  const english=(await state()).wordStudy[id].en;
  check('English schedule saved independently of Chinese',english.due===E.schedule(null,'good',today).due&&!(await state()).wordStudy[id].zh);
  check('collection uses canonical ID and retains first example',((await state()).vocabulary.filter(w=>w.id===id)).length===1&&(await state()).vocabulary.find(w=>w.id===id).context===word.examples[0].en);
  await end();await value('#wc-mode','due','change');await c.click('[data-action=wc-start]');check('empty due-only mode does not pretend to start a batch',await c.eval('!document.querySelector(".wc-session")&&document.querySelector("#toast").textContent.includes("没有到期词")'));await value('#wc-mode','mix','change');
  await view('library');await value('#wc-search','');check('library is paginated rather than one giant list',await c.eval('document.querySelectorAll(".wc-library-row").length===24&&document.querySelector(".result-count").textContent.includes("180")'));
  const first=await c.eval('document.querySelector(".wc-library-row h2").textContent');await c.click('[data-action=wc-library-next]');check('next page changes content',await c.eval(`document.querySelector('.wc-library-row h2').textContent!==${JSON.stringify(first)}`));
  for(const topic of Object.keys(E.TOPICS)){
    await value('#wc-library-topic',topic,'change');const names=await c.eval('[...document.querySelectorAll(".wc-library-row h2")].map(e=>e.textContent)');
    check('topic filter '+topic,names.length>0&&names.every(t=>D.words.find(w=>w.term===t)?.topics.includes(topic)),names);
  }
  await value('#wc-library-topic','all','change');await value('#wc-search','发票');check('Chinese search finds invoice',await c.eval('document.querySelector(".wc-library-row h2").textContent==="invoice"'));
  await view('library');await value('#wc-search','');
  const focusProbe=await c.eval(`(async()=>{const i=document.querySelector('#wc-search');i.focus();i.dataset.qaNode='keep';const out=[];for(const v of ['c','co','con','cons','consi']){i.value=v;i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:v}));i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:v}));await new Promise(r=>requestAnimationFrame(r));out.push({v,focus:document.activeElement===i,same:i.dataset.qaNode==='keep',rows:document.querySelectorAll('.wc-library-row').length});}return out})()`);
  check('search keeps focus and the same input node through IME composition',focusProbe.every(x=>x.focus&&x.same)&&focusProbe.at(-1).rows>0,focusProbe);
  check('search results update without a full page rebuild',await c.eval('!!document.querySelector("#wc-search")&&document.querySelector("#wc-library-live .result-count").textContent.includes("个词")'));
  await value('#wc-search','');
  await detail();await c.click('[data-action=wc-ai]');check('word AI action has real configuration or consent flow, not a fake answer',await c.eval('document.querySelector("#modal").open&&(!!document.querySelector("[data-action=go-settings]")||!!document.querySelector("#privacy-ok"))'));await close();
  await detail();await c.click('[data-action=wc-code-new]');await value('#wc-code-fragment','cons');await value('#wc-code-title','康熙');await value('#wc-code-note','虚构联想：康熙拿着奏折，认真考虑。');
  check('cons defaults to personal fragment and shows literal spelling preview',await c.eval('document.querySelector("#wc-code-kind").value==="fragment"&&document.querySelector("#wc-code-preview mark").textContent==="cons"'));
  await image('svg','bad.svg');check('SVG refused without losing text',await c.eval('!document.querySelector("#wc-code-error").hidden&&document.querySelector("#wc-code-title").value==="康熙"&&!document.querySelector("#wc-code-submit").disabled'));
  await image();await c.until('document.querySelector("#wc-code-image-status").textContent.includes("已准备")');const thumbnail=await c.eval('document.querySelector("#wc-code-image-preview img").getAttribute("src")');
  check('real browser decode produces a bounded safe thumbnail',E.imageValid(thumbnail)&&thumbnail.length<=E.MAX_IMAGE);
  for(const kind of ['large','corrupt','huge']){await image(kind,kind+'.png');await c.until('!document.querySelector("#wc-code-error").hidden&&!document.querySelector("#wc-code-submit").disabled');check('bad image '+kind+' preserves previous thumbnail',await c.eval(`document.querySelector('#wc-code-image-preview img').getAttribute('src')===${JSON.stringify(thumbnail)}`));}
  await saveEditor();await c.until('!document.querySelector("#modal").open');check('encoding and thumbnail persisted together',(await state()).wordCodes[0].imageData===thumbnail&&(await state()).wordCodes[0].fragment==='cons');
  await view('codes');await c.until('document.querySelector(".wc-code-card img").complete');check('thumbnail renders successfully',await c.eval('document.querySelector(".wc-code-card img").naturalWidth>0'));
  await c.click('[data-action=wc-code-matches]');check('saved code matches newly encountered words',await c.eval('document.querySelector(".wc-match-words").textContent.includes("consider")&&document.querySelector(".wc-match-words").textContent.includes("consistent")'));await close();
  await editor();await saveEditor();check('duplicate encoding rejected with input retained',await c.eval('document.querySelector("#modal").open&&!document.querySelector("#wc-code-error").hidden&&document.querySelector("#wc-code-title").value==="康熙"')&&(await state()).wordCodes.length===1);await close();
  await c.click('[data-action=wc-code-toggle]');await practice();check('disabled encoding does not offer a hint',await c.eval('!document.querySelector("[data-action=wc-hint]")'));await end();await view('codes');await c.click('[data-action=wc-code-toggle]');
  await view('study');await value('#wc-direction','zh','change');await practice();
  check('Chinese-to-English prompt masks target and hides English answer',await c.eval(`!document.querySelector('#wc-answer')&&!document.querySelector('.wc-recall-face').textContent.toLowerCase().includes('consider')&&document.querySelector('.wc-gap-sentence').textContent.includes('_____')`));
  check('image hint is opt-in, not automatically exposed',await c.eval('!!document.querySelector("[data-action=wc-hint]")&&!document.querySelector("#wc-session-hints")'));
  await c.click('[data-action=wc-hint]');check('hint displays personal cons to 康熙 mapping',await c.eval('document.querySelector("#wc-session-hints").textContent.includes("康熙")'));await c.click('[data-action=wc-hint]');await c.click('[data-action=wc-reveal]');await c.click('[data-action=wc-grade][data-grade=good]');
  const hinted=(await state()).wordStudy[id];check('closing hint does not erase its use; good is downgraded to hard',hinted.zh.grade==='hard'&&hinted.zh.hinted&&hinted.zh.due===E.schedule(null,'hard',today,true).due&&JSON.stringify(hinted.en)===JSON.stringify(english));
  await route('review');await c.click('[data-action=review-tab][data-tab=words]');await c.click(`[data-action="review-now"][data-key="word:${id}"]`);await c.click('[data-action=reveal-review]');await c.click('[data-action=review-known]');
  check('legacy vocabulary review updates only Chinese direction',(await state()).wordStudy[id].zh.seen===2&&(await state()).wordStudy[id].en.seen===1);
  await c.click('[data-action=review-tab][data-tab=words]');await c.click(`[data-action="delete-word"][data-id="${id}"]`);await c.click('[data-action=delete-word-confirm]');await route('words');await detail();await c.click('[data-action=wc-save-word]');await close();
  check('recollecting a learned word inherits its Chinese schedule',(await state()).vocabulary.find(w=>w.id===id).seen===2);
  await addWord('CONSIDER','another definition');check('case variant cannot create a duplicate saved word',(await state()).vocabulary.filter(w=>E.termKey(w.term)===term).length===1);await close();
  await addWord('quux memory','','The original sentence lacks this target.');await route('words');await end();await view('study');await value('#wc-topic','saved','change');
  check('unexplained custom vocabulary is visibly excluded from recall',await c.eval('document.querySelector(".wc-setup").textContent.includes("1 个自选词缺少释义")'));
  await route('review');await c.click('[data-action=review-tab][data-tab=words]');const custom=(await state()).vocabulary.find(w=>w.term==='quux memory');await c.click(`[data-action="edit-word"][data-id="${custom.id}"]`);await value('#word-meaning','虚构的自选词');await c.click('#word-form [type=submit]');
  await c.click(`[data-action="edit-word"][data-id="${custom.id}"]`);await value('#word-term','consistent');await value('#word-meaning','保持一致的');await c.click('#word-form [type=submit]');
  check('editing into a built-in word assigns canonical ID without changing source',(await state()).vocabulary.some(w=>w.id==='V_consistent'&&w.lessonId===custom.lessonId)&&!(await state()).vocabulary.some(w=>w.id===custom.id));
  // Deterministic image race tests use the real image decoder after controlled file reads.
  await route('words');await view('codes');await editor('phon','电话');await holdImages();await image('png','delay-close.png');await c.until('window.qaHeld.length===1');await close();await editor('graph','图表');await releaseImages();
  check('closed editor cannot write into the next editor',await c.eval('document.querySelector("#wc-code-title").value==="图表"&&!document.querySelector("#wc-code-image-preview img")'));await close();
  await editor('port','港口');await holdImages();await image('png','delay-first.png');await c.until('window.qaHeld.length===1');await image('blue','blue.png');await c.until('document.querySelector("#wc-code-image-status").textContent.includes("已准备")');const blue=await c.eval('document.querySelector("#wc-code-image-preview img").getAttribute("src")');await releaseImages();
  check('latest valid image wins over a slower earlier image',await c.eval(`document.querySelector('#wc-code-image-preview img').getAttribute('src')===${JSON.stringify(blue)}`));
  await holdImages();await image('png','delay-before-invalid.png');await c.until('window.qaHeld.length===1');await image('svg','new-invalid.svg');await releaseImages();check('invalid latest selection also cancels older image job',await c.eval(`!document.querySelector('#wc-code-submit').disabled&&document.querySelector('#wc-code-image-preview img').getAttribute('src')===${JSON.stringify(blue)}`));await close();
  // Encoding CRUD is independent of saved-word and recall records.
  await c.click('[data-action=wc-code-edit]');await value('#wc-code-title','康熙（改）');await c.eval('document.querySelector("#wc-code-match").closest("details").open=true');await value('#wc-code-match','start','change');await saveEditor();
  check('editing a code updates label and matching rule without duplicating it',(await state()).wordCodes.length===1&&(await state()).wordCodes[0].title==='康熙（改）'&&(await state()).wordCodes[0].match==='start');
  await c.click('[data-action=wc-code-edit]');await value('#wc-code-title','康熙');await value('#wc-code-match','any','change');await saveEditor();
  await editor('phon','电话');await saveEditor();const temporary=(await state()).wordCodes.find(w=>w.fragment==='phon'),beforeDelete=await state();await c.click(`[data-action="wc-code-delete"][data-id="${temporary.id}"]`);await c.click('[data-action=wc-code-delete-confirm]');
  check('deleting an encoding does not delete vocabulary or recall progress',(await state()).wordCodes.length===1&&equal((await state()).vocabulary,beforeDelete.vocabulary)&&equal((await state()).wordStudy,beforeDelete.wordStudy));
  // Account creation, server recovery (no browser copy), another account, re-login, and real conflict.
  const expected=await state(),usernameA='words-a-'+Date.now().toString(36),usernameB='words-b-'+Date.now().toString(36);
  const info=await login(usernameA,true);check('account explicitly identifies the local-server boundary',info.cloud===false);
  const remote=await c.eval('fetch("/api/sync").then(r=>r.json()).then(d=>d.state)');check('server receives words, collections, both directions, and thumbnail',JSON.stringify(remote.wordStudy)===JSON.stringify(expected.wordStudy)&&JSON.stringify(remote.wordCodes)===JSON.stringify(expected.wordCodes)&&remote.vocabulary.length===expected.vocabulary.length);
  await c.eval('localStorage.clear()');await reload('words');check('refresh with no browser copy restores encoding and progress from account server',JSON.stringify((await state()).wordCodes)===JSON.stringify(expected.wordCodes)&&JSON.stringify((await state()).wordStudy)===JSON.stringify(expected.wordStudy));
  await view('codes');await editor('scope','望远镜');await holdImages();await image('png','delay-account.png');await c.until('window.qaHeld.length===1');await close();await logout();await c.eval(`localStorage.setItem('${GUEST}',JSON.stringify(UnfoldCore.newState()))`);await login(usernameB,true);await releaseImages();
  check('other account receives neither old editor nor previous account data',(await state()).wordCodes.length===0&&Object.keys((await state()).wordStudy).length===0&&(await state()).vocabulary.length===0&&!await c.eval('document.querySelector("#modal").open'));
  await logout();await login(usernameA);check('re-login restores original personal encoding',JSON.stringify((await state()).wordCodes)===JSON.stringify(expected.wordCodes));
  await c.eval(`(async()=>{const h=await fetch('/api/health').then(r=>r.json()),r=await fetch('/api/sync').then(r=>r.json());r.state.wordCodes[0].title='康熙（另一测试页）';const p=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json','X-Unfold-Token':h.csrf_token},body:JSON.stringify({revision:r.revision,state:r.state})});if(p.status!==200)throw Error('QA conflict setup failed')})()`);
  await value('#theme-select','dark','change');await c.click('[data-action=sync-now]');await c.until('!!document.querySelector("[data-action=sync-conflict]")');check('real revision conflict does not silently overwrite local words',(await state()).wordCodes[0].title==='康熙');
  await c.click('[data-action=sync-conflict]');await c.click('[data-action=sync-load]');check('explicit server conflict resolution loads encoding',((await state()).wordCodes[0].title==='康熙（另一测试页）'));await logout();
  // New module commits are transactional: no disappearing input or falsely saved grades.
  await fresh();await practice();await c.click('[data-action=wc-reveal]');const before=await state();await c.eval(`window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='${GUEST}')throw new DOMException('Synthetic quota','QuotaExceededError');return window.qaSetItem.call(this,k,v)}`);await c.click('[data-action=wc-grade][data-grade=good]');
  check('storage failure keeps the revealed card and does not advance or save grade',await c.eval(`document.querySelector('.wc-session').dataset.wordId==='${id}'&&!!document.querySelector('#wc-answer')`)&&JSON.stringify((await state()).wordStudy)===JSON.stringify(before.wordStudy));await c.eval('Storage.prototype.setItem=window.qaSetItem');await reload();
  await view('codes');await editor();await c.eval(`window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='${GUEST}')throw new DOMException('Synthetic quota','QuotaExceededError');return window.qaSetItem.call(this,k,v)}`);await saveEditor();
  check('failed code save preserves editor input and reports unsaved state',await c.eval('document.querySelector("#modal").open&&document.querySelector("#wc-code-title").value==="康熙"&&!document.querySelector("#wc-code-error").hidden')&&(await state()).wordCodes.length===0);await c.eval('Storage.prototype.setItem=window.qaSetItem');await close();await reload();
  await practice();await c.click('[data-action=wc-reveal]');const external=await state();external.preferences.textSize='large';await c.eval(`localStorage.setItem('${GUEST}',JSON.stringify(${JSON.stringify(external)}))`);await c.click('[data-action=wc-grade][data-grade=good]');
  check('another page write is preserved instead of overwritten by a score',JSON.stringify(await state())===JSON.stringify(external)&&await c.eval('!!document.querySelector("#wc-answer")&&!!document.querySelector("#storage-warning")'));await reload();
  let quota=await empty();quota.wordCodes=Array.from({length:500},(_,i)=>({id:'C_'+i,fragment:'c'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),title:'虚构编码',note:'',kind:'fragment',rootMeaning:'',match:'any',enabled:true,imageData:'',created:today,updated:today}));await seed(quota);await view('codes');await editor('test','测试');await saveEditor();
  check('500-code limit rejects only the new candidate, preserving inputs and library',(await state()).wordCodes.length===500&&await c.eval('document.querySelector("#modal").open&&document.querySelector("#wc-code-title").value==="测试"&&!document.querySelector("#wc-code-error").hidden'));await close();
  quota=await empty();const limit=2*1024*1024;
  while(Buffer.byteLength(JSON.stringify(quota))<limit-100)quota.vocabulary.push({id:'W_'+quota.vocabulary.length,term:'fictional '+quota.vocabulary.length,meaning:'fictional',context:'x'.repeat(1500),lessonId:'L01',due:today,seen:0,streak:0});
  const excess=Buffer.byteLength(JSON.stringify(quota))-(limit-100);quota.vocabulary.at(-1).context=quota.vocabulary.at(-1).context.slice(0,1500-excess);await seed(quota,'settings');
  await c.eval(`window.qaBlobURL=URL.createObjectURL;window.qaAnchorClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=function(b){window.qaExportBlob=b;return window.qaBlobURL.call(this,b)};HTMLAnchorElement.prototype.click=function(){if(!this.download)window.qaAnchorClick.call(this)};`);await c.click('[data-action=export]');const exported=await c.eval('window.qaExportBlob.text()');
  check('near-quota compact export remains re-importable',Buffer.byteLength(exported)<=limit&&equal(JSON.parse(exported),quota),{bytes:Buffer.byteLength(exported),limit});await c.eval('URL.createObjectURL=window.qaBlobURL;HTMLAnchorElement.prototype.click=window.qaAnchorClick');
  await importState(JSON.parse(exported));check('backup confirmation includes vocabulary, directional progress and encoding scope',await c.eval('document.querySelector("#modal").textContent.includes("分方向刷词进度")&&document.querySelector("#modal").textContent.includes("含缩略图")'));await close();
  await route('words');await view('codes');await editor('test','容量测试','x'.repeat(500));await saveEditor();check('whole-account quota keeps existing record and unsaved code input',(await state()).wordCodes.length===0&&await c.eval('document.querySelector("#modal").open&&!document.querySelector("#wc-code-error").hidden&&document.querySelector("#wc-code-title").value==="容量测试"'));await close();
  await fresh('settings');const modern=await empty();modern.wordStudy={[id]:{en:E.schedule(null,'good',today)}};modern.wordCodes=[expected.wordCodes[0]];modern.vocabulary=expected.vocabulary;await importState(modern);await c.click('[data-action=restore-confirm]');
  check('confirmed backup import restores new collections and image',JSON.stringify((await state()).wordCodes)===JSON.stringify(modern.wordCodes)&&JSON.stringify((await state()).wordStudy)===JSON.stringify(modern.wordStudy));await route('settings');
  const old=await empty();delete old.wordStudy;delete old.wordCodes;delete old.preferences.wordDirection;delete old.preferences.wordTopic;await importState(old);await c.click('[data-action=restore-confirm]');check('legacy backup imports with safe new defaults',Object.keys((await state()).wordStudy).length===0&&(await state()).wordCodes.length===0&&(await state()).preferences.wordDirection==='en');
  await route('settings');await c.click('[data-action=reset]');check('reset explicitly warns that word progress and image codes are included',await c.eval('document.querySelector("#modal").textContent.includes("刷词进度")&&document.querySelector("#modal").textContent.includes("图像编码与缩略图")'));await close();
  // Visual matrix: no document/modal overflow, usable controls, keyboard focus, real screenshots.
  const fixture=await empty();fixture.wordCodes=[{...expected.wordCodes[0],note:'康熙拿着奏折认真考虑。'.repeat(20)}];await seed(fixture);let overflow=[],badControls=[];
  await view('codes');check('long memory scenes are collapsed until requested',await c.eval('!!document.querySelector(".wc-code-note-disclosure")&&!document.querySelector(".wc-code-note-disclosure").open'));
  for(const width of [320,390,768,1440])for(const mode of ['standard-light','large-light','large-dark','small-light']){
    await c.size(width,900,width<700);await route('settings');await value('#text-size-select',mode.split('-')[0],'change');await value('#theme-select',mode.split('-')[1],'change');await route('words');await end();await view('study');
    for(const v of ['study','library','codes']){
      await view(v);const r=await c.eval('({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll(".nav-button,.wc-workspace button,.wc-workspace input,.wc-workspace select,.wc-workspace summary")].filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.dataset.action,height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),input:e.matches("input,select")}))})');
      layouts.push({width,mode,view:v});if(r.scroll>r.width+1)overflow.push({width,mode,view:v,...r});for(const t of r.targets)if(t.height<43.9||t.input&&t.font<16)badControls.push({width,mode,view:v,...t});
    }
    await practice();for(const face of ['front','back']){if(face==='back')await c.click('[data-action=wc-reveal]');const r=await c.eval('({width:innerWidth,scroll:document.documentElement.scrollWidth})');layouts.push({width,mode,view:face});if(r.scroll>r.width+1)overflow.push({width,mode,view:face,...r});}
    await c.click('[data-action=wc-code-new]');await value('#wc-code-fragment','cons');await value('#wc-code-title','康熙');
    for(const expanded of [false,true]){
      await c.eval(`document.querySelectorAll('#wc-code-form details').forEach(e=>e.open=${expanded});document.querySelector('#modal').scrollTop=0`);
      const r=await editorGeometry(),name=expanded?'editor-expanded':'editor';
      layouts.push({width,mode,view:name});if(r.left<0||r.right>r.width+1||r.scroll>r.client+1)overflow.push({width,mode,view:name,...r});
      if(r.submit.bottom>r.bottom+1||r.submit.top<r.top||r.submit.height<44||!r.submit.hit)badControls.push({width,mode,view:name,issue:'unreachable primary save',...r});
      for(const t of r.targets)if(t.height<43.9||t.input&&t.font<16)badControls.push({width,mode,view:name,...t});
    }
    await close();await end();
  }
  // Short mobile viewports approximate the reduced area available around a software keyboard.
  // This checks reachability, not an actual OS keyboard or physical-device test.
  for(const width of [320,390])for(const height of [480,600])for(const mode of ['standard-light','large-dark']){
    await c.size(width,height,true);await route('settings');await value('#text-size-select',mode.split('-')[0],'change');await value('#theme-select',mode.split('-')[1],'change');await route('words');await view('codes');await editor();
    for(const expanded of [false,true]){
      await c.eval(`document.querySelectorAll('#wc-code-form details').forEach(e=>e.open=${expanded});document.querySelector('#modal').scrollTop=0`);
      const r=await editorGeometry(),name=expanded?'editor-expanded-short':'editor-short';layouts.push({width,height,mode,view:name});
      if(r.left<0||r.right>r.width+1||r.scroll>r.client+1)overflow.push({width,height,mode,view:name,...r});
      if(r.submit.bottom>r.bottom+1||r.submit.top<r.top||r.submit.height<44||!r.submit.hit)badControls.push({width,height,mode,view:name,issue:'unreachable primary save',...r});
      if(expanded)for(const field of ['wc-code-fragment','wc-code-title','wc-code-note','wc-code-kind','wc-code-match','wc-code-root-meaning','wc-code-image']){
        await c.eval(`document.getElementById(${JSON.stringify(field)}).focus()`);
        const f=await c.eval(`(()=>{const e=document.getElementById(${JSON.stringify(field)}).getBoundingClientRect(),h=document.querySelector('.modal-heading').getBoundingClientRect(),b=document.querySelector('.wc-code-footer').getBoundingClientRect();return {top:e.top,bottom:e.bottom,headingBottom:h.bottom,footerTop:b.top,active:document.activeElement.id}})()`);
        if(f.active!==field||f.top<f.headingBottom-1||f.bottom>f.footerTop+1)badControls.push({width,height,mode,view:name,field,issue:'focused input hidden behind sticky controls',...f});
      }
    }
    await close();
  }
  check(`${layouts.length} word views / viewport / size / theme layouts without overflow`,overflow.length===0,overflow);
  check('new word controls retain 44px targets and editable text at least 16px',badControls.length===0,badControls);
  await c.size(1440,900);await route('settings');await value('#text-size-select','standard','change');await value('#theme-select','light','change');await route('words');await end();await view('study');await shot('words-desktop-setup.png');await practice();await shot('words-desktop-front.png');await c.click('[data-action=wc-reveal]');await shot('words-desktop-answer.png');
  await c.click('[data-action=wc-code-new]');await value('#wc-code-fragment','cons');await value('#wc-code-title','康熙');await value('#wc-code-note','虚构画面：康熙拿着奏折，认真考虑。');await c.eval('document.querySelector("#modal").scrollTop=0');await shot('words-desktop-editor.png');
  await c.eval('document.querySelector("#wc-code-submit").focus()');await c.key('Tab','Tab',9);check('modal Tab wraps to close button',await c.eval('document.activeElement.classList.contains("modal-close")'));await c.key('Tab','Tab',9,8);check('modal Shift-Tab wraps to submit',await c.eval('document.activeElement.id==="wc-code-submit"'));await close();
  await c.size(390,900,true);await end();await view('study');await value('#wc-direction','zh','change');await practice();await c.click('[data-action=wc-hint]');await shot('words-mobile-hint.png');await c.click('[data-action=wc-reveal]');await shot('words-mobile-answer.png');
  await end();await view('codes');await shot('words-mobile-codes.png');await view('library');await shot('words-mobile-library.png');
  await c.size(320,900,true);await view('codes');await shot('words-small-codes.png');await route('settings');await value('#text-size-select','large','change');await value('#theme-select','dark','change');await route('words');await end();await view('study');await practice();await shot('words-small-dark-front.png');await c.click('[data-action=wc-reveal]');await shot('words-small-dark-answer.png');
  await c.size(320,480,true);await c.click('[data-action=wc-code-new]');await value('#wc-code-fragment','cons');await value('#wc-code-title','康熙');await c.eval('document.querySelectorAll("#wc-code-form details").forEach(e=>e.open=true);document.querySelector("#modal").scrollTop=0');await shot('words-small-dark-editor.png');await close();
  const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown');check('no uncaught browser exceptions',errors.length===0,errors.map(e=>e.params.exceptionDetails.text));
})().catch(e=>{console.error(e);checks.push({name:'unexpected test interruption',pass:false,detail:String(e.stack||e)});process.exitCode=1}).finally(()=>{
  fs.writeFileSync(path.join(OUT,'words-browser-results.json'),JSON.stringify({checks,layouts,screens},null,2));console.log(`Words browser: ${checks.filter(x=>x.pass).length}/${checks.length} checks passed; layouts=${layouts.length}; output=${OUT}`);
  if(checks.some(x=>!x.pass))process.exitCode=1;c?.close();
});
