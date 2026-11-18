'use strict';
const fs=require('node:fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
  constructor(ws){this.ws=ws;this.seq=0;this.pending=new Map();this.events=[];ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(!d.id){this.events.push(d);return;}const p=this.pending.get(d.id);if(!p)return;this.pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);});}
  static async connect(port){const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(),tab=tabs.find(t=>t.type==='page');if(!tab)throw Error('Start the isolated QA Chrome first');const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});const c=new CDP(ws);await c.call('Page.enable');await c.call('Runtime.enable');return c;}
  call(method,params={}){const id=++this.seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async until(expression,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await this.eval(expression))return;await wait(80);}throw Error('Condition timeout: '+expression);}
  async navigate(url){await this.call('Page.navigate',{url});await this.until('document.readyState==="complete"');}
  async size(width,height,mobile=false){await this.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await this.call('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:1});}
  async click(selector,touch=false){const p=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(touch){await this.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await this.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await this.call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await this.call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}await wait(100);}
  async key(key,code=key,virtual=0,modifiers=0){await this.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,modifiers});await this.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,modifiers});}
  async capture(file){await this.eval('window.scrollTo(0,0)');await wait(100);const r=await this.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.data,'base64'));}
  close(){this.ws.close();}
}
module.exports={CDP,wait};
