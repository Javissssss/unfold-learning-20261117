/* Silent recall and personal image codes. Reuses the host's account state and modal. */
(function(root){
  'use strict';
  function create(b){
    const E=b.engine,D=b.data,esc=b.esc,btn=b.button;
    let failure='';try{E.catalogValid(D.words);}catch(e){failure=e.message;}
    const base=failure?[]:D.words,byTerm=new Map(base.map(w=>[E.termKey(w.term),w]));
    let view='study',mode='mix',search='',codeSearch='',libraryTopic='all',libraryPage=0,session=null,editor=null,ticket=0;
    const S=()=>b.getState(),today=()=>b.day(),uid=()=> 'C_'+(globalThis.crypto?.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+Math.random().toString(36).slice(2,10));
    const topicLabel=t=>t==='all'?'全部':t==='saved'?'我的生词':t==='single'?'单词自练':E.TOPICS[t]||'全部';
    const directionLabel=d=>d==='zh'?'中文 → 英文':'英文 → 中文';
    const save=patch=>b.commit({...S(),...patch});
    function all(){
      const saved=new Map();for(const w of S().vocabulary)if(!saved.has(E.termKey(w.term)))saved.set(E.termKey(w.term),w);
      const rows=base.map(w=>({...w,saved:saved.get(E.termKey(w.term))||null,custom:false}));
      for(const [key,w] of saved)if(!byTerm.has(key))rows.push({id:w.id,term:w.term,pos:'',meaning:w.meaning,tip:'这是你收藏的词；释义和原句可在「复习 → 生词」编辑。',topics:[],collocations:[],examples:[],saved:w,custom:true});
      return rows;
    }
    const find=id=>all().find(w=>w.id===id);
    function canonicalId(word){return byTerm.get(E.termKey(word.term))?.id||word.id;}
    function record(w,dir){
      const known=S().wordStudy?.[w.id]?.[dir];if(known)return known;
      if(dir==='zh'&&w.saved&&w.saved.seen>0)return {due:w.saved.due||today(),seen:w.saved.seen,streak:w.saved.streak||0};
      return null;
    }
    function filtered(topic,ready=false){return all().filter(w=>(topic==='all'||topic==='saved'&&w.saved||w.topics.includes(topic))&&(!ready||!!w.meaning.trim()));}
    function stats(rows,dir){
      let due=0,fresh=0,done=0;
      for(const w of rows){const s=record(w,dir);if(!s||!s.seen)fresh++;else if(s.due<=today())due++;if(s?.last===today())done++;}
      return {due,fresh,done};
    }
    function hints(term,includeDisabled=false){return E.matches(term,includeDisabled?(S().wordCodes||[]).map(c=>({...c,enabled:true})):S().wordCodes||[]);}
    function codesHTML(codes,editable=false){
      const cards=codes.map(c=>{
        const picture=c.imageData?`<img src="${esc(c.imageData)}" alt="${esc(c.title+'，'+c.fragment+'的个人图像编码')}" width="96" height="96" loading="lazy">`:`<div class="wc-code-symbol" aria-hidden="true">${esc(c.title.slice(0,4))}</div>`;
        const note=!c.note?'':c.note.length>140?`<details class="wc-code-note-disclosure"><summary>画面说明</summary><p class="wc-code-note">${esc(c.note)}</p></details>`:`<p class="wc-code-note">${esc(c.note)}</p>`;
        const actions=editable?`<div class="wc-code-actions">${btn('wc-code-edit','编辑','small',`data-id="${esc(c.id)}"`)}${btn('wc-code-matches','匹配词','ghost small',`data-id="${esc(c.id)}"`)}${btn('wc-code-toggle',c.enabled?'提示已启用':'提示已关闭','ghost small',`data-id="${esc(c.id)}" aria-pressed="${c.enabled}"`)}${btn('wc-code-delete','删除','ghost small',`data-id="${esc(c.id)}" aria-label="删除${esc(c.fragment)}编码"`)}</div>`:'';
        return `<article class="wc-code-card">${picture}<div class="wc-code-body"><h3><span lang="en">${esc(c.fragment)}</span><span class="wc-code-arrow" aria-hidden="true"> → </span>${esc(c.title)}</h3><p class="helper-copy">${c.kind==='root'?'用户标注词根':'个人拼写片段'} · ${c.match==='start'?'只匹配开头':c.match==='end'?'只匹配结尾':'匹配任意位置'}${c.rootMeaning?' · '+esc(c.rootMeaning):''}</p>${note}${actions}</div></article>`;
      });
      return `<div class="wc-code-list">${cards.join('')}</div>`;
    }
    function examplesHTML(w,showOwnMeaning=true){
      const original=w.saved?.context&&!w.examples.some(e=>e.en===w.saved.context)?`<section><h3>我的原句</h3><p class="wc-original" lang="en">${esc(w.saved.context)}</p></section>`:'';
      const ownMeaning=showOwnMeaning&&w.saved?.meaning&&w.saved.meaning!==w.meaning?`<section><h3>我的解释</h3><p>${esc(w.saved.meaning)}</p></section>`:'';
      return `<div class="wc-answer-content"><section><h3>常用搭配</h3>${w.collocations.length?`<ul class="wc-collocations" lang="en">${w.collocations.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:'<p class="helper-copy">自选词暂没有搭配；可补充原句，或按需使用AI辨析。</p>'}</section><section><h3>记住用法</h3><p class="wc-usage">${esc(w.tip)}</p></section>${original}${ownMeaning}${w.examples.length?`<section><h3>语境例句</h3><ol class="wc-examples">${w.examples.map(e=>`<li><p lang="en">${esc(e.en)}</p><p class="wc-example-zh">${esc(e.zh)}</p></li>`).join('')}</ol></section>`:''}</div>`;
    }
    function wordActions(w,modal=false){
      return `<div class="wc-word-actions">${btn('wc-save-word',w.saved?'已在生词库':'收藏生词',w.saved?'ghost small':'small',`data-id="${esc(w.id)}" ${w.saved?'disabled':''}`)}${btn('wc-code-new','编辑图像编码','ghost small',`data-term="${esc(w.term)}"`)}${modal?btn('wc-practice-one','练这个词','primary small',`data-id="${esc(w.id)}"`):''}${b.ai?btn('wc-ai','AI辨析','ghost small',`data-id="${esc(w.id)}"`):''}</div>`;
    }
    function setupHTML(){
      const pref=S().preferences,topic=pref.wordTopic||'all',dir=pref.wordDirection||'en',rows=filtered(topic,true),counts=stats(rows,dir),excluded=filtered(topic).length-rows.length;
      return `<section class="wc-setup"><div class="wc-setup-lead"><h2>先回想，再翻卡</h2><p>${dir==='zh'?'看中文和挖空例句，试着想起英文。':'看英文，试着想起意思和用法。'}全程不需要听、说。</p></div><div class="wc-filter-grid"><label for="wc-topic">词汇主题<select id="wc-topic">${[['all','全部'],...Object.entries(E.TOPICS),['saved','我的生词']].map(([k,t])=>`<option value="${k}" ${topic===k?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label for="wc-direction">回想方向<select id="wc-direction"><option value="en" ${dir==='en'?'selected':''}>英文 → 中文</option><option value="zh" ${dir==='zh'?'selected':''}>中文 → 英文</option></select></label><label for="wc-mode">本批内容<select id="wc-mode">${[['mix','到期优先 + 新词'],['due','只练到期'],['new','只练新词'],['all','全部（可提前练）']].map(([k,t])=>`<option value="${k}" ${mode===k?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="wc-setup-foot"><div class="wc-counts"><span>到期 <strong>${counts.due}</strong></span><span>未练 <strong>${counts.fresh}</strong></span><span>今日已练 <strong>${counts.done}</strong></span></div>${btn('wc-start','开始这批 '+b.icon('arrow'),'primary')}</div><p class="helper-copy wc-rule-short">当前方向分别计词数；每批最多20词，新词最多10词。</p>${excluded?`<p class="helper-copy">${excluded} 个自选词缺少释义，暂不入队。到「复习 → 生词」补充即可。</p>`:''}</section>`;
    }
    function current(){return session?find(session.ids[session.index]):null;}
    function recallHTML(){
      if(!session)return setupHTML();
      if(session.index>=session.ids.length){
        const answers=session.answers,good=answers.filter(a=>a.grade==='good').length,hard=answers.filter(a=>a.grade==='hard').length,again=answers.filter(a=>a.grade==='again').length;
        return `<section class="wc-finish"><span class="wc-eyebrow">这一批完成了</span><h2>回想了 ${answers.length} 个词</h2><p>${directionLabel(session.direction)} · ${topicLabel(session.topic)}</p><div class="wc-counts wc-finish-counts"><span>想起来 <strong>${good}</strong></span><span>模糊 / 用提示 <strong>${hard}</strong></span><span>没想起 <strong>${again}</strong></span></div><p class="helper-copy">${session.skipped?`跳过 ${session.skipped} 个，不计已学。`:'每次评分已保存；翻卡本身不计已学。'} 两个方向的进度独立，不是能力测评。</p><div class="wc-word-actions">${btn('wc-next-batch','继续一批','primary')}${btn('wc-end','回到选择','ghost')}</div></section>`;
      }
      const w=current();if(!w)return `<section class="wc-finish"><h2>这个词已不在当前词库</h2>${btn('wc-skip','跳到下一个','primary')}${btn('wc-end','结束这批','ghost')}</section>`;
      const matched=hints(w.term),dir=session.direction,show=session.revealed;
      const meaning=w.saved?.meaning||w.meaning,first=w.custom?(w.saved?.context||''):w.examples[0].en,masked=E.mask(first,w.term),safeContext=masked!==first?masked:'';
      const prompt=dir==='en'?`<h2 class="wc-term" lang="en" data-wc-term="${esc(w.term)}">${esc(w.term)}</h2>${w.pos?`<p class="wc-pos" lang="en">${esc(w.pos)}</p>`:''}`:`<h2 class="wc-meaning-prompt">${esc(E.mask(meaning,w.term))}</h2>${safeContext?`<p class="wc-gap-sentence" lang="en">${esc(masked)}</p>`:'<p class="helper-copy">先试着想起英文；原句暂没有可挖空的原词。</p>'}`;
      const answerMeaning=dir==='en'||w.meaning!==meaning?`<p class="wc-short-meaning">${dir==='zh'?'参考释义：':''}${esc(w.meaning)}</p>`:'';
      return `<section class="wc-session" data-word-id="${esc(w.id)}"><div class="wc-session-header"><p>第 ${session.index+1} / ${session.ids.length} 词 · ${directionLabel(dir)}</p>${btn('wc-end','结束这批','ghost small')}</div><progress class="wc-progress" max="${session.ids.length}" value="${session.index}" aria-label="本批已处理词数"></progress><div class="wc-recall-face"><span class="wc-eyebrow">${show?'对照答案':'先在心里回想'}</span>${prompt}${!show?`<label class="wc-draft-label" for="wc-draft">想法或答案（选填，不上传）</label><input id="wc-draft" type="text" maxlength="200" autocomplete="off" spellcheck="false" value="${esc(session.draft)}" placeholder="先想一想，也可以直接翻卡">`:''}${matched.length&&!show?`<div class="wc-hint-control">${btn('wc-hint',session.hintsOpen?'收起图像提示':`图像提示 · ${matched.length}`,'ghost small',`aria-expanded="${session.hintsOpen}" aria-controls="wc-session-hints"`)}</div>${session.hintsOpen?`<div id="wc-session-hints">${codesHTML(matched)}<p class="helper-copy">提示只按字母片段匹配，不代表词源。看过提示会按「模糊」安排复习。</p></div>`:''}`:''}${!show?btn('wc-reveal','翻卡看答案','primary',`data-id="${esc(w.id)}"`):`<div class="wc-answer" id="wc-answer" tabindex="-1">${dir==='zh'?`<h3 class="wc-term" lang="en" data-wc-term="${esc(w.term)}">${esc(w.term)}</h3>`:''}${answerMeaning}${wordActions(w)}${examplesHTML(w,dir==='en')}</div><div class="wc-grade-actions" aria-label="本次回想自评">${btn('wc-grade','没想起','',`data-id="${esc(w.id)}" data-grade="again"`)}${btn('wc-grade','有点模糊','',`data-id="${esc(w.id)}" data-grade="hard"`)}${btn('wc-grade',session.hinted?'用了提示':'想起来了','primary',`data-id="${esc(w.id)}" data-grade="good"`)}</div><p class="helper-copy">${session.hinted?'这次看过图像或答案提示；评分最高按「模糊」记录。':'没想起或模糊：明天再练；连续想起：逐步拉长间隔。'}</p>`}</div><div class="wc-session-footer"><span>${topicLabel(session.topic)} · 不会自动朗读</span>${btn('wc-skip','跳过，不记已学','ghost small',`data-id="${esc(w.id)}"`)}</div></section>`;
    }
    function libraryHTML(){
      const term=search.trim().toLowerCase(),rows=filtered(libraryTopic).filter(w=>!term||(w.term+' '+w.meaning+' '+w.topics.map(topicLabel).join(' ')).toLowerCase().includes(term));
      const pages=Math.max(1,Math.ceil(rows.length/24));libraryPage=Math.min(libraryPage,pages-1);const chunk=rows.slice(libraryPage*24,libraryPage*24+24);
      return `<div class="wc-library-toolbar"><label class="search"><span class="visually-hidden">搜索词汇或中文释义</span>${b.icon('search')}<input id="wc-search" type="text" maxlength="100" placeholder="搜索英文 / 中文" value="${esc(search)}"></label><label class="filter-field" for="wc-library-topic"><span>主题</span><select id="wc-library-topic">${[['all','全部'],...Object.entries(E.TOPICS),['saved','我的生词']].map(([k,t])=>`<option value="${k}" ${libraryTopic===k?'selected':''}>${esc(t)}</option>`).join('')}</select></label></div><p class="result-count" role="status">${rows.length} 个词 · 第 ${libraryPage+1} / ${pages} 页</p>${chunk.length?`<div class="wc-library-grid">${chunk.map(w=>`<article class="wc-library-row"><div><h2 lang="en">${esc(w.term)}</h2><p>${esc(w.meaning||'尚未填写解释')}</p><span class="helper-copy">${w.custom?'我的生词':w.topics.map(topicLabel).join(' · ')}${w.saved?' · 已收藏':''}</span></div>${btn('wc-view-word','释义与例句','small',`data-id="${esc(w.id)}" aria-label="查看${esc(w.term)}的释义与例句"`)}</article>`).join('')}</div>`:`<div class="empty"><h2>没有找到这个词</h2><p>换个关键词或主题。自选词在「复习 → 生词」添加。</p>${btn('wc-library-reset','显示全部词','primary')}</div>`}<nav class="wc-pagination" aria-label="词库分页">${btn('wc-library-prev','上一页','',libraryPage===0?'disabled':'')}<span>${libraryPage+1} / ${pages}</span>${btn('wc-library-next','下一页','',libraryPage>=pages-1?'disabled':'')}</nav>`;
    }
    function codeLibraryHTML(){
      const q=codeSearch.trim().toLowerCase(),codes=(S().wordCodes||[]).filter(c=>!q||(c.fragment+' '+c.title+' '+c.note+' '+c.rootMeaning).toLowerCase().includes(q)).slice().sort((a,b)=>a.fragment.localeCompare(b.fragment));
      return `<div class="wc-library-toolbar"><label class="search"><span class="visually-hidden">搜索编码片段或联想</span>${b.icon('search')}<input id="wc-code-search" type="text" maxlength="100" placeholder="搜索片段 / 图像联想" value="${esc(codeSearch)}"></label>${btn('wc-code-new','新建编码 '+b.icon('plus'),'primary')}</div><p class="result-count" role="status">${codes.length} 个编码 · 图片可选，文字联想也能使用</p>${codes.length?codesHTML(codes,true):`<div class="empty"><h2>${q?'没有匹配的编码':'把你的记忆图像存下来'}</h2><p>例如 cons → 康熙。保存后，遇到 consider、consistent 等匹配词，可手动看提示。</p>${btn(q?'wc-code-search-reset':'wc-code-new',q?'清除搜索':'建立第一个编码','primary')}</div>`}<details class="help-disclosure"><summary>个人片段、词根与匹配规则</summary><p>默认是个人拼写片段，不是词源分析。可另标为「用户标注词根」并填写意义，但需自行核验。匹配只看字母，可限定开头或结尾，容易误匹配时可关闭提示。提示不会自动展开。</p><p>最多500条编码；单张缩略图约12KiB，图片总额度768KiB（base64编码后）。全账号学习记录仍受2MiB上限约束。图片随学习备份与账号状态保存，不传入AI，也不上传到源码仓库。</p></details>`;
    }
    function page(){
      if(failure)return `<div class="empty"><h1>刷词材料未通过检查</h1><p>${esc(failure)}</p><p>请重新加载。现有场景和学习记录不受影响。</p></div>`;
      return `<div class="wc-workspace"><div class="page-heading"><div><h1>刷词</h1><p>安静地回想，把图像联想变成自己的提示。</p></div><span class="wc-silent-label">静音练习</span></div><nav class="tabs wc-view-tabs" aria-label="刷词视图">${[['study','刷词'],['library','词库'],['codes','编码库']].map(([k,t])=>btn('wc-view',t,view===k?'tab active':'tab',`data-view="${k}" aria-pressed="${view===k}"`)).join('')}</nav>${view==='library'?libraryHTML():view==='codes'?codeLibraryHTML():recallHTML()}<details class="help-disclosure" id="wc-how"><summary>练习与资料说明</summary><p>进入刷词会暂停当前音频，并保留续播位置。翻卡后选择「没想起 / 有点模糊 / 想起来了」才写入复习进度。两个方向独立；用过提示的「想起来了」按模糊处理。输入框只用于自练，不保存或提交AI。</p><p>${base.length} 个精选词，${base.reduce((n,w)=>n+w.examples.length,0)} 组中英例句，覆盖日常、商务、财务会计、科技、金融与托业常见情境；词可跨主题出现，不重复计为新词。${esc(D.source)}</p><p>没想起或模糊明天再练；连续想起依次间隔3、7、14、30、60天。安排基于自评规则，不是正式水平测评或经验证的自适应模型。账号和备份包含进度、编码与缩略图；访客只存浏览器，本机账号不等于云服务。</p></details></div>`;
    }
    function start(ids=null){
      const pref=S().preferences,topic=pref.wordTopic||'all',dir=pref.wordDirection||'en',rows=filtered(topic,true),records=Object.fromEntries(rows.map(w=>[w.id,record(w,dir)]));
      const chosen=ids?ids.map(find).filter(w=>w&&w.meaning.trim()):E.queue(rows,records,mode,today());
      if(!chosen.length){b.toast(mode==='due'?'当前方向没有到期词。可选新词或提前练。':'当前筛选没有可练的词；换个主题，或先补充自选词释义。');return false;}
      session={ids:chosen.map(w=>w.id),index:0,direction:dir,topic:ids?'single':topic,key:b.getAccountKey(),revealed:false,hinted:false,hintsOpen:false,draft:'',answers:[],skipped:0};view='study';b.render({focusTarget:'#wc-draft'});return true;
    }
    function gradeRecord(w,dir,grade,hinted=false){
      const next=E.schedule(record(w,dir),grade,today(),hinted),study={...S().wordStudy,[w.id]:{...S().wordStudy?.[w.id],[dir]:next}};
      const vocabulary=dir==='zh'?S().vocabulary.map(v=>E.termKey(v.term)===E.termKey(w.term)?{...v,due:next.due,seen:next.seen,streak:next.streak}:v):S().vocabulary;
      if(!save({wordStudy:study,vocabulary}))return null;return next;
    }
    function gradeSaved(word,known,hinted=false){
      const id=canonicalId(word),w=find(id);if(!w)return null;return gradeRecord(w,'zh',known?'good':'again',hinted);
    }
    function next(){session.index++;session.revealed=false;session.hinted=false;session.hintsOpen=false;session.draft='';b.render(session.index<session.ids.length?{focusTarget:'#wc-draft'}:{focusMain:true});}
    function openWord(id){
      const w=find(id);if(!w)return;
      if(current()?.id===id&&!session.revealed)session.hinted=true;
      b.openModal('释义与例句',`<div class="wc-word-detail" data-word-id="${esc(w.id)}"><h2 class="wc-term" lang="en" data-wc-term="${esc(w.term)}">${esc(w.term)}</h2><p class="wc-short-meaning">${esc(w.meaning||'尚未填写解释')}</p>${wordActions(w,true)}${hints(w.term).length?btn('wc-word-hints','查看图像提示','ghost small',`data-term="${esc(w.term)}"`):''}${examplesHTML(w)}</div>`);
    }
    function openHints(term){
      const codes=hints(term);if(!codes.length){b.toast('这个词还没有启用的图像编码。');return;}
      if(current()&&E.termKey(current().term)===E.termKey(term)&&!session.revealed)session.hinted=true;
      b.openModal('我的图像提示',`${codesHTML(codes)}<p class="helper-copy">这些是你的字母片段联想，不是自动词源分析。不会发送到AI。</p>`);
    }
    function saveWord(w){
      if(!w||w.saved){b.toast('这个词已在生词库。');return false;}
      if(S().vocabulary.length>=3000){b.toast('生词已达3000条，请先导出和整理。');return false;}
      const s=record(w,'zh'),item={id:w.id,term:w.term,meaning:w.meaning,context:w.examples[0]?.en||'',lessonId:'WORD_CORE',due:s?.due||today(),seen:s?.seen||0,streak:s?.streak||0};
      if(!save({vocabulary:[...S().vocabulary,item]}))return false;
      b.render();const action=document.querySelector(`#modal [data-action="wc-save-word"][data-id="${w.id}"]`);if(action){action.disabled=true;action.textContent='已在生词库';}
      b.toast('已加入原有生词库，账号和备份一并保存。');return true;
    }
    function cancelEditor(){ticket++;editor=null;}
    function alive(t,key){return !!editor&&editor.ticket===t&&editor.key===key&&b.getAccountKey()===key&&b.modalOpen()&&document.getElementById('wc-code-form')?.dataset.ticket===String(t);}
    function previewFragment(){
      if(!editor)return;const fragment=document.getElementById('wc-code-fragment')?.value.toLowerCase()||'',target=document.getElementById('wc-code-preview');
      if(target)target.innerHTML=editor.term?E.segments(editor.term,fragment).map(p=>p.match?`<mark>${esc(p.text)}</mark>`:esc(p.text)).join(''):esc(fragment||'输入片段后，保存为可复用编码');
      const match=document.getElementById('wc-code-match')?.value||'any',help=document.getElementById('wc-code-preview-help');
      if(help)help.textContent=editor.term&&fragment&&E.matches(editor.term,[{fragment,match,enabled:true}]).length===0?'当前匹配位置不会命中这个词，请检查片段或位置。':editor.term?'高亮仅表示字母出现的位置，不证明词源关系。':'按字面拼写匹配；可限定词首或词尾。';
    }
    function editorError(message){const e=document.getElementById('wc-code-error');if(e){e.textContent=message;e.hidden=!message;if(message)e.scrollIntoView({block:'nearest'});}}
    function editorPicture(){
      if(!editor)return;const box=document.getElementById('wc-code-image-preview');if(box)box.innerHTML=editor.imageData?`<img src="${esc(editor.imageData)}" alt="待保存的个人编码缩略图" width="96" height="96">`:'<span class="helper-copy">没有图片，文字联想仍可使用</span>';
      const remove=document.querySelector('[data-action="wc-code-image-remove"]');if(remove)remove.disabled=!editor.imageData||editor.busy;
    }
    function openEditor(term='',fragment='',id=''){
      const code=(S().wordCodes||[]).find(c=>c.id===id),sel=String(globalThis.getSelection?.()||'').trim();
      if(!code&&!fragment&&/^[A-Za-z]{2,20}$/.test(sel)&&E.termKey(term).includes(sel.toLowerCase()))fragment=sel.toLowerCase();
      const blank={fragment,title:'',note:'',rootMeaning:'',kind:'fragment',match:'any',enabled:true,imageData:''},c=code||blank;
      b.openModal(code?'编辑图像编码':'建立图像编码',`<form id="wc-code-form">
        <p class="modal-copy">记你自己的图像，例如 cons → 康熙。文字联想即可使用，图片选填。</p>
        <div class="form-row"><div class="field"><label for="wc-code-fragment">编码片段</label><input id="wc-code-fragment" name="fragment" type="text" required minlength="2" maxlength="20" pattern="[A-Za-z]{2,20}" placeholder="cons" value="${esc(c.fragment)}" autocomplete="off" spellcheck="false"></div><div class="field"><label for="wc-code-title">图像联想 / 谐音</label><input id="wc-code-title" name="title" type="text" required maxlength="60" placeholder="康熙" value="${esc(c.title)}"></div></div>
        <p class="wc-fragment-preview" id="wc-code-preview" lang="en"></p><p class="helper-copy" id="wc-code-preview-help"></p>
        <div class="field"><label for="wc-code-note">画面或动作说明（选填）</label><textarea id="wc-code-note" name="note" maxlength="500" rows="3" placeholder="例如：康熙拿着奏折，认真考虑一件事。">${esc(c.note)}</textarea></div>
        <details class="wc-editor-options" ${c.kind==='root'||c.match!=='any'||!c.enabled?'open':''}><summary>词根标注与匹配规则（选填）</summary>
          <div class="form-row"><div class="field"><label for="wc-code-kind">标注类型</label><select id="wc-code-kind" name="kind"><option value="fragment" ${c.kind==='fragment'?'selected':''}>个人拼写片段（默认）</option><option value="root" ${c.kind==='root'?'selected':''}>用户标注词根（自行核验）</option></select></div><div class="field"><label for="wc-code-match">命中位置</label><select id="wc-code-match" name="match">${[['any','任意位置'],['start','只在开头'],['end','只在结尾']].map(([k,t])=>`<option value="${k}" ${c.match===k?'selected':''}>${t}</option>`).join('')}</select></div></div>
          <div class="field"><label for="wc-code-root-meaning">片段含义或词根义（选填）</label><input id="wc-code-root-meaning" name="rootMeaning" type="text" maxlength="100" value="${esc(c.rootMeaning)}" placeholder="个人联想不必强行填写词源"></div>
          <label class="self-check"><input name="enabled" type="checkbox" ${c.enabled?'checked':''}>在命中词中提供手动提示</label>
        </details>
        <details class="wc-editor-options" id="wc-image-options" ${c.imageData?'open':''}><summary>编码图片（选填）</summary><div class="field"><label class="visually-hidden" for="wc-code-image">选择编码图片</label><input id="wc-code-image" type="file" accept="image/png,image/jpeg,image/webp"><p class="helper-copy">本地PNG、JPEG或WebP，最多8MiB；自动缩小并去除原图元数据。不传AI。</p><div class="wc-image-tools"><div id="wc-code-image-preview"></div>${btn('wc-code-image-remove','移除图片','ghost small')}</div><p class="helper-copy" id="wc-code-image-status" role="status"></p></div></details>
        <p class="note error" id="wc-code-error" role="alert" hidden></p><div class="form-actions wc-code-footer">${btn('close-modal','取消','ghost')}<button type="submit" class="btn primary" id="wc-code-submit">保存到编码库</button></div>
      </form>`);
      const t=++ticket,key=b.getAccountKey(),form=document.getElementById('wc-code-form');
      editor={ticket:t,key,id:code?.id||'',term:String(term||'').slice(0,80),imageData:c.imageData,created:code?.created||today(),busy:false};form.dataset.ticket=String(t);
      // Native focus can consider a field visible even when a sticky footer covers it.
      form.addEventListener('focusin',e=>{
        if(!alive(t,key)||!e.target.matches('input,textarea,select'))return;
        const r=e.target.getBoundingClientRect(),head=form.closest('dialog').querySelector('.modal-heading').getBoundingClientRect(),foot=form.querySelector('.wc-code-footer').getBoundingClientRect();
        if(r.top<head.bottom+8||r.bottom>foot.top-8)e.target.scrollIntoView({block:'nearest'});
      });
      previewFragment();editorPicture();document.getElementById('wc-code-fragment').focus();
    }
    // Inspect dimensions before decoding, so tiny compressed files cannot request enormous canvases.
    function imageHeader(bytes,mime){
      const a=new Uint8Array(bytes),v=new DataView(bytes),ascii=(at,n)=>String.fromCharCode(...a.slice(at,at+n));
      if(mime==='image/png'&&a.length>=24&&ascii(1,3)==='PNG'&&ascii(12,4)==='IHDR')return [v.getUint32(16),v.getUint32(20)];
      if(mime==='image/jpeg'&&a[0]===255&&a[1]===216){let p=2;while(p+8<a.length){if(a[p++]!==255)break;while(a[p]===255)p++;const marker=a[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(p+2>a.length)break;const size=v.getUint16(p);if(size<2||p+size>a.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7)return [v.getUint16(p+5),v.getUint16(p+3)];p+=size;}}
      if(mime==='image/webp'&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){let p=12;while(p+8<=a.length){const kind=ascii(p,4),size=v.getUint32(p+4,true),o=p+8;if(o+size>a.length)break;if(kind==='VP8X'&&size>=10){if(a[o]&2)throw Error('请使用静态图片，不支持动画WebP。');return [1+a[o+4]+(a[o+5]<<8)+(a[o+6]<<16),1+a[o+7]+(a[o+8]<<8)+(a[o+9]<<16)];}if(kind==='VP8L'&&size>=5&&a[o]===47)return [1+a[o+1]+((a[o+2]&63)<<8),1+(a[o+2]>>6)+(a[o+3]<<2)+((a[o+4]&15)<<10)];if(kind==='VP8 '&&size>=10&&a[o+3]===157&&a[o+4]===1&&a[o+5]===42)return [v.getUint16(o+6,true)&16383,v.getUint16(o+8,true)&16383];p=o+size+(size%2);}}
      throw Error('图片头无法读取；请选择正常的PNG、JPEG或WebP文件。');
    }
    async function imageFile(file){
      if(!editor)return;const t=editor.ticket,key=editor.key;
      const job=(editor.imageJob||0)+1;editor.imageJob=job;
      const active=()=>alive(t,key)&&editor.imageJob===job;
      const submit=document.getElementById('wc-code-submit');
      if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024){
        editor.busy=false;submit.disabled=false;document.getElementById('wc-code-image').value='';
        document.getElementById('wc-code-image-status').textContent='未采用新图片；文字联想和原图片保留。';
        editorPicture();editorError('请选择不超过8MiB的PNG、JPEG或WebP，SVG和远程图片不支持。');return;
      }
      editor.busy=true;submit.disabled=true;document.getElementById('wc-code-image-status').textContent='正在生成小图…';editorError('');let image=null;
      try{
        const bytes=await file.arrayBuffer();if(!active())return;const [width,height]=imageHeader(bytes,file.type);
        if(!width||!height||width>8192||height>8192||width*height>16000000)throw Error('原图尺寸过大；请先缩到8192px以内且不超过1600万像素。');
        image=await createImageBitmap(new Blob([bytes],{type:file.type}));if(!active())return;
        if(!image.width||!image.height||image.width*image.height>16000000)throw Error('图片解码尺寸不合法。');
        let data='';for(const side of [192,160,128,96]){const ratio=Math.min(1,side/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器无法处理缩略图。');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);for(const quality of [.82,.65,.5]){data=canvas.toDataURL('image/webp',quality);if(!data.startsWith('data:image/webp;'))data=canvas.toDataURL('image/jpeg',quality);if(E.imageValid(data))break;}if(E.imageValid(data))break;}
        if(!E.imageValid(data))throw Error('图片无法压缩到安全大小，请换一张更简单的图。');
        if(!active())return;editor.imageData=data;editorPicture();document.getElementById('wc-code-image-status').textContent=`小图已准备，约${Math.ceil(data.length/1024)}KiB（编码后）；点击保存后写入账号记录。`;
      }catch(e){if(active())editorError(e.message||'图片处理失败；文字联想和原图片仍保留。');}
      finally{image?.close();if(active()){editor.busy=false;document.getElementById('wc-code-submit').disabled=false;document.getElementById('wc-code-image').value='';if(document.getElementById('wc-code-image-status').textContent==='正在生成小图…')document.getElementById('wc-code-image-status').textContent='没有采用新图片，可继续保存文字联想。';editorPicture();}}
    }
    async function submit(form){
      if(form.id!=='wc-code-form')return false;
      if(!editor||!alive(editor.ticket,editor.key))return true;
      if(editor.busy){editorError('小图仍在处理中，请稍候。');return true;}
      const d=new FormData(form),fragment=String(d.get('fragment')||'').trim().toLowerCase(),title=String(d.get('title')||'').trim();
      if(!/^[a-z]{2,20}$/.test(fragment)||!title){editorError('片段为2–20个英文字母，图像联想不能为空。');return true;}
      const c={id:editor.id||uid(),fragment,title,note:String(d.get('note')||'').trim(),kind:d.get('kind'),rootMeaning:String(d.get('rootMeaning')||'').trim(),match:d.get('match'),enabled:d.get('enabled')==='on',imageData:editor.imageData,created:editor.created,updated:today()},codes=(S().wordCodes||[]).filter(x=>x.id!==c.id);
      if(codes.some(x=>x.fragment===fragment&&x.match===c.match)){editorError('这个片段和匹配位置已有编码。请到编码库编辑，或选择另一匹配位置。');return true;}
      try{if(!save({wordCodes:[...codes,c]})){editorError('未写入记录。输入仍保留，请先导出副本或处理保存问题。');return true;}b.closeModal();b.render();b.toast('编码已保存。以后命中时可手动查看提示。');}
      catch(e){editorError(e.message||'未能保存；输入仍保留。');}return true;
    }
    async function action(el){
      const a=el.dataset.action;
      try{
        if(a==='wc-view'){view=['study','library','codes'].includes(el.dataset.view)?el.dataset.view:'study';b.render({focusMain:true});return;}
        if(a==='wc-start'){start();return;}
        if(a==='wc-reveal'){if(!session||!current()||el.dataset.id!==current().id)return;session.revealed=true;b.render({focusTarget:'#wc-answer'});return;}
        if(a==='wc-hint'){if(!session)return;session.hintsOpen=!session.hintsOpen;if(session.hintsOpen)session.hinted=true;b.render();return;}
        if(a==='wc-grade'){const w=current();if(!session||!w||!session.revealed||session.key!==b.getAccountKey()||el.dataset.id!==w.id)return;const result=gradeRecord(w,session.direction,el.dataset.grade,session.hinted);if(!result){b.toast('评分未保存，留在这张卡。请先处理保存问题。');return;}session.answers.push({id:w.id,grade:result.grade,hinted:result.hinted});next();return;}
        if(a==='wc-skip'){if(session){if(el.dataset.id&&el.dataset.id!==current()?.id)return;session.skipped++;next();}return;}
        if(a==='wc-end'){session=null;b.render({focusTarget:'#wc-topic'});return;}
        if(a==='wc-next-batch'){session=null;start();return;}
        if(a==='wc-view-word'){openWord(el.dataset.id);return;}
        if(a==='wc-practice-one'){const id=el.dataset.id;b.closeModal();if(b.goToWords)b.goToWords();start([id]);return;}
        if(a==='wc-save-word'){saveWord(find(el.dataset.id));return;}
        if(a==='wc-ai'){const w=find(el.dataset.id);if(w&&b.ai)b.ai(w.term,w.saved?.context||w.examples[0]?.en||'');return;}
        if(a==='wc-word-hints'){openHints(el.dataset.term);return;}
        if(a==='wc-library-prev'||a==='wc-library-next'){libraryPage=Math.max(0,libraryPage+(a==='wc-library-next'?1:-1));b.render({focusTarget:'#wc-search'});return;}
        if(a==='wc-library-reset'){libraryTopic='all';search='';libraryPage=0;b.render({focusTarget:'#wc-search'});return;}
        if(a==='wc-code-search-reset'){codeSearch='';b.render({focusTarget:'#wc-code-search'});return;}
        if(a==='wc-code-new'||a==='wc-code-edit'){openEditor(el.dataset.term||'',el.dataset.fragment||'',el.dataset.id||'');return;}
        if(a==='wc-code-image-remove'){if(editor&&!editor.busy){editor.imageData='';editorPicture();editorError('');document.getElementById('wc-code-image-status').textContent='保存后移除旧小图；文字联想保留。';}return;}
        const c=(S().wordCodes||[]).find(c=>c.id===el.dataset.id);if(!c)return;
        if(a==='wc-code-toggle'){if(save({wordCodes:S().wordCodes.map(x=>x.id===c.id?{...x,enabled:!x.enabled,updated:today()}:x)}))b.render();return;}
        if(a==='wc-code-delete'){b.openModal('删除这个图像编码？',`<p class="modal-copy">移除 ${esc(c.fragment)} → ${esc(c.title)}，不会删除生词和刷词进度。建议先导出备份。</p><div class="form-actions">${btn('close-modal','取消','ghost')}${btn('wc-code-delete-confirm','确认删除','danger',`data-id="${esc(c.id)}"`)}</div>`);return;}
        if(a==='wc-code-delete-confirm'){if(save({wordCodes:S().wordCodes.filter(x=>x.id!==c.id)})){b.closeModal();b.render();b.toast('编码已移除，生词和进度保留。');}return;}
        if(a==='wc-code-matches'){const rows=all().filter(w=>E.matches(w.term,[{...c,enabled:true}]).length);b.openModal('匹配这个片段的词',`<p class="modal-copy"><span lang="en">${esc(c.fragment)}</span> → ${esc(c.title)} · ${rows.length} 个字面匹配，不代表词源关系。</p><div class="wc-match-words">${rows.map(w=>btn('wc-view-word',esc(w.term),'small',`data-id="${esc(w.id)}" lang="en"`)).join('')||'<p>当前词库暂无匹配。以后遇到新词时仍可使用。</p>'}</div>`);return;}
      }catch(e){b.toast(e.message||'操作未完成，记录未覆盖。');}
    }
    function input(t){
      if(t.id==='wc-search'){search=t.value;libraryPage=0;b.render();return true;}
      if(t.id==='wc-code-search'){codeSearch=t.value;b.render();return true;}
      if(t.id==='wc-draft'){if(session)session.draft=t.value.slice(0,200);return true;}
      if(t.id==='wc-code-fragment'){previewFragment();editorError('');return true;}
      return false;
    }
    function change(t){
      if(t.id==='wc-code-image'){if(t.files[0])imageFile(t.files[0]);return true;}
      if(t.id==='wc-code-match'){previewFragment();return true;}
      if(t.id==='wc-mode'){mode=['mix','due','new','all'].includes(t.value)?t.value:'mix';return true;}
      if(t.id==='wc-library-topic'){libraryTopic=t.value;libraryPage=0;b.render();return true;}
      if(t.id==='wc-topic'||t.id==='wc-direction'){
        const key=t.id==='wc-topic'?'wordTopic':'wordDirection',prior=S().preferences[key]|| (key==='wordTopic'?'all':'en');
        try{if(save({preferences:{...S().preferences,[key]:t.value}}))b.render();else t.value=prior;}catch(e){t.value=prior;b.toast(e.message);}return true;
      }
      return false;
    }
    function keyboard(e){
      if(!session||b.modalOpen()||view!=='study'||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented||e.target?.isContentEditable||e.target?.closest?.('input,textarea,select,button,a,summary,[role="button"]'))return false;
      const w=current();if(!w)return false;
      if(e.key===' '&&!session.revealed){e.preventDefault();session.revealed=true;b.render({focusTarget:'#wc-answer'});return true;}
      if(session.revealed&&['1','2','3'].includes(e.key)){e.preventDefault();action({dataset:{action:'wc-grade',id:w.id,grade:{1:'again',2:'hard',3:'good'}[e.key]}});return true;}return false;
    }
    function reset(){cancelEditor();session=null;view='study';mode='mix';search='';codeSearch='';libraryTopic='all';libraryPage=0;}
    return Object.freeze({page,action,input,change,submit,keyboard,reset,cancelEditor,canonicalId,gradeSaved,openEditor,openHints,hints});
  }
  root.UnfoldWordsUI=Object.freeze({create});
})(typeof globalThis!=='undefined'?globalThis:this);
