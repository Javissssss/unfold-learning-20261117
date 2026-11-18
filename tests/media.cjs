'use strict';
/* Deterministic media-lifecycle tests, not evidence of a full natural listen.
   Only the 1400ms next-lesson grace timer is controlled; real audio files still load.
   Requires an isolated QA server/database and browser profile. */
const {CDP,wait}=require('./cdp.cjs');
const fs=require('node:fs'),path=require('node:path');
if(process.env.UNFOLD_QA_ISOLATED!=='1')throw Error('An isolated QA database and Chrome profile are required.');
const origin=process.env.UNFOLD_QA_ORIGIN||'http://127.0.0.1:8792';
const checks=[];let c,injectId,serial=Date.now();
function check(name,pass,detail){checks.push({name,pass:!!pass,detail:pass?undefined:detail});console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(detail)));}
async function route(hash){await c.eval(`location.hash=${JSON.stringify('#'+hash)}`);await wait(120);}
async function reload(hash){await c.navigate(`${origin}/?media=${++serial}#${hash}`);await c.until('!!document.querySelector(".nav-button")',11000);}
async function toggle(enabled){await c.eval(`(()=>{const e=document.getElementById('auto-next');e.checked=${enabled};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function prepare(enabled=true){
  await c.call('Network.clearBrowserCookies');await reload('settings');await c.eval('localStorage.clear()');await reload('settings');await toggle(enabled);await route('lesson/L01/0');await c.until('UnfoldPlayback?.lessonId==="L01"&&UnfoldPlayback.duration>0');
}
async function ended(){await c.eval(`(()=>{const a=document.querySelector('#audio-host audio');a.pause();Object.defineProperty(a,'ended',{value:true,configurable:true});a.dispatchEvent(new Event('ended'));})()`);}
async function flush(){await c.eval('window.flushNextLesson()');await wait(200);}
(async()=>{
  c=await CDP.connect(Number(process.env.UNFOLD_QA_CDP||9252));await c.size(1440,900);await c.call('Network.enable');
  injectId=(await c.call('Page.addScriptToEvaluateOnNewDocument',{source:`
    (()=>{
      const nativeSet=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);
      const next=new Map();let serial=-1;
      window.setTimeout=(fn,delay,...args)=>{if(delay!==1400)return nativeSet(fn,delay,...args);const id=serial--;next.set(id,()=>fn(...args));return id;};
      window.clearTimeout=id=>{if(next.has(id))next.delete(id);else nativeClear(id);};
      window.pendingNextLesson=()=>next.size;
      window.flushNextLesson=()=>{const tasks=[...next.values()];next.clear();tasks.forEach(fn=>fn());};
      window.mediaActions={};
      if(navigator.mediaSession){const install=navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);navigator.mediaSession.setActionHandler=(action,handler)=>{window.mediaActions[action]=handler;return install(action,handler);};}
    })();
  `})).identifier;
  await prepare(false);await ended();check('auto-next disabled queues nothing',await c.eval('pendingNextLesson()===0'));await flush();check('ended event does not claim a natural full listen',await c.eval('!JSON.parse(localStorage.getItem("unfold.workspace.v1")).progress.L01.heard'));
  await prepare();await ended();check('auto-next queues one grace timer',await c.eval('pendingNextLesson()===1'));await flush();await c.until('UnfoldPlayback?.lessonId==="L02"&&UnfoldPlayback.currentTime>.1');check('normal auto-next plays the next lesson',await c.eval('!UnfoldPlayback.paused'));
  await prepare();await ended();await route('settings');await toggle(false);check('turning off auto-next cancels grace timer',await c.eval('pendingNextLesson()===0'));await toggle(true);await flush();check('off then on does not resurrect old auto-next',await c.eval('UnfoldPlayback?.lessonId==="L01"&&location.hash==="#settings"'));
  await prepare();await ended();await route('settings');await c.click('[data-action=preview-pack][data-pack=a]');check('audition cancels next-lesson timer',await c.eval('pendingNextLesson()===0'));await flush();check('audition never jumps away to next lesson',await c.eval('UnfoldPlayback?.lessonId==="L01"&&location.hash==="#settings"'));
  await prepare();await ended();await route('lesson/L03/0');await flush();check('changing lessons cancels old auto-next',await c.eval('pendingNextLesson()===0&&UnfoldPlayback?.lessonId==="L03"'));
  await prepare();await ended();await c.click('[data-action=reading-only]');await flush();check('reading-only cancels old auto-next',await c.eval('pendingNextLesson()===0&&location.hash==="#lesson/L01/1"'));
  await prepare();await ended();await c.eval('window.mediaActions.pause()');await flush();check('media-session pause cancels old auto-next',await c.eval('pendingNextLesson()===0&&UnfoldPlayback?.lessonId==="L01"'));
  await prepare();await ended();await route('settings');await c.click('[data-action=account-register]');await c.eval(`(()=>{document.querySelector('#account-name').value='media-'+Date.now().toString(36);document.querySelector('#account-password').value='regression-only-password';document.querySelector('#account-form').requestSubmit();})()`);await c.until('!document.querySelector("#modal").open&&!!document.querySelector("[data-action=account-logout]")');await flush();check('account activation clears old media and auto-next',await c.eval('pendingNextLesson()===0&&!UnfoldPlayback&&document.querySelectorAll("#audio-host audio").length===0&&location.hash==="#settings"'));await c.until('document.querySelector("#sync-status").textContent.includes("已保存")');await c.click('[data-action=account-logout]');
  const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown');check('no uncaught media lifecycle exception',errors.length===0,errors.map(e=>e.params.exceptionDetails.text));
  const out=path.join(process.env.TEMP||require('node:os').tmpdir(),'unfold-audit-20261118');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'media-results.json'),JSON.stringify({method:'Synthetic ended events and controlled auto-next grace timers; not a natural full-listen test',checks},null,2));console.log(`Media: ${checks.filter(x=>x.pass).length}/${checks.length}`);if(checks.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(c&&injectId)await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injectId}).catch(()=>{});c?.close();});
