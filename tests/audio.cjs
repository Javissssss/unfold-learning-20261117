'use strict';
const {CDP,wait}=require('./cdp.cjs');
const fs=require('node:fs'),path=require('node:path');
if(process.env.UNFOLD_QA_ISOLATED!=='1')throw Error('An isolated QA database and Chrome profile are required.');
const ORIGIN=process.env.UNFOLD_QA_ORIGIN||'http://127.0.0.1:8792';
let c;
(async()=>{
  c=await CDP.connect(Number(process.env.UNFOLD_QA_CDP||9252));await c.size(1440,900);await c.call('Network.enable');await c.call('Network.clearBrowserCookies');
  await c.navigate(`${ORIGIN}/?audio=${Date.now()}#settings`);await c.until('!!document.querySelector(".nav-button")');await c.eval('localStorage.clear()');await c.call('Page.reload');await c.until('!!document.querySelector("#default-rate")');
  await c.eval('(()=>{const e=document.querySelector("#default-rate");e.value="1.3";e.dispatchEvent(new Event("change",{bubbles:true}))})()');
  const rows=[];
  for(const pack of ['a','b']){
    await c.eval('location.hash="#settings"');await wait(120);await c.eval(`document.querySelector('input[name="voice-pack"][value="${pack}"]').click()`);
    for(let i=1;i<=36;i++){
      const id='L'+String(i).padStart(2,'0');await c.eval(`location.hash='#lesson/${id}/0'`);await c.until(`!!document.querySelector('#play-button')&&UnfoldPlayback?.lessonId==='${id}'`);await wait(120);await c.click('[data-action=play]');await wait(1300);
      const row=await c.eval('({player:UnfoldPlayback,src:document.querySelector("#audio-host audio")?.getAttribute("src"),select:document.querySelector("#play-rate").value})');
      const pass=row.player?.currentTime>.05&&!row.player.paused&&row.player.duration>0&&!row.player.errorCode&&row.src===`/audio/${pack}/${id}.wav`&&row.select==='1.3';rows.push({pack,id,pass,...row});console.log((pass?'PASS ':'FAIL ')+pack+'/'+id);
      await c.eval('document.querySelector("#audio-host audio")?.pause()');
    }
    await c.eval('location.hash="#settings"');await wait(120);await c.click(`[data-action=preview-pack][data-pack=${pack}]`);await wait(700);const preview=await c.eval('(()=>{const e=[...document.querySelectorAll("#audio-host audio")].find(a=>a.getAttribute("src").includes("_preview"));return e?{time:e.currentTime,duration:e.duration,paused:e.paused,error:e.error?.code||null}:null})()');rows.push({pack,id:'_preview',pass:preview?.time>.05&&preview.duration>0&&!preview.paused&&!preview.error,preview});
  }
  await c.eval('location.hash="#lesson/L01/0"');await wait(120);await c.click('[data-action=replay]');await c.until('UnfoldPlayback?.ended===true',45000);const full=await c.eval('({playback:UnfoldPlayback,progress:JSON.parse(localStorage.getItem("unfold.workspace.v1")).progress.L01})');const completed=full.progress.heard&&full.playback.covered>=full.playback.duration-.75;console.log((completed?'PASS ':'FAIL ')+'natural playback reaches complete without seeking');
  const out=path.join(process.env.TEMP||require('node:os').tmpdir(),'unfold-audit-20261118');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'audio-results.json'),JSON.stringify({rows,completed,full},null,2));console.log(`Audio: ${rows.filter(r=>r.pass).length}/${rows.length} playback files; natural completion=${completed}`);if(rows.some(r=>!r.pass)||!completed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>c?.close());
