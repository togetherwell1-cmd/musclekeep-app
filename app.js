/* 머슬킵 MVP
   Week 1: 온보딩 + 프로필 + 홈 대시보드
   Week 2: 기록/로깅(단백질·체중·근력·부작용) + 홈 진행바 실데이터 + 연속기록
   순수 바닐라 JS · localStorage. Week 3부터 LLM추천/주사일/차트/결제 확장. */

const PROFILE_KEY = 'mk_profile_v1';
const LOGS_KEY = 'mk_logs_v1';
const app = document.getElementById('app');

/* ---------- 상태 ---------- */
let draft = {};
let stepIndex = 0;
let activeTab = 'home';
let showInjForm = false, injDraft = null, notified = false, showSub = false;

/* ---------- 온보딩 질문 ---------- */
const STEPS = [
  { key:'drug', title:'지금 복용 중인 약은요?', hint:'가장 강한 순으로 근손실 위험이 달라요',
    opts:[['mounjaro','마운자로'],['wegovy','위고비'],['saxenda','삭센다'],['oral','경구/기타']] },
  { key:'duration', title:'복용한 지 얼마나 됐나요?',
    opts:[['start','이제 시작'],['<3','3개월 미만'],['3-6','3~6개월'],['6+','6개월 이상']] },
  { key:'goal', title:'지금 가장 큰 목표는요?',
    opts:[['lose','체중 감량'],['maintain','체중 유지'],['muscle','근육 지키기·늘리기']] },
  { key:'basic', title:'기본 정보를 알려주세요', type:'basic' },
  { key:'exercise', title:'주 몇 회 근력운동을 하나요?', hint:'걷기 말고 저항운동(스쿼트·밴드 등)',
    opts:[['none','거의 안 함'],['1-2','주 1~2회'],['3+','주 3회 이상'],['sometimes','가끔']] },
  { key:'protein', title:'단백질은 잘 챙겨 드세요?', hint:'계란·닭가슴살·두부·프로틴 등',
    opts:[['low','거의 못 챙김 / 잘 모름'],['mid','보통 (하루 한 끼 정도)'],['high','끼니마다 잘 챙김']] },
  { key:'speed', title:'체중이 빠지는 속도는요?',
    opts:[['slow','천천히'],['normal','보통'],['fast','빠르게 / 급격히']] },
];

/* ---------- 계산 로직 ---------- */
const S = {
  drug:{mounjaro:2,wegovy:1,saxenda:0,oral:0},
  duration:{'start':0,'<3':0,'3-6':1,'6+':2},
  exercise:{none:2,'1-2':1,sometimes:1,'3+':0},
  protein:{low:2,mid:1,high:0},
  speed:{slow:0,normal:1,fast:2},
};
function ageScore(a){ return a<40?0:a<50?1:a<65?2:3; }

function compute(p){
  const raw = S.drug[p.drug] + S.duration[p.duration] + S.exercise[p.exercise]
            + S.protein[p.protein] + S.speed[p.speed] + ageScore(p.age);
  const pct = Math.round(raw/13*100);
  let risk = raw<=3 ? 'low' : raw<=7 ? 'mid' : 'high';

  let f = 1.4;
  if(p.age>=50) f += 0.2;
  if(S.speed[p.speed]>=2) f += 0.2;
  if(p.exercise==='3+') f += 0.1;
  if(p.goal==='muscle') f += 0.1;
  f = Math.min(2.0, Math.max(1.2, f));
  const proteinTarget = Math.round(p.weight*f/5)*5;

  const est = {high:Math.round(p.weight*1.2), mid:70, low:40}[p.protein];
  const gap = Math.max(0, proteinTarget - est);
  const acts = [];
  if(gap>0) acts.push(`단백질 하루 <b>약 ${gap}g</b> 더 — 계란 1개≈6g, 닭가슴살 100g≈23g, 프로틴 1스쿱≈20g`);
  if(p.exercise!=='3+') acts.push('주 <b>2~3회 저항운동</b> — 스쿼트·밴드·벽팔굽혀펴기부터');
  if(S.speed[p.speed]>=2) acts.push('<b>감량 속도 점검</b> — 너무 빠르면 근육이 먼저 빠져요');
  if(acts.length<3 && p.age>=50) acts.push('단백질을 <b>끼니마다 나눠서</b> — 흡수 효율↑');
  if(acts.length<3) acts.push('주 1회 <b>체중·근력 기록</b>으로 유지 확인');
  if(acts.length<3) acts.push('<b>물·전해질</b> 충분히 — 식욕 저하로 놓치기 쉬워요');

  return { riskLevel:risk, riskPct:pct, proteinTarget, actions:acts.slice(0,3) };
}

/* ---------- 프로필 저장/로드 ---------- */
function loadProfile(){ try{ return JSON.parse(localStorage.getItem(PROFILE_KEY)); }catch(e){ return null; } }
function saveProfile(p){ localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }

/* ---------- 기록(로그) 저장/로드 (Week 2) ---------- */
const QUICK_FOODS = [['계란 1개',6],['닭가슴살 100g',23],['두부 100g',9],['프로틴 1스쿱',20],['그릭요거트',10]];
function todayKey(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function loadLogs(){ try{ return JSON.parse(localStorage.getItem(LOGS_KEY))||{}; }catch(e){ return {}; } }
function saveLogs(l){ localStorage.setItem(LOGS_KEY, JSON.stringify(l)); }
function getDay(key){
  const l = loadLogs();
  return l[key] || { protein:[], weightKg:null, resistanceDone:false, sideEffects:[] };
}
function setDay(key, day){ const l = loadLogs(); l[key]=day; saveLogs(l); }
function proteinTotal(day){ return day.protein.reduce((s,e)=>s+(e.g||0),0); }
function dayHasActivity(day){ return day.protein.length>0 || day.weightKg!=null || day.resistanceDone; }
function streak(){
  const l = loadLogs(); let n=0; const d=new Date();
  for(let i=0;i<400;i++){
    const key=todayKey(d);
    const day=l[key];
    if(day && dayHasActivity(day)) n++;
    else if(i===0){ /* 오늘 아직 기록 없음 → 어제부터 카운트 */ }
    else break;
    d.setDate(d.getDate()-1);
  }
  return n;
}

/* 로그 조작 */
function addProtein(g,label){ const k=todayKey(); const day=getDay(k);
  day.protein.push({g:Math.round(g),label,at:new Date().toISOString()}); setDay(k,day); }
function removeProtein(idx){ const k=todayKey(); const day=getDay(k); day.protein.splice(idx,1); setDay(k,day); }
function setWeight(v){ const k=todayKey(); const day=getDay(k); day.weightKg=v; setDay(k,day); }
function toggleResistance(){ const k=todayKey(); const day=getDay(k); day.resistanceDone=!day.resistanceDone; setDay(k,day); }
function toggleSide(name){ const k=todayKey(); const day=getDay(k);
  const i=day.sideEffects.indexOf(name); if(i>=0) day.sideEffects.splice(i,1); else day.sideEffects.push(name);
  setDay(k,day); }
function toggleInjection(){ const k=todayKey(); const day=getDay(k); day.injectionDone=!day.injectionDone; setDay(k,day); }

/* ---------- 주사일 (Week 4) ---------- */
const WEEKDAYS=['일','월','화','수','목','금','토'];
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a,b){ return startOfDay(a).getTime()===startOfDay(b).getTime(); }
function nextInjectionDate(inj, doneToday){
  const now=new Date();
  if(inj.freq==='daily') return doneToday ? addDays(startOfDay(now),1) : startOfDay(now);
  let diff=(inj.weekday - now.getDay()+7)%7;
  if(diff===0 && doneToday) diff=7;
  return addDays(startOfDay(now), diff);
}
function ddayText(date){ const diff=Math.round((startOfDay(date)-startOfDay(new Date()))/86400000);
  return diff<=0?'오늘':diff===1?'내일':`D-${diff}`; }
function pad2(n){ return String(n).padStart(2,'0'); }
function fmtICS(d){ return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`; }
function buildICS(inj){
  const byday=['SU','MO','TU','WE','TH','FR','SA'][inj.weekday||0];
  const [hh,mm]=(inj.time||'09:00').split(':');
  const start=nextInjectionDate(inj,false); start.setHours(Number(hh),Number(mm),0,0);
  const rule=inj.freq==='daily'?'FREQ=DAILY':`FREQ=WEEKLY;BYDAY=${byday}`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//musclekeep//KR','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:mk-inj-${start.getTime()}@musclekeep`,`DTSTAMP:${fmtICS(new Date())}`,
    `DTSTART:${fmtICS(start)}`,`RRULE:${rule}`,'SUMMARY:💉 주사 맞는 날 (머슬킵)',
    'DESCRIPTION:GLP-1 주사 리마인더 — 단백질·운동도 챙기세요!',
    'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:주사 30분 전','END:VALARM',
    'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
function downloadICS(inj){
  const blob=new Blob([buildICS(inj)],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='musclekeep-injection.ics'; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function notifOn(){ return localStorage.getItem('mk_notif')==='1' && ('Notification'in window) && Notification.permission==='granted'; }
function enableNotif(p){
  if(!('Notification'in window)){ alert('이 브라우저는 알림을 지원하지 않아요.'); return; }
  Notification.requestPermission().then(perm=>{ if(perm==='granted'){ localStorage.setItem('mk_notif','1'); maybeNotify(p); } renderApp(p); });
}
function maybeNotify(p){
  if(!notifOn() || !p.injection) return;
  const done=getDay(todayKey()).injectionDone;
  if(sameDay(nextInjectionDate(p.injection,done), new Date()) && !done){
    try{ new Notification('오늘 주사일이에요 💉',{body:'잊지 말고 주사 + 단백질 챙기세요!',icon:'icon.svg'}); }catch(e){}
  }
}

/* ---------- 구독/프리미엄 (Week 6) ----------
   무료: 온보딩·홈·기록·주사일 / 프리미엄: AI 추천·차트·주간리포트.
   ⚠️ 실결제는 토스페이먼츠 등 PG 연동 필요. 현재 activateSub()는 테스트용 스텁. */
const SUB_KEY='mk_sub_v1';
function getSub(){ try{ return JSON.parse(localStorage.getItem(SUB_KEY))||{status:'none'}; }catch(e){ return {status:'none'}; } }
function setSub(s){ localStorage.setItem(SUB_KEY, JSON.stringify(s)); }
function startTrial(){ const s=getSub(); if(!s.trialStart) setSub({status:'trial', trialStart:new Date().toISOString()}); }
function trialDaysLeft(){ const s=getSub(); if(!s.trialStart) return 0; const used=Math.floor((Date.now()-new Date(s.trialStart).getTime())/86400000); return Math.max(0,7-used); }
function isPremium(){ const s=getSub(); if(s.status==='active') return true; if(s.status==='trial') return trialDaysLeft()>0; return false; }
function activateSub(plan){ setSub({status:'active', activatedAt:new Date().toISOString(), plan}); } // TODO: 실제 PG 결제창 연동
function cancelSub(){ setSub({status:'expired'}); }
function subLabel(){ const s=getSub(); return s.status==='active'?'프리미엄 ✓':(s.status==='trial'&&trialDaysLeft()>0)?`무료체험 (${trialDaysLeft()}일 남음)`:'무료'; }

function paywallCard(title, desc){
  return `<div class="card paywall">
    <div class="lock">🔒</div>
    <b>${title}</b>
    <p class="sub" style="margin:6px 0 14px">${desc}</p>
    <button class="btn" id="goPremium">${getSub().trialStart?'프리미엄 잠금 해제':'7일 무료로 잠금 해제'}</button>
  </div>`;
}
function subBanner(){
  const s=getSub();
  if(isPremium() && s.status==='trial') return `<div class="trial-note" id="goPremium">✨ 무료체험 ${trialDaysLeft()}일 남음 · 프리미엄 보기</div>`;
  if(isPremium()) return '';
  return `<div class="card banner" id="goPremium"><span>✨ AI 추천·차트 잠금 해제 · 프리미엄</span><span class="arrow">›</span></div>`;
}
function renderSub(p){
  const trialUsed=!!getSub().trialStart;
  const benefits=[['🥗','AI 식단·운동 추천','오늘 남은 단백질을 채울 한식·맞춤 운동을 매일'],
    ['📊','추세 그래프 & 주간 리포트','근육이 지켜지는지 데이터로 확인'],
    ['♾️','무제한 기록 보관','언제든 돌아보기'],
    ['💉','주사일 스마트 알림','캘린더 연동 리마인더']];
  return `<div class="screen">
    <button class="btn ghost" id="subBack" style="width:auto;padding:8px 14px;margin:0">← 뒤로</button>
    <div class="center"><div class="hero-emoji" style="margin:12px 0 4px">💪</div>
      <h1>머슬킵 프리미엄</h1><p class="sub">근육 지키기, 제대로 하려면</p></div>
    <div class="card">
      ${benefits.map(([i,t,d])=>`<div class="benefit"><span class="bi">${i}</span><div><b>${t}</b><div class="sub">${d}</div></div></div>`).join('')}
    </div>
    <div class="plans">
      <label class="plan"><input type="radio" name="plan" value="month" checked><span><b>월 9,900원</b><div class="sub">언제든 해지</div></span></label>
      <label class="plan"><input type="radio" name="plan" value="year"><span><b>연 79,000원</b> <em class="save">2개월 무료</em><div class="sub">월 6,583원 꼴</div></span></label>
    </div>
    ${trialUsed
      ? `<button class="btn" id="subPay">구독하기</button>`
      : `<button class="btn" id="subTrial">7일 무료로 시작</button><button class="btn secondary" id="subPay">바로 구독하기</button>`}
    <p class="disclaimer">체험 후 선택한 요금제로 전환돼요. 실제 결제는 토스페이먼츠 연동 후 활성화됩니다(현재 테스트 모드).</p>
  </div>`;
}
function bindSub(p){
  document.getElementById('subBack').onclick=()=>{ showSub=false; renderApp(p); };
  const t=document.getElementById('subTrial'); if(t) t.onclick=()=>{ startTrial(); showSub=false; renderApp(p); };
  const pay=document.getElementById('subPay'); if(pay) pay.onclick=()=>{
    const plan=(document.querySelector('input[name=plan]:checked')||{}).value||'month';
    // TODO: 실제 PG(토스페이먼츠) 결제창 호출. 지금은 테스트용 즉시 활성화.
    if(confirm('테스트용으로 프리미엄을 활성화할까요?\n(실결제는 PG 연동 후 동작합니다)')){ activateSub(plan); showSub=false; renderApp(p); }
  };
}

/* ---------- 라우팅 ---------- */
function route(){
  const p = loadProfile();
  if(!p){ draft={}; stepIndex=0; return renderWelcome(); }
  renderApp(p);
  if(!notified){ notified=true; maybeNotify(p); }
}

/* ---------- 웰컴 ---------- */
function renderWelcome(){
  app.innerHTML = `
    <div class="screen">
      <div class="hero-emoji">💪</div>
      <h1 class="center">약으로 살은 빼되,<br><span class="hl">근육</span>은 지켜요</h1>
      <p class="sub center">위고비·마운자로 하면서<br>매일 단백질·운동·주사일을 챙겨주는 코치</p>
      <div class="card">
        <div class="kv"><span>⏱️ 30초 온보딩</span><span class="muted">약·목표·몸 정보</span></div>
        <div class="kv"><span>🎯 내 단백질 목표</span><span class="muted">자동 계산</span></div>
        <div class="kv"><span>📉 근손실 위험도</span><span class="muted">진단</span></div>
      </div>
      <button class="btn" id="start">시작하기</button>
      <p class="sub center" style="font-size:12px;margin-top:10px">시작하면 <a href="terms.html">이용약관</a> · <a href="privacy.html">개인정보처리방침</a>에 동의하는 것으로 간주됩니다.</p>
      <p class="disclaimer">⚠️ 본 서비스는 의료 진단·처방·치료가 아니며 생활습관 정보 제공(웰니스 코칭)을 목적으로 합니다. 약물 복용·용량·중단은 반드시 의사와 상담하세요.</p>
    </div>`;
  document.getElementById('start').onclick = ()=>{ stepIndex=0; renderStep(); };
}

/* ---------- 온보딩 스텝 ---------- */
function renderStep(){
  const step = STEPS[stepIndex];
  const pct = Math.round(stepIndex/STEPS.length*100);
  let body='';
  if(step.type==='basic'){
    body = `
      <div class="row">
        <div class="num"><input id="f-age" type="number" inputmode="numeric" placeholder="나이" value="${draft.age||''}"></div>
        <div class="num"><input id="f-weight" type="number" inputmode="decimal" placeholder="체중(kg)" value="${draft.weight||''}"></div>
      </div>
      <div class="opts grid2" style="margin-top:10px">
        ${[['f','여성'],['m','남성']].map(([v,l])=>`
          <label class="opt"><input type="radio" name="sex" value="${v}" ${draft.sex===v?'checked':''}><span>${l}</span></label>`).join('')}
      </div>`;
  } else {
    body = `<div class="opts ${step.opts.length>3?'grid2':''}">
      ${step.opts.map(([v,l])=>`
        <label class="opt"><input type="radio" name="opt" value="${v}" ${draft[step.key]===v?'checked':''}><span>${l}</span></label>`).join('')}
    </div>`;
  }
  app.innerHTML = `
    <div class="screen">
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="step-count">STEP ${stepIndex+1} / ${STEPS.length}</div>
      <div class="q-title">${step.title} ${step.hint?`<span class="q-hint">· ${step.hint}</span>`:''}</div>
      ${body}
      <div class="nav-row">
        ${stepIndex>0?`<button class="btn secondary back" id="back">이전</button>`:''}
        <button class="btn" id="next">${stepIndex===STEPS.length-1?'완료':'다음'}</button>
      </div>
    </div>`;
  if(step.type!=='basic'){
    document.querySelectorAll('input[name="opt"]').forEach(r=>{
      r.onchange = ()=>{ draft[step.key]=r.value; setTimeout(nextStep,180); };
    });
  }
  const back=document.getElementById('back');
  if(back) back.onclick = ()=>{ stepIndex--; renderStep(); };
  document.getElementById('next').onclick = ()=>{
    if(step.type==='basic'){
      const age=Number(document.getElementById('f-age').value);
      const weight=Number(document.getElementById('f-weight').value);
      const sex=document.querySelector('input[name="sex"]:checked');
      if(!age||!weight||!sex){ shake(); return; }
      draft.age=age; draft.weight=weight; draft.sex=sex.value; nextStep();
    } else { if(!draft[step.key]){ shake(); return; } nextStep(); }
  };
}
function nextStep(){ if(stepIndex<STEPS.length-1){ stepIndex++; renderStep(); } else finishOnboarding(); }
function shake(){ const n=document.getElementById('next'); n.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:220}); }
function finishOnboarding(){
  const profile = { ...draft, ...compute(draft), v:1, createdAt:new Date().toISOString() };
  saveProfile(profile); startTrial(); /* 신규 유저 7일 무료체험 자동 시작 → 전 기능 경험 */
  activeTab='home'; renderApp(profile);
}

/* ---------- 앱(탭) ---------- */
function renderApp(p){
  if(showSub){ app.innerHTML=renderSub(p); bindSub(p); return; }
  const body = { home:homeView, log:logView, routine:routineView, settings:settingsView }[activeTab](p);
  app.innerHTML = `<div class="screen has-tabs">${body}</div>${tabbar()}`;
  bindTabs(p);
  if(activeTab==='home') bindHome(p);
  if(activeTab==='log') bindLog(p);
  if(activeTab==='routine') bindRoutine(p);
  if(activeTab==='settings') bindSettings(p);
  document.querySelectorAll('#goPremium').forEach(b=>b.onclick=()=>{ showSub=true; renderApp(p); });
}

function greeting(){ const h=new Date().getHours();
  return h<11?'좋은 아침이에요':h<17?'오늘도 화이팅':h<21?'좋은 저녁이에요':'오늘 하루 수고했어요'; }
const RISK_LABEL={low:'낮음',mid:'중간',high:'높음'};
const DRUG_LABEL={mounjaro:'마운자로',wegovy:'위고비',saxenda:'삭센다',oral:'경구/기타'};

/* ---------- 홈 ---------- */
function homeView(p){
  const day=getDay(todayKey());
  const total=proteinTotal(day);
  const pct=Math.min(100, Math.round(total/p.proteinTarget*100));
  const remain=Math.max(0, p.proteinTarget-total);
  const st=streak();
  return `
    <p class="greet">${greeting()} 👋</p>
    <h2>오늘도 근육 지켜요</h2>
    ${subBanner()}

    <div class="card hero-protein">
      <div class="lbl">오늘 단백질</div>
      <div class="big">${total}<span class="unit">/${p.proteinTarget}g</span></div>
      <div class="prog"><i id="proteinProg" style="width:${pct}%"></i></div>
      <div class="lbl">${remain>0 ? `목표까지 ${remain}g 남았어요` : '오늘 목표 달성! 💪'}</div>
      <div class="quick" id="homeQuick">
        ${QUICK_FOODS.map(([l,g])=>`<button class="chip" data-g="${g}" data-l="${l}">+${g} ${l}</button>`).join('')}
        <button class="chip alt" id="quickCustom">직접입력</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="v">🔥 ${st}일</div><div class="k">연속 기록</div></div>
      <div class="stat"><div class="v"><span class="badge ${p.riskLevel}">● ${RISK_LABEL[p.riskLevel]}</span></div><div class="k">근손실 위험도</div></div>
    </div>

    <div class="section-title">오늘 할 일 3가지</div>
    <ul class="list">
      ${p.actions.map((a,i)=>`<li><span class="n">${i+1}</span><span>${a}</span></li>`).join('')}
    </ul>

    ${injectionCard(p)}

    <p class="disclaimer">의료 진단·처방이 아닙니다. 약물 관련 결정은 의사와 상담하세요.</p>`;
}

/* 주사일 카드 / 설정 폼 */
function injectionCard(p){
  const inj=p.injection;
  if(showInjForm){
    if(!injDraft) injDraft={ freq:(p.drug==='saxenda'||p.drug==='oral')?'daily':'weekly', weekday:2, time:'09:00', ...(inj||{}) };
    return injFormHTML(injDraft);
  }
  if(!inj){
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>💉 주사 일정</b><button class="chip" id="injSetup">설정하기</button></div><p class="sub" style="margin-top:6px">등록하면 다음 주사 D-day + 폰 캘린더 알림을 만들어드려요.</p></div>`;
  }
  const done=getDay(todayKey()).injectionDone;
  const nd=nextInjectionDate(inj,done);
  const isToday=sameDay(nd,new Date()) && !done;
  const label=inj.freq==='daily'?'매일':`매주 ${WEEKDAYS[inj.weekday]}요일`;
  return `<div class="card inj">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b>💉 주사 일정</b><button class="chip" id="injEdit">변경</button>
    </div>
    ${isToday
      ? `<div class="inj-today">오늘이 주사일이에요! 💉</div><button class="btn" id="injDone2">주사 완료 체크</button>`
      : `<div class="inj-next"><span>${label} · ${inj.time}</span><span class="dday">${ddayText(nd)}</span></div>${done?'<p class="sub" style="margin-top:8px;text-align:right">오늘 주사 완료 ✓</p>':''}`}
    <div class="inj-actions">
      <button class="chip" id="injIcs">📅 캘린더에 추가</button>
      <button class="chip ${notifOn()?'sel-on':''}" id="injNotif">${notifOn()?'🔔 알림 켜짐':'🔔 알림 켜기'}</button>
    </div>
  </div>`;
}
function injFormHTML(d){
  return `<div class="card inj">
    <b>💉 주사 일정 설정</b>
    <p class="sub" style="margin:6px 0 10px">등록하면 D-day 표시 + 폰 캘린더 알림을 만들 수 있어요.</p>
    <div class="opts grid2" id="injFreq">
      <label class="opt"><input type="radio" name="ifreq" value="weekly" ${d.freq==='weekly'?'checked':''}><span>주 1회 (위고비·마운자로)</span></label>
      <label class="opt"><input type="radio" name="ifreq" value="daily" ${d.freq==='daily'?'checked':''}><span>매일 (삭센다·경구)</span></label>
    </div>
    <div id="injWeekWrap" style="${d.freq==='daily'?'display:none':''}">
      <div class="chips" id="injWeek" style="margin-top:10px;justify-content:center">
        ${WEEKDAYS.map((w,i)=>`<button class="chip ${d.weekday===i?'sel':''}" data-wd="${i}">${w}</button>`).join('')}
      </div>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="num"><input id="injTime" type="time" value="${d.time}"></div>
      <button class="btn" style="flex:0 0 90px;margin:0" id="injSave">저장</button>
    </div>
  </div>`;
}
function bindHome(p){
  document.querySelectorAll('#homeQuick .chip[data-g]').forEach(b=>{
    b.onclick = ()=>{ addProtein(Number(b.dataset.g), b.dataset.l); renderApp(p); };
  });
  const c=document.getElementById('quickCustom');
  if(c) c.onclick = ()=>{
    const v=prompt('단백질 양(g)을 입력하세요','20');
    const g=Number(v); if(g>0){ addProtein(g,'직접입력'); renderApp(p); }
  };
  // 주사일 설정 폼
  if(document.getElementById('injSave')){
    document.querySelectorAll('#injFreq input').forEach(r=>r.onchange=()=>{
      injDraft.freq=r.value; document.getElementById('injWeekWrap').style.display = r.value==='daily'?'none':''; });
    document.querySelectorAll('#injWeek .chip').forEach(b=>b.onclick=()=>{
      injDraft.weekday=Number(b.dataset.wd);
      document.querySelectorAll('#injWeek .chip').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); });
    document.getElementById('injSave').onclick=()=>{
      injDraft.time=document.getElementById('injTime').value||'09:00';
      p.injection={freq:injDraft.freq,weekday:injDraft.weekday,time:injDraft.time};
      saveProfile(p); showInjForm=false; injDraft=null; renderApp(p); };
  }
  // 주사일 카드 버튼
  const injSetup=document.getElementById('injSetup'); if(injSetup) injSetup.onclick=()=>{ injDraft=null; showInjForm=true; renderApp(p); };
  const injEdit=document.getElementById('injEdit'); if(injEdit) injEdit.onclick=()=>{ injDraft={...p.injection}; showInjForm=true; renderApp(p); };
  const injDone2=document.getElementById('injDone2'); if(injDone2) injDone2.onclick=()=>{ toggleInjection(); renderApp(p); };
  const injIcs=document.getElementById('injIcs'); if(injIcs) injIcs.onclick=()=>downloadICS(p.injection);
  const injNotif=document.getElementById('injNotif'); if(injNotif) injNotif.onclick=()=>enableNotif(p);
}

/* ---------- 기록 탭 (Week 2) ---------- */
const SIDE_EFFECTS=['메스꺼움','변비','피로','속쓰림','두통'];
function logView(p){
  const key=todayKey();
  const day=getDay(key);
  const total=proteinTotal(day);
  const pct=Math.min(100, Math.round(total/p.proteinTarget*100));
  const logs=loadLogs();
  const recent=[];
  const d=new Date();
  for(let i=0;i<7;i++){ const k=todayKey(d); recent.push([k, logs[k]]); d.setDate(d.getDate()-1); }

  return `
    <h2>오늘 기록</h2>
    <p class="sub">${key}</p>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <b>단백질</b><span class="muted">${total} / ${p.proteinTarget}g</span>
      </div>
      <div class="prog" style="margin:10px 0"><i style="width:${pct}%"></i></div>
      <div class="quick" id="logQuick">
        ${QUICK_FOODS.map(([l,g])=>`<button class="chip" data-g="${g}" data-l="${l}">+${g} ${l}</button>`).join('')}
        <button class="chip alt" id="logCustom">직접입력</button>
      </div>
      ${day.protein.length ? `<ul class="entries">${day.protein.map((e,i)=>`
        <li><span>${e.label} · ${e.g}g</span><button data-idx="${i}" class="del">✕</button></li>`).join('')}</ul>` : `<p class="sub" style="margin-top:12px">아직 기록이 없어요. 위에서 추가해보세요.</p>`}
    </div>

    <div class="card">
      <b>오늘 체중</b>
      <div class="row" style="margin-top:8px">
        <div class="num"><input id="w-input" type="number" inputmode="decimal" placeholder="kg" value="${day.weightKg??''}"></div>
        <button class="btn" style="flex:0 0 90px;margin:0" id="w-save">저장</button>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>오늘 근력운동</b>
        <button class="toggle ${day.resistanceDone?'on':''}" id="res-toggle">${day.resistanceDone?'✓ 했어요':'안 했어요'}</button>
      </div>
    </div>

    <div class="card">
      <b>부작용 (있으면 체크)</b>
      <div class="chips" id="side-chips" style="margin-top:10px">
        ${SIDE_EFFECTS.map(s=>`<button class="chip ${day.sideEffects.includes(s)?'sel':''}" data-s="${s}">${s}</button>`).join('')}
      </div>
    </div>

    ${isPremium() ? `
    <div class="section-title">이번 주 리포트</div>
    ${weeklyReportCard(p)}

    <div class="section-title">최근 14일 단백질</div>
    <div class="card">${proteinBarChart(rangeDays(14), p.proteinTarget)}</div>

    <div class="section-title">체중 추세</div>
    <div class="card">${weightChart(rangeDays(14))}</div>
    ` : `
    <div class="section-title">추세 & 리포트</div>
    ${paywallCard('그래프·주간 리포트는 프리미엄','근육이 지켜지는지 체중·단백질 추세와 주간 리포트로 확인하세요.')}
    `}

    <div class="section-title">최근 7일 요약</div>
    <div class="card">
      ${recent.map(([k,dd])=>{
        const t=dd?proteinTotal(dd):0; const done=dd&&dd.resistanceDone; const w=dd&&dd.weightKg; const inj=dd&&dd.injectionDone;
        const ok=t>=p.proteinTarget;
        return `<div class="kv">
          <span class="k">${k.slice(5)}</span>
          <span>${t>0?`<b style="color:${ok?'var(--low)':'var(--text)'}">${t}g</b>`:'<span class="muted">–</span>'} ${done?'· 💪':''} ${inj?'· 💉':''} ${w?`· ${w}kg`:''}</span>
        </div>`;
      }).join('')}
    </div>
    <p class="disclaimer">기록은 이 기기에 저장돼요. (클라우드 동기화는 추후)</p>`;
}
function bindLog(p){
  document.querySelectorAll('#logQuick .chip[data-g]').forEach(b=>{
    b.onclick=()=>{ addProtein(Number(b.dataset.g), b.dataset.l); renderApp(p); };
  });
  const lc=document.getElementById('logCustom');
  if(lc) lc.onclick=()=>{ const v=prompt('단백질 양(g)','20'); const g=Number(v); if(g>0){ addProtein(g,'직접입력'); renderApp(p); } };
  document.querySelectorAll('.entries .del').forEach(b=>{
    b.onclick=()=>{ removeProtein(Number(b.dataset.idx)); renderApp(p); };
  });
  const ws=document.getElementById('w-save');
  if(ws) ws.onclick=()=>{ const v=Number(document.getElementById('w-input').value); if(v>0){ setWeight(v); renderApp(p); } };
  const rt=document.getElementById('res-toggle');
  if(rt) rt.onclick=()=>{ toggleResistance(); renderApp(p); };
  document.querySelectorAll('#side-chips .chip').forEach(b=>{
    b.onclick=()=>{ toggleSide(b.dataset.s); renderApp(p); };
  });
}

/* ---------- 분석/차트 (Week 5) ---------- */
function rangeDays(n){ const logs=loadLogs(); const arr=[]; for(let i=n-1;i>=0;i--){ const k=todayKey(addDays(new Date(),-i)); arr.push([k, logs[k]]); } return arr; }
function weekFeedback(hit){ return hit>=6?'완벽해요! 💪':hit>=4?'잘하고 있어요 👍':hit>=2?'조금만 더 챙겨봐요':'이번 주 단백질을 놓쳤어요. 다시 시작! 🙂'; }
function weeklyReportCard(p){
  const days=rangeDays(7);
  let hit=0,wk=0,inj=0,ptot=0,pdays=0;
  days.forEach(([k,dd])=>{ if(!dd)return; const t=proteinTotal(dd); if(t>0){ptot+=t;pdays++;} if(t>=p.proteinTarget)hit++; if(dd.resistanceDone)wk++; if(dd.injectionDone)inj++; });
  const avg=pdays?Math.round(ptot/pdays):0;
  return `<div class="card">
    <b>📅 이번 주 리포트 · 최근 7일</b>
    <div class="stat-row" style="margin-top:12px">
      <div class="stat"><div class="v">${hit}<span style="font-size:13px;color:var(--muted)">/7</span></div><div class="k">단백질 목표</div></div>
      <div class="stat"><div class="v">${wk}회</div><div class="k">근력운동</div></div>
      <div class="stat"><div class="v">${inj}회</div><div class="k">주사</div></div>
    </div>
    <p class="sub" style="margin-top:12px;text-align:center">평균 단백질 <b style="color:var(--accent2)">${avg}g</b> / 목표 ${p.proteinTarget}g · ${weekFeedback(hit)}</p>
  </div>`;
}
function proteinBarChart(days, target){
  const W=320,H=132,pad=18,n=days.length;
  const vals=days.map(([k,dd])=>dd?proteinTotal(dd):0);
  const max=Math.max(target,...vals,1);
  const gap=(W-pad*2)/n, bw=gap*0.62, baseY=H-22, top=12;
  const sc=v=>(v/max)*(baseY-top);
  const bars=vals.map((v,i)=>{ const x=pad+gap*i+(gap-bw)/2, h=sc(v), ok=v>=target&&v>0;
    return `<rect x="${x.toFixed(1)}" y="${(baseY-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="3" fill="${ok?'#59e2c5':'#3a4266'}"/>`; }).join('');
  const ty=baseY-sc(target);
  const labels=days.map(([k],i)=> i%3===0?`<text x="${(pad+gap*i+gap/2).toFixed(1)}" y="${H-6}" font-size="8" fill="#6b7396" text-anchor="middle">${k.slice(8)}</text>`:'').join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="최근 단백질 섭취 막대그래프">
    <line x1="${pad}" y1="${ty.toFixed(1)}" x2="${W-pad}" y2="${ty.toFixed(1)}" stroke="#6c8cff" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="${W-pad}" y="${(ty-4).toFixed(1)}" font-size="8" fill="#6c8cff" text-anchor="end">목표 ${target}g</text>
    ${bars}${labels}
  </svg>`;
}
function weightChart(days){
  const pts=days.map(([k,dd],i)=>[i,(dd&&dd.weightKg)?dd.weightKg:null]).filter(p=>p[1]!=null);
  if(pts.length<2) return `<p class="sub center" style="padding:18px 0">체중을 2일 이상 기록하면 추세가 보여요.</p>`;
  const W=320,H=120,pad=24,n=days.length;
  const ws=pts.map(p=>p[1]), min=Math.min(...ws), max=Math.max(...ws), rng=(max-min)||1;
  const X=i=>pad+(i/(n-1))*(W-pad*2), Y=w=>14+(1-(w-min)/rng)*(H-38);
  const path=pts.map((p,idx)=>`${idx?'L':'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
  const dots=pts.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="#59e2c5"/>`).join('');
  const diff=(pts[pts.length-1][1]-pts[0][1]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="체중 추세 선그래프">
    <path d="${path}" fill="none" stroke="#6c8cff" stroke-width="2"/>${dots}
    <text x="${pad}" y="11" font-size="9" fill="#6b7396">${max}kg</text>
    <text x="${pad}" y="${H-4}" font-size="9" fill="#6b7396">${min}kg</text>
  </svg><p class="sub center" style="margin-top:2px">기간 변화 <b style="color:${diff<=0?'var(--accent2)':'var(--text)'}">${diff>0?'+':''}${diff}kg</b></p>`;
}

/* ---------- 루틴 (Week 3): 규칙기반 추천 엔진 ----------
   ⚙️ LLM 업그레이드 훅: aiRecommend()에 서버리스 엔드포인트를 꽂으면 규칙기반을 대체/보강.
   현재는 키/서버 불필요한 로컬 엔진으로 동작(빠르고 무료). */
let mealSeed=1, routineSeed=1;
function rng32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// 한식 위주 단백질 식품 DB (p = 단백질 g)
const FOODS=[
  {n:'삶은 계란 1개',p:6},{n:'닭가슴살 100g',p:23},{n:'닭안심 100g',p:23},
  {n:'두부 반모(150g)',p:13},{n:'연두부 1팩',p:6},{n:'그릭요거트 100g',p:10},
  {n:'프로틴 셰이크 1스쿱',p:20},{n:'참치캔 1개',p:25},{n:'연어 100g',p:20},
  {n:'소고기 살코기 100g',p:26},{n:'돼지 등심 100g',p:22},{n:'새우 100g',p:20},
  {n:'오징어 100g',p:18},{n:'낫토 1팩',p:8},{n:'우유 200ml',p:6},
  {n:'검은콩 한 줌(30g)',p:11},{n:'프로틴바 1개',p:15},{n:'계란흰자 3개',p:11},
  {n:'코티지치즈 100g',p:11},{n:'병아리콩 100g',p:9},
];
function suggestMeals(gap, seed){
  const rng=rng32(seed*7+3);
  const pool=[...FOODS].sort(()=>rng()-0.5);
  const g=Math.max(15,gap);
  const singles=pool.filter(f=>f.p>=Math.min(20,g*0.5)).slice(0,3);
  // 조합: 목표 근접까지 2~3개
  let combo=[], tot=0;
  for(const f of pool){ if(tot>=g) break; if(combo.includes(f)) continue; combo.push(f); tot+=f.p; if(combo.length>=3) break; }
  return { singles: singles.length?singles:pool.slice(0,3), combo, comboTotal:tot };
}
/* 쿠팡파트너스 단백질 제품 (⚠️ 실제 파트너스 딥링크로 교체 · 아래는 검색 URL 임시값) */
const COUPANG_NOTICE='쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.';
const COUPANG_PRODUCTS=[
  {label:'프로틴 파우더',url:'https://www.coupang.com/np/search?q=프로틴'},
  {label:'닭가슴살',url:'https://www.coupang.com/np/search?q=닭가슴살'},
  {label:'그릭요거트',url:'https://www.coupang.com/np/search?q=그릭요거트'},
  {label:'단백질바',url:'https://www.coupang.com/np/search?q=단백질바'},
];
const EX={
  lower:[{n:'의자 스쿼트',sr:'3세트 × 10회',tip:'의자에 살짝 앉았다 일어나기'},{n:'힙 브릿지',sr:'3 × 12',tip:'엉덩이 꽉 조이기'},{n:'런지',sr:'3 × 10(양쪽)',tip:'무릎이 발끝 넘지 않게'}],
  push:[{n:'벽 팔굽혀펴기',sr:'3 × 12',tip:'익숙하면 무릎 대고'},{n:'무릎 푸시업',sr:'3 × 8',tip:'몸을 일자로'}],
  pull:[{n:'밴드 로우',sr:'3 × 12',tip:'밴드 없으면 수건 당기기'},{n:'슈퍼맨',sr:'3 × 12',tip:'등 근육 조이기'}],
  core:[{n:'플랭크',sr:'3 × 20초',tip:'허리 꺾이지 않게'},{n:'데드버그',sr:'3 × 10',tip:'허리를 바닥에 붙이고'}],
};
function buildRoutine(p, seed){
  const rng=rng32(seed*11+5);
  const pick=arr=>arr[Math.floor(rng()*arr.length)];
  const r=[pick(EX.lower),pick(EX.push),pick(EX.pull),pick(EX.core)];
  if(p.goal==='muscle') r.splice(2,0,pick(EX.lower)); // 근육 목표면 하체 1개 추가
  return r;
}
// LLM 업그레이드 자리 (지금은 null 반환 → 로컬 엔진 사용)
async function aiRecommend(/* kind, payload */){ return null; }

function routineView(p){
  if(!isPremium()) return `<h2>오늘의 루틴</h2>${paywallCard('AI 식단·운동 추천은 프리미엄','오늘 남은 단백질을 채울 한식 추천과 맞춤 저항운동 루틴을 매일 받아보세요.')}`;
  const day=getDay(todayKey());
  const gap=Math.max(0, p.proteinTarget - proteinTotal(day));
  const m=suggestMeals(gap, mealSeed);
  const routine=buildRoutine(p, routineSeed);
  return `
    <h2>오늘의 루틴</h2>
    <p class="sub">약·목표·오늘 기록에 맞춘 제안이에요</p>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>🍚 오늘 뭐 먹지</b>
        <button class="chip" id="mealRefresh">다른 추천 ↻</button>
      </div>
      <p class="sub" style="margin:8px 0 12px">${gap>0?`목표까지 <b style="color:var(--accent2)">${gap}g</b> 남았어요. 이 중 하나로 채워보세요.`:'오늘 목표 달성! 아래는 참고용이에요 💪'}</p>
      ${m.singles.map(f=>`
        <div class="rec"><span>${f.n} <b class="p">+${f.p}g</b></span>
          <button class="chip logbtn" data-g="${f.p}" data-n="${f.n}">기록</button></div>`).join('')}
      <div class="combo">
        <div class="k">추천 조합</div>
        <div>${m.combo.map(f=>f.n).join(' + ')} <b class="p">= ${m.comboTotal}g</b></div>
        <button class="chip alt" id="comboLog" style="margin-top:8px">조합 전체 기록 (+${m.comboTotal}g)</button>
      </div>
      <div class="coupang">
        <div class="k">🛒 단백질 채우기 · 추천 제품</div>
        <div class="cp-list">${COUPANG_PRODUCTS.map(x=>`<a class="cp" href="${x.url}" target="_blank" rel="noopener nofollow sponsored">${x.label}</a>`).join('')}</div>
        <p class="cp-notice">${COUPANG_NOTICE}</p>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>🏋️ 오늘 운동 루틴</b>
        <button class="chip" id="routineRefresh">다른 루틴 ↻</button>
      </div>
      <p class="sub" style="margin:8px 0 10px">근손실 방지엔 저항운동이 핵심. 집에서 맨몸/밴드로.</p>
      <ol class="routine">
        ${routine.map(e=>`<li><div class="ex-top"><b>${e.n}</b><span class="sr">${e.sr}</span></div><div class="tip">💡 ${e.tip}</div></li>`).join('')}
      </ol>
      <button class="btn ${day.resistanceDone?'secondary':''}" id="routineDone">${day.resistanceDone?'✓ 오늘 운동 완료됨':'오늘 운동 완료 기록'}</button>
    </div>

    <p class="disclaimer">규칙기반 추천 v1. AI 개인화 추천은 서버 연동 후 이 자리에 확장됩니다. 개인 건강상태에 따라 조정하세요.</p>`;
}
function bindRoutine(p){
  document.getElementById('mealRefresh').onclick=()=>{ mealSeed++; renderApp(p); };
  document.getElementById('routineRefresh').onclick=()=>{ routineSeed++; renderApp(p); };
  document.querySelectorAll('.logbtn').forEach(b=>{
    b.onclick=()=>{ addProtein(Number(b.dataset.g), b.dataset.n); renderApp(p); };
  });
  const cl=document.getElementById('comboLog');
  if(cl) cl.onclick=()=>{ const m=suggestMeals(Math.max(0,p.proteinTarget-proteinTotal(getDay(todayKey()))), mealSeed);
    m.combo.forEach(f=>addProtein(f.p,f.n)); renderApp(p); };
  const rd=document.getElementById('routineDone');
  if(rd) rd.onclick=()=>{ const day=getDay(todayKey()); if(!day.resistanceDone) toggleResistance(); renderApp(p); };
}

/* ---------- 설정 ---------- */
function settingsView(p){
  return `
    <h2>설정</h2>
    <div class="card">
      <div class="kv"><span class="k">복용 약</span><span>${DRUG_LABEL[p.drug]}</span></div>
      <div class="kv"><span class="k">복용 기간</span><span>${({'start':'이제 시작','<3':'3개월 미만','3-6':'3~6개월','6+':'6개월 이상'})[p.duration]}</span></div>
      <div class="kv"><span class="k">목표</span><span>${({lose:'감량',maintain:'유지',muscle:'근육 지키기'})[p.goal]}</span></div>
      <div class="kv"><span class="k">나이 / 체중</span><span>${p.age}세 · ${p.weight}kg</span></div>
      <div class="kv"><span class="k">근력운동</span><span>${({none:'거의 안 함','1-2':'주 1~2회',sometimes:'가끔','3+':'주 3회 이상'})[p.exercise]}</span></div>
      <div class="kv"><span class="k">단백질 목표</span><span>${p.proteinTarget}g / 일</span></div>
      <div class="kv"><span class="k">근손실 위험도</span><span class="badge ${p.riskLevel}">● ${RISK_LABEL[p.riskLevel]}</span></div>
      <div class="kv"><span class="k">주사 일정</span><span>${p.injection?(p.injection.freq==='daily'?'매일':'매주 '+WEEKDAYS[p.injection.weekday]+'요일')+' '+p.injection.time:'미설정 (홈에서 설정)'}</span></div>
      <div class="kv"><span class="k">구독</span><span>${subLabel()}</span></div>
    </div>
    <div class="card">
      <b>📚 근거·출처</b>
      <p class="sub" style="margin:6px 0 10px">단백질·운동 권고는 공식 가이드라인을 근거로 합니다.</p>
      <p class="sub" style="line-height:1.9">
        · <a href="https://general.kosso.or.kr/html/user/core/view/reaction/main/kosso/inc/data/guideline2022_vol8.pdf" target="_blank" rel="noopener">대한비만학회 진료지침</a> (단백질 1.0~1.2g/kg, 근력 주2~3회)<br>
        · <a href="https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6722" target="_blank" rel="noopener">질병관리청 국가건강정보포털</a> (근손실)<br>
        · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12536186/" target="_blank" rel="noopener">의학 리뷰</a> (GLP-1 감량 시 20~30% 근육 손실)
      </p>
    </div>
    <button class="btn ${isPremium()?'secondary':''}" id="subManage">${getSub().status==='active'?'구독 관리':'프리미엄 보기'}</button>
    <button class="btn secondary" id="redo">프로필 다시 설정</button>
    <button class="btn ghost" id="reset">데이터 초기화</button>
    <p class="disclaimer center"><a href="terms.html" style="color:var(--muted)">이용약관</a> · <a href="privacy.html" style="color:var(--muted)">개인정보처리방침</a> · <a href="mailto:x@nomadx.life" style="color:var(--muted)">문의</a></p>
    <p class="disclaimer center logo">머슬<span class="dot">킵</span> · MVP v0.6 (Week 6)</p>`;
}
function bindSettings(p){
  document.getElementById('redo').onclick=()=>{ draft={...p}; stepIndex=0; renderStep(); };
  document.getElementById('reset').onclick=()=>{
    if(confirm('프로필과 모든 기록을 지우고 처음부터 시작할까요?')){ clearProfile(); localStorage.removeItem(LOGS_KEY); localStorage.removeItem(SUB_KEY); route(); }
  };
  document.getElementById('subManage').onclick=()=>{
    if(getSub().status==='active'){ if(confirm('구독을 해지할까요? (테스트)')){ cancelSub(); renderApp(p); } }
    else { showSub=true; renderApp(p); }
  };
}

/* ---------- 탭바 ---------- */
function tabbar(){
  const tabs=[['home','🏠','홈'],['log','📊','기록'],['routine','🥗','루틴'],['settings','⚙️','설정']];
  return `<nav class="tabbar">${tabs.map(([id,ic,l])=>`
    <button data-tab="${id}" class="${activeTab===id?'active':''}"><span class="ic">${ic}</span>${l}</button>`).join('')}</nav>`;
}
function bindTabs(p){
  document.querySelectorAll('.tabbar button').forEach(b=>{ b.onclick=()=>{ activeTab=b.dataset.tab; renderApp(p); }; });
}

/* ---------- PWA ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

route();
