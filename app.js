/* Unfold — no remote assets, no analytics, and no API keys in the browser. */
(() => {
  'use strict';
  const GUEST_KEY = 'unfold.workspace.v1';
  let KEY = GUEST_KEY;
const AUDIO_REVISION = 'kokoro-fp32-v7-20261118';
  const VOICE_PACKS = [['a','清亮 · 女声较高，男声低沉'],['b','温润 · 女声柔和，男声厚实']];
  const LEVELS = {1:'基础',2:'进阶',3:'拓展'};
  const THEMES = {meetings:'会议与对齐',projects:'项目与进展',communication:'沟通与反馈',business:'商业与判断',daily:'日常生活',social:'社交与邀约',travel:'旅行与出行',food:'饮食与烹饪',culture:'影视与文化',science:'科学与证据',relationships:'人际与情绪',ideas:'观点与思辨',news:'新闻与信息',health:'健康与照顾',tech:'科技与隐私',learning:'学习与记忆',money:'金钱与消费',environment:'环境与习惯',home:'居住与选择',sport:'运动与复盘',family:'家庭与边界',career:'职业与取舍',cities:'城市与公共'};
  const hasBundledAudio = l => !!l && !l.generated && /^L(?:0[1-9]|[12][0-9]|3[0-6])$/.test(l.id);
  const bundledAudioUrl = l => `/audio/${state.preferences.voicePack}/${l.id}.wav`;
  const DICT = window.UnfoldDict || {};
  const RATINGS = ['大多没跟上','较依赖中文辅助','能抓住大意','基本顺畅','能理解关键细节'];
  const CONTEXTS = ['unrecorded','independent','supported','not-listened'];
  const validAnswers = a => Array.isArray(a) && a.length===4 && a.every(v=>v===null || (Number.isInteger(v)&&v>=0&&v<=2));
  const requiredAnswers = (a,mode) => (mode==='reading'?a.slice(2):a).every(v=>v!==null);
  const idPattern = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_-]{1,60}$/;
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function day(date = new Date()) { return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'); }
  function addDays(value, count) { const d = new Date(value+'T12:00:00'); d.setDate(d.getDate()+count); return day(d); }
  function validDate(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00')) && day(new Date(value+'T12:00:00'))===value; }
  function str(value, limit, name) { if(typeof value!=='string' || !value.trim() || value.length>limit) throw new Error(`${name}缺失或长度不合法`); return value.trim(); }
  function lessonValid(value) {
    if(!value || typeof value!=='object' || !idPattern.test(value.id) || ![1,2,3].includes(value.level) || !Object.hasOwn(THEMES,value.theme)) throw new Error('材料标识、主题或难度不合法');
    const result={id:value.id,level:value.level,theme:value.theme,generated:value.generated===true};
    const limits={title:150,subtitle:180,readingTitle:150,script:6000,reading:7000,easy:1400,zh:1000,speakingPrompt:700,writingPrompt:700};
    for(const [name,limit] of Object.entries(limits)) result[name]=str(value[name],limit,name);
    if(!Array.isArray(value.phrases) || value.phrases.length<2 || value.phrases.length>5) throw new Error('意群格式不合法');
    result.phrases=value.phrases.map(p=>({text:str(p.text,350,'意群'),meaning:str(p.meaning,500,'解释'),cue:str(p.cue,500,'提取提示')}));
    for(const name of ['listenQuestions','readingQuestions']) {
      if(!Array.isArray(value[name]) || value[name].length!==2) throw new Error('听读须各有两道理解题');
      result[name]=value[name].map(q=>{
        if(!Array.isArray(q.options) || q.options.length!==3 || !Number.isInteger(q.answer) || q.answer<0 || q.answer>2) throw new Error('题目答案格式不合法');
        return {question:str(q.question,500,'题目'),options:q.options.map(o=>str(o,450,'选项')),answer:q.answer,explanation:str(q.explanation,850,'解释')};
      });
    }
    return result;
  }
  function newState() { return {version:1,progress:{},reviews:[],journals:[],drafts:{},generated:[],vocabulary:[],preferences:{rate:1,voice:'',textSize:'standard',voicePack:'a',volume:0.9,autoNext:false,theme:'auto'},lastLesson:'L01'}; }
  function newProgress() {
    return {heard:false,read:false,checked:false,answers:[null,null,null,null],replays:0,hintLevel:0,chineseHints:0,transcriptOpened:0,completedAt:null,
      mode:'both',stage:0,listenChecked:false,readingChecked:false,listenContext:'unrecorded',firstAnswers:[null,null,null,null],completion:null,
      supportUsed:false,audioPosition:0,audioRanges:[],audioRevision:'',speakingDone:false,writingDone:false};
  }
  function stateValid(value) {
    if(!value || value.version!==1 || typeof value!=='object') throw new Error('不支持的备份版本');
    const s=newState();
    if(!Array.isArray(value.generated) || value.generated.length>200) throw new Error('材料数量不合法');
    s.generated=value.generated.map(v=>({...lessonValid(v),generated:true}));
    if(new Set(s.generated.map(l=>l.id)).size!==s.generated.length || s.generated.some(l=>!l.id.startsWith('G_'))) throw new Error('扩展材料标识重复或不合法');
    if(!value.progress || typeof value.progress!=='object' || Array.isArray(value.progress) || Object.keys(value.progress).length>500) throw new Error('进度格式不合法');
    for(const [id,p] of Object.entries(value.progress)) {
      if(!idPattern.test(id) || !p || typeof p!=='object') throw new Error('进度标识不合法');
      if(!validAnswers(p.answers)) throw new Error('答题记录不合法');
      const clean=newProgress();
      for(const name of ['heard','read','checked']) { if(typeof p[name]!=='boolean') throw new Error('进度状态不合法'); clean[name]=p[name]; }
      clean.mode=p.mode===undefined?'both':p.mode;
      if(!['both','reading'].includes(clean.mode)) throw new Error('练习模式不合法');
      if(clean.checked && !requiredAnswers(p.answers,clean.mode)) throw new Error('已检查的记录缺少答案');
      clean.answers=[...p.answers];
      for(const name of ['replays','chineseHints','transcriptOpened']) { if(!Number.isInteger(p[name]) || p[name]<0 || p[name]>100000) throw new Error('计数不合法'); clean[name]=p[name]; }
      if(!Number.isInteger(p.hintLevel) || p.hintLevel<0 || p.hintLevel>3) throw new Error('提示阶段不合法');
      clean.hintLevel=p.hintLevel;
      clean.stage=p.stage===undefined?(p.checked?2:p.read?1:0):p.stage;
      if(!Number.isInteger(clean.stage)||clean.stage<0||clean.stage>2) throw new Error('练习位置不合法');
      for(const name of ['listenChecked','readingChecked','supportUsed','speakingDone','writingDone']) {
        if(p[name]!==undefined && typeof p[name]!=='boolean') throw new Error('练习标记不合法');
        clean[name]=p[name]===undefined?(['listenChecked','readingChecked'].includes(name)?p.checked:false):p[name];
      }
      clean.supportUsed=clean.supportUsed||p.hintLevel>0||p.chineseHints>0;
      if(clean.listenChecked && clean.answers.slice(0,2).some(a=>a===null)) throw new Error('听力复盘缺少答案');
      if(clean.readingChecked && clean.answers.slice(2).some(a=>a===null)) throw new Error('阅读复盘缺少答案');
      clean.listenContext=p.listenContext===undefined?'unrecorded':p.listenContext;
      if(!CONTEXTS.includes(clean.listenContext)) throw new Error('辅助情况标记不合法');
      const first=p.firstAnswers===undefined?(p.checked?p.answers:[null,null,null,null]):p.firstAnswers;
      if(!validAnswers(first)) throw new Error('首次答题记录不合法');
      clean.firstAnswers=[...first];
      clean.audioPosition=p.audioPosition===undefined?0:p.audioPosition;
      if(typeof clean.audioPosition!=='number'||!Number.isFinite(clean.audioPosition)||clean.audioPosition<0||clean.audioPosition>7200) throw new Error('音频位置不合法');
      const ranges=p.audioRanges===undefined?[]:p.audioRanges;
      if(!Array.isArray(ranges)||ranges.length>64||ranges.some((r,i)=>!Array.isArray(r)||r.length!==2||r.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>7200)||r[1]<=r[0]||(i>0&&ranges[i-1][1]>r[0]))) throw new Error('音频播放记录不合法');
      clean.audioRanges=ranges.map(r=>[...r]);
      clean.audioRevision=p.audioRevision===undefined?'':p.audioRevision;
      if(typeof clean.audioRevision!=='string'||!/^[-a-zA-Z0-9_]{0,60}$/.test(clean.audioRevision))throw new Error('音频版本不合法');
      if(p.completedAt!==null) {
        if(typeof p.completedAt!=='string' || p.completedAt.length>80 || Number.isNaN(Date.parse(p.completedAt)) || !clean.read) throw new Error('完成记录不完整');
        const past=p.completion===undefined||p.completion===null?{mode:clean.mode,answers:clean.answers,context:clean.listenContext}:p.completion;
        if(!past||!['both','reading'].includes(past.mode)||!validAnswers(past.answers)||!requiredAnswers(past.answers,past.mode)||!CONTEXTS.includes(past.context)|| (past.mode==='both'&&!clean.heard)) throw new Error('完成范围不完整');
        if((p.completion===undefined||p.completion===null)&&!clean.checked) throw new Error('完成记录未复盘');
        clean.completion={mode:past.mode,answers:[...past.answers],context:past.context};
        clean.completedAt=p.completedAt;
      } else if(p.completion!==undefined&&p.completion!==null) throw new Error('完成记录缺少日期');
      s.progress[id]=clean;
    }
    if(!Array.isArray(value.reviews) || value.reviews.length>1000) throw new Error('复习记录不合法');
    s.reviews=value.reviews.map(r=>{
      if(!r || !idPattern.test(r.lessonId) || !Number.isInteger(r.phraseIndex)||r.phraseIndex<0||r.phraseIndex>4||!validDate(r.due)||!Number.isInteger(r.seen)||r.seen<0||r.seen>100000) throw new Error('复习条目不合法');
      const streak=r.streak===undefined?0:r.streak;
      if(!Number.isInteger(streak)||streak<0||streak>5) throw new Error('复习间隔标记不合法');
      return {key:r.lessonId+'_'+r.phraseIndex,lessonId:r.lessonId,phraseIndex:r.phraseIndex,due:r.due,seen:r.seen,streak};
    });
    if(new Set(s.reviews.map(r=>r.key)).size!==s.reviews.length) throw new Error('复习条目重复');
    const words=value.vocabulary===undefined?[]:value.vocabulary;
    if(!Array.isArray(words)||words.length>3000)throw new Error('生词库不合法');
    s.vocabulary=words.map(w=>{
      if(!w||!idPattern.test(w.id)||typeof w.term!=='string'||!w.term.trim()||w.term.length>80||typeof w.context!=='string'||w.context.length>1500||typeof w.meaning!=='string'||w.meaning.length>500||typeof w.lessonId!=='string'||!idPattern.test(w.lessonId))throw new Error('生词记录不合法');
      const streak=Number.isInteger(w.streak)?Math.min(5,Math.max(0,w.streak)):0,seen=Number.isInteger(w.seen)?Math.min(100000,Math.max(0,w.seen)):0;
      return {id:w.id,term:w.term.trim(),context:w.context,meaning:w.meaning,lessonId:w.lessonId,due:validDate(w.due)?w.due:day(),seen,streak};
    });
    if(new Set(s.vocabulary.map(w=>w.id)).size!==s.vocabulary.length)throw new Error('生词标识重复');
    if(!Array.isArray(value.journals) || value.journals.length>1000) throw new Error('使用记录不合法');
    s.journals=value.journals.map(j=>{
      if(!j || !idPattern.test(j.id) || !validDate(j.date) || !Object.hasOwn(THEMES,j.scenario) || !Number.isInteger(j.rating) || j.rating<1 || j.rating>5 || typeof j.note!=='string' || j.note.length>280) throw new Error('使用条目不合法');
      return {id:j.id,date:j.date,scenario:j.scenario,rating:j.rating,note:j.note};
    });
    if(new Set(s.journals.map(j=>j.id)).size!==s.journals.length) throw new Error('使用条目标识重复');
    if(!value.drafts || typeof value.drafts!=='object' || Array.isArray(value.drafts) || Object.keys(value.drafts).length>300) throw new Error('草稿不合法');
    for(const [id,text] of Object.entries(value.drafts)) { if(!idPattern.test(id)||typeof text!=='string'||text.length>1800) throw new Error('草稿格式不合法'); s.drafts[id]=text; }
    const pref=value.preferences||{};
    if(![0.75,0.9,1,1.15,1.3].includes(pref.rate)) throw new Error('偏好设置不合法');
    const voice=typeof pref.voice==='string'?pref.voice.slice(0,500):'';
    const textSize=['small','standard','large'].includes(pref.textSize)?pref.textSize:'standard';
    const voicePack=['a','b'].includes(pref.voicePack)?pref.voicePack:'a';
    const volume=typeof pref.volume==='number'&&Number.isFinite(pref.volume)?Math.min(1,Math.max(0,pref.volume)):0.9;
    const theme=['auto','light','dark'].includes(pref.theme)?pref.theme:'auto';
    s.preferences={rate:pref.rate,voice,textSize,voicePack,volume,autoNext:pref.autoNext===true,theme};
    if(typeof value.lastLesson==='string' && idPattern.test(value.lastLesson)) s.lastLesson=value.lastLesson;
    return s;
  }
  function score(lesson,answers) { const qs=[...lesson.listenQuestions,...lesson.readingQuestions]; return qs.reduce((n,q,i)=>n+(answers[i]===q.answer?1:0),0); }
  function scoreForMode(lesson,answers,mode='both') { return mode==='reading'?lesson.readingQuestions.reduce((n,q,i)=>n+(answers[i+2]===q.answer?1:0),0):score(lesson,answers); }
  function mergeRanges(ranges,start,end) {
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start) return ranges.map(r=>[...r]);
    const sorted=[...ranges.map(r=>[...r]),[start,end]].sort((a,b)=>a[0]-b[0]),merged=[];
    for(const r of sorted) { const last=merged.at(-1);if(last&&r[0]<=last[1]+0.2)last[1]=Math.max(last[1],r[1]);else merged.push(r); }
    return merged.length<=64?merged:merged.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])).slice(0,64).sort((a,b)=>a[0]-b[0]);
  }
  function coveredDuration(ranges) { return ranges.reduce((n,r)=>n+Math.max(0,r[1]-r[0]),0); }
  function fullyHeard(ranges,duration) { return Number.isFinite(duration)&&duration>0&&ranges.length>0&&ranges[0][0]<=0.25&&ranges.at(-1)[1]>=duration-0.4&&coveredDuration(ranges)>=duration-0.75; }
  function scheduleReview(r,known,today=day()) {
    const streak=known?Math.min(5,(r.streak||0)+1):0,interval=known?[3,7,14,30,60][streak-1]:1;
    return {...r,seen:Math.min(100000,r.seen+1),streak,due:addDays(today,interval)};
  }
  function readyToFinish(p) { return p.read&&p.readingChecked&&p.checked&&requiredAnswers(p.answers,p.mode)&&(p.mode==='reading'||p.heard&&p.listenChecked); }
  function syncChecked(p) { p.checked=p.readingChecked&&(p.mode==='reading'||p.listenChecked)&&requiredAnswers(p.answers,p.mode); }
  const core=Object.freeze({esc,day,addDays,validDate,lessonValid,stateValid,newState,newProgress,score,scoreForMode,mergeRanges,coveredDuration,fullyHeard,scheduleReview,readyToFinish});
  if(typeof module!=='undefined' && module.exports) module.exports=core;
  if(typeof document==='undefined') return;
  window.UnfoldCore=core;

  let state=newState(), lessons=[], page='home', lessonId='L01', stage=0;
  let health={configured:false,detail:'正在检查连接…',host:'',model:'',csrf_token:''}, liveUsed=false, offlineText=false;
  let storageBlocked=false, storageWarning='', originalRaw=null, lastStoredRaw=null, voices=[], transcript=false, reviewRevealed=new Set();
  let speechPlaying=false,speechPaused=false,utterance=null,bundledPlayer=null,audioTimer=null,customAudio=null;
  let audioId='',audioSource='',playerRanges=[],lastAudioTime=null,lastAudioWall=0,playerError='',playerSeeking=false,lastMediaSave=0;
  let recorder=null,recordStream=null,recordChunks=[],recordURL='',recordLesson='',recordStarted=0,recordTick=null,recordTimeout=null,recordPending=false,recordRequest=0;
  let pendingAI=null,aiBusy=false,aiAbort=null,aiRequest=0,healthRequest=0,toastTimer=null,searchTerm='',filterLevel='all',filterTheme='all';
  let reviewTab='due',reviewKey='',reviewDrafts={},undoReview=null,modalReturnSelector='',journalEditing=null;
  let pendingImport=null,pendingDestructiveRaw=null;
  let account=null,accountCloud=false,syncRevision=0,syncBlocked=false,syncBusy=false,syncTimer=null,syncAgain=false,syncMessage='',remoteSnapshot=null,selectedWord='';
  let dialogueHistory=[],dialogueLesson='';
  const app=document.getElementById('app'), modal=document.getElementById('modal');
  const iconPaths={home:'M3 10l7-7 7 7M5 9v8h10V9M8 17v-5h4v5',books:'M4 3h4v14H4zM10 3h4v14h-4zM16 4l3 1-3 12-3-1',review:'M4 6a7 7 0 1 1-1 7M4 2v5h5M10 6v4l3 2',journal:'M5 3h10a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M7 7h6M7 11h6',settings:'M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8',arrow:'M4 10h12M11 5l5 5-5 5',back:'M16 10H4M9 5l-5 5 5 5',clock:'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16M10 5v5l3 2',headphones:'M3 11V9a7 7 0 0 1 14 0v2M3 10h3v7H3zM14 10h3v7h-3z',read:'M10 5C7 3 4 3 2 4v12c3-1 5-1 8 1 3-2 5-2 8-1V4c-2-1-5-1-8 1v12',mic:'M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4M4 9v1a6 6 0 0 0 12 0V9M10 16v3M7 19h6',write:'M4 13l9-9 3 3-9 9-4 1 1-4M12 5l3 3M3 18h14',check:'M4 10l4 4 8-8',lock:'M5 9h10v8H5zM7 9V6a3 3 0 0 1 6 0v3',play:'M7 4l9 6-9 6z',pause:'M6 4v12M14 4v12',stop:'M5 5h10v10H5z',search:'M8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 12l5 5',close:'M5 5l10 10M5 15L15 5',plus:'M10 4v12M4 10h12',download:'M10 3v10M6 9l4 4 4-4M3 15v3h14v-3',spark:'M10 2l2 5 5 3-5 2-2 6-2-6-5-2 5-3z',flag:'M4 18V3M4 3h10l-2 4 2 4H4'};
  function icon(name) { return `<svg class="icon" aria-hidden="true" viewBox="0 0 20 20"><path d="${iconPaths[name]||iconPaths.arrow}"/></svg>`; }
  function button(action,label,cls='',extra='') { return `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`; }
  // The size control cycles three ways, so its label has to name the next step.
  const TEXT_SIZES={small:['较小','标准字号'],standard:['标准','大字号'],large:['较大','较小字号']};
  function textSizeButton(){const info=TEXT_SIZES[state.preferences.textSize]||TEXT_SIZES.standard;return button('text-size',info[1],'ghost small',`aria-label="字号，当前${info[0]}，点击切换"`);}
  function getLesson(id=lessonId) { return [...lessons,...state.generated].find(l=>l.id===id); }
  function progress(id=lessonId,create=false) { if(!state.progress[id] && create) state.progress[id]=newProgress(); return state.progress[id]||newProgress(); }
  function storageNotice() {
    return storageWarning?`<div id="storage-warning" class="note warning" role="status"><p>${esc(storageWarning)}</p><div class="settings-actions">${button('export','导出当前副本','small')}${button('reload-storage','载入最新记录','small')}${originalRaw?button('export-raw','导出原始记录','small'):''}</div></div>`:'';
  }
  function paintStorageWarning() {
    if(!storageWarning||document.getElementById('storage-warning'))return;
    document.getElementById('main')?.insertAdjacentHTML('afterbegin',storageNotice());
  }
  function save() {
    if(storageBlocked) return false;
    try {
      const current=localStorage.getItem(KEY);
      if(current!==lastStoredRaw) {
        storageBlocked=true;originalRaw=current;
        storageWarning='另一个页面更新了学习记录，已暂停覆盖。先导出当前副本，再载入最新记录。';
        paintStorageWarning();toast(storageWarning);return false;
      }
      const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);lastStoredRaw=raw;
      if(account){try{localStorage.setItem(KEY+'.sync',JSON.stringify({revision:syncRevision,dirty:true}));}catch{}scheduleSync();}
      return true;
    } catch {
      storageBlocked=true;storageWarning='浏览器无法保存。当前内容仅留在本页，请导出备份。';paintStorageWarning();toast(storageWarning);return false;
    }
  }
  function readStorage() {
    try { originalRaw=localStorage.getItem(KEY);lastStoredRaw=originalRaw;if(originalRaw)state=stateValid(JSON.parse(originalRaw)); }
    catch { storageBlocked=true;storageWarning='旧记录无法读取，已暂停覆盖。请先导出原始记录，再决定是否重置。'; }
  }
  async function accountRequest(path,payload) {
    const response=await fetch(path,payload===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Unfold-Token':health.csrf_token},body:JSON.stringify(payload)});
    const body=await response.json();if(!response.ok){const error=new Error(body.error||'请求失败');error.status=response.status;throw error;}return body;
  }
  function syncStatus(message){syncMessage=message;const el=document.getElementById('sync-status');if(el)el.textContent=message;}
  function scheduleSync(){if(!account||syncBlocked)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(),1200);}
  async function syncNow(){
    if(!account||syncBlocked||storageBlocked)return;
    if(syncBusy){syncAgain=true;return;}
    syncBusy=true;syncAgain=false;const snapshot=JSON.stringify(state),revision=syncRevision,uid=account.id;
    syncStatus('正在同步账号记录…');
    try{
      const result=await accountRequest('/api/sync',{revision,state:JSON.parse(snapshot)});
      if(!account||account.id!==uid)return;
      syncRevision=result.revision;
      const dirty=JSON.stringify(state)!==snapshot;
      localStorage.setItem(KEY+'.sync',JSON.stringify({revision:syncRevision,dirty}));
      syncStatus(dirty?'还有更改等待同步':'已保存到账号服务器');
      if(dirty||syncAgain)scheduleSync();
    }catch(error){
      if(!account||account.id!==uid)return;
      if(error.status===409){syncBlocked=true;syncStatus('另一设备更新了记录，已暂停同步。请到设置处理冲突。');if(page==='settings')render();}
      else syncStatus('同步失败：'+error.message+'。本浏览器副本仍保留，可手动重试。');
    }finally{syncBusy=false;}
  }
  async function activateAccount(user){
    clearTimeout(syncTimer);syncBlocked=false;remoteSnapshot=null;account=user;KEY=GUEST_KEY+'.account.'+user.id;storageBlocked=false;storageWarning='';originalRaw=null;lastStoredRaw=null;state=newState();readStorage();
    let meta={revision:0,dirty:false};try{meta=JSON.parse(localStorage.getItem(KEY+'.sync')||'null')||meta;}catch{}
    if(storageBlocked){syncBlocked=true;syncStatus('账号本机副本无法读取，已暂停同步；请先导出原始记录。');return;}
    const local=lastStoredRaw,remote=await accountRequest('/api/sync');
    syncRevision=Number.isInteger(meta.revision)?meta.revision:0;
    if(remote.state){
      const clean=stateValid(remote.state);
      if(local&&meta.dirty&&syncRevision!==remote.revision){syncBlocked=true;remoteSnapshot=remote;syncStatus('账号和本机都有未合并更改；请在设置处理冲突。');return;}
      if(!local||!meta.dirty){state=clean;const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);lastStoredRaw=raw;syncRevision=remote.revision;localStorage.setItem(KEY+'.sync',JSON.stringify({revision:syncRevision,dirty:false}));syncStatus('已载入账号记录');}
      else {syncStatus('本机有待同步更改');scheduleSync();}
    }else{
      syncRevision=0;
      if(!local){const guest=localStorage.getItem(GUEST_KEY);if(guest){state=stateValid(JSON.parse(guest));const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);lastStoredRaw=raw;}}
      localStorage.setItem(KEY+'.sync',JSON.stringify({revision:0,dirty:true}));syncStatus('正在把本机记录保存到新账号；访客副本保留。');scheduleSync();
    }
  }
  async function refreshAccount(){
    try{const info=await accountRequest('/api/account/status');accountCloud=info.cloud===true;if(info.csrf_token)health.csrf_token=info.csrf_token;if(info.user)await activateAccount(info.user);else{account=null;syncStatus('访客记录仅在本浏览器。');}}
    catch{syncStatus('账号服务器不可用，本地记录仍保留。');}
  }
  function accountForm(register=false){
    openModal(register?'创建账号':'登录账号',`<form id="account-form" data-register="${register}"><p class="modal-copy">${register?'新账号会复制当前访客记录；原访客副本不删除。':'登录后加载该账号记录；访客记录不会删除。'}账号仅属于当前服务器。密码至少10位。</p><div class="field"><label for="account-name">账号</label><input id="account-name" name="username" required minlength="3" maxlength="40" autocomplete="username" pattern="[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*"></div><div class="field"><label for="account-password">密码</label><input id="account-password" name="password" type="password" required minlength="10" maxlength="128" autocomplete="${register?'new-password':'current-password'}"></div><p class="helper-copy">${accountCloud?'请妥善保存密码，当前版本没有密码找回。':'本机服务器账号只能在本机使用；跨设备需部署有持久存储的安全服务器。'}</p><button class="btn primary" type="submit">${register?'创建并登录':'登录'}</button></form>`);
  }
  async function accountLogin(form){
    const submit=form.querySelector('[type=submit]');submit.disabled=true;const d=new FormData(form);
    try{const result=await accountRequest(form.dataset.register==='true'?'/api/account/register':'/api/account/login',{username:d.get('username'),password:d.get('password')});await activateAccount(result.user);await checkHealth();closeModal();lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;navigate('settings');toast('已登录。'+(accountCloud?'':' 当前账号数据存储在本机服务端。'));}
    catch(error){submit.disabled=false;toast(error.message);}
  }
  async function accountLogout(){
    if(syncBusy){toast('同步进行中，请稍候再退出。');return;}
    if(account&&!syncBlocked){clearTimeout(syncTimer);await syncNow();let m={};try{m=JSON.parse(localStorage.getItem(KEY+'.sync')||'{}');}catch{}if(m.dirty){toast('还有未同步更改，请先重试或导出备份。');return;}}
    await accountRequest('/api/account/logout',{});clearTimeout(syncTimer);account=null;KEY=GUEST_KEY;state=newState();storageBlocked=false;storageWarning='';readStorage();await checkHealth();closeModal();lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;navigate('settings');toast('已退出账号，访客记录保持原样。');
  }
  function accountConflict(){
    openModal('处理账号同步冲突',`<p class="modal-copy">本机与账号服务器都有更改，不能自动合并。先导出本机副本，再选择载入账号版本或用本机版本覆盖账号版本。期间服务器若再次更新，仍会阻止覆盖。</p><div class="settings-actions">${button('export','导出本机副本','')}${button('sync-load','载入账号版本','')}${button('sync-overwrite','用本机版本覆盖账号','danger')}</div>`);
  }
  async function resolveConflict(useLocal){
    const remote=await accountRequest('/api/sync');
    if(useLocal){syncRevision=remote.revision;syncBlocked=false;localStorage.setItem(KEY+'.sync',JSON.stringify({revision:syncRevision,dirty:true}));closeModal();await syncNow();render();return;}
    if(!remote.state)throw new Error('账号尚无记录，未覆盖本机。');
    const clean=stateValid(remote.state);const raw=JSON.stringify(clean);localStorage.setItem(KEY,raw);clearVolatileMedia();state=clean;lastStoredRaw=raw;syncRevision=remote.revision;localStorage.setItem(KEY+'.sync',JSON.stringify({revision:syncRevision,dirty:false}));syncBlocked=false;syncStatus('已载入账号版本；如需恢复，请导入事先导出的副本。');closeModal();lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;render();
  }
  function toast(message) { const el=document.getElementById('toast'); el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800); }
  function dueReviews() { return state.reviews.filter(r=>r.due<=day() && getLesson(r.lessonId)?.phrases[r.phraseIndex]); }
  function dueWords() { return state.vocabulary.filter(w=>(w.due||day())<=day()); }
  // Saved phrases and saved words are recalled the same way, so they share one
  // queue and one sitting instead of two separate places to check.
  function reviewQueue() {
    const q=[];
    for(const r of state.reviews){const l=getLesson(r.lessonId),ph=l?.phrases[r.phraseIndex];if(ph)q.push({kind:'phrase',key:r.key,due:r.due,lesson:l,phrase:ph,ref:r});}
    for(const w of state.vocabulary)q.push({kind:'word',key:'word:'+w.id,due:w.due||day(),lesson:getLesson(w.lessonId),word:w,ref:w});
    return q;
  }
  function dueQueue() { return reviewQueue().filter(x=>x.due<=day()).sort((a,b)=>a.due.localeCompare(b.due)||a.key.localeCompare(b.key)); }
  function dueCount() { return dueQueue().length; }
  function queueItem(key) { return reviewQueue().find(x=>x.key===key)||dueQueue()[0]||null; }
  function maskedContext(w){
    const ctx=String(w.context||'').trim();
    if(!ctx)return '';
    const term=String(w.term||'').trim();
    if(!term)return esc(ctx);
    let re=null;
    try{re=new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');}catch{re=null;}
    return esc(re?ctx.replace(re,m=>'_'.repeat(Math.max(3,m.length))):ctx);
  }
  function weekLogs() { const now=new Date();now.setDate(now.getDate()-((now.getDay()+6)%7)); const first=day(now);return state.journals.filter(j=>j.date>=first&&j.date<=day()); }
  function doneLessons() { return Object.values(state.progress).filter(p=>p.completedAt).length; }
  function hasPractice(p,id) { return !!(p.heard||p.read||p.checked||p.replays||p.stage||state.drafts[id]); }
  function chooseToday() {
    const all=[...lessons,...state.generated],last=getLesson(state.lastLesson);
    if(last&&!progress(last.id).completedAt&&hasPractice(progress(last.id),last.id))return last;
    return all.find(l=>!progress(l.id).completedAt)||last||all[0];
  }
  function navigate(next,id=null,nextStage=null,updateRoute=true) {
    // Keep the same lesson's media alive across views; a new lesson replaces it.
    if(id&&getLesson(id)&&id!==lessonId){stopSound();resetPlayer();}
    stopRecording();
    page=next;
    if(id&&getLesson(id)) {
      lessonId=id;state.lastLesson=id;
      const p=progress(id,true);stage=Number.isInteger(nextStage)?Math.max(0,Math.min(2,nextStage)):(p.completedAt?(p.mode==='reading'?1:0):p.stage);
      p.stage=stage;transcript=false;
    } else if(next==='lesson') { stage=Number.isInteger(nextStage)?Math.max(0,Math.min(2,nextStage)):stage;progress(lessonId,true).stage=stage; }
    if(page==='lesson'&&stage===1&&progress().firstAnswers.slice(0,2).every(x=>x===null))progress(lessonId,true).supportUsed=true;
    save();
    if(updateRoute&&window.history&&window.location) {
      const hash=page==='lesson'?`#lesson/${lessonId}/${stage}`:`#${page}`;
      if(window.location.hash!==hash)window.history.pushState(null,'',hash);
    }
    render({focusMain:true});window.scrollTo({top:0,behavior:'auto'});
  }
  function fromRoute() {
    if(!window.location)return;
    let parts;
    try {parts=decodeURIComponent(window.location.hash.slice(1)).split('/');}catch{navigate('home',null,null,false);return;}
    const next=parts[0]||'home';
    if(next==='lesson') {
      if(!getLesson(parts[1])){navigate('library',null,null,false);toast('这份材料已不在当前记录中。');return;}
      const n=Number(parts[2]);navigate('lesson',parts[1],Number.isInteger(n)?n:0,false);
    } else navigate(['home','library','review','journal','settings'].includes(next)?next:'home',null,null,false);
  }
  function shell(content) {
    const nav=[['home','home','今日练习','今天'],['library','books','场景库','场景'],['review','review','复习','复习'],['journal','journal','学习记录','记录'],['settings','settings','设置','设置']];
    const active=page==='lesson'?'home':page;
    const date=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
    const names={home:'今日练习',library:'场景库',lesson:'听读练习',review:'复习',journal:'学习记录',settings:'设置'};
    return `<div class="shell"><aside class="sidebar"><button type="button" class="brand" data-action="home" aria-label="Unfold，回到今日练习"><span class="brand-mark">U</span><span class="brand-name">Unfold</span></button><nav class="nav" aria-label="主要导航">${nav.map(([p,i,t,m])=>`<button type="button" class="nav-button ${active===p?'active':''}" data-action="${p}" ${active===p?'aria-current="page"':''}>${icon(i)}<span class="nav-desktop">${t}</span><span class="nav-mobile">${m}</span>${p==='review'&&dueCount()?`<span class="nav-count" aria-label="${dueCount()}条到期">${dueCount()}</span>`:''}</button>`).join('')}</nav><p class="sidebar-local">${icon('lock')}${account?'账号：'+esc(account.username):'访客学习空间'}<br><span>${account?(accountCloud?'账号同步已启用':'本机账号'):'记录保存在浏览器'}</span></p></aside><div class="workspace"><header class="topbar"><span class="topbar-location"><strong class="mobile-wordmark">Unfold</strong><span class="desktop-location">${names[page]}</span></span><div class="topbar-actions"><span class="topbar-date">${esc(date)}</span>${button('help','练习说明','ghost')}</div></header><main id="main" tabindex="-1" class="${page==='lesson'?'lesson-workspace ':''}${state.preferences.textSize==='standard'?'':state.preferences.textSize+'-text'}">${storageNotice()}${content}</main></div></div>`;
  }
  function heading(title,desc='',action='') { return `<div class="page-heading"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div>${action}</div>`; }
  function lessonCard(l,headingLevel=3) {
    const p=progress(l.id),done=!!p.completedAt,started=hasPractice(p,l.id),tag=headingLevel===2?'h2':'h3';
    return `<article class="lesson-card"><div class="lesson-meta"><span>${esc(LEVELS[l.level])} · ${esc(THEMES[l.theme])}</span>${l.generated?'<span class="tag">AI材料</span>':''}</div><${tag} lang="en">${esc(l.title)}</${tag}><p>${esc(l.subtitle)}</p><div class="lesson-card-foot"><span class="lesson-state">${done?`${icon('check')}已练习`:started?'进行中':''}</span>${button('open-lesson',(done?'再练':started?'继续':'开始')+' '+icon('arrow'),'small',`data-id="${esc(l.id)}" aria-label="${done?'再练':started?'继续':'开始'}：${esc(l.title)}"`)}</div></article>`;
  }
  function homePage() {
    const l=chooseToday(),p=progress(l.id),continuing=!p.completedAt&&hasPractice(p,l.id),due=dueQueue();
    const next=[...lessons,...state.generated].filter(x=>x.id!==l.id&&!progress(x.id).completedAt).slice(0,3);
    const stepNames=p.mode==='reading'?[[2,'读懂语境'],[3,'试着用']]:[[1,'听出主旨'],[2,'读懂语境'],[3,'试着用']];
    return `${heading('今天练什么？','从一个场景开始，建议20分钟。')}<div class="home-grid"><section class="today-session"><div class="session-label">${continuing?`<span>上次停在「${['听','读','用'][p.stage]}」</span>`:''}<span class="tag">${esc(LEVELS[l.level])} · ${esc(THEMES[l.theme])}</span></div><h2 lang="en">${esc(l.title)}</h2><p class="session-desc">${esc(l.subtitle)}</p><ol class="mini-steps">${stepNames.map(([i,n])=>`<li><span>${i}</span>${n}</li>`).join('')}</ol><div class="session-action">${button('open-lesson',(continuing?'继续练习':p.completedAt?'再练一遍':'开始练习')+' '+icon('arrow'),'primary',`data-id="${l.id}"`)}<span>${p.mode==='reading'?'本次只练阅读':'随时暂停，不用按顺序解锁'}</span></div></section><aside class="home-review"><h2>${due.length?'把学过的意思想起来':'给学过的表达留个位置'}</h2><p>${due.length?`${due.length} 条表达或生词到了复习时间。先试着想起来，再翻开提示。`:'在练习最后收藏想用的表达，下次从情境中回想。'}</p>${button(due.length?'review':'library',due.length?'开始复习 '+icon('arrow'):'看看其他场景 '+icon('arrow'),'')}<div class="home-summary"><span>${doneLessons()} 个练习已完成</span><span>听读为主 · 复述与短写选做</span></div></aside></div><div class="section-heading"><h2>${next.length?'换个场景也可以':'继续拓展'}</h2>${button('library','全部场景 '+icon('arrow'),'ghost')}</div><div class="lesson-grid">${(next.length?next:lessons.filter(x=>x.id!==l.id).slice(0,3)).map(l=>lessonCard(l)).join('')}</div>`;
  }
  function libraryPage() {
    const all=[...lessons,...state.generated],term=searchTerm.toLowerCase().trim();
    const visible=all.filter(l=>(filterLevel==='all'||l.level===Number(filterLevel))&&(filterTheme==='all'||l.theme===filterTheme)&&(!term||(l.title+' '+l.subtitle+' '+THEMES[l.theme]+' '+l.readingTitle).toLowerCase().includes(term)));
    const filtered=!!(term||filterLevel!=='all'||filterTheme!=='all');
    return `${heading('选一个场景','可直接选择适合自己的难度。',health.configured?button('generate','AI拓展 '+icon('plus'),''): '')}<div class="toolbar"><label class="search"><span class="visually-hidden">搜索场景</span>${icon('search')}<input id="lesson-search" type="text" maxlength="100" placeholder="搜索标题或主题" value="${esc(searchTerm)}"></label><label class="filter-field"><span>难度</span><select id="level-filter"><option value="all">全部</option>${Object.entries(LEVELS).map(([v,t])=>`<option value="${v}" ${filterLevel===v?'selected':''}>${t}</option>`).join('')}</select></label>${filtered?button('clear-filters','清除筛选','ghost'):''}</div><p class="result-count" role="status">${visible.length} 个场景${filtered?'符合筛选':''} · 难度指材料，不是语言等级</p><div class="lesson-grid">${visible.map(l=>lessonCard(l,2)).join('')}</div>${!visible.length?`<div class="empty"><h2>没找到这个场景</h2><p>换个关键词，或清除难度与主题筛选。</p>${button('clear-filters','显示全部场景','primary')}</div>`:''}<details class="help-disclosure" id="library-source"><summary>材料来源与拓展</summary><p>${lessons.length} 份原创虚构材料，${state.generated.length} 份AI材料。AI材料有独立标记，生成后需核对内容和答案。</p>${!health.configured?button('settings','了解选配的AI拓展','ghost small'):''}</details>`;
  }
  function hintPanel(l,p) {
    return `<details class="help-disclosure hint-panel" id="hint-disclosure" ${p.hintLevel?'open':''}><summary>需要提示？</summary><div class="hint-content">${p.hintLevel>=1?`<section class="hint-stage"><h2>简单英文</h2><p lang="en">${esc(l.easy)}</p></section>`:''}${p.hintLevel>=2?`<section class="hint-stage"><h2>关键表达</h2><ul>${l.phrases.map(x=>`<li><strong lang="en">${esc(x.text)}</strong><p lang="en">${esc(x.meaning)}</p></li>`).join('')}</ul></section>`:''}${p.hintLevel>=3?`<section class="hint-stage"><h2>简短中文</h2><p>${esc(l.zh)}</p></section>`:''}<p class="helper-copy">${p.hintLevel?'提示用来帮助理解，不必强迫自己无辅助。':'先换一个英文入口，再按需看中文。'}</p>${p.hintLevel<3?button('hint',p.hintLevel===0?'看简单英文':p.hintLevel===1?'看关键表达':'看简短中文','') : button('hide-hints','收起提示，再试一次','')} ${health.configured?`<div class="ai-inline"><label for="explain-phrase">想进一步解释的表达</label><select id="explain-phrase">${l.phrases.map((x,i)=>`<option value="${i}">${esc(x.text)}</option>`).join('')}</select>${button('explain','请AI解释','small')}</div>`:''}</div></details>`;
  }
  function contextLabel(p) {
    return p.listenContext==='independent'?'首答前未打开原文或提示':p.listenContext==='supported'?'首答使用过原文、提示或阅读语境':p.listenContext==='not-listened'?'首答前尚未听完音频':'旧记录未记录首答辅助情况';
  }
  function questionSet(l,p,group) {
    const listening=group==='listen',offset=listening?0:2,qs=listening?l.listenQuestions:l.readingQuestions,checked=listening?p.listenChecked:p.readingChecked;
    const correct=qs.reduce((n,q,i)=>n+(p.answers[offset+i]===q.answer?1:0),0);
    return `<section class="question-set" aria-labelledby="${group}-heading"><div class="section-heading"><h2 id="${group}-heading">${listening?'听懂了什么？':'读懂了什么？'}</h2><span class="helper-copy">两道理解练习</span></div>${qs.map((q,n)=>{const i=offset+n;return `<fieldset class="question"><legend lang="en">${n+1}. ${esc(q.question)}</legend><div class="options">${q.options.map((o,j)=>`<label class="option ${checked?(j===q.answer?'correct':p.answers[i]===j?'wrong':''):''}"><input type="radio" id="answer-${i}-${j}" name="answer-${i}" value="${j}" data-question="${i}" ${p.answers[i]===j?'checked':''} ${checked?'disabled':''}><span lang="en">${esc(o)}</span>${checked&&j===q.answer?'<span class="answer-label">正确答案</span>':checked&&p.answers[i]===j?'<span class="answer-label">你的选择</span>':''}</label>`).join('')}</div>${checked?`<p class="question-feedback"><strong>${p.answers[i]===q.answer?'理解正确':'再看这个理由'}</strong><span lang="en">${esc(q.explanation)}</span></p>`:''}</fieldset>`;}).join('')}${checked?`<div id="${group}-feedback" class="group-result" tabindex="-1" role="status"><strong>${correct} / 2</strong><span>本组题目正确数${listening?' · '+contextLabel(p):''}。可带着理由再练，不要求满分。</span></div>`:''}<div class="lesson-bottom">${checked?button('retry-group','重新答这两题','ghost',`data-group="${group}"`):''}${button(checked?'next-stage':'check-group',checked?(listening?'继续阅读':'试着用 '+icon('arrow')):(listening?'检查意思':'读完了，检查意思'),'primary',`data-group="${group}"`)}</div></section>`;
  }
  function listeningPage(l,p) {
    const hasCustom=customAudio?.lessonId===l.id,bundled=hasBundledAudio(l);
    return `<section class="audio-panel" aria-labelledby="listen-heading"><div class="section-heading"><h2 id="listen-heading">先听主旨</h2><span class="tag neutral">${hasCustom?'本地音频':bundled?'AI场景对话 · 非真人':'合成朗读 · 非真人'}</span></div><p class="player-caption">先抓问题、原因和下一步。切到其他标签会继续播放；展开原文可逐句重听。</p><div class="player-controls"><button type="button" class="btn primary play-button" data-action="play" id="play-button">${icon('play')}<span>播放</span></button>${button('replay','从头重听','',`id="replay-button"`)}<label class="rate-control"><span class="visually-hidden">播放速度</span><select id="play-rate">${[0.75,0.9,1,1.15].map(r=>`<option value="${r}" ${state.preferences.rate===r?'selected':''}>${r}×</option>`).join('')}</select></label></div><div class="seek-track"><label class="visually-hidden" for="audio-seek">音频进度，可拖动回听</label><input id="audio-seek" type="range" min="0" max="100" step="0.1" value="0" disabled><div class="time-labels"><span id="audio-elapsed">0:00</span><span id="audio-duration">${bundled||hasCustom?'加载时长…':'合成朗读不支持拖动'}</span></div></div><div class="inline-status" id="listen-status" role="status">${icon(p.heard?'check':'headphones')}<span>${p.heard?'已听完本课音频':'尚未听完整段音频'}</span></div><div id="audio-error"></div><div id="shadow-status" class="shadow-status" role="status" hidden></div><div class="audio-secondary">${button('transcript',transcript?'收起英文原文':'看英文原文','ghost','aria-controls="transcript-text" aria-expanded="'+transcript+'"')}${sentenceLoopButton()}${shadowButton()}${button('reading-only','现在只练阅读','ghost')}</div>${hasCustom?`<p class="local-audio-name">${esc(customAudio.name)}</p>`:''}</section>${transcriptBlock(l)}${hintPanel(l,p)}<details class="help-disclosure" id="audio-source"><summary>音频来源与更多选择</summary><p>${hasCustom?'这是你选择的本地音频，请核对它与原文一致。文件不上传，刷新后需重新选择。':bundled?'Kokoro神经声线在本机生成，按角色使用不同声线，不朗读角色名。仍为AI合成，不是真人录音。':'本课尚无内置神经语音。可选择对应本地音频；浏览器朗读只作为手动备选，系统联网声线可能需要网络。'} 切换标签和本产品内的页面可持续播放；关闭或刷新播放页会结束。只有实际听过的区间才计入完整播放，拖到末尾不算听完。</p>${button('import-audio','选择对应的本地音频','small')}${hasCustom?button('remove-audio','还原默认音频','ghost small'):''}</details><input type="file" id="audio-file" accept="audio/*" hidden>${questionSet(l,p,'listen')}`;
  }
  function readingPage(l,p) {
    return `${p.mode==='reading'?`<div class="mode-note"><span>本次只练阅读，不记录听力完成。</span>${button('both-mode','改回听读','ghost')}</div>`:''}<article class="reading-card"><div class="reading-heading"><h2 lang="en">${esc(l.readingTitle)}</h2>${textSizeButton()}</div><div class="reading-text" lang="en">${l.reading.split(/\n\n+/).map(t=>`<p>${esc(t)}</p>`).join('')}</div><div class="reading-word-action">${button('add-word','收藏生词','small')}<span class="helper-copy">先选中单词或短语，也可手动输入。</span></div></article>${hintPanel(l,p)}${questionSet(l,p,'reading')}`;
  }
  function transferPage(l,p) {
    const saved=i=>state.reviews.some(r=>r.key===l.id+'_'+i),ready=readyToFinish(p);
    const missing=!p.read||!p.readingChecked?1:!p.heard||!p.listenChecked?0:1;
    const completion=p.completedAt?`<div class="completion-summary" role="status">${icon('check')}<span>${storageBlocked?'本页练习尚未写入浏览器，请导出副本。':`已保存${p.completion?.mode==='reading'?'阅读':'听读'}练习记录${!ready?'；重练不覆盖首次完成记录':''}。`}</span></div>`:'';
    const finishAction=!ready?button('stage',missing===0?'返回听力补齐':'返回阅读补齐','primary',`data-index="${missing}"`):storageBlocked?button('export','导出当前副本','primary'):p.completedAt?button('library','选下一个场景 '+icon('arrow'),'primary'):button('finish','保存本次练习','primary');
    const finishCopy=p.completedAt&&ready&&!storageBlocked?'首次完成记录保留；重练和草稿自动保存。':ready?(p.mode==='reading'?'将保存阅读与两题复盘，不计听力完成。':'已听完、确认阅读并检查四题。'):p.mode==='reading'?'先完成阅读和两题复盘。':'还需补齐听力或阅读复盘。';
    return `<section class="transfer-intro"><h2>让意思变成自己的话</h2><p>收藏想用的表达。再换个情境，试着复述或短写。</p></section><section aria-labelledby="phrase-heading"><div class="section-heading"><h2 id="phrase-heading">想留下的表达</h2></div><div class="phrase-list">${l.phrases.map((x,i)=>`<article class="phrase"><div><h3 lang="en">${esc(x.text)}</h3><p lang="en">${esc(x.cue)}</p></div>${button('save-phrase',saved(i)?icon('check')+' 已收藏':'收藏 '+icon('plus'),'small',`data-index="${i}" aria-pressed="${saved(i)}" aria-label="${saved(i)?'取消收藏':'收藏'}：${esc(x.text)}"`)}</article>`).join('')}</div>${undoReview?button('undo-review','撤销上次取消收藏','ghost small'):''}</section><section class="output-section"><div class="section-heading"><h2>试着表达</h2><span class="helper-copy">选做，不影响听读保存</span></div><div class="optional-grid"><details class="optional-card" id="speaking-panel" ${recorder?.state==='recording'||recordPending||recordURL&&recordLesson===l.id?'open':''}><summary>${icon('mic')}口头复述</summary><div class="optional-body"><p lang="en">${esc(l.speakingPrompt)}</p><p class="helper-copy">可以直接口述。录音只在本页回听，不上传或评分。</p>${button('record',recorder?.state==='recording'?'结束录音':'录音回听',recorder?.state==='recording'?'danger':'')}<div id="record-time" class="record-time">${recorder?.state==='recording'?'正在录音…':''}</div>${recordURL&&recordLesson===l.id?`<audio controls src="${esc(recordURL)}"></audio><p class="helper-copy">刷新后录音不保留。</p>`:''}<label class="self-check"><input type="checkbox" id="speaking-done" ${p.speakingDone?'checked':''}>我已用自己的话复述（自记）</label></div></details><details class="optional-card" id="writing-panel" ${state.drafts[l.id]?'open':''}><summary>${icon('write')}英语短写</summary><div class="optional-body"><p lang="en">${esc(l.writingPrompt)}</p><label for="writing-draft">英语草稿</label><textarea id="writing-draft" maxlength="1800" placeholder="用虚构细节，写清你想表达的意思。">${esc(state.drafts[l.id]||'')}</textarea><p class="draft-status" id="writing-save" role="status">${storageBlocked?'仅留本页，尚未保存':'自动保存在本地'}</p><p class="helper-copy">回读：意图、理由和下一步是否清楚？别照抄材料。</p>${health.configured?button('feedback','获取AI反馈','small'):''}<label class="self-check"><input type="checkbox" id="writing-done" ${p.writingDone?'checked':''}>我已回读并修改（自记）</label></div></details></div></section>${completion}<div class="lesson-bottom finish-row"><span class="helper-copy">${finishCopy}</span>${finishAction}${p.completedAt?button('home','回到今天','ghost'):''}</div>`;
  }
  function lessonPage() {
    const l=getLesson();if(!l)return `<div class="empty"><h1>材料已不在当前记录中</h1>${button('library','返回场景库','primary')}</div>`;
    const p=progress(),done=[p.mode==='both'&&p.heard&&p.listenChecked,p.read&&p.readingChecked,!!p.completedAt],names=['听','读','用'];
    const content=[listeningPage,readingPage,transferPage][stage](l,p)+(stage===2?`<section class="ai-practice"><h2>情境对话</h2><p>用英语回应场景中的人物，AI接续对话并给一条表达建议。文字对话不等于口语发音评分。</p>${button('dialogue','开始文字对话','small')}</section>`:'');
    return `<div class="lesson-top">${button('library',icon('back')+'场景库','ghost')}<span class="lesson-meta">${esc(LEVELS[l.level])} · ${esc(THEMES[l.theme])}${l.generated?' · AI材料，需核对':''}</span></div><h1 class="lesson-title" lang="en">${esc(l.title)}</h1><nav class="steps" aria-label="练习步骤">${names.map((n,i)=>`<button type="button" class="step ${stage===i?'active':''} ${done[i]?'done':''}" data-action="stage" data-index="${i}" ${stage===i?'aria-current="step"':''}><span class="step-number">${done[i]?icon('check'):i+1}</span><span>${n}${i===0&&p.mode==='reading'?'（略过）':''}</span></button>`).join('')}</nav><div class="lesson-content">${content}</div>`;
  }
  function reviewPage() {
    const due=dueQueue();
    const r=queueItem(reviewKey);
    const rows=state.reviews.filter(x=>getLesson(x.lessonId)?.phrases[x.phraseIndex]);
    const any=reviewQueue();
    let content='';
    if(reviewTab==='words') {
      content=state.vocabulary.length?`<div class="saved-list">${state.vocabulary.slice().reverse().map(w=>`<article class="saved-row"><div><h2 lang="en">${esc(w.term)}</h2>${w.meaning?`<p>${esc(w.meaning)}</p>`:''}${w.context?`<p lang="en">${esc(w.context)}</p>`:''}<p>${esc(getLesson(w.lessonId)?.title||'自定义语境')}</p></div><div class="row-actions">${button('review-now','复习','small',`data-key="word:${esc(w.id)}" aria-label="复习生词 ${esc(w.term)}"`)}${button('edit-word','编辑','small',`data-id="${esc(w.id)}"`)}${health.configured?button('word-ai','AI辨析','small',`data-id="${esc(w.id)}"`):''}${button('delete-word','删除','ghost small',`data-id="${esc(w.id)}"`)}</div></article>`).join('')}</div>`:`<div class="empty"><h2>生词库还是空的</h2><p>在阅读时选中单词或短语，点击「收藏生词」。也可以手动添加。</p>${button('add-word','添加生词','primary')}</div>`;
    } else if(reviewTab==='all') {
      content=rows.length?`<div class="saved-list">${rows.map(x=>{const l=getLesson(x.lessonId),ph=l.phrases[x.phraseIndex];return `<article class="saved-row"><div><h2 lang="en">${esc(ph.text)}</h2><p>${esc(l.title)} · ${x.due<=day()?'已到期':'下次 '+x.due}</p></div><div class="row-actions">${button('review-now','练一下','small',`data-key="${x.key}" aria-label="练习：${esc(ph.text)}"`)}${button('remove-review','移除','ghost small',`data-key="${x.key}" aria-label="移除：${esc(ph.text)}"`)}</div></article>`;}).join('')}</div>`:`<div class="empty"><h2>还没收藏表达</h2><p>练习最后，把想再次使用的表达加入复习。</p>${button('library','选择一个场景','primary')}</div>`;
    } else if(r&&r.kind==='word') {
      content=wordRecall(r,due);
    } else if(r&&r.kind==='phrase') {
      const l=r.lesson,ph=r.phrase,show=reviewRevealed.has(r.key);
      content=`<section class="recall-session"><p class="review-position">${due.length?'今天还有 '+due.length+' 条到期':'提前练一次'} · 来自 ${esc(l.title)}</p><h2 lang="en">${esc(ph.cue)}</h2><label for="recall-draft">先试一句英语，也可以直接口述</label><textarea id="recall-draft" maxlength="500" data-key="${r.key}" placeholder="不必一字不差，先把意思说出来。">${esc(reviewDrafts[r.key]||'')}</textarea>${show?`<div class="review-reveal"><h3 lang="en">${esc(ph.text)}</h3><p lang="en">${esc(ph.meaning)}</p><p class="helper-copy">意思对上了吗？再换个情境用一次，而不是照抄。</p><div class="review-actions">${button('review-again','还没想起','',`data-key="${r.key}"`)}${button('review-known','想起来了','primary',`data-key="${r.key}"`)}</div></div>`:button('reveal-review','看看表达','primary',`data-key="${r.key}"`)}<p class="helper-copy recall-local">自练句子只留本页，不上传或自动评分。</p></section>`;
    } else {
      content=`<div class="empty"><h2>${any.length?'今天没有到期内容':'还没收藏表达或生词'}</h2><p>${any.length?'可以提前练，也可以开始一个新场景。':'在练习最后收藏表达，或在阅读时选中生词收藏，下次从语境中回想。'}</p>${any.length?button('review-now','提前练一个','primary',`data-key="${any[0].key}"`):button('library','选择一个场景','primary')}</div>`;
    }
    return `${heading('复习与生词','把表达和生词放回语境中回想。',`${reviewTab==='words'?button('add-word','添加生词 '+icon('plus'),''):''}${button('export-csv','导出CSV '+icon('download'),'ghost small')}`)}<div class="tabs" aria-label="复习视图">${button('review-tab','到期 '+due.length,reviewTab==='due'?'tab active':'tab',`data-tab="due" aria-pressed="${reviewTab==='due'}"`)}${button('review-tab','表达 '+rows.length,reviewTab==='all'?'tab active':'tab',`data-tab="all" aria-pressed="${reviewTab==='all'}"`)}${button('review-tab','生词 '+state.vocabulary.length,reviewTab==='words'?'tab active':'tab',`data-tab="words" aria-pressed="${reviewTab==='words'}"`)}</div>${undoReview?`<div class="undo-row"><span>已移除一条表达</span>${button('undo-review','撤销移除','small')}</div>`:''}${content}${reviewTab!=='words'?`<details class="help-disclosure" id="review-rule"><summary>复习时间怎样安排？</summary><p>表达和生词用同一套规则。没想起：明天再练。连续想起：依次隔3、7、14、30、60天；忘记后回到起步间隔。这是基于自评的规则，不是经独立验证的自适应模型。</p></details>`:''}`;
  }
  function journalPage() {
    const logs=weekLogs(),history=Object.entries(state.progress).filter(([,p])=>p.completedAt).sort((a,b)=>b[1].completedAt.localeCompare(a[1].completedAt));
    return `${heading('学习记录','记下英语被用到的时刻，不做“英语思维”评分。',button('new-journal','记一次使用 '+icon('plus'),'primary'))}<div class="journal-layout"><section class="journal-section"><div class="section-heading"><h2>实际使用</h2><span class="helper-copy">本周 ${logs.length} 条自述</span></div>${state.journals.length?state.journals.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(j=>`<article class="journal-entry"><header><h3>${esc(THEMES[j.scenario])}</h3><span class="tag neutral">${esc(RATINGS[j.rating-1])}</span></header><p>${esc(j.note||'这次只记下了场景与感受。')}</p><div class="journal-entry-foot"><time datetime="${j.date}">${j.date}</time><div class="row-actions">${button('edit-journal','编辑','ghost small',`data-id="${j.id}" aria-label="编辑${j.date}的记录"`)}${button('delete-journal','删除','ghost small',`data-id="${j.id}" aria-label="删除${j.date}的记录"`)}</div></div></article>`).join(''):`<div class="empty"><h3>从一次具体使用开始</h3><p>读资料、听讨论或写邮件后，记下哪里更顺、哪里还卡住。不写内部内容。</p>${button('new-journal','记第一条','')}</div>`}</section><section class="journal-section"><div class="section-heading"><h2>场景练习</h2><span class="helper-copy">${doneLessons()} 个不同场景</span></div>${history.length?history.map(([id,p])=>{const l=getLesson(id),snapshot=p.completion||{mode:p.mode,answers:p.answers,context:p.listenContext},reading=snapshot.mode==='reading';return `<article class="history-row"><div><h3 lang="en">${esc(l?.title||id)}</h3><p>${day(new Date(p.completedAt))} · ${reading?'只练阅读':'听读练习'}</p><p class="helper-copy">${snapshot.context==='unrecorded'?'旧版复盘记录':reading?'首次阅读提交':contextLabel({listenContext:snapshot.context})}</p></div><div class="history-action"><span class="tag neutral">${l?scoreForMode(l,snapshot.answers,snapshot.mode):'—'} / ${reading?2:4}</span>${l?button('open-lesson','再练','ghost small',`data-id="${id}" aria-label="再练：${esc(l.title)}"`):''}</div></article>`;}).join(''):`<div class="empty"><h3>还没有保存的练习</h3><p>完成相应听读与理解题后，在「用」这一步保存。</p>${button('library','选择场景','')}</div>`}<details class="help-disclosure" id="record-method"><summary>这些记录代表什么？</summary><p>正确数只来自相应练习题；新记录保存第一次提交，不用重答覆盖。只练阅读为两题，听读为四题。自述与题目正确数都不是正式语言测评，也不能证明脑内不再翻译。</p></details></section></div>`;
  }
  function voiceDescription() { const v=selectedVoice();return v?`${v.name} · ${v.lang} · ${v.localService?'本地声线，可能较机械':'系统联网声线，可能需要网络'}`:'尚未选择浏览器声线；推荐使用内置场景音频或对应本地音频'; }
  function selectedVoice() {
    const picked=voices.find(v=>v.voiceURI===state.preferences.voice);
    if(picked)return picked;
    const en=voices.filter(v=>/^en([-_]|$)/i.test(v.lang||''));
    return en.find(v=>/natural|neural|premium|enhanced/i.test(v.name||''))||en.find(v=>/(US|GB)/i.test((v.voiceURI||'')+(v.name||'')))||en[0]||null;
  }
  function settingsPage() {
    return `${heading('设置','调整阅读、播放、账号和AI服务。')}<div class="settings-grid">
      <section class="settings-card"><h2>阅读与播放</h2><div class="field"><label for="text-size-select">字号</label><select id="text-size-select"><option value="small" ${state.preferences.textSize==='small'?'selected':''}>较小</option><option value="standard" ${state.preferences.textSize==='standard'?'selected':''}>标准</option><option value="large" ${state.preferences.textSize==='large'?'selected':''}>较大</option></select></div><p class="size-preview" lang="en">A little practice makes room for new ideas.</p><div class="field"><label for="theme-select">界面主题</label><select id="theme-select">${[['auto','跟随系统'],['light','浅色'],['dark','深色']].map(([v,t])=>`<option value="${v}" ${state.preferences.theme===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="default-rate">播放速度</label><select id="default-rate">${[0.75,0.9,1,1.15,1.3].map(r=>`<option value="${r}" ${state.preferences.rate===r?'selected':''}>${r}×</option>`).join('')}</select></div><div class="field"><label for="volume-range">音量 <output id="volume-out">${Math.round(state.preferences.volume*100)}</output>%</label><input id="volume-range" type="range" min="0" max="100" step="5" value="${Math.round(state.preferences.volume*100)}"></div><label class="self-check" for="auto-next"><input id="auto-next" type="checkbox" ${state.preferences.autoNext?'checked':''}>整段听完后自动播放下一课</label><div class="field"><span class="field-label" id="voice-pack-label">内置对话声线</span><div class="pack-list" role="radiogroup" aria-labelledby="voice-pack-label">${VOICE_PACKS.map(([key,label])=>`<div class="pack-option"><label><input type="radio" name="voice-pack" value="${key}" ${state.preferences.voicePack===key?'checked':''}> ${esc(label)}</label>${button('preview-pack','试听','ghost small',`data-pack="${key}" aria-label="试听${esc(label)}"`)}</div>`).join('')}</div></div><p class="helper-copy">字号、速度、音量立即生效；切换声线会重新加载本课音频。</p><details class="help-disclosure" id="voice-settings"><summary>AI生成场景的浏览器朗读</summary><p>没有内置录音的场景改用浏览器自带合成音，质量因系统而异，与上面选定的声线无关。</p><div class="field"><label for="voice-select">浏览器声线</label><select id="voice-select">${voices.length?voices.map(v=>`<option value="${esc(v.voiceURI)}" ${selectedVoice()?.voiceURI===v.voiceURI?'selected':''}>${esc(v.name+' · '+v.lang)}</option>`).join(''):'<option value="">此浏览器没有英文合成声线</option>'}</select></div>${button('preview-voice','试听','small')}${button('refresh-voices','重新检查','ghost small')}</details></section>
      <section class="settings-card"><h2>账号与同步</h2><p>${account?'已登录 '+esc(account.username):'未登录，当前使用访客记录。'}</p><p id="sync-status" class="helper-copy" role="status">${esc(syncMessage)}</p><p class="helper-copy">${accountCloud?'记录同步到此服务的账号；不同设备须访问同一服务。':'当前为本机服务器：账号数据存储在这台电脑，不能自动跨设备。跨设备需另行部署有持久存储的安全服务器。'}</p><div class="settings-actions">${account?`${button('sync-now','立即同步','small')}${syncBlocked?button('sync-conflict','处理同步冲突','danger small'):''}${button('account-logout','退出登录','ghost small')}`:`${button('account-register','创建账号','small')}${button('account-login','登录','small')}`}</div><p class="helper-copy">密码无法找回，请妥善保管。共享设备请退出登录并清理浏览器账号副本。</p></section>
      <section class="settings-card"><h2>学习备份</h2><p>建议定期导出；登录账号不代替备份。</p><div class="settings-actions">${button('export','导出备份 '+icon('download'),'')}${button('import','导入备份','')}${originalRaw&&storageBlocked?button('export-raw','导出原始记录',''):''}</div><input type="file" id="backup-file" accept="application/json,.json" hidden><details class="help-disclosure" id="backup-scope"><summary>备份内容</summary><p>练习、表达、生词、使用记录、草稿、偏好和AI材料。不含密码、API密钥、录音与自选音频。</p></details><div class="setting-row"><div><h3>重置当前记录</h3><p class="helper-copy">需再次确认；登录时重置会同步到账号。</p></div>${button('reset','重置','danger small')}</div></section>
      <section class="settings-card ai-settings"><div class="section-heading"><h2>AI辅助</h2><span class="tag neutral">${liveUsed?'本次调用成功':health.configured?'已配置，待调用':'未连接'}</span></div><p>生成新场景、解释语境、生词辨析、短写反馈和角色对话。每次调用前都需确认内容和可能的费用。</p><p class="helper-copy">${esc(health.detail)} 密钥仅保存在当前服务进程内存中，重启或退出登录后需重填；不进入备份或GitHub。</p><form id="ai-config-form"><div class="field"><label for="ai-url">兼容 Chat Completions 的 API 根地址</label><input id="ai-url" name="base_url" type="url" required maxlength="500" value="${esc(health.base_url||'https://api.openai.com/v1')}" placeholder="https://服务地址/v1"></div><div class="field"><label for="ai-model">模型名称</label><input id="ai-model" name="model" required maxlength="160" value="${esc(health.model||'')}" placeholder="由服务商提供"></div><div class="field"><label for="ai-key">API 密钥${health.configured?'（留空保留现有密钥）':''}</label><input id="ai-key" name="api_key" type="password" autocomplete="off" maxlength="4000" ${health.configured?'':'required'}></div><div class="field"><label for="ai-token-param">生成长度参数</label><select id="ai-token-param" name="token_param"><option value="max_completion_tokens" ${health.token_param==='max_completion_tokens'?'selected':''}>max_completion_tokens</option><option value="max_tokens" ${health.token_param==='max_tokens'?'selected':''}>max_tokens</option><option value="none" ${health.token_param==='none'?'selected':''}>不发送</option></select></div><div class="settings-actions"><button type="submit" class="btn primary">保存配置</button>${button('clear-ai','清除配置','ghost small')}${health.configured?button('test-ai','试一次AI解释','small'):''}</div></form><p class="helper-copy">只发送公开或虚构内容；不要发送公司内部信息、成本、客户信息或密钥。模型可能出错，不是能力测评。</p></section></div>`;
  }
  function focusSelector(el) {
    if(!el||!el.tagName||el===document.body)return '';
    if(el.id)return '#'+el.id;
    if(el.dataset?.action){let selector=`[data-action="${el.dataset.action}"]`;for(const key of ['index','id','key','group','tab'])if(el.dataset[key]!==undefined)selector+=`[data-${key}="${el.dataset[key]}"]`;return selector;}
    return '';
  }
  function render(options={}) {
    const active=document.activeElement,selector=focusSelector(active),selection=active?.selectionStart;
    document.body.classList.toggle('large-text',state.preferences.textSize==='large');
    document.body.classList.toggle('small-text',state.preferences.textSize==='small');
    const mode=state.preferences.theme==='auto'?(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):state.preferences.theme;
    document.documentElement.dataset.theme=mode;
    const opened=options.focusMain?[]:[...document.querySelectorAll('#app details[open][id]')].map(el=>el.id);
    const pages={home:homePage,library:libraryPage,lesson:lessonPage,review:reviewPage,journal:journalPage,settings:settingsPage};
    app.innerHTML=shell((pages[page]||homePage)());
    if(page==='library'){
      const all=[...lessons,...state.generated];
      const categories=[['all','全部'],...Object.entries(THEMES).filter(([key])=>all.some(l=>l.theme===key))];
      document.querySelector('.toolbar')?.insertAdjacentHTML('beforebegin',`<nav class="category-navigation" aria-label="按主题浏览">${categories.map(([key,label])=>`<button type="button" class="category-chip ${filterTheme===key?'active':''}" data-action="category-filter" data-theme="${esc(key)}" aria-pressed="${filterTheme===key}">${esc(label)} <span>${key==='all'?all.length:all.filter(l=>l.theme===key).length}</span></button>`).join('')}</nav>`);
    }
    document.getElementById('main')?.insertAdjacentHTML('afterbegin','<section id="continued-player" class="continued-player" aria-label="当前音频" hidden></section>');
    for(const id of opened){const el=document.getElementById(id);if(el)el.open=true;}
    if(page==='lesson'&&stage===0){ensurePlayer();ensureTimings();}
    const voiceSelect=document.getElementById('voice-select');
    if(page==='settings'&&voiceSelect&&voices.length){voiceSelect.insertAdjacentHTML('afterbegin','<option value="">不使用浏览器朗读（默认）</option>');voiceSelect.value=selectedVoice()?.voiceURI||'';}
    const recordButton=document.querySelector('[data-action="record"]');if(recordPending&&recordButton){recordButton.disabled=true;recordButton.textContent='等待录音权限…';}
    paintPlayer();
    if(!modal.open){
      const target=options.focusMain?document.getElementById('main'):document.querySelector(options.focusTarget||selector||'#never-match');
      if(target){target.focus({preventScroll:true});if(typeof selection==='number'&&target.setSelectionRange){try{target.setSelectionRange(selection,selection);}catch{}}if(options.focusTarget)target.scrollIntoView({block:'center',behavior:'auto'});}
    }
  }
  function formatTime(n) { const value=Math.max(0,Math.floor(Number(n)||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`; }
  function paintPlayer() {
    paintContinuedPlayer();
    highlightTurn(activeTurn);
    updateMediaSession();
    const play=document.getElementById('play-button'),audio=bundledPlayer&&audioId===lessonId?bundledPlayer:null;
    const active=audio?!audio.paused&&!audio.ended:speechPlaying&&!speechPaused,loading=audioTimer!==null;
    if(play){const label=loading?'加载音频…':active?'暂停':audio&&audio.currentTime>0&&!audio.ended||speechPaused?'继续':'播放';play.disabled=loading;play.innerHTML=icon(loading?'clock':active?'pause':'play')+`<span>${label}</span>`;play.setAttribute('aria-label',label==='加载音频…'?label:label+'英文音频');}
    const seek=document.getElementById('audio-seek'),duration=audio&&Number.isFinite(audio.duration)?audio.duration:0;
    if(seek){seek.disabled=!duration;seek.max=duration||100;if(!playerSeeking)seek.value=audio?.currentTime||0;seek.setAttribute('aria-valuetext',duration?`${formatTime(audio.currentTime)}，总时长${formatTime(duration)}`:'时长尚不可用');}
    const elapsed=document.getElementById('audio-elapsed'),end=document.getElementById('audio-duration');
    if(elapsed)elapsed.textContent=formatTime(audio?.currentTime||0);
    if(end)end.textContent=duration?formatTime(duration):audio?'等待时长…':'合成朗读不支持拖动';
    const status=document.getElementById('listen-status');
    if(status){const p=progress(),text=p.heard?'已记录一次完整播放':active?'正在播放；可暂停或回听':'尚未听完整段音频';const html=icon(p.heard?'check':'headphones')+`<span>${text}</span>`;if(status.innerHTML!==html)status.innerHTML=html;status.classList.toggle('complete',p.heard);}
    const error=document.getElementById('audio-error');if(error){const html=playerError?`<div class="note error" role="alert"><p>${esc(playerError)}</p><div class="settings-actions">${button('retry-audio','重试播放','small')}${button('reading-only','先练阅读','ghost small')}</div></div>`:'';if(error.innerHTML!==html)error.innerHTML=html;}
  }
  function paintContinuedPlayer() {
    const bar=document.getElementById('continued-player'),audio=bundledPlayer;
    if(!bar)return;
    const available=audio&&!audio.ended&&(!audio.paused||audio.currentTime>0||audioTimer!==null)||!!utterance;
    bar.hidden=!available||(page==='lesson'&&stage===0);
    if(bar.hidden)return;
    const active=audio?!audio.paused:speechPlaying&&!speechPaused,title=getLesson(audioId||lessonId)?.title||'英文音频';
    if(!bar.children.length)bar.innerHTML=`<div class="continued-info"><strong lang="en" id="continued-title"></strong><span id="continued-time"></span></div><div class="continued-actions">${button('continued-toggle','暂停','small', 'id="continued-toggle"')}${button('continued-return','回到听力','ghost small')}</div>`;
    document.getElementById('continued-title').textContent=title;
    document.getElementById('continued-time').textContent=audio?`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`:'浏览器合成朗读';
    const toggle=document.getElementById('continued-toggle');toggle.disabled=audioTimer!==null;toggle.textContent=audioTimer!==null?'加载中…':active?'暂停':'继续播放';
  }
  function updateMediaSession() {
    if(!('mediaSession' in navigator))return;
    const audio=bundledPlayer,session=navigator.mediaSession;
    try {
      const status=audio?audio.ended?'none':audio.paused?'paused':'playing':utterance?speechPaused?'paused':'playing':'none';
      if(session.playbackState!==status)session.playbackState=status;
      if(audio&&window.MediaMetadata&&session.metadata?.title!==getLesson(audioId)?.title)session.metadata=new MediaMetadata({title:getLesson(audioId)?.title||'英文音频',artist:'Unfold',album:audioSource==='bundled'?'AI场景对话':'自选音频'});
      if(!audio&&!utterance)session.metadata=null;
    } catch { /* Unsupported media-session fields must not interrupt audio. */ }
  }
  function resumeCurrentAudio() {
    const audio=bundledPlayer;if(!audio||audio.ended)return;
    playerError='';audio.play().catch(()=>{if(audio!==bundledPlayer)return;playerError='未能继续播放，请回到听力页重试。';paintPlayer();toast(playerError);});
  }
  function configureMediaSession() {
    if(!('mediaSession' in navigator))return;
    const handlers={
      play:()=>{if(bundledPlayer)resumeCurrentAudio();else if(utterance){window.speechSynthesis?.resume();speechPaused=false;paintPlayer();}},
      pause:()=>{if(bundledPlayer)bundledPlayer.pause();else if(utterance){window.speechSynthesis?.pause();speechPaused=true;paintPlayer();}},
      stop:()=>stopSound(),
      seekto:details=>{const audio=bundledPlayer;if(!audio||!Number.isFinite(audio.duration)||!Number.isFinite(details.seekTime))return;recordPlayed(audio,true);lastAudioTime=null;playerSeeking=true;audio.currentTime=Math.max(0,Math.min(audio.duration,details.seekTime));}
    };
    for(const [action,handler] of Object.entries(handlers)){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
  }
  function refreshVoices() {
    voices=window.speechSynthesis?window.speechSynthesis.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang)):[];
    const select=document.getElementById('voice-select');
    if(select){select.innerHTML='<option value="">不使用浏览器朗读（默认）</option>'+voices.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name+' · '+v.lang)}</option>`).join('');select.value=selectedVoice()?.voiceURI||'';}
    paintPlayer();
  }
  function persistPlayer(force=false) {
    const audio=bundledPlayer;if(!audio||!audioId)return;
    const p=progress(audioId,true);
    if(audioSource==='bundled'){p.audioRevision=AUDIO_REVISION;p.audioPosition=Math.min(7200,Math.max(0,audio.currentTime||0));p.audioRanges=playerRanges.map(r=>[...r]);}
    if(fullyHeard(playerRanges,audio.duration)&&!p.heard){p.heard=true;force=true;}
    if(force||Date.now()-lastMediaSave>2000){lastMediaSave=Date.now();save();}
  }
  function recordPlayed(audio,force=false) {
    if(audio!==bundledPlayer)return;
    const now=Date.now(),current=audio.currentTime||0;
    if(lastAudioTime!==null&&!audio.seeking&&!playerSeeking&&(!audio.paused||force)){
      const delta=current-lastAudioTime,wall=(now-lastAudioWall)/1000;
      if(delta>0&&delta<=wall*audio.playbackRate+0.35)playerRanges=mergeRanges(playerRanges,lastAudioTime,current);
    }
    lastAudioTime=current;lastAudioWall=now;persistPlayer(force);paintPlayer();
  }
  function stopSound() {
    if(shadowOn)stopShadow(true);
    clearTimeout(audioTimer);audioTimer=null;
    if(bundledPlayer){recordPlayed(bundledPlayer,true);bundledPlayer.pause();persistPlayer(true);}
    const old=utterance;utterance=null;if(old)window.speechSynthesis?.cancel();speechPlaying=false;speechPaused=false;lastAudioTime=null;paintPlayer();
  }
  function resetPlayer() {
    clearTimeout(audioTimer);audioTimer=null;
    const audio=bundledPlayer;bundledPlayer=null;
    if(audio){for(const name of ['onloadedmetadata','onplaying','onpause','ontimeupdate','onseeking','onseeked','onended','onerror','onwaiting'])audio[name]=null;audio.pause();audio.removeAttribute?.('src');audio.load?.();audio.remove?.();}
    audioId='';audioSource='';playerRanges=[];lastAudioTime=null;playerSeeking=false;playerError='';speechPlaying=false;speechPaused=false;
  }
  function ensurePlayer() {
    const l=getLesson();if(!l)return null;
    const custom=customAudio?.lessonId===l.id,source=custom?'custom':hasBundledAudio(l)?'bundled':'';
    if(!source){if(bundledPlayer){stopSound();resetPlayer();}return null;}
    const url=custom?customAudio.url:bundledAudioUrl(l);
    if(bundledPlayer&&audioId===l.id&&audioSource===source&&bundledPlayer.getAttribute?.('src')===url)return bundledPlayer;
    if(bundledPlayer){stopSound();resetPlayer();}
    const p=progress(l.id),matchingRevision=p.audioRevision===AUDIO_REVISION,audio=new Audio();audio.preload='auto';audio.src=url;audio.playbackRate=state.preferences.rate;audio.volume=state.preferences.volume;audioHost().appendChild(audio);
    bundledPlayer=audio;audioId=l.id;audioSource=source;playerRanges=source==='bundled'&&matchingRevision?p.audioRanges.map(r=>[...r]):[];playerError='';
    let counted=false;
    audio.onloadedmetadata=()=>{if(audio!==bundledPlayer)return;if(source==='bundled'&&matchingRevision&&p.audioPosition>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(p.audioPosition,audio.duration);paintPlayer();};
    audio.onplaying=()=>{if(audio!==bundledPlayer)return;clearTimeout(audioTimer);audioTimer=null;speechPlaying=true;speechPaused=false;playerError='';lastAudioTime=audio.currentTime;lastAudioWall=Date.now();if(!counted||audio.currentTime<0.15){counted=true;progress(l.id,true).replays=Math.min(100000,progress(l.id).replays+1);save();}paintPlayer();};
    audio.ontimeupdate=()=>{tickSentence(audio);recordPlayed(audio);};
    audio.onpause=()=>{if(audio!==bundledPlayer)return;recordPlayed(audio,true);speechPlaying=false;speechPaused=audio.currentTime>0&&!audio.ended;lastAudioTime=null;paintPlayer();};
    audio.onseeking=()=>{if(audio!==bundledPlayer)return;playerSeeking=true;lastAudioTime=null;};
    audio.onseeked=()=>{if(audio!==bundledPlayer)return;playerSeeking=false;lastAudioTime=audio.currentTime;lastAudioWall=Date.now();persistPlayer(true);paintPlayer();};
    audio.onended=()=>{if(audio!==bundledPlayer)return;recordPlayed(audio,true);clearTimeout(audioTimer);audioTimer=null;speechPlaying=false;speechPaused=false;lastAudioTime=null;loopTurn=-1;persistPlayer(true);paintPlayer();toast(fullyHeard(playerRanges,audio.duration)?'整段音频已听完。检查意思后继续阅读。':'播放结束；尚有未听过的区间，可回听补齐或只练阅读。');if(state.preferences.autoNext)setTimeout(()=>{if(audio===bundledPlayer||!bundledPlayer)playNextLesson();},1400);};
    audio.onerror=()=>{if(audio!==bundledPlayer)return;clearTimeout(audioTimer);audioTimer=null;audio.pause();speechPlaying=false;speechPaused=false;
      if(source==='bundled'&&state.preferences.voicePack!=='a'&&!packFallbackUsed){packFallbackUsed=true;state.preferences.voicePack='a';save();resetPlayer();toast('这套声线缺少本课录音，已切回默认声线。');render();playSpeech(true);return;}
      playerError=source==='custom'?'这个文件无法播放。可重选浏览器支持的音频，或还原默认音频。':(health.host?'这段音频读取失败，可重试或先练阅读。':'本地服务未连接，音频无法播放。请先运行「启动.ps1」再刷新本页；也可以先练阅读。');paintPlayer();};
    return audio;
  }
  function playSpeech(fromStart=false) {
    if(document.hidden){toast('先回到产品页面，再播放音频。');return;}
    const l=getLesson();if(!l)return;
    if(playerError){resetPlayer();}
    const audio=ensurePlayer();
    if(audio){
      if(!fromStart&&!audio.paused&&!audio.ended){audio.pause();return;}
      if(fromStart||audio.ended){lastAudioTime=null;if(audio.currentTime>0){playerSeeking=true;audio.currentTime=0;}else playerSeeking=false;}
      playerError='';clearTimeout(audioTimer);audioTimer=setTimeout(()=>{if(audio!==bundledPlayer)return;audioTimer=null;audio.pause();playerError='音频等待超过15秒，尚未启动。可重试或先练阅读。';paintPlayer();},15000);paintPlayer();
      audio.play().catch(()=>{if(audio!==bundledPlayer)return;clearTimeout(audioTimer);audioTimer=null;speechPlaying=false;speechPaused=false;playerError='播放未能启动。请重试；也可以先练阅读。';paintPlayer();});return;
    }
    if(speechPlaying&&!fromStart){speechPaused=!speechPaused;if(speechPaused)window.speechSynthesis?.pause();else window.speechSynthesis?.resume();paintPlayer();return;}
    if(utterance)stopSound();
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){playerError='浏览器没有合成朗读能力。可选择对应的本地音频，或只练阅读。';paintPlayer();return;}
    refreshVoices();const v=selectedVoice();if(!v){playerError='这个场景没有内置录音，当前浏览器也没有英文合成声线。可选择对应本地音频，或先练阅读。';paintPlayer();return;}
    const u=new SpeechSynthesisUtterance(l.script);u.voice=v;u.lang=v.lang;u.rate=state.preferences.rate;u.volume=state.preferences.volume;let started=false;
    utterance=u;audioId=l.id;speechPlaying=true;speechPaused=false;
    const failed=()=>{if(utterance!==u)return;clearTimeout(audioTimer);audioTimer=null;utterance=null;window.speechSynthesis.cancel();speechPlaying=false;speechPaused=false;playerError='合成朗读未能完成，未记听力完成。可重试、选择本地音频或先练阅读。';paintPlayer();};
    audioTimer=setTimeout(failed,15000);
    u.onstart=()=>{if(utterance!==u)return;started=true;clearTimeout(audioTimer);audioTimer=null;progress(l.id,true).replays=Math.min(100000,progress(l.id).replays+1);save();paintPlayer();};
    u.onend=()=>{if(utterance!==u)return;if(!started){failed();return;}clearTimeout(audioTimer);audioTimer=null;progress(l.id,true).heard=true;utterance=null;speechPlaying=false;speechPaused=false;save();paintPlayer();toast('合成朗读已完整结束。检查意思后继续阅读。');};
    u.onerror=failed;paintPlayer();try{window.speechSynthesis.speak(u);}catch{failed();}
  }
  function openModal(title,body) {
    if(!modal.open)modalReturnSelector=focusSelector(document.activeElement);
    modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">${title}</h2><button type="button" class="modal-close" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}</div>`;
    if(!modal.open)modal.showModal();
  }
  function closeModal() {
    if(aiBusy){aiRequest++;aiAbort?.abort();aiBusy=false;aiAbort=null;toast('已停止等待；已发送的请求仍可能计费。');}
    modal.close();pendingAI=null;pendingImport=null;journalEditing=null;
    const target=modalReturnSelector?document.querySelector(modalReturnSelector):null;target?.focus({preventScroll:true});
  }
  function helpModal() {
    openModal('怎样练？',`<div class="help-content"><ol><li><strong>听：</strong>先抓意思；可以回听、减速或看提示。</li><li><strong>读：</strong>理解语境，选中单词或短语并收藏到生词库。</li><li><strong>用：</strong>收藏表达、口述或短写；连接AI后可进行文字对话。</li><li><strong>复习：</strong>先从情境回想，再看提示。</li></ol><details class="help-disclosure"><summary>音频与记录</summary><p>内置场景为原创虚构教材，音频为神经声线合成而非真人录音。切换标签和站内页面不中断；刷新、关闭播放页或选择另一课会结束当前播放。录音只在本页回听，不上传或评分。</p><p>账号记录同步到当前服务器。本机服务器的数据仍在本机；跨设备需要同一台部署在安全公网服务并有持久存储的服务器。请定期导出备份。</p></details><details class="help-disclosure"><summary>AI与隐私</summary><p>AI为选配，发送前单独确认主机、内容和可能产生的费用。勿输入内部经营数据、成本、客户资料或密钥。模型反馈、题目正确数及自述都不是正式能力测评。</p></details></div>`);
  }
  function journalForm(id=null) {
    journalEditing=id;const entry=state.journals.find(j=>j.id===id)||{date:day(),scenario:'meetings',rating:null,note:''};
    openModal(id?'编辑使用记录':'记一次英语使用',`<form id="journal-form"><p class="modal-copy">只记体验与难点，不写内部内容。这份自述不传AI。</p><div class="form-row"><div class="field"><label for="journal-date">日期</label><input id="journal-date" name="date" type="date" max="${day()}" value="${entry.date}" required></div><div class="field"><label for="journal-scenario">场景</label><select id="journal-scenario" name="scenario">${Object.entries(THEMES).map(([v,t])=>`<option value="${v}" ${entry.scenario===v?'selected':''}>${t}</option>`).join('')}</select></div></div><fieldset class="field rating-field"><legend>这次理解有多顺？</legend><div class="rating-group">${RATINGS.map((r,i)=>`<label class="rating-option"><input type="radio" name="rating" value="${i+1}" required ${entry.rating===i+1?'checked':''}><span>${r}</span></label>`).join('')}</div></fieldset><div class="field"><label for="journal-note">一句体验或难点（选填）</label><textarea id="journal-note" name="note" maxlength="280" placeholder="例如：听懂了讨论结论，委婉表达还要回想。">${esc(entry.note)}</textarea></div><div class="form-actions">${button('close-modal','取消','ghost')}<button class="btn primary" type="submit">保存记录</button></div></form>`);
  }
  function apiLesson(l) { return l.generated?{lesson_id:l.id,lesson:l}:{lesson_id:l.id}; }
  function aiSetupNotice() {openModal('AI尚未连接',`<p class="modal-copy">内置练习照常使用。AI解释、拓展与短写反馈需要先连接服务，不会显示模拟回答。</p>${button('go-settings','查看AI设置','primary')}`);}
  function confirmAI(mode) {
    if(!health.configured){aiSetupNotice();return;}
    const l=getLesson(),phrase=Number(document.getElementById('explain-phrase')?.value||0);
    if(mode==='feedback' && (state.drafts[l.id]||'').trim().length<10){toast('先写至少10个字符的虚构英语练习，再请求反馈。');return;}
    pendingAI=mode==='generate'?{mode}:{mode,...apiLesson(l),...(mode==='explain'?{phrase_index:phrase}:{writing:(state.drafts[l.id]||'').trim()})};
    const title={explain:'请AI换一种语境解释',feedback:'请AI反馈这段短写',generate:'生成一个新的学习场景'}[mode];
    const fields=mode==='generate'?`<div class="field"><label for="generate-topic">主题</label><select id="generate-topic">${Object.entries(THEMES).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div><div class="field"><label for="generate-level">材料难度</label><select id="generate-level">${Object.entries(LEVELS).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div>`:'';
    openModal(title,`<p class="modal-copy">发送到 <strong>${esc(health.host)}</strong> · 模型 <strong>${esc(health.model)}</strong>。${mode==='feedback'?'仅发送这段短写及虚构练习题，不发送你的使用记录。':mode==='explain'?'发送当前原创/AI材料中的语境与选中意群，不发送个人使用记录。':'只发送所选主题和难度，不发送个人使用记录。'}</p>${fields}<div class="note warning">这是一次真实服务调用，可能按你选择的服务计费。AI结果可能有误，不作为等级鉴定或母语水平证明。</div><label class="privacy-check"><input id="privacy-ok" type="checkbox">我确认发送内容为公开或虚构教学内容，不含内部经营数据、成本、客户信息或密钥，并接受本次服务可能产生费用。</label>${button('ai-send','确认并调用真实AI '+icon('spark'),'primary')}`);
  }
  function confirmSpecialAI(mode,payload){
    if(!health.configured){aiSetupNotice();return;}
    pendingAI={mode,...payload};
    const description=mode==='vocabulary'?`发送生词「${esc(payload.term)}」及其保存的语境。`:`发送本次回复、当前虚构场景及本页前几轮对话。`;
    openModal(mode==='vocabulary'?'AI语境辨析':'发送对话回复',`<p class="modal-copy">发送到 <strong>${esc(health.host)}</strong> · 模型 <strong>${esc(health.model)}</strong>。${description}</p>${mode==='dialogue'?`<blockquote lang="en">${esc(payload.message)}</blockquote>`:''}<div class="note warning">本次真实调用可能产生费用；模型回答可能有误。取消不会自动重试。</div><label class="privacy-check"><input id="privacy-ok" type="checkbox">我确认发送内容为公开或虚构内容，不含内部资料、客户信息或密钥，并接受可能产生的费用。</label>${button('ai-send','确认并调用AI','primary')}`);
  }
  async function sendAI() {
    if(aiBusy||!pendingAI)return;
    if(!document.getElementById('privacy-ok')?.checked){toast('先确认发送内容与费用边界。');document.getElementById('privacy-ok')?.focus();return;}
    const payload={...pendingAI,privacy_ok:true};
    if(payload.mode==='generate'){payload.topic=document.getElementById('generate-topic').value;payload.level=Number(document.getElementById('generate-level').value);}
    if(payload.mode==='generate'&&state.generated.length>=200){toast('AI材料已达200份上限；请先导出备份。');return;}
    const request=++aiRequest,abort=new AbortController();aiBusy=true;aiAbort=abort;const timeout=setTimeout(()=>abort.abort(),52000);
    openModal('正在等待AI返回',`<div class="loading-line" role="status">请求已发送，正在等待模型。</div><p class="modal-copy">不会自动重试。关闭会停止等待，但已发送的请求仍可能计费。</p>`);
    try {
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','X-Unfold-Token':health.csrf_token},body:JSON.stringify(payload),signal:abort.signal});
      const body=await response.json();if(request!==aiRequest||!modal.open)return;
      if(!response.ok)throw new Error(body.error||'服务返回失败状态');
      if(body.source!=='live_ai'||body.mode!==payload.mode)throw new Error('服务结果标识不符合预期，未采用');
      if(payload.mode==='generate'){
        const fresh={...lessonValid(body.result),generated:true};if(!fresh.id.startsWith('G_')||getLesson(fresh.id))throw new Error('新材料标识不合法');
        state.generated.push(fresh);const saved=save();liveUsed=true;modal.close();pendingAI=null;navigate('lesson',fresh.id);toast(saved?'AI材料已加入场景库，请核对内容与答案。':'AI材料只留本页，尚未写入备份，请导出。');
      }else{
        const labels=payload.mode==='explain'?{explanation:'语境里的意思',example:'换一个情境',check:'试着回答'}:payload.mode==='vocabulary'?{meaning:'语境中的意思',example:'新例句',contrast:'辨析与语感',check:'回想一下'}:payload.mode==='dialogue'?{reply:'对方回复',feedback:'表达建议',challenge:'下一轮目标'}:{strength:'表达清楚的地方',rewrite:'一种改写参考',next_step:'下一步怎么练',note:'反馈的局限'};
        const sections=Object.entries(labels).map(([k,t])=>`<section><h3>${t}</h3><p lang="en">${esc(str(body.result[k],3500,k))}</p></section>`).join('');
        if(payload.mode==='dialogue'){dialogueHistory.push({role:'learner',text:payload.message},{role:'partner',text:body.result.reply});dialogueHistory=dialogueHistory.slice(-8);}
        liveUsed=true;openModal('AI反馈',`<div class="ai-result">${sections}</div><p class="helper-copy">模型 ${esc(body.model)} · 内容可能有误，不是能力评定。</p>${payload.mode==='dialogue'?button('dialogue','继续对话','primary'):''}`);render();
      }
    }catch(error){
      if(request!==aiRequest||!modal.open)return;
      if(error.name==='AbortError')openModal('AI等待超时',`<p class="modal-copy">没有采用结果；这次请求仍可能计费，不会自动重试。</p>${button('close-modal','返回练习','primary')}`);
      else openModal('AI没有返回可用结果',`<div class="note error" role="alert">${esc(error.message)}</div><p class="modal-copy">本地练习与记录仍可使用。检查配置后再手动请求。</p>${button('go-settings','查看连接设置','')}`);
    }finally{clearTimeout(timeout);if(request===aiRequest){aiBusy=false;aiAbort=null;}}
  }
  async function checkHealth() {
    const request=++healthRequest,control=new AbortController(),timeout=setTimeout(()=>control.abort(),4000);
    try{const response=await fetch('/api/health',{signal:control.signal});if(!response.ok)throw new Error();const data=await response.json();if(request===healthRequest)health={configured:data.configured===true,host:String(data.host||''),model:String(data.model||''),detail:String(data.detail||''),csrf_token:String(data.csrf_token||''),base_url:String(data.base_url||''),token_param:String(data.token_param||'max_completion_tokens'),token_limit:Number(data.token_limit)||2700};}
    catch{if(request===healthRequest)health={configured:false,host:'',model:'',detail:'本地服务未连接。通过启动脚本运行后，再刷新页面。',csrf_token:''};}
    finally{clearTimeout(timeout);}
  }
  async function startRecording() {
    if(recorder?.state==='recording'){stopRecording();return;}
    if(recordPending){toast('正在等待录音权限。离开本步骤会取消开始录音。');return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('当前浏览器不支持本地录音。选做任务可以直接口述，不影响听读完成。');return;}
    const request=++recordRequest,requestedId=lessonId;let stream=null;recordPending=true;stopSound();render();
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(request!==recordRequest||page!=='lesson'||stage!==2||lessonId!==requestedId||document.hidden){stream.getTracks().forEach(t=>t.stop());if(request===recordRequest){recordPending=false;render();}return;}
      recordPending=false;recordStream=stream;const chunks=[];recordChunks=chunks;
      const type=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      const active=type?new MediaRecorder(stream,{mimeType:type}):new MediaRecorder(stream);recorder=active;
      active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      active.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(recorder!==active)return;recorder=null;recordStream=null;clearInterval(recordTick);clearTimeout(recordTimeout);if(recordURL)URL.revokeObjectURL(recordURL);recordURL=URL.createObjectURL(new Blob(chunks,{type:active.mimeType||'audio/webm'}));recordLesson=requestedId;render();toast('录音仅在本页回听，不上传，刷新后不保留。');};
      active.start();recordStarted=Date.now();render();recordTick=setInterval(()=>{const el=document.getElementById('record-time');if(el)el.textContent=`正在录音 · ${Math.floor((Date.now()-recordStarted)/1000)} 秒 · 最长2分钟`;},1000);recordTimeout=setTimeout(stopRecording,120000);
    }catch{stream?.getTracks().forEach(t=>t.stop());if(request===recordRequest){recordPending=false;recordStream=null;recorder=null;render();toast('录音权限未获准或设备不可用。未上传任何音频。');}}
  }
  function stopRecording(){recordRequest++;recordPending=false;if(recorder?.state==='recording')recorder.stop();recordStream?.getTracks().forEach(t=>t.stop());clearInterval(recordTick);clearTimeout(recordTimeout);}
  function clearVolatileMedia(){
    const old=utterance;utterance=null;if(old)window.speechSynthesis?.cancel();resetPlayer();stopRecording();recorder=null;recordStream=null;
    if(recordURL)URL.revokeObjectURL(recordURL);recordURL='';recordLesson='';if(customAudio)URL.revokeObjectURL(customAudio.url);customAudio=null;
  }
  function download(name,content,mime='application/json;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function storageSnapshot(){try{return localStorage.getItem(KEY);}catch{return undefined;}}
  function replaceLocal(next,expected){
    try{
      const current=localStorage.getItem(KEY);if(expected===undefined||current!==expected)throw new Error('确认期间另一个页面更改了记录，未覆盖。请先导出当前副本，再载入最新记录。');
      const raw=JSON.stringify(next);localStorage.setItem(KEY,raw);clearVolatileMedia();state=next;lastStoredRaw=raw;originalRaw=raw;storageBlocked=false;storageWarning='';reviewRevealed.clear();reviewKey='';reviewDrafts={};undoReview=null;return true;
    }catch(error){storageBlocked=true;originalRaw=storageSnapshot()??originalRaw;storageWarning=error.message||'浏览器无法写入记录。请导出当前副本。';toast(storageWarning);return false;}
  }
  function resetConfirm(){pendingDestructiveRaw=storageSnapshot();openModal('重置本地学习记录？',`<p class="modal-copy">将清空当前浏览器的练习、收藏、使用记录、草稿和AI材料，不删除磁盘文件。建议先导出备份。</p><div class="settings-actions">${button('export','先导出备份','')}${button('reset-confirm','确认重置','danger')}</div>`);}
  let selTimer=null;
  function wordForm(id=''){
    const existing=state.vocabulary.find(w=>w.id===id),sel=window.getSelection(),selected=!existing&&page==='lesson'?String(sel||'').trim().slice(0,80):'';
    const node=sel?.anchorNode?.parentElement,context=!existing&&selected&&node?.closest('.reading-text')?(node.closest('p')?.textContent||'').slice(0,1500):'';
    const dict=existing?dictLookup(existing.term):dictLookup(selected);
    const dictHint=dict&&dict.senses.length?`<p class="helper-copy">内置释义：${esc(dict.senses.join('；').slice(0,200))}</p>`:'';
    openModal(existing?'编辑生词':'收藏生词',`${dictHint}<form id="word-form" data-id="${esc(id)}"><div class="field"><label for="word-term">单词或短语</label><input id="word-term" name="term" maxlength="80" required value="${esc(existing?.term||selected)}"></div><div class="field"><label for="word-context">原句或语境（选填）</label><textarea id="word-context" name="context" maxlength="1500">${esc(existing?.context||context)}</textarea></div><div class="field"><label for="word-meaning">自己的解释（选填）</label><textarea id="word-meaning" name="meaning" maxlength="500">${esc(existing?.meaning||'')}</textarea></div><p class="helper-copy">保留语境有助于回想；AI辨析是可选功能，调用前会单独确认。</p><button type="submit" class="btn primary">保存生词</button></form>`);
  }
  // ---- 逐句精听：点原文任意一句单独重听或循环，播放时同步高亮 ----------------
  // Turn boundaries come from audio/<pack>/timings.json, measured off the rendered
  // file, so a lesson whose timings are absent simply keeps whole-file playback.
  let timingsCache={},timingsLoading='',activeTurn=-1,loopTurn=-1,packFallbackUsed=false,hiddenWhilePlaying=false;
  function audioHost(){
    let host=document.getElementById('audio-host');
    if(!host){host=document.createElement('div');host.id='audio-host';host.setAttribute('aria-hidden','true');document.body.appendChild(host);}
    return host;
  }
  function scriptLines(l){return String(l?.script||'').split('\n').filter(x=>x.includes(':')&&x.trim());}
  function sentenceSourceOK(l){return !!l&&customAudio?.lessonId!==l.id&&hasBundledAudio(l);}
  function lessonTimings(l=getLesson()){
    if(!sentenceSourceOK(l))return null;
    const entry=timingsCache[state.preferences.voicePack]?.[l.id];
    if(!entry||!Array.isArray(entry.timing)||!Array.isArray(entry.turns))return null;
    const lines=scriptLines(l);
    if(lines.length!==entry.timing.length)return null;
    if(!entry.timing.every(r=>Array.isArray(r)&&r.length===2&&Number.isFinite(r[0])&&Number.isFinite(r[1])&&r[1]>r[0]))return null;
    return {lines,timing:entry.timing};
  }
  function ensureTimings(){
    const l=getLesson();
    if(page!=='lesson'||stage!==0||!sentenceSourceOK(l))return;
    const pack=state.preferences.voicePack;
    if(Object.hasOwn(timingsCache,pack)||timingsLoading===pack)return;
    timingsLoading=pack;
    fetch(`/audio/${pack}/timings.json`)
      .then(r=>r.ok?r.json():null)
      .then(t=>{timingsLoading='';timingsCache[pack]=(t&&typeof t==='object'&&!Array.isArray(t))?t:null;if(page==='lesson'&&stage===0)render();})
      .catch(()=>{timingsLoading='';timingsCache[pack]=null;});
  }
  function transcriptBlock(l){
    if(!transcript)return '';
    const t=lessonTimings(l);
    if(!t)return `<section class="transcript" id="transcript-text" lang="en" aria-label="对话英文原文">${esc(l.script)}</section>`;
    return `<section class="transcript has-turns" id="transcript-text" lang="en" aria-label="对话英文原文，点任意一句可单独重听">`+
      t.lines.map((line,i)=>{
        const cut=line.indexOf(':'),role=line.slice(0,cut).trim(),text=line.slice(cut+1).trim(),range=t.timing[i];
        return `<button type="button" class="turn${i===activeTurn?' active':''}" data-action="play-turn" data-index="${i}" aria-label="只播放第${i+1}句，${esc(role)}"><span class="turn-role">${esc(role)}</span><span class="turn-text">${esc(text)}</span><span class="turn-time">${formatTime(range[0])}</span></button>`;
      }).join('')+`</section>`;
  }
  function sentenceLoopButton(){
    if(!lessonTimings())return '';
    return button('loop-turn',loopTurn>=0?'取消单句循环':'单句循环',loopTurn>=0?'primary':'ghost',`aria-pressed="${loopTurn>=0}" title="先在原文里点一句，再开启循环"`);
  }
  function highlightTurn(index){
    const box=document.getElementById('transcript-text');
    if(!box)return;
    const turns=box.querySelectorAll('.turn');
    for(let i=0;i<turns.length;i++)turns[i].classList.toggle('active',i===index);
  }
  function seekTo(audio,seconds){
    if(Math.abs((audio.currentTime||0)-seconds)>0.05){playerSeeking=true;audio.currentTime=seconds;}
    else{lastAudioTime=seconds;lastAudioWall=Date.now();}
  }
  function playTurn(index){
    const t=lessonTimings();
    if(!t||!t.timing[index]){toast('这一课还没有逐句时间轴，请整段播放。');return;}
    const audio=ensurePlayer();
    if(!audio){toast('这一课没有可播放的音频。');return;}
    stopSpeechOnly();
    activeTurn=index;
    if(loopTurn>=0)loopTurn=index;
    playerError='';
    seekTo(audio,t.timing[index][0]);
    audio.play().catch(()=>{playerError='这一句没能开始播放，请重试或整段播放。';paintPlayer();});
    highlightTurn(index);
  }
  function stopSpeechOnly(){
    if(!utterance)return;
    const old=utterance;utterance=null;window.speechSynthesis?.cancel();
    speechPlaying=false;speechPaused=false;
    if(old)paintPlayer();
  }
  // Shadowing: play one turn, then hand the learner the same amount of time to
  // say it out loud before moving on. No recording leaves the browser, and the
  // pause length is derived from the turn itself, so the rhythm stays natural.
  let shadowOn=false,shadowIndex=-1,shadowPhase='',shadowTimer=null,shadowTick=null;
  function shadowButton(){
    return button('shadow',shadowOn?'退出跟读':'跟读模式','ghost',`aria-pressed="${shadowOn}" aria-label="${shadowOn?'退出逐句跟读':'开始逐句跟读，播放一句后留时间跟读'}"`);
  }
  function shadowStatus(text){
    const el=document.getElementById('shadow-status');
    if(el){if(text===null)el.hidden=true;else{el.hidden=false;el.textContent=text;}}
  }
  function clearShadowTimers(){clearTimeout(shadowTimer);clearInterval(shadowTick);shadowTimer=null;shadowTick=null;}
  function stopShadow(quiet=false){
    if(!shadowOn&&!shadowTimer)return;
    clearShadowTimers();shadowOn=false;shadowIndex=-1;shadowPhase='';
    if(bundledPlayer&&!bundledPlayer.paused)bundledPlayer.pause();
    shadowStatus(null);
    if(page==='lesson')render();
    if(!quiet)toast('已退出跟读。');
  }
  function startShadow(){
    const t=lessonTimings();
    if(!t||!t.timing.length){toast('这一课还没有逐句时间轴，暂时无法跟读。');return;}
    const audio=ensurePlayer();
    if(!audio){toast('这一课没有可跟读的音频。');return;}
    shadowOn=true;shadowIndex=-1;render();nextShadowTurn();
  }
  function nextShadowTurn(){
    if(!shadowOn)return;
    const t=lessonTimings();const audio=bundledPlayer;
    if(!t||!audio){stopShadow(true);return;}
    shadowIndex+=1;
    if(shadowIndex>=t.timing.length){stopShadow(true);toast('跟读完成，这一课的每一句都留了时间。');return;}
    const [start,end]=t.timing[shadowIndex],rate=audio.playbackRate||1;
    const spoken=Math.max(0.8,(end-start)/rate);
    shadowPhase='listen';activeTurn=shadowIndex;highlightTurn(shadowIndex);
    shadowStatus(`第 ${shadowIndex+1}/${t.timing.length} 句 · 先听`);
    seekTo(audio,start);audio.play().catch(()=>stopShadow(true));
    clearShadowTimers();
    // The gap is timed from the audio itself so a slowed-down read still gets a
    // full turn to repeat, rather than a fixed guess.
    shadowTimer=setTimeout(()=>beginShadowGap(spoken),spoken*1000+220);
  }
  function beginShadowGap(seconds){
    if(!shadowOn)return;
    const audio=bundledPlayer;if(audio)audio.pause();
    shadowPhase='repeat';
    const gap=Math.max(1.4,seconds*0.95);let left=gap;
    shadowStatus(`第 ${shadowIndex+1} 句 · 该你了`);
    clearShadowTimers();
    shadowTick=setInterval(()=>{
      left-=0.2;
      if(left<=0){clearShadowTimers();nextShadowTurn();return;}
      shadowStatus(`第 ${shadowIndex+1} 句 · 该你了 ${Math.ceil(left)}s`);
    },200);
  }
  function seekBy(delta){
    const audio=bundledPlayer;if(!audio||!Number.isFinite(audio.duration))return;
    recordPlayed(audio,true);playerSeeking=true;
    audio.currentTime=Math.max(0,Math.min(audio.duration,(audio.currentTime||0)+delta));
    paintPlayer();
  }
  function stepTurn(direction){
    const t=lessonTimings();if(!t||!t.timing.length){toast('这一课还没有逐句时间轴，可用方向键快进。');return;}
    const now=bundledPlayer?.currentTime||0;
    let index=t.timing.findIndex(r=>now>=r[0]-0.05&&now<r[1]+0.15);
    if(index<0)index=direction>0?-1:t.timing.length;
    playTurn(Math.max(0,Math.min(t.timing.length-1,index+direction)));
  }
  function tickSentence(audio){
    if(audio!==bundledPlayer)return;
    const t=lessonTimings();
    if(!t)return;
    const now=audio.currentTime||0;
    if(loopTurn>=0){
      const range=t.timing[loopTurn];
      if(range&&!audio.paused&&now>=range[1]-0.03){seekTo(audio,range[0]);return;}
    }
    let found=-1;
    for(let i=0;i<t.timing.length;i++){
      const range=t.timing[i];
      if(now>=range[0]-0.05&&now<range[1]+0.15){found=i;break;}
    }
    if(found!==activeTurn){activeTurn=found;highlightTurn(found);}
  }

  function wordRecall(r,due){
    const w=r.word,show=reviewRevealed.has(r.key),where=w.lessonId?getLesson(w.lessonId)?.title:'';
    const ctx=maskedContext(w);
    return `<section class="recall-session"><p class="review-position">${due.length?'今天还有 '+due.length+' 条到期':'提前练一次'} · 生词${where?' · 来自 '+esc(where):''}</p>`+
      `<h2>${w.meaning?esc(w.meaning):'回想这个英语词'}</h2>`+
      (ctx?`<p class="recall-context" lang="en">${ctx}</p>`:'')+
      `<label for="recall-draft">先想起这个词，再放进你自己的一句话</label>`+
      `<textarea id="recall-draft" maxlength="500" data-key="${r.key}" placeholder="不必一字不差，先想起来再用一次。">${esc(reviewDrafts[r.key]||'')}</textarea>`+
      (show?`<div class="review-reveal"><h3 lang="en">${esc(w.term)}</h3>${w.meaning?`<p>${esc(w.meaning)}</p>`:''}${w.context?`<p class="helper-copy" lang="en">${esc(w.context)}</p>`:''}<p class="helper-copy">能在新句子里用出来，才算记住了。</p><div class="review-actions">${button('review-again','还没想起','',`data-key="${r.key}"`)}${button('review-known','想起来了','primary',`data-key="${r.key}"`)}</div></div>`:button('reveal-review','看看这个词','primary',`data-key="${r.key}"`))+
      `<p class="helper-copy recall-local">自练句子只留本页，不上传或自动评分。</p></section>`;
  }
  function exportReviewCSV(){
    const rows=[['类型','英文','释义或提示','语境','来源场景','下次复习','连续想起','练习次数']];
    for(const x of reviewQueue()){
      if(x.kind==='phrase')rows.push(['表达',x.phrase.text,x.phrase.cue,x.phrase.meaning,x.lesson?.title||'',x.due,x.ref?.streak||0,x.ref?.seen||0]);
      else rows.push(['生词',x.word.term,x.word.meaning,x.word.context,x.lesson?.title||'',x.word.due||day(),x.word.streak||0,x.word.seen||0]);
    }
    if(rows.length<2){toast('还没有可导出的表达或生词。');return;}
    const csvCell=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
    download(`unfold-review-${day()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    toast('已请求下载CSV，可用表格软件或导入Anki。');
  }
  function playNextLesson(){
    const list=[...lessons,...state.generated];
    const index=list.findIndex(l=>l.id===(audioId||lessonId));
    const next=index>=0?list[index+1]:null;
    if(!next){toast('已经是最后一个场景。');return;}
    navigate('lesson',next.id,0);
    toast('继续播放：'+next.title);
    playSpeech(true);
  }

  // ---- 划词：选中英文即出现释义 / 收藏 / 朗读 ----------------------------
  const SELECTABLE='.reading-text,.transcript,.hint-content,.phrase,.optional-body,.reading-card';
  let selToolbar=null,previewAudio=null,previewResume=false,lastSelection={text:'',context:''};
  function dictLookup(raw){
    const clean=String(raw||'').trim().toLowerCase().replace(/\u2019/g,"'").replace(/^[\u201c("'[]+|[\u201d"'\].!?;,]+$/g,'');
    if(!clean||clean.length>80)return null;
    if(DICT[clean])return {term:clean,senses:DICT[clean]};
    const rules=[['ies','y'],['ied','y'],['ves','f'],['ing',''],['ing','e'],['ed',''],['ed','e'],['es',''],['s',''],['er',''],['est',''],['ly',''],['ment',''],['ness',''],['tion','te'],['ation','e']];
    for(const [suffix,replace] of rules){
      if(clean.endsWith(suffix)&&clean.length-suffix.length>=3){
        const stem=clean.slice(0,-suffix.length)+replace;
        if(DICT[stem])return {term:stem,senses:DICT[stem],inflected:clean};
      }
    }
    if(clean.includes('-')){
      const parts=clean.split('-').filter(Boolean).map(p=>DICT[p]?p:null);
      if(parts.some(Boolean))return {term:clean,senses:[parts.map((p,i)=>p?`${clean.split('-')[i]} → ${DICT[p][0]}`:'').filter(Boolean).join('；')],compound:true};
    }
    return null;
  }
  function sentenceOf(node){
    const block=node?.closest?.('p,li,.phrase,h2,h3,td')||node?.parentElement;
    return (block?.textContent||'').replace(/\s+/g,' ').trim().slice(0,600);
  }
  function hideSelToolbar(){if(selToolbar){selToolbar.remove();selToolbar=null;}}
  function showSelToolbar(){
    const sel=window.getSelection();
    const text=String(sel&&sel.rangeCount?sel.toString():'').trim();
    const node=sel?.anchorNode;
    const el=node&&(node.nodeType===1?node:node.parentElement);
    const inField=el?.closest?.('input,textarea,select,.sel-toolbar');
    if(!text||text.length>200||inField||!el?.closest?.(SELECTABLE)||!/[A-Za-z]{2}/.test(text)){hideSelToolbar();return;}
    lastSelection={text:text.slice(0,80),context:sentenceOf(el)};
    hideSelToolbar();
    const bar=document.createElement('div');
    bar.className='sel-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','选中内容操作');
    bar.innerHTML=`<button type="button" class="btn small primary" data-sel="meaning">释义</button><button type="button" class="btn small" data-sel="save">收藏生词</button><button type="button" class="btn small ghost" data-sel="speak">朗读</button>`;
    document.body.appendChild(bar);
    const rect=sel.getRangeAt(0).getBoundingClientRect();
    const width=bar.offsetWidth,height=bar.offsetHeight;
    bar.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2))+'px';
    bar.style.top=Math.max(8,rect.top-height-10)+(rect.top-height-10<8?height+20:0)+'px';
    selToolbar=bar;
  }
  function meaningModal(){
    const {text,context}=lastSelection;
    const found=dictLookup(text);
    const senses=found?found.senses.map(s=>`<li>${esc(s)}</li>`).join(''):'';
    const head=found?`<h2 class="word-term" lang="en">${esc(found.term)}</h2>${found.inflected&&found.inflected!==found.term?`<p class="helper-copy">原形（你选中的是 ${esc(found.inflected)}）</p>`:''}`:`<h2 class="word-term" lang="en">${esc(text)}</h2>`;
    const offline=found?`<ul class="word-senses">${senses}</ul>`:`<p class="note">内置词典没有收录这个词。可连接AI获取解释，或直接收藏后自己填写。</p>`;
    const ai=health.configured?button('word-ai-selection','让AI解释这个词','small'):button('go-settings','连接AI后可深入解释','ghost small');
    openModal('划词释义',`<div class="word-card">${head}${offline}${context?`<p class="word-context" lang="en">${esc(context)}</p>`:''}<div class="settings-actions">${ai}${button('word-save-selection','收藏到生词库','')}</div><p class="helper-copy">内置释义离线可用，覆盖本课全部词汇；AI可补充例句与辨析。</p></div>`);
  }
  function saveSelectionWord(silent=false){
    const {text,context}=lastSelection;
    if(!text)return false;
    const term=text.slice(0,80);
    if(state.vocabulary.some(w=>w.term.toLowerCase()===term.toLowerCase())){if(!silent)toast('这个词已在生词库。');return false;}
    if(state.vocabulary.length>=3000){toast('生词已达3000条，请先导出和整理。');return false;}
    const found=dictLookup(term);
    const meaning=found?found.senses.join('；').slice(0,500):'';
    state.vocabulary.push({id:'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),term,context:context.slice(0,1500),meaning,lessonId:idPattern.test(lessonId)?lessonId:'L01',due:day(),seen:0,streak:0});
    const saved=save();
    if(!silent){closeModal();toast(saved?'已收藏到生词库，可在「复习与生词」查看。':'已收藏，但未能保存，请导出备份。');}
    return saved;
  }
  function speakSelection(){
    const text=lastSelection.text;
    if(!text||!window.speechSynthesis){toast('当前浏览器不支持朗读选中内容。');return;}
    const v=selectedVoice();
    if(!v){toast('此浏览器没有英文合成声线，无法朗读选中内容。');return;}
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.voice=v;u.lang=v.lang;u.rate=state.preferences.rate;u.volume=state.preferences.volume;
    window.speechSynthesis.speak(u);
  }
  function previewPack(pack){
    if(!['a','b'].includes(pack))return;
    stopPreview();
    // Auditioning a voice must not talk over the lesson the learner paused.
    if(bundledPlayer&&!bundledPlayer.paused&&!bundledPlayer.ended){bundledPlayer.pause();previewResume=true;}
    const a=new Audio(`/audio/${pack}/_preview.wav`);
    a.volume=state.preferences.volume;a.playbackRate=state.preferences.rate;
    previewAudio=a;audioHost().appendChild(a);
    const finish=()=>{if(previewAudio!==a)return;previewAudio=null;a.remove();
      if(previewResume){previewResume=false;resumeCurrentAudio();}};
    a.onended=finish;
    a.onerror=()=>{if(previewAudio!==a)return;finish();toast(health.host?'这套声线的试听样本缺失。':'本地服务未连接，无法试听。请先运行「启动.ps1」。');};
    a.play().then(()=>toast('正在试听这套声线。')).catch(()=>{finish();toast('浏览器阻止了播放，请再点一次试听。');});
  }
  function stopPreview(){
    if(!previewAudio)return;
    const a=previewAudio;previewAudio=null;previewResume=false;
    try{a.pause();a.remove();}catch{}
  }
  function switchVoicePack(pack){
    const next=['a','b'].includes(pack)?pack:'a';
    if(next===state.preferences.voicePack)return;
    state.preferences.voicePack=next;
    packFallbackUsed=false;activeTurn=-1;loopTurn=-1;
    const wasPlaying=!!bundledPlayer&&!bundledPlayer.paused&&!bundledPlayer.ended;
    const target=audioId||lessonId;
    stopSound();resetPlayer();save();render();
    if(wasPlaying&&page==='lesson'){lessonId=target;playSpeech(true);}
    toast('已切换声线。');
  }
  function dialogueForm(){
    if(!health.configured){aiSetupNotice();return;}
    if(dialogueLesson!==lessonId){dialogueLesson=lessonId;dialogueHistory=[];}
    const history=dialogueHistory.map(t=>`<p><strong>${t.role==='learner'?'你':'对方'}：</strong><span lang="en">${esc(t.text)}</span></p>`).join('');
    openModal('情境文字对话',`<p class="modal-copy">${esc(getLesson()?.title)} · 对话仅在本次页面停留期间保留。不要输入真实公司或个人敏感信息。</p><div class="dialogue-history">${history||'<p>用英语说出你的第一句话。</p>'}</div><form id="dialogue-form"><div class="field"><label for="dialogue-message">你的回复</label><textarea id="dialogue-message" name="message" maxlength="1200" required></textarea></div><p class="helper-copy">每一轮都要先确认发送内容、服务商和费用。</p><button type="submit" class="btn primary">准备发送</button></form>`);
  }
  function removeReview(key){const index=state.reviews.findIndex(r=>r.key===key);if(index<0)return;undoReview={item:{...state.reviews[index]},index};state.reviews.splice(index,1);reviewRevealed.delete(key);if(reviewKey===key)reviewKey='';const saved=save();render();toast(saved?'已移除，可撤销。':'已在本页移除，尚未保存。');}
  async function handleAction(el) {
    const a=el.dataset.action;
    if(['home','library','review','journal','settings'].includes(a)){navigate(a);return;}
    if(a==='open-lesson'){navigate('lesson',el.dataset.id);return;}
    if(a==='close-modal'){closeModal();return;}
    if(a==='help'){helpModal();return;}
    if(a==='go-settings'){closeModal();navigate('settings');return;}
    if(a==='stage'){if(shadowOn)stopShadow(true);navigate('lesson',null,Number(el.dataset.index));return;}
    if(a==='next-stage'){navigate('lesson',null,Math.min(2,stage+1));return;}
    if(a==='play'){if(shadowOn)stopShadow(true);playSpeech();return;}
    if(a==='shadow'){if(shadowOn)stopShadow();else startShadow();return;}
    if(a==='continued-toggle'){if(bundledPlayer){if(bundledPlayer.paused)resumeCurrentAudio();else bundledPlayer.pause();}else if(utterance)playSpeech();return;}
    if(a==='continued-return'){navigate('lesson',audioId||lessonId,0);return;}
    if(a==='replay'||a==='retry-audio'){playSpeech(true);return;}
    if(a==='transcript'){transcript=!transcript;if(transcript){const p=progress(lessonId,true);p.transcriptOpened=Math.min(100000,p.transcriptOpened+1);p.supportUsed=true;save();}render();return;}
    if(a==='hint'){const p=progress(lessonId,true);p.hintLevel=Math.min(3,p.hintLevel+1);p.supportUsed=true;if(p.hintLevel===3)p.chineseHints=Math.min(100000,p.chineseHints+1);save();render();document.getElementById('hint-disclosure').open=true;return;}
    if(a==='hide-hints'){progress(lessonId,true).hintLevel=0;transcript=false;save();render();document.getElementById('hint-disclosure').open=false;document.querySelector('#hint-disclosure summary')?.focus({preventScroll:true});return;}
    if(a==='reading-only'||a==='both-mode'){if(a==='reading-only')stopSound();const p=progress(lessonId,true);p.mode=a==='reading-only'?'reading':'both';syncChecked(p);navigate('lesson',null,p.mode==='reading'?1:0);toast(p.mode==='reading'?'本次只记阅读练习；可随时改回听读。':'已改回听读练习。');return;}
    if(a==='check-group'){
      const p=progress(lessonId,true),listening=el.dataset.group==='listen',offset=listening?0:2,missing=p.answers.slice(offset,offset+2).findIndex(x=>x===null);
      if(missing>=0){toast('先为这两题各选一个意思，不要求满分。');document.getElementById(`answer-${offset+missing}-0`)?.focus();return;}
      if(listening&&p.firstAnswers.slice(0,2).every(x=>x===null))p.listenContext=p.supportUsed||p.transcriptOpened>0||p.hintLevel>0?'supported':p.heard?'independent':'not-listened';
      for(let i=offset;i<offset+2;i++)if(p.firstAnswers[i]===null)p.firstAnswers[i]=p.answers[i];
      if(listening)p.listenChecked=true;else{p.readingChecked=true;p.read=true;}
      syncChecked(p);save();render({focusTarget:`#${listening?'listen':'reading'}-feedback`});return;
    }
    if(a==='retry-group'){const p=progress(lessonId,true),listening=el.dataset.group==='listen',offset=listening?0:2;for(let i=offset;i<offset+2;i++)p.answers[i]=null;if(listening)p.listenChecked=false;else p.readingChecked=false;syncChecked(p);save();render({focusTarget:`#answer-${offset}-0`});toast('可以重答；首次提交与已有完成记录保留。');return;}
    if(a==='finish'){
      const p=progress(lessonId,true);if(!readyToFinish(p)){toast('先完成相应的听读和理解题，或选择只练阅读。');return;}
      const existing=!!p.completedAt;
      if(!existing){p.completedAt=new Date().toISOString();p.completion={mode:p.mode,answers:requiredAnswers(p.firstAnswers,p.mode)?[...p.firstAnswers]:[...p.answers],context:p.mode==='reading'?'not-listened':p.listenContext};}
      const saved=save();render();toast(!saved?'练习只留在本页，请导出备份。':existing?'本轮已保存；首次完成记录保留。':p.mode==='reading'?'阅读练习已保存，不计听力完成。':'听读练习已保存。想用的表达可加入复习。');return;
    }
    if(a==='save-phrase'){
      const index=Number(el.dataset.index),l=getLesson(),key=lessonId+'_'+index;if(!l?.phrases[index])return;
      if(state.reviews.some(r=>r.key===key)){removeReview(key);return;}
      if(state.reviews.length>=1000){toast('收藏已达1000条上限，请先导出备份。');return;}
      state.reviews.push({key,lessonId,phraseIndex:index,due:day(),seen:0,streak:0});const saved=save();render();toast(saved?'已收藏，可到复习里从情境回想。':'已收藏在本页，尚未保存，请导出。');return;
    }
    if(a==='remove-review'){removeReview(el.dataset.key);return;}
    if(a==='undo-review'){let saved=false;if(undoReview&&!state.reviews.some(r=>r.key===undoReview.item.key)){state.reviews.splice(Math.min(undoReview.index,state.reviews.length),0,undoReview.item);saved=save();}undoReview=null;render();toast(saved?'已恢复上次移除的表达。':'已在本页恢复，尚未保存，请导出副本。');return;}
    if(a==='reveal-review'){reviewRevealed.add(el.dataset.key);render({focusTarget:'[data-action="review-again"]'});return;}
    if(a==='review-tab'){reviewTab=['all','words'].includes(el.dataset.tab)?el.dataset.tab:'due';reviewKey='';render();return;}
    if(a==='add-word'||a==='edit-word'){wordForm(el.dataset.id||'');return;}
    if(a==='delete-word'){openModal('删除这条生词？',`<p class="modal-copy">此操作会从当前记录移除该生词。</p>${button('delete-word-confirm','确认删除','danger',`data-id="${esc(el.dataset.id)}"`)}`);return;}
    if(a==='delete-word-confirm'){state.vocabulary=state.vocabulary.filter(w=>w.id!==el.dataset.id);save();closeModal();render();toast('生词已删除。');return;}
    if(a==='word-ai-selection'){const w=lastSelection;if(!w.text){toast('请先选中一个单词。');return;}if(!w.context.trim()){toast('没有取到语境，请先在课文里选中单词。');return;}confirmSpecialAI('vocabulary',{term:w.text,context:w.context});return;}
    if(a==='word-save-selection'){const ok=saveSelectionWord(true);closeModal();render();toast(ok?'已收藏到生词库。':'这个词已在生词库，或未能保存。');return;}
    if(a==='word-ai'){const w=state.vocabulary.find(x=>x.id===el.dataset.id);if(!w)return;if(!w.context.trim()){toast('请先编辑生词，填写一段公开或虚构的语境。');return;}confirmSpecialAI('vocabulary',{term:w.term,context:w.context});return;}
    if(a==='dialogue'){dialogueForm();return;}
    if(a==='account-register'||a==='account-login'){accountForm(a==='account-register');return;}
    if(a==='account-logout'){await accountLogout();return;}
    if(a==='sync-now'){if(syncBlocked)accountConflict();else await syncNow();return;}
    if(a==='sync-conflict'){accountConflict();return;}
    if(a==='sync-load'||a==='sync-overwrite'){await resolveConflict(a==='sync-overwrite');return;}
    if(a==='clear-ai'){await accountRequest('/api/ai/config',{clear:true});await checkHealth();render();toast('已清除当前进程中的AI配置。');return;}
    if(a==='preview-voice'){const voice=selectedVoice();if(!voice||!window.speechSynthesis){toast('此浏览器没有英文合成声线；内置场景音频不受影响。');return;}stopSound();stopPreview();const sample=new SpeechSynthesisUtterance('A little practice makes room for new ideas.');sample.voice=voice;sample.lang=voice.lang;sample.rate=state.preferences.rate;sample.volume=state.preferences.volume;sample.onend=()=>toast('试听结束。');sample.onerror=()=>toast('试听失败：浏览器拒绝了合成朗读。');window.speechSynthesis.speak(sample);toast('正在试听浏览器声线。');return;}
    if(a==='preview-pack'){previewPack(el.dataset.pack);return;}
    if(a==='play-turn'){playTurn(Number(el.dataset.index));return;}
    if(a==='loop-turn'){
      if(!lessonTimings()){toast('这一课还没有逐句时间轴，可整段播放。');return;}
      if(loopTurn>=0){loopTurn=-1;toast('已取消单句循环。');}
      else if(activeTurn<0){toast('先在英文原文里点一句，再开启单句循环。');return;}
      else{loopTurn=activeTurn;toast('已开启单句循环，再点一次取消。');}
      render();return;
    }
    if(a==='review-now'){reviewKey=el.dataset.key;reviewTab='due';reviewRevealed.delete(reviewKey);render({focusTarget:'#recall-draft'});return;}
    if(a==='review-again'||a==='review-known'){
      const key=el.dataset.key;if(!reviewRevealed.has(key))return;
      const known=a==='review-known';
      let next=null;
      if(key.startsWith('word:')){
        const w=state.vocabulary.find(x=>'word:'+x.id===key);if(!w)return;
        next=scheduleReview({due:w.due||day(),seen:w.seen||0,streak:w.streak||0},known);
        w.due=next.due;w.seen=next.seen;w.streak=next.streak;
      } else {
        const index=state.reviews.findIndex(x=>x.key===key);if(index<0)return;
        next=scheduleReview(state.reviews[index],known);state.reviews[index]=next;
      }
      const saved=save();reviewRevealed.delete(key);delete reviewDrafts[key];reviewKey='';
      render(dueCount()?{focusTarget:'#recall-draft'}:{focusMain:true});
      toast(saved?`下次复习：${next.due}。`:'复习安排尚未保存，请导出备份。');return;
    }
    if(a==='export-csv'){exportReviewCSV();return;}
    if(a==='clear-filters'){searchTerm='';filterLevel='all';filterTheme='all';render({focusTarget:'#lesson-search'});return;}
    if(a==='category-filter'){filterTheme=Object.hasOwn(THEMES,el.dataset.theme)?el.dataset.theme:'all';render();return;}
    if(a==='text-size'){const order=['small','standard','large'];state.preferences.textSize=order[(order.indexOf(state.preferences.textSize)+1)%order.length];save();render();return;}
    if(a==='new-journal'){journalForm();return;}
    if(a==='edit-journal'){journalForm(el.dataset.id);return;}
    if(a==='delete-journal'){openModal('删除这条使用记录？',`<p class="modal-copy">只删除这条自述，不影响场景练习。此操作不可撤销。</p><div class="form-actions">${button('close-modal','取消','ghost')}${button('delete-journal-confirm','确认删除','danger',`data-id="${esc(el.dataset.id)}"`)}</div>`);return;}
    if(a==='delete-journal-confirm'){state.journals=state.journals.filter(j=>j.id!==el.dataset.id);const saved=save();closeModal();render({focusMain:true});toast(saved?'使用记录已删除。':'仅在本页删除，尚未保存。');return;}
    if(a==='explain'||a==='feedback'||a==='generate'){confirmAI(a);return;}
    if(a==='test-ai'){const old=lessonId;lessonId=lessons[0].id;confirmAI('explain');lessonId=old;return;}
    if(a==='ai-send'){await sendAI();return;}
    if(a==='refresh-health'){el.disabled=true;el.textContent='检查中…';await checkHealth();render();toast(health.detail);return;}
    if(a==='refresh-voices'){refreshVoices();toast(voices.length?`找到${voices.length}个英文声线。`:'没有找到英文声线，可使用内置音频。');return;}
    if(a==='record'){await startRecording();return;}
    if(a==='import-audio'){document.getElementById('audio-file').click();return;}
    if(a==='remove-audio'){stopSound();resetPlayer();if(customAudio)URL.revokeObjectURL(customAudio.url);customAudio=null;render();toast('已还原默认音频。');return;}
    if(a==='export'){download(`unfold-backup-${day()}.json`,JSON.stringify(state,null,2));toast('已请求下载备份，请确认浏览器保存位置。');return;}
    if(a==='export-raw'){if(originalRaw)download(`unfold-original-${day()}.json`,originalRaw);return;}
    if(a==='import'){document.getElementById('backup-file').click();return;}
    if(a==='reset'){resetConfirm();return;}
    if(a==='reset-confirm'){if(replaceLocal(newState(),pendingDestructiveRaw)){closeModal();navigate('home');toast('本地学习记录已重置。');}else render();return;}
    if(a==='restore-confirm'){if(pendingImport&&replaceLocal(pendingImport,pendingDestructiveRaw)){pendingImport=null;closeModal();navigate('home');toast('备份已恢复到当前浏览器。');}else render();return;}
    if(a==='reload-storage'){
      try{const raw=localStorage.getItem(KEY),next=raw?stateValid(JSON.parse(raw)):newState();clearVolatileMedia();state=next;lastStoredRaw=raw;originalRaw=raw;storageBlocked=false;storageWarning='';reviewRevealed.clear();reviewKey='';reviewDrafts={};undoReview=null;lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;navigate('home');toast('已载入浏览器中的最新记录。');}catch{toast('最新记录仍无法读取，未替换本页内容。请先导出原始记录。');}return;
    }
  }
  document.addEventListener('click',e=>{const el=e.target.closest?.('[data-action]');if(el&&!el.disabled)handleAction(el).catch(()=>toast('操作未完成。请重试；当前输入仍留在本页。'));});
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='writing-draft'){state.drafts[lessonId]=t.value.slice(0,1800);const saved=save();const status=document.getElementById('writing-save');if(status)status.textContent=saved?'草稿已保存在本地':'尚未保存，仅留本页，请导出备份。';}
    if(t.id==='recall-draft')reviewDrafts[t.dataset.key]=t.value.slice(0,500);
    if(t.id==='lesson-search'){searchTerm=t.value;render();}
    if(t.id==='volume-range'){const v=Math.min(1,Math.max(0,Number(t.value)/100));state.preferences.volume=v;const out=document.getElementById('volume-out');if(out)out.textContent=Math.round(v*100);if(bundledPlayer)bundledPlayer.volume=v;if(utterance)utterance.volume=v;if(previewAudio)previewAudio.volume=v;save();}
    if(t.id==='audio-seek'&&bundledPlayer&&Number.isFinite(bundledPlayer.duration)){playerSeeking=true;lastAudioTime=null;bundledPlayer.currentTime=Math.min(bundledPlayer.duration,Math.max(0,Number(t.value)));const elapsed=document.getElementById('audio-elapsed');if(elapsed)elapsed.textContent=formatTime(t.value);}
  });
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.matches('[data-question]')){const index=Number(t.dataset.question),p=progress(lessonId,true);if(index>=0&&index<4&&!(index<2?p.listenChecked:p.readingChecked)){p.answers[index]=Number(t.value);save();}}
    if(t.id==='level-filter'){filterLevel=t.value;render();}
    if(t.id==='play-rate'||t.id==='default-rate'){state.preferences.rate=Number(t.value);if(bundledPlayer){recordPlayed(bundledPlayer,true);bundledPlayer.playbackRate=state.preferences.rate;lastAudioTime=bundledPlayer.currentTime;lastAudioWall=Date.now();}save();if(utterance)toast('合成朗读将在下次播放使用新速度；内置音频可即时调速。');}
    if(t.id==='voice-select'){if(utterance)stopSound();state.preferences.voice=t.value;save();render();}
    if(t.id==='text-size-select'){state.preferences.textSize=['small','standard','large'].includes(t.value)?t.value:'standard';save();render();}
    if(t.id==='theme-select'){state.preferences.theme=['auto','light','dark'].includes(t.value)?t.value:'auto';save();render();}
    if(t.name==='voice-pack'&&t.checked){switchVoicePack(t.value);}
    if(t.id==='auto-next'){state.preferences.autoNext=t.checked;save();toast(t.checked?'听完整段后会自动播放下一课。':'已关闭自动连播。');}
    if(t.id==='speaking-done'||t.id==='writing-done'){progress(lessonId,true)[t.id==='speaking-done'?'speakingDone':'writingDone']=t.checked;save();}
    if(t.id==='audio-file'&&t.files[0]){
      const f=t.files[0];if(f.size>50*1024*1024||!f.size||(!f.type.startsWith('audio/')&&!/\.(wav|mp3|m4a|aac|ogg|opus|flac|webm)$/i.test(f.name))){toast('请选择不超过50MB、格式受浏览器支持的音频。');t.value='';return;}
      stopSound();resetPlayer();if(customAudio)URL.revokeObjectURL(customAudio.url);customAudio={lessonId,url:URL.createObjectURL(f),name:f.name};render();toast('文件只在本页播放，请核对与课文对应。');
    }
    if(t.id==='backup-file'&&t.files[0]){
      try{const f=t.files[0];if(f.size>2*1024*1024)throw new Error('备份不能超过2MB');const imported=stateValid(JSON.parse(await f.text()));pendingImport=imported;pendingDestructiveRaw=storageSnapshot();openModal('用备份替换当前记录？',`<p class="modal-copy">已检查：${Object.values(imported.progress).filter(p=>p.completedAt).length} 个已完成场景，${imported.journals.length} 条使用记录，${imported.reviews.length} 条收藏，${imported.generated.length} 份AI材料。</p><p class="modal-copy">将覆盖当前浏览器的记录，不能合并。建议先导出当前备份；不会修改服务端密钥。</p><div class="settings-actions">${button('export','先导出当前备份','')}${button('restore-confirm','确认替换记录','primary')}</div>`);}catch(error){toast('未导入：'+error.message);}finally{t.value='';}
    }
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id==='account-form'){e.preventDefault();await accountLogin(e.target);return;}
    if(e.target.id==='ai-config-form'){
      e.preventDefault();const form=e.target,d=new FormData(form),submit=form.querySelector('[type=submit]');submit.disabled=true;
      try{await accountRequest('/api/ai/config',{base_url:d.get('base_url'),model:d.get('model'),api_key:d.get('api_key'),token_param:d.get('token_param'),token_limit:health.token_limit||2700});await checkHealth();render();toast('配置已保存到服务内存；请试一次真实调用。');}catch(error){submit.disabled=false;toast(error.message);}return;
    }
    if(e.target.id==='word-form'){
      e.preventDefault();const d=new FormData(e.target),term=String(d.get('term')||'').trim(),context=String(d.get('context')||'').trim(),meaning=String(d.get('meaning')||'').trim(),id=e.target.dataset.id;
      if(!term||term.length>80||context.length>1500||meaning.length>500){toast('请检查生词和语境长度。');return;}
      const current=state.vocabulary.find(w=>w.id===id);if(!current&&state.vocabulary.length>=3000){toast('生词已达3000条，请先导出和整理。');return;}
      const item={id:current?.id||'W_'+(window.crypto?.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+Math.random().toString(36).slice(2,8)),term,context,meaning,lessonId:current?.lessonId||lessonId,due:validDate(current?.due)?current.due:day(),seen:current?.seen||0,streak:current?.streak||0};
      if(current)Object.assign(current,item);else state.vocabulary.push(item);const saved=save();closeModal();render();toast(saved?'生词已收藏，可在复习中查看。':'生词仅保留本页，请导出。');return;
    }
    if(e.target.id==='dialogue-form'){
      e.preventDefault();const message=String(new FormData(e.target).get('message')||'').trim();if(!message)return;
      confirmSpecialAI('dialogue',{...apiLesson(getLesson()),message,history:dialogueHistory.slice(-8)});return;
    }
    if(e.target.id!=='journal-form')return;e.preventDefault();const data=new FormData(e.target),date=data.get('date'),scenario=data.get('scenario'),rating=Number(data.get('rating')),note=String(data.get('note')||'').trim();
    if(!validDate(date)||date>day()||!Object.hasOwn(THEMES,scenario)||!Number.isInteger(rating)||rating<1||rating>5||note.length>280){toast('请选择有效日期、场景与本次体验。');return;}
    if(!journalEditing&&state.journals.length>=1000){toast('记录已达1000条上限，请先导出备份。');return;}
    const id=journalEditing||'J_'+(window.crypto?.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+Math.random().toString(36).slice(2,8));
    const entry={id,date,scenario,rating,note},index=state.journals.findIndex(j=>j.id===id);if(index>=0)state.journals[index]=entry;else state.journals.push(entry);
    const saved=save();closeModal();render({focusMain:true});toast(saved?'记录已保存在本地，不传AI。':'记录仅留本页，请导出备份。');
  });
  modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  modal.addEventListener('keydown',e=>{
    if(!modal.open||e.key!=='Tab'||e.altKey||e.ctrlKey||e.metaKey)return;
    const targets=[...modal.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],summary,[tabindex]')].filter(t=>!t.disabled&&t.tabIndex>=0&&t.getClientRects().length&&getComputedStyle(t).visibility!=='hidden');
    const first=targets[0],last=targets[targets.length-1],active=document.activeElement;
    if(!first){e.preventDefault();return;}
    if(active===modal||!modal.contains(active)||e.shiftKey&&active===first||!e.shiftKey&&active===last){e.preventDefault();(e.shiftKey?last:first).focus();}
  });
  modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();});
  // Leaving a tab must not interrupt listening. Hidden microphones still stop.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      hiddenWhilePlaying=!!bundledPlayer&&!bundledPlayer.paused&&!bundledPlayer.ended;
      if(bundledPlayer)recordPlayed(bundledPlayer,true);
      if(recordPending||recorder?.state==='recording')stopRecording();
    } else {
      // A backgrounded tab can be suspended by the browser; put it back exactly
      // where the learner left off instead of leaving the player silently stuck.
      const resume=hiddenWhilePlaying&&bundledPlayer&&bundledPlayer.paused&&!bundledPlayer.ended;
      hiddenWhilePlaying=false;
      if(resume)resumeCurrentAudio();
      paintPlayer();
    }
  });
  document.addEventListener('selectionchange',()=>{clearTimeout(selTimer);selTimer=setTimeout(showSelToolbar,180);});
  document.addEventListener('mousedown',e=>{if(selToolbar&&!selToolbar.contains(e.target))hideSelToolbar();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){hideSelToolbar();if(shadowOn)stopShadow();}
    // Shortcuts only act on the listening stage and never while typing.
    const tag=(e.target?.tagName||'').toLowerCase();
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
    if(tag==='input'||tag==='textarea'||tag==='select'||e.target?.isContentEditable)return;
    if(modal.open)return;
    if(page!=='lesson')return;
    if(e.key===' '&&stage===0){e.preventDefault();playSpeech();return;}
    if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&bundledPlayer){e.preventDefault();seekBy(e.key==='ArrowLeft'?-5:5);return;}
    if((e.key==='j'||e.key==='k')&&stage===0){e.preventDefault();stepTurn(e.key==='j'?1:-1);return;}
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-sel]');if(!btn||!selToolbar)return;
    e.preventDefault();e.stopPropagation();
    const kind=btn.dataset.sel;
    if(kind==='meaning')meaningModal();
    else if(kind==='save'){saveSelectionWord();hideSelToolbar();render();}
    else if(kind==='speak')speakSelection();
  },true);
  configureMediaSession();
  window.addEventListener('beforeunload',()=>{stopSound();stopPreview();stopRecording();});
  window.addEventListener('hashchange',()=>{if(lessons.length&&window.location.hash!=='#main')fromRoute();});
  window.addEventListener('storage',e=>{
    if((e.key===KEY||e.key===null)&&e.newValue!==lastStoredRaw){storageBlocked=true;originalRaw=e.key===KEY?e.newValue:storageSnapshot()??null;storageWarning='另一个页面更新了学习记录，已暂停覆盖。先导出当前副本，再载入最新记录。';stopSound();render();toast(storageWarning);}
  });
  if(window.speechSynthesis)window.speechSynthesis.addEventListener('voiceschanged',refreshVoices);
  Object.defineProperty(window,'UnfoldPlayback',{get:()=>bundledPlayer?Object.freeze({lessonId:audioId,source:audioSource,currentTime:bundledPlayer.currentTime,duration:Number.isFinite(bundledPlayer.duration)?bundledPlayer.duration:null,rate:bundledPlayer.playbackRate,paused:bundledPlayer.paused,ended:bundledPlayer.ended,readyState:bundledPlayer.readyState,networkState:bundledPlayer.networkState,covered:coveredDuration(playerRanges),errorCode:bundledPlayer.error?.code||null}):null});
  async function init(){
    readStorage();
    const control=new AbortController(),timeout=setTimeout(()=>control.abort(),5000);
    try {
      await checkHealth();
      const responses=await Promise.all(['lessons.json','catalog.json'].map(path=>fetch(path,{signal:control.signal})));
      if(responses.some(response=>!response.ok))throw new Error();const groups=await Promise.all(responses.map(response=>response.json()));if(groups.some(items=>!Array.isArray(items)))throw new Error();const items=groups.flat();if(!items.length)throw new Error();lessons=items.map(lessonValid);
      if(new Set(lessons.map(l=>l.id)).size!==lessons.length)throw new Error();
      await refreshAccount();await checkHealth();
      lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;
      refreshVoices();if(window.location.hash&&window.location.hash!=='#main')fromRoute();else render();
    }catch{
      if(Array.isArray(window.UnfoldContent)&&window.UnfoldContent.length){
        try{
          lessons=window.UnfoldContent.map(lessonValid);
          if(new Set(lessons.map(l=>l.id)).size===lessons.length){
            offlineText=true;health={configured:false,host:'',model:'',detail:'本地服务未连接：已加载内置文本，音频与账号同步不可用。',csrf_token:''};
            lessonId=getLesson(state.lastLesson)?state.lastLesson:lessons[0].id;
            refreshVoices();render();toast('未连接本地服务：文本可练习，音频与同步不可用。');return;
          }
        }catch{}
      }
      app.innerHTML=`<main class="boot" id="main" tabindex="-1"><span class="boot-mark">U</span><h1>练习材料未加载</h1><p>通过产品目录的 <strong>启动.ps1</strong> 启动本地服务，再刷新页面。不要直接双击HTML。</p><a class="btn primary" href="">重新加载</a></main>`;}
    finally{clearTimeout(timeout);}
  }
  init();
})();
