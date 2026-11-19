/* Pure vocabulary/encoding rules. No network, storage or UI side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.UnfoldWordEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TOPICS={daily:'日常',business:'商务',accounting:'财务会计',tech:'科技',finance:'金融',toeic:'托业'};
  const ID=/^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_-]{1,60}$/;
  const MAX_CODES=500,MAX_IMAGE=16430,MAX_IMAGES=786432;
  const fail=message=>{throw new Error(message);};
  const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const int=(x,max=100000)=>Number.isInteger(x)&&x>=0&&x<=max;
  const text=(x,max,required=false)=>typeof x==='string'&&x.length<=max&&(!required||!!x.trim());
  const fields=(x,names)=>object(x)&&Object.keys(x).every(k=>names.includes(k));
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function termKey(term){return String(term||'').trim().toLowerCase().replace(/\u2019/g,"'").replace(/\s+/g,' ');}
  function wordId(term){return 'V_'+termKey(term).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
  function imageValid(value){
    if(value==='')return true;
    if(typeof value!=='string'||value.length>MAX_IMAGE)return false;
    const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if(!m||m[2].length%4!==0)return false;
    try{
      const raw=typeof atob==='function'?atob(m[2]):Buffer.from(m[2],'base64').toString('binary');
      if(raw.length<12)return false;
      if(m[1]==='png')return raw.slice(0,8)==='\x89PNG\r\n\x1a\n';
      if(m[1]==='jpeg')return raw.slice(0,3)==='\xff\xd8\xff';
      return raw.slice(0,4)==='RIFF'&&raw.slice(8,12)==='WEBP';
    }catch{return false;}
  }
  function scheduleValid(s){
    return fields(s,['due','seen','streak','last','grade','hinted'])&&date(s.due)&&int(s.seen)&&int(s.streak,5)&&date(s.last)&&['again','hard','good'].includes(s.grade)&&typeof s.hinted==='boolean';
  }
  function collectionsValid(value){
    const study=value.wordStudy===undefined?{}:value.wordStudy,codes=value.wordCodes===undefined?[]:value.wordCodes;
    if(!object(study)||Object.keys(study).length>6000)fail('刷词记录格式或数量不合法');
    const clean={};
    for(const [id,s] of Object.entries(study)){
      if(!ID.test(id)||!fields(s,['en','zh'])||!Object.keys(s).length)fail('刷词记录标识或方向不合法');
      const row={};
      for(const dir of Object.keys(s)){if(!scheduleValid(s[dir]))fail('刷词复习日期或计数不合法');row[dir]={...s[dir]};}
      clean[id]=row;
    }
    if(!Array.isArray(codes)||codes.length>MAX_CODES)fail('编码库格式或数量不合法');
    const ids=new Set(),pairs=new Set();let imageSize=0;
    const encoded=codes.map(c=>{
      if(!fields(c,['id','fragment','title','note','kind','rootMeaning','match','enabled','imageData','created','updated'])||typeof c.id!=='string'||!ID.test(c.id)||ids.has(c.id)||!text(c.fragment,20,true)||!/^[a-z]{2,20}$/.test(c.fragment)||!text(c.title,60,true)||!text(c.note,500)||!text(c.rootMeaning,100)||!['fragment','root'].includes(c.kind)||!['any','start','end'].includes(c.match)||typeof c.enabled!=='boolean'||!date(c.created)||!date(c.updated)||!imageValid(c.imageData))fail('编码内容、图片或日期不合法');
      const pair=c.fragment+':'+c.match;if(pairs.has(pair))fail('同一片段和匹配位置已有编码');
      ids.add(c.id);pairs.add(pair);imageSize+=c.imageData.length;
      return {...c};
    });
    if(imageSize>MAX_IMAGES)fail('编码缩略图合计超过768KB（编码后），请先导出或移除部分图片');
    return {wordStudy:clean,wordCodes:encoded};
  }
  function matches(term,codes){
    const word=termKey(term);
    return codes.filter(c=>c.enabled&&typeof c.fragment==='string'&&(c.match==='start'?word.startsWith(c.fragment):c.match==='end'?word.endsWith(c.fragment):word.includes(c.fragment))).sort((a,b)=>b.fragment.length-a.fragment.length||a.fragment.localeCompare(b.fragment));
  }
  function segments(term,fragment){
    const text=String(term),lower=text.toLowerCase(),needle=String(fragment||'').toLowerCase(),out=[];
    if(!needle)return [{text,match:false}];
    let from=0,index;
    while((index=lower.indexOf(needle,from))>=0){if(index>from)out.push({text:text.slice(from,index),match:false});out.push({text:text.slice(index,index+needle.length),match:true});from=index+needle.length;}
    if(from<text.length)out.push({text:text.slice(from),match:false});return out;
  }
  function mask(text,term){
    const escaped=String(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(!escaped)return String(text);
    try{return String(text).replace(new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','giu'),'_____');}catch{return String(text);}
  }
  function schedule(previous,grade,today,hinted=false){
    if(!['again','hard','good'].includes(grade)||!date(today))fail('刷词评分或日期不合法');
    if(hinted&&grade==='good')grade='hard';
    const seen=Math.min(100000,(previous?.seen||0)+1);
    const streak=grade==='good'?Math.min(5,(previous?.streak||0)+1):grade==='hard'?Math.max(0,(previous?.streak||0)-1):0;
    const interval=grade==='good'?[3,7,14,30,60][streak-1]:1;
    const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+interval);
    return {due:d.toISOString().slice(0,10),seen,streak,last:today,grade,hinted:!!hinted};
  }
  function queue(rows,records,mode,today){
    if(!date(today)||!['mix','due','new','all'].includes(mode))fail('刷词队列参数不合法');
    const fresh=[],due=[],future=[];
    for(const row of rows){const s=records[row.id];if(!s||!s.seen)fresh.push(row);else(s.due<=today?due:future).push(row);}
    due.sort((a,b)=>records[a.id].due.localeCompare(records[b.id].due)||a.id.localeCompare(b.id));
    future.sort((a,b)=>records[a.id].due.localeCompare(records[b.id].due)||a.id.localeCompare(b.id));
    if(mode==='due')return due.slice(0,20);
    if(mode==='new')return fresh.slice(0,10);
    const ready=due.slice(0,20),batch=[...ready,...fresh.slice(0,Math.min(10,20-ready.length))];
    return mode==='all'?[...batch,...future].slice(0,20):batch;
  }
  function catalogValid(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>10000)fail('词库没有可用词条');
    const ids=new Set(),terms=new Set();
    for(const w of rows){
      if(!object(w)||typeof w.id!=='string'||!ID.test(w.id)||ids.has(w.id)||!text(w.term,80,true)||terms.has(termKey(w.term))||!text(w.pos,20,true)||!text(w.meaning,500,true)||!text(w.tip,500,true)||!Array.isArray(w.topics)||!w.topics.length||w.topics.some(k=>!Object.hasOwn(TOPICS,k))||!Array.isArray(w.collocations)||w.collocations.length<2||w.collocations.some(c=>!text(c,120,true))||!Array.isArray(w.examples)||w.examples.length<3||w.examples.some(e=>!text(e.en,500,true)||!text(e.zh,500,true)))fail('词条释义、分类或例句不完整');
      if(mask(w.examples[0].en,w.term)===w.examples[0].en)fail('首个例句须包含可挖空的原词：'+w.term);
      if(new Set(w.examples.map(e=>e.en)).size!==w.examples.length)fail('同一词条的例句重复：'+w.term);
      ids.add(w.id);terms.add(termKey(w.term));
    }
    return rows;
  }
  return Object.freeze({TOPICS,ID,MAX_CODES,MAX_IMAGE,MAX_IMAGES,date,termKey,wordId,imageValid,collectionsValid,scheduleValid,matches,segments,mask,schedule,queue,catalogValid});
});
