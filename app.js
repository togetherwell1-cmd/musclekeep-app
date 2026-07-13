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

/* ---------- 라우팅 ---------- */
function route(){
  const p = loadProfile();
  if(!p){ draft={}; stepIndex=0; return renderWelcome(); }
  renderApp(p);
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
  saveProfile(profile); activeTab='home'; renderApp(profile);
}

/* ---------- 앱(탭) ---------- */
function renderApp(p){
  const body = { home:homeView, log:logView, routine:routineView, settings:settingsView }[activeTab](p);
  app.innerHTML = `<div class="screen has-tabs">${body}</div>${tabbar()}`;
  bindTabs(p);
  if(activeTab==='home') bindHome(p);
  if(activeTab==='log') bindLog(p);
  if(activeTab==='routine') bindRoutine(p);
  if(activeTab==='settings') bindSettings(p);
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

    <div class="card soon">
      <div style="display:flex;align-items:center"><b>💉 다음 주사일 알림</b><span class="pill-soon">곧 (Week 4)</span></div>
      <p class="sub" style="margin-top:6px">주사 요일을 등록하면 매주 리마인드해드릴게요.</p>
    </div>

    <p class="disclaimer">의료 진단·처방이 아닙니다. 약물 관련 결정은 의사와 상담하세요.</p>`;
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

    <div class="section-title">최근 7일</div>
    <div class="card">
      ${recent.map(([k,dd])=>{
        const t=dd?proteinTotal(dd):0; const done=dd&&dd.resistanceDone; const w=dd&&dd.weightKg;
        const ok=t>=p.proteinTarget;
        return `<div class="kv">
          <span class="k">${k.slice(5)}</span>
          <span>${t>0?`<b style="color:${ok?'var(--low)':'var(--text)'}">${t}g</b>`:'<span class="muted">–</span>'} ${done?'· 💪':''} ${w?`· ${w}kg`:''}</span>
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
    </div>
    <button class="btn secondary" id="redo">프로필 다시 설정</button>
    <button class="btn ghost" id="reset">데이터 초기화</button>
    <p class="disclaimer center logo">머슬<span class="dot">킵</span> · MVP v0.3 (Week 3)</p>`;
}
function bindSettings(p){
  document.getElementById('redo').onclick=()=>{ draft={...p}; stepIndex=0; renderStep(); };
  document.getElementById('reset').onclick=()=>{
    if(confirm('프로필과 모든 기록을 지우고 처음부터 시작할까요?')){ clearProfile(); localStorage.removeItem(LOGS_KEY); route(); }
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
