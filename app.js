/* 머슬킵 MVP — Week 1: 온보딩 + 프로필 + 홈 대시보드 뼈대
   순수 바닐라 JS · localStorage. Week 2부터 기록/LLM추천/주사일/차트/결제 확장. */

const PROFILE_KEY = 'mk_profile_v1';
const app = document.getElementById('app');

/* ---------- 상태 ---------- */
let draft = {};        // 온보딩 중 임시 프로필
let stepIndex = 0;
let activeTab = 'home';

/* ---------- 온보딩 질문 정의 ---------- */
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

/* ---------- 계산 로직 (계산기와 동일 원리) ---------- */
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
  const maxRaw = 13, pct = Math.round(raw/maxRaw*100);
  let risk = raw<=3 ? 'low' : raw<=7 ? 'mid' : 'high';

  let f = 1.4;
  if(p.age>=50) f += 0.2;
  if(S.speed[p.speed]>=2) f += 0.2;
  if(p.exercise==='3+') f += 0.1;
  if(p.goal==='muscle') f += 0.1;
  f = Math.min(2.0, Math.max(1.2, f));
  const proteinTarget = Math.round(p.weight*f/5)*5;

  // 오늘 할 일 3개
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

/* ---------- 저장/로드 ---------- */
function loadProfile(){ try{ return JSON.parse(localStorage.getItem(PROFILE_KEY)); }catch(e){ return null; } }
function saveProfile(p){ localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }

/* ---------- 라우팅 ---------- */
function route(){
  const p = loadProfile();
  if(!p){ draft = {}; stepIndex = 0; return renderWelcome(); }
  renderApp(p);
}

/* ---------- 화면: 웰컴 ---------- */
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

/* ---------- 화면: 온보딩 스텝 ---------- */
function renderStep(){
  const step = STEPS[stepIndex];
  const pct = Math.round((stepIndex)/(STEPS.length)*100);
  let body = '';

  if(step.type==='basic'){
    body = `
      <div class="row">
        <div class="num"><input id="f-age" type="number" inputmode="numeric" placeholder="나이" value="${draft.age||''}"></div>
        <div class="num"><input id="f-weight" type="number" inputmode="decimal" placeholder="체중(kg)" value="${draft.weight||''}"></div>
      </div>
      <div class="opts grid2" style="margin-top:10px">
        ${['f:여성','m:남성'].map(o=>{const[v,l]=o.split(':');return `
          <label class="opt"><input type="radio" name="sex" value="${v}" ${draft.sex===v?'checked':''}><span>${l}</span></label>`}).join('')}
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

  // 라디오 선택 시 자동 다음 (basic 제외)
  if(step.type!=='basic'){
    document.querySelectorAll('input[name="opt"]').forEach(r=>{
      r.onchange = ()=>{ draft[step.key]=r.value; setTimeout(nextStep, 180); };
    });
  }
  const back = document.getElementById('back');
  if(back) back.onclick = ()=>{ stepIndex--; renderStep(); };
  document.getElementById('next').onclick = ()=>{
    if(step.type==='basic'){
      const age=Number(document.getElementById('f-age').value);
      const weight=Number(document.getElementById('f-weight').value);
      const sex=document.querySelector('input[name="sex"]:checked');
      if(!age||!weight||!sex){ shake(); return; }
      draft.age=age; draft.weight=weight; draft.sex=sex.value;
      nextStep();
    } else {
      if(!draft[step.key]){ shake(); return; }
      nextStep();
    }
  };
}
function nextStep(){
  if(stepIndex < STEPS.length-1){ stepIndex++; renderStep(); }
  else finishOnboarding();
}
function shake(){ const n=document.getElementById('next'); n.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:220}); }

function finishOnboarding(){
  const derived = compute(draft);
  const profile = { ...draft, ...derived, v:1, createdAt:new Date().toISOString() };
  saveProfile(profile);
  activeTab='home';
  renderApp(profile);
}

/* ---------- 화면: 앱(탭 구성) ---------- */
function renderApp(p){
  const body = { home:homeView, log:logView, routine:routineView, settings:settingsView }[activeTab](p);
  app.innerHTML = `<div class="screen has-tabs">${body}</div>${tabbar()}`;
  bindTabs(p);
  if(activeTab==='home'){
    const bar=document.getElementById('proteinProg');
    if(bar) requestAnimationFrame(()=>bar.style.width='0%'); // Week2: 실제 섭취량 반영
  }
  if(activeTab==='settings') bindSettings(p);
}

function greeting(){
  const h=new Date().getHours();
  return h<11?'좋은 아침이에요':h<17?'오늘도 화이팅':h<21?'좋은 저녁이에요':'오늘 하루 수고했어요';
}
const RISK_LABEL={low:'낮음',mid:'중간',high:'높음'};
const DRUG_LABEL={mounjaro:'마운자로',wegovy:'위고비',saxenda:'삭센다',oral:'경구/기타'};

function homeView(p){
  return `
    <p class="greet">${greeting()} 👋</p>
    <h2>오늘도 근육 지켜요</h2>

    <div class="card hero-protein">
      <div class="lbl">오늘 단백질 목표</div>
      <div class="big">0<span class="unit">/${p.proteinTarget}g</span></div>
      <div class="prog"><i id="proteinProg"></i></div>
      <div class="lbl">기록 기능은 곧 열려요 (Week 2)</div>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="v">${DRUG_LABEL[p.drug]}</div><div class="k">복용 약</div></div>
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

function comingSoon(title, weekText, desc){
  return `
    <h2>${title}</h2>
    <div class="card center" style="padding:40px 18px">
      <div style="font-size:44px">🚧</div>
      <p style="font-weight:800;margin:10px 0 4px">${weekText}에 열려요</p>
      <p class="sub">${desc}</p>
    </div>`;
}
function logView(){ return comingSoon('기록','Week 2~5','오늘 먹은 단백질·체중·근력·부작용을 30초에 기록하고, 유지되는지 그래프로 확인해요.'); }
function routineView(){ return comingSoon('루틴','Week 3','약·목표에 맞춘 저항운동 루틴과 "오늘 뭐 먹지" 단백질 추천을 AI가 매일 제안해요.'); }

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
    <p class="disclaimer center logo">머슬<span class="dot">킵</span> · MVP v0.1 (Week 1)</p>`;
}
function bindSettings(p){
  document.getElementById('redo').onclick = ()=>{ draft={...p}; stepIndex=0; renderStep(); };
  document.getElementById('reset').onclick = ()=>{
    if(confirm('모든 데이터를 지우고 처음부터 시작할까요?')){ clearProfile(); route(); }
  };
}

/* ---------- 탭바 ---------- */
function tabbar(){
  const tabs=[['home','🏠','홈'],['log','📊','기록'],['routine','🥗','루틴'],['settings','⚙️','설정']];
  return `<nav class="tabbar">${tabs.map(([id,ic,l])=>`
    <button data-tab="${id}" class="${activeTab===id?'active':''}"><span class="ic">${ic}</span>${l}</button>`).join('')}</nav>`;
}
function bindTabs(p){
  document.querySelectorAll('.tabbar button').forEach(b=>{
    b.onclick = ()=>{ activeTab=b.dataset.tab; renderApp(p); };
  });
}

/* ---------- PWA 서비스워커 ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ---------- 시작 ---------- */
route();
