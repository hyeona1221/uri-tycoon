(()=>{
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const won=n=>(n<0?'-':'')+Math.abs(Math.round(n||0)).toLocaleString('ko-KR')+'원';
const now=new Date();const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
/* 살림 기간: 월급날(25일)부터 다음 달 24일까지를 한 달로 봄. 기간 이름은 월급 받은 달 (예: 2026-11 = 11/25~12/24) */
const PAYDAY=25;
function periodOf(ds){const [y,m,d]=ds.split('-').map(Number);if(d>=PAYDAY)return `${y}-${pad(m)}`;const t=new Date(y,m-2,1);return `${t.getFullYear()}-${pad(t.getMonth()+1)}`}
function periodRange(p){const [y,m]=p.split('-').map(Number);return [new Date(y,m-1,PAYDAY),new Date(y,m,PAYDAY-1)]}
function periodLabel(p,short){const [a,b]=periodRange(p);return short?`${a.getMonth()+1}/${a.getDate()}~${b.getMonth()+1}/${b.getDate()}`:`${a.getMonth()+1}월 ${a.getDate()}일 ~ ${b.getMonth()+1}월 ${b.getDate()}일`}
const ym=periodOf(today);
const ymShift=(m,d)=>{const [y,mm]=m.split('-').map(Number);const t=new Date(y,mm-1+d,1);return `${t.getFullYear()}-${pad(t.getMonth()+1)}`};

const DEPTS=[
 {id:'food',n:'식품(장보기)',team:'식자재조달팀',c:'#5aa84f'},
 {id:'dine',n:'외식/배달',team:'외식·간식지원팀',c:'#e2733a'},
 {id:'baby',n:'육아용품',team:'신입사원케어팀',c:'#f29bb8'},
 {id:'choa',n:'초아비용',team:'인턴복지팀',c:'#d8913a'},
 {id:'home',n:'생필품',team:'총무·비품팀',c:'#55a9c9'},
 {id:'car',n:'교통',team:'차량운행팀',c:'#c94a3c'},
 {id:'med',n:'의료/약국',team:'보건관리팀',c:'#4f7fd0'},
 {id:'self',n:'의류/미용/운동',team:'자기계발팀',c:'#8d63c4'},
 {id:'gift',n:'경조사/선물',team:'대외협력팀',c:'#c9a23a'},
 {id:'etc',n:'예비비용',team:'긴급예산팀',c:'#7d8796'},
];
let FIXED=[];
const fxTotal=()=>FIXED.reduce((s,f)=>s+f.a,0);
const TARGET_MIN=1000000,TARGET_MAX=1200000;

/* ---------- data (Supabase) ---------- */
const CFG=window.TYCOON_CONFIG||{};
const sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true}});
let S={expenses:[],months:{},noSpend:[],sound:true};
try{S.sound=localStorage.getItem('uri-sound')!=='off'}catch(e){}
const M=m=>(S.months[m]||(S.months[m]={received:0,paid:{}}));
let loaded=false;
async function loadAll(){
  {const {data:{session},error}=await sb.auth.getSession();if(!session||error){const r=await sb.auth.refreshSession();if(r.error||!r.data.session)throw r.error||new Error('no session')}}
  const [e,mo,ns,fx]=await Promise.all([
    sb.from('expenses').select('*').order('date'),
    sb.from('months').select('*'),
    sb.from('no_spend').select('date'),
    sb.from('fixed_items').select('*').eq('active',true).order('sort')]);
  const err=e.error||mo.error||ns.error||fx.error;if(err)throw err;
  S.expenses=e.data.map(r=>({id:r.id,date:r.date,cat:r.cat,place:r.place,amount:r.amount,method:r.method,memo:r.memo,at:r.created_at,by:r.created_by}));
  S.months={};for(const r of mo.data)S.months[r.ym]={received:r.received,paid:r.paid||{}};
  S.noSpend=ns.data.map(r=>r.date);
  FIXED=fx.data.map(r=>({id:r.id,n:r.name,w:r.due,a:r.amount}));
  loaded=true;$('syncInfo').innerHTML='<span class="syncdot"></span>실시간 동기화 중 · 마지막 갱신 '+new Date().toLocaleTimeString('ko-KR');
}
let reloadT=0;
function scheduleReload(){clearTimeout(reloadT);reloadT=setTimeout(async()=>{try{await loadAll();render()}catch(e){}},250)}
async function write(fn,okMsg){try{const {error}=await fn();if(error)throw error;if(okMsg)toast(okMsg)}catch(e){console.error(e);toast('저장하지 못했어요. 인터넷 연결을 확인해주세요');scheduleReload()}}
const saveMonth=m=>write(()=>sb.from('months').upsert({ym:m,received:M(m).received||0,paid:M(m).paid||{},updated_at:new Date().toISOString()}));
let channel=null;
function subscribe(){if(channel)return;channel=sb.channel('uri-all');for(const t of['expenses','months','no_spend','fixed_items'])channel.on('postgres_changes',{event:'*',schema:'public',table:t},scheduleReload);channel.subscribe()}

/* ---------- sound (8-bit, generated) ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}return AC}
function tone(f,t0,dur,type='square',vol=.08){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,a.currentTime+t0);g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02)}
function noise(t0,dur,vol=.15){const a=ac();if(!a)return;const b=a.createBuffer(1,a.sampleRate*dur,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=a.createBufferSource(),g=a.createGain();s.buffer=b;g.gain.value=vol;s.connect(g).connect(a.destination);s.start(a.currentTime+t0)}
const SFX={
 stamp(){noise(0,.09,.25);tone(90,0,.12,'triangle',.2)},
 coin(){tone(988,0,.07);tone(1319,.07,.18)},
 alert(){for(let i=0;i<3;i++){tone(880,i*.24,.12,'sawtooth',.05);tone(660,i*.24+.12,.12,'sawtooth',.05)}},
 fanfare(){[523,659,784,1047].forEach((f,i)=>tone(f,i*.11,.16));tone(1047,.48,.4,'square',.07);tone(784,.48,.4,'triangle',.06)},
};
function play(n){if(S.sound)try{SFX[n]()}catch(e){}}
$('soundBtn').onclick=()=>{S.sound=!S.sound;try{localStorage.setItem('uri-sound',S.sound?'on':'off')}catch(e){}renderHud();if(S.sound)play('coin')};

/* ---------- calculations ---------- */
const exOf=m=>S.expenses.filter(e=>periodOf(e.date)===m);
const spentOf=m=>exOf(m).reduce((s,e)=>s+e.amount,0);
const paidSum=m=>FIXED.filter(f=>M(m).paid?.[f.id]).reduce((s,f)=>s+f.a,0);
function monthsList(){const set=new Set([...Object.keys(S.months),...S.expenses.map(e=>periodOf(e.date)),ym]);return [...set].sort()}
/* 금고 입출금: months.paid.v 에 기록. month:true 면 그 기간 생활비에 보태거나(out) 생활비에서 옮긴(in) 돈 */
const movesOf=p=>(S.months[p]?.paid?.v)||[];
const allMoves=()=>Object.keys(S.months).flatMap(p=>movesOf(p).map(x=>({...x,p})));
const monthAdj=p=>movesOf(p).filter(x=>x.month).reduce((s,x)=>s+(x.type==='out'?x.amount:-x.amount),0);
function surplus(m){return (S.months[m]?.received||0)-fxTotal()-spentOf(m)+monthAdj(m)}
function vaultNow(){return vaultBefore(ym)+allMoves().reduce((s,x)=>s+(x.type==='in'?x.amount:-x.amount),0)}
function vaultBefore(m){return monthsList().filter(k=>k<m).reduce((s,k)=>s+surplus(k),0)}
function nsStats(){const days=S.noSpend.filter(d=>periodOf(d)===ym);let combo=0;const set=new Set(S.noSpend);let t=new Date(now);for(;;){const k=`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;if(set.has(k)){combo++;t.setDate(t.getDate()-1)}else break}return {count:days.length,combo}}

/* ---------- toast ---------- */
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),1800)}

/* ---------- scene effects (background art + overlay canvas) ---------- */
const fx=$('fx'),fc=fx.getContext('2d');let hearts=[],sparks=[];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function heart(x,y,a){fc.globalAlpha=a;fc.fillStyle='#ff4f7a';[[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]].forEach(([i,j])=>fc.fillRect(x+i*2,y+j*2,2,2));fc.globalAlpha=1}
function fxLoop(t){fc.clearRect(0,0,512,138);
  hearts=hearts.filter(h=>t-h.t0<1800);for(const h of hearts){if(t<h.t0)continue;const k=(t-h.t0)/1800;heart(h.x+Math.sin(k*6+h.x)*4,h.y-k*34,1-k)}
  sparks=sparks.filter(p=>t-p.t0<900);for(const p of sparks){const k=(t-p.t0)/900;fc.globalAlpha=1-k;fc.fillStyle=p.c;fc.fillRect(p.x+p.vx*k*30,p.y+p.vy*k*30+k*k*20,3,3);fc.globalAlpha=1}
  requestAnimationFrame(fxLoop)}
if(!reduce)requestAnimationFrame(fxLoop);
function floatText(txt,lp,tp){if(reduce)return;const d=document.createElement('div');d.className='float';d.textContent=txt;d.style.left=lp+'%';d.style.top=tp+'%';$('stage').appendChild(d);setTimeout(()=>d.remove(),1500)}
function burst(x,y,colors){const t=performance.now();for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;sparks.push({x,y,vx:Math.cos(a),vy:Math.sin(a)-.6,c:colors[i%colors.length],t0:t})}}
function react(cat,amount){const t=performance.now();
  if(cat==='choa'){wake(true)}
  else if(cat==='baby'){babyHappy('찬솔이 최애템 GET!');burst(242,100,['#f29bb8','#9fd0f0','#f2b632'])}
  else floatText(`-${amount.toLocaleString('ko-KR')}`,'28','50');
  burst(286,70,['#f2b632','#ffd96a'])}
let dogT=[];
function pose(p){const b=$('dogBtn');b.className='dogbtn'+(p==='sleep'?'':' '+p);$('dog').src='assets/choa_'+p+'.png';$('zzz').hidden=p!=='sleep'}
function wake(withHearts){dogT.forEach(clearTimeout);dogT=[];pose('lie');
  dogT.push(setTimeout(()=>{pose('sit');if(withHearts){const t=performance.now();for(let i=0;i<6;i++)hearts.push({x:206+i*6,y:44,t0:t+i*140});floatText('초아: 멍! 고마워요','42','22')}else floatText('초아: 멍?','42','22')},300));
  dogT.push(setTimeout(()=>pose('lie'),3000));dogT.push(setTimeout(()=>pose('sleep'),3400))}
$('dogBtn').onclick=()=>{wake(false)};
let babyT=0;
function babyRest(){const h=new Date().getHours();return (h>=21||h<7)?'sleep':'crawl'}
function babyPose(p){$('babyBtn').className='babybtn '+p;$('baby').src='assets/chansol_'+p+'.png'}
function babyHappy(msg){clearTimeout(babyT);babyPose('sit');floatText(msg,'47','58');babyT=setTimeout(()=>babyPose(babyRest()),3000)}
$('babyBtn').onclick=()=>babyHappy(babyRest()==='sleep'?'찬솔: 응애… (졸려)':'찬솔: 까르르!');
babyPose(babyRest());
['assets/choa_lie.png','assets/choa_sit.png','assets/chansol_sit.png','assets/chansol_crawl.png','assets/chansol_sleep.png'].forEach(src=>{const i=new Image();i.src=src});
function drawScene(){const left=(M(ym).received||0)-fxTotal()-spentOf(ym)+monthAdj(ym);const bo=$('bossBub');bo.textContent='';bo.classList.toggle('grow',role==='boss');const bb=document.createElement('div');bo.appendChild(bb);const lines=role==='boss'?bossLines():left>=0?['이번 달 남은 돈',won(left)+'!','아껴 쓰자!']:['이번 달',won(-left)+' 초과!','금고에서 채우자!'];lines.forEach((t,i)=>{if(i)bb.appendChild(document.createElement('br'));const sp=document.createElement('span');sp.textContent=t;if(i===1){sp.style.color=role==='boss'?'#284f91':left>=0?'#2f7d2b':'#d2402f';sp.style.fontSize='1.15em'}bb.appendChild(sp)});$('vaultTag').textContent=Math.round(vaultNow()/10000).toLocaleString('ko-KR')+'만원'}
/* ---------- dept icons ---------- */
function deptIcon(c,d){const x=c.getContext('2d');c.width=14;c.height=14;x.fillStyle='#000';x.fillRect(2,2,10,10);x.fillStyle=d.c;x.fillRect(3,3,8,8);x.fillStyle='rgba(255,255,255,.55)';x.fillRect(3,3,8,2);x.fillStyle='#fff';x.font='bold 7px monospace';x.fillText(String(DEPTS.indexOf(d)+1%10),DEPTS.indexOf(d)>=9?2:5,10)}
function deptGrid(el,onPick,selected){el.textContent='';for(const d of DEPTS){const b=document.createElement('button');b.type='button';b.className='dept';b.setAttribute('aria-pressed',String(selected===d.id));const c=document.createElement('canvas');deptIcon(c,d);const t=document.createElement('b');t.textContent=d.n;b.title=`${d.n} [${d.team}]`;b.append(c,t);b.onclick=()=>onPick(d.id);el.appendChild(b)}}

/* ---------- frequent places ---------- */
const PLACES=['당근','쿠팡','마트','편의점','네이버쇼핑'];
function renderPlaces(){const box=$('fPlaces');box.textContent='';const cur=$('fPlace').value.trim();
  const freq={};for(const e of S.expenses){const p=(e.place||'').trim();if(p&&!PLACES.includes(p))freq[p]=(freq[p]||0)+1}
  const recent=Object.entries(freq).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([p])=>p);
  for(const p of [...PLACES,...recent]){const b=document.createElement('button');b.type='button';b.textContent=p;if(!PLACES.includes(p))b.className='recent';b.setAttribute('aria-pressed',String(cur===p));
    b.onclick=()=>{$('fPlace').value=cur===p?'':p;renderPlaces();if(!$('fAmt').value)$('fAmt').focus()};box.appendChild(b)}}
$('fPlace').addEventListener('input',renderPlaces);

/* ---------- state for form ---------- */
const METHODS=['하나카드','토스뱅크','우리은행','기업은행'];
let selDept='food',method=METHODS[0],editId=null;

/* ---------- render ---------- */
function setBar(el,ratio,label,warnAt=.8){el.classList.toggle('over',ratio>1);el.classList.toggle('warn',ratio>=warnAt&&ratio<=1);el.querySelector('i').style.width=Math.min(100,ratio*100)+'%';el.querySelector('span').textContent=label}
function fxRows(el){
  el.textContent='';const paid=M(ym).paid||{};
  for(const f of FIXED){const b=document.createElement('button');b.type='button';b.className='fxrow'+(paid[f.id]?' done':'');
    const box=document.createElement('span');box.className='box';box.textContent=paid[f.id]?'✓':'';
    const nm=document.createElement('span');nm.className='nm';nm.textContent=f.n;if(f.w){const s=document.createElement('small');s.textContent=f.w;nm.appendChild(s)}
    const am=document.createElement('span');am.className='am';am.textContent=f.a.toLocaleString('ko-KR');
    const st=document.createElement('span');st.className='stamp';st.textContent=paid[f.id]?'결재 완료':'결재 대기';
    b.append(box,nm,am,st);b.setAttribute('aria-pressed',String(!!paid[f.id]));b.setAttribute('aria-label',`${f.n} ${f.a}원 ${paid[f.id]?'결재 완료':'결재 대기'}`);
    b.onclick=()=>{const m=M(ym);m.paid={...(m.paid||{}),[f.id]:!m.paid?.[f.id]};saveMonth(ym);if(m.paid[f.id]){play('stamp');if(FIXED.length&&FIXED.every(x=>m.paid[x.id])){setTimeout(()=>play('fanfare'),250);toast('고정비 올 클리어!')}}render()};
    el.appendChild(b)}
}
function renderHud(){
  const xp=S.expenses.length+Object.values(S.months).reduce((s,m)=>s+Object.entries(m.paid||{}).filter(([k,v])=>k!=='h'&&v===true).length,0)+S.noSpend.length*3;
  $('lv').textContent=Math.floor(xp/20)+1;const xb=$('xp');xb.textContent='';for(let i=0;i<10;i++){const k=document.createElement('i');if(i<Math.floor((xp%20)/2))k.className='on';xb.appendChild(k)}
  const spent=spentOf(ym),[pa,pb]=periodRange(ym),total=Math.round((pb-pa)/864e5)+1,elapsed=Math.max(1,Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-pa)/864e5)+1);const pace=(spent/TARGET_MAX)/(elapsed/total);
  const st=pace<=.9?['good','양호 (잘 아끼고 있어요)']:pace<=1.1?['mid','보통 (페이스 유지!)']:['bad','주의 (예산 관리가 시급합니다!)'];
  $('status').innerHTML='재무 상태: <em></em>';const em=$('status').querySelector('em');em.className=st[0];em.textContent=st[1];
  $('hudVault').textContent=Math.round(vaultNow()/1000).toLocaleString('ko-KR')+'K';$('hudGem').textContent=nsStats().count;
  $('soundBtn').textContent=S.sound?'소리 ON':'소리 OFF';$('soundBtn').setAttribute('aria-pressed',String(S.sound));
}
function render(){
  renderHud();
  const paid=M(ym).paid||{};const done=FIXED.filter(f=>paid[f.id]).length;
  for(const [el,cnt,bar] of [[$('oFx'),$('oFxCount'),$('oFxBar')],[$('fFx'),$('fCount'),$('fBar')]]){fxRows(el);cnt.textContent=`${done}/${FIXED.length} 완료`;setBar(bar,done/FIXED.length,`${done}/${FIXED.length} 완료`,2)}
  // money
  const recv=M(ym).received||0,spent=spentOf(ym),reserved=fxTotal()-paidSum(ym),carry=vaultNow(),adj=monthAdj(ym);
  const avail=recv-fxTotal()-spent+adj;
  $('oMonth').textContent=periodLabel(ym);$('recvPeriod').textContent=periodLabel(ym)+' 살림';
  const kv=(el,rows)=>{el.textContent='';for(const [k,v,cls] of rows){const a=document.createElement('div');a.textContent=k;const b=document.createElement('div');b.className='v '+(cls||'');b.textContent=won(v);if(cls&&cls.includes('t'))a.className='t';el.append(a,b)}};
  kv($('oKv'),[['받은 돈',recv],['고정비 (예약금 포함)',-fxTotal()],['쓴 돈',-spent],...(adj?[[adj>0?'금고에서 보탬':'금고로 옮김',adj]]:[]),['이번 달 남은 돈',avail,'t '+(avail<0?'neg':'pos')]]);
  setBar($('oVarBar'),spent/TARGET_MAX,`${won(spent)} / 목표 100~120만`);
  kv($('fKv'),[['받은 돈',recv],['결재 완료 고정비',-paidSum(ym)],['예약금 (결재 대기)',-reserved],['변동비로 쓸 수 있는 돈',recv-fxTotal(),'t '+(recv-fxTotal()<0?'neg':'pos')]]);
  if(document.activeElement!==$('recvIn'))$('recvIn').value=recv?recv.toLocaleString('ko-KR'):'';
  deptGrid($('oDepts'),id=>{selDept=id;go('var');$('fAmt').focus()},null);
  deptGrid($('fDepts'),id=>{selDept=id;render()},selDept);
  const ns=nsStats();$('nsCount').textContent=ns.count;$('nsCombo').textContent=ns.combo;
  const spentToday=S.expenses.some(e=>e.date===today);$('noSpendBtn').disabled=spentToday||S.noSpend.includes(today);$('noSpendBtn').textContent=S.noSpend.includes(today)?'오늘 무지출 달성 중':spentToday?'오늘은 지출이 있어요':'오늘 무지출 데이 선언';
  // chart
  const ex=exOf(ym);const tot=ex.reduce((s,e)=>s+e.amount,0);$('chartTotal').textContent=`합계 ${won(tot)}`;
  const ch=$('chart');ch.textContent='';const sums=DEPTS.map(d=>({d,v:ex.filter(e=>e.cat===d.id).reduce((s,e)=>s+e.amount,0)})).sort((a,b)=>b.v-a.v);const mx=Math.max(1,...sums.map(s=>s.v));
  for(const {d,v} of sums){const r=document.createElement('div');r.className='crow';const n=document.createElement('span');n.textContent=d.n;const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=(v/mx*100)+'%';i.style.background=d.c;bar.appendChild(i);const val=document.createElement('span');val.className='v';val.textContent=v?`${Math.round(v/1000)}K · ${tot?Math.round(v/tot*100):0}%`:'-';r.append(n,bar,val);ch.appendChild(r)}
  // ledger
  const L=$('ledger');L.textContent='';const sorted=[...ex].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at));$('ledgerCount').textContent=`${sorted.length}건`;
  if(!sorted.length){const e=document.createElement('div');e.className='empty';e.textContent='이번 달 결재 내역이 없어요. 위에서 품의서를 올려보세요.';L.appendChild(e)}
  for(const e of sorted){const d=DEPTS.find(x=>x.id===e.cat)||DEPTS[9];const r=document.createElement('div');r.className='lrow';
    const dd=document.createElement('span');dd.className='d';dd.textContent=`${+e.date.slice(5,7)}/${+e.date.slice(8)}`;
    const dot=document.createElement('span');dot.className='dot';dot.style.background=d.c;
    const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=e.place||d.n;const s=document.createElement('span');s.textContent=`${d.n} · ${e.method}${e.memo?' · '+e.memo:''}`;t.append(b,s);
    const a=document.createElement('span');a.className='a';a.textContent=e.amount.toLocaleString('ko-KR');
    const acts=document.createElement('div');acts.className='acts';const ed=document.createElement('button');ed.textContent='수정';ed.onclick=()=>startEdit(e);const del=document.createElement('button');del.textContent='삭제';
    del.onclick=()=>{if(del.dataset.c){S.expenses=S.expenses.filter(x=>x.id!==e.id);render();write(()=>sb.from('expenses').delete().eq('id',e.id),'삭제했어요')}else{del.dataset.c='1';del.textContent='정말?';del.className='danger';setTimeout(()=>{if(del.isConnected){delete del.dataset.c;del.textContent='삭제';del.className=''}},3000)}};
    acts.append(ed,del);r.append(dd,dot,t,a,acts);L.appendChild(r)}
  // vault
  $('vaultBig').textContent=won(carry);
  const H=$('hist');H.textContent='';const hr=document.createElement('tr');for(const h of['기간','받은 돈','고정비','변동비','남은 돈'])hr.appendChild(Object.assign(document.createElement('th'),{textContent:h}));H.appendChild(hr);
  for(const m of monthsList().reverse()){const tr=document.createElement('tr');const sp=surplus(m);for(const [v,c] of [[`${periodLabel(m,true)}${m===ym?' (진행 중)':''}`],[won(S.months[m]?.received||0)],[won(-fxTotal())],[won(-spentOf(m))],[won(sp),sp<0?'neg':'pos']]){const td=document.createElement('td');td.textContent=v;if(c)td.className=c;tr.appendChild(td)}H.appendChild(tr)}
  drawSafe();
  $('fMethod').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!$('fMethodCustom').value.trim()&&b.dataset.m===method)));
  if(role==='boss')renderBoss();
  renderPlaces();renderPay();renderVault();
  drawScene();
}
function drawSafe(){const c=$('safeCv').getContext('2d');c.clearRect(0,0,40,40);c.fillStyle='#4b5262';c.fillRect(4,4,32,32);c.fillStyle='#6b7385';c.fillRect(6,6,28,28);c.fillStyle='#c9c9c9';c.fillRect(16,14,8,8);c.fillStyle='#888';c.fillRect(19,12,2,12);const n=Math.max(0,Math.min(12,Math.floor(vaultNow()/80000)));for(let i=0;i<n;i++){c.fillStyle='#f2b632';c.fillRect(8+(i%4)*6,32-Math.floor(i/4)*3,5,3)}}

/* ---------- vault in/out ---------- */
let vType='out',vMonth=true;
const V_KINDS={out:[[true,'이번 달 생활비에 보태기','생활비가 모자라서 금고 돈을 이번 달에 씀. 이번 달 남은 돈이 늘어나요.'],[false,'따로 쓰기 (큰 지출)','가전, 여행처럼 생활비와 별도로 금고 돈을 씀. 이번 달 생활비는 그대로예요.']],
  in:[[true,'이번 달 생활비에서 옮기기','이번 달 쓸 돈 일부를 미리 금고에 넣어둠. 이번 달 남은 돈이 줄어요.'],[false,'다른 돈 넣기','보너스, 축의금, 원래 있던 비상금처럼 생활비 밖의 돈을 넣음.']]};
function vKindRender(){const box=$('vKind');box.textContent='';for(const [m,label] of V_KINDS[vType]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(vMonth===m));b.onclick=()=>{vMonth=m;vKindRender()};box.appendChild(b)}
  $('vKindHint').textContent=V_KINDS[vType].find(k=>k[0]===vMonth)[2]}
function vOpen(t){vType=t;vMonth=true;$('vForm').hidden=false;$('vFormTitle').textContent=t==='out'?'금고에서 꺼내 쓰기':'금고 채우기';$('vSave').textContent=t==='out'?'꺼내기 기록':'채우기 기록';$('vAmt').value='';$('vMemo').value='';$('vDate').value=today;vKindRender();$('vAmt').focus()}
$('vOutBtn').onclick=()=>vOpen('out');$('vInBtn').onclick=()=>vOpen('in');$('vCancel').onclick=()=>{$('vForm').hidden=true};
$('vAmt').addEventListener('input',e=>{const n=num(e.target.value);e.target.value=n?n.toLocaleString('ko-KR'):''});
$('vForm').onsubmit=e=>{e.preventDefault();const amount=num($('vAmt').value);if(!amount){toast('금액을 입력해주세요');return}
  const date=$('vDate').value||today,p=periodOf(date),m=M(p);m.paid={...(m.paid||{})};m.paid.v=[...(m.paid.v||[]),{id:crypto.randomUUID(),type:vType,month:vMonth,amount,date,memo:$('vMemo').value.trim().slice(0,40)}];
  saveMonth(p);play('coin');burst(286,70,['#f2b632','#ffd96a']);toast(vType==='out'?`금고에서 ${won(amount)} 꺼냈어요`:`금고에 ${won(amount)} 채웠어요`);$('vForm').hidden=true;render()};
function renderVault(){const L=$('vList');L.textContent='';const mv=allMoves().sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id));$('vCount').textContent=mv.length?`${mv.length}건`:'';
  if(!mv.length){const e=document.createElement('div');e.className='empty';e.textContent='아직 금고에서 꺼내거나 채운 기록이 없어요.';L.appendChild(e);return}
  for(const x of mv){const r=document.createElement('div');r.className='vrow';
    const d=document.createElement('span');d.className='d';d.textContent=`${+x.date.slice(5,7)}/${+x.date.slice(8)}`;
    const tg=document.createElement('span');tg.className='tag2 '+x.type;tg.textContent=x.type==='out'?'꺼냄':'채움';
    const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=x.memo||(x.type==='out'?'금고에서 꺼냄':'금고 채움');const s=document.createElement('span');s.textContent=V_KINDS[x.type].find(k=>k[0]===!!x.month)[1];t.append(b,s);
    const a=document.createElement('span');a.className='a '+(x.type==='out'?'neg':'pos');a.textContent=(x.type==='out'?'-':'+')+x.amount.toLocaleString('ko-KR');
    const del=document.createElement('button');del.className='del';del.textContent='삭제';del.style.cssText='background:#fff;border:2px solid #000;border-radius:3px;font-size:11px;padding:2px 6px';
    del.onclick=()=>{if(!del.dataset.c){del.dataset.c='1';del.textContent='정말?';del.style.background='var(--red)';del.style.color='#fff';setTimeout(()=>{if(del.isConnected){delete del.dataset.c;del.textContent='삭제';del.style.background='#fff';del.style.color=''}},3000);return}
      const m=M(x.p);m.paid={...(m.paid||{}),v:(m.paid?.v||[]).filter(y=>y.id!==x.id)};saveMonth(x.p);toast('삭제했어요');render()};
    r.append(d,tg,t,a,del);L.appendChild(r)}}

/* ---------- payment method totals ---------- */
let payOpen=null;
function renderPay(){
  $('payPeriod').textContent=periodLabel(ym);
  const ex=exOf(ym);const tot=ex.reduce((s,e)=>s+e.amount,0);$('payTotal').textContent=won(tot);
  const g={};for(const e of ex){const k=(e.method||'기타').trim()||'기타';(g[k]=g[k]||{sum:0,n:0,items:[]});g[k].sum+=e.amount;g[k].n++;g[k].items.push(e)}
  const rows=Object.entries(g).sort((a,b)=>b[1].sum-a[1].sum);const box=$('payList');box.textContent='';
  if(!rows.length){const d=document.createElement('div');d.className='empty';d.textContent='이번 기간 결재 내역이 없어요.';box.appendChild(d);return}
  for(const [k,v] of rows){
    const b=document.createElement('button');b.type='button';b.className='payrow';b.setAttribute('aria-expanded',String(payOpen===k));
    const nm=document.createElement('span');nm.className='nm';nm.textContent=k;const sm=document.createElement('small');sm.textContent=`${v.n}건 · ${tot?Math.round(v.sum/tot*100):0}%`;nm.appendChild(sm);
    const val=document.createElement('span');val.className='v';val.textContent=won(v.sum);
    const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=(tot?v.sum/tot*100:0)+'%';bar.appendChild(i);
    b.append(nm,val,bar);b.onclick=()=>{payOpen=payOpen===k?null:k;renderPay()};box.appendChild(b);
    if(payOpen===k){const det=document.createElement('div');det.className='paydetail';
      for(const e of [...v.items].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at))){const d=DEPTS.find(x=>x.id===e.cat)||DEPTS[9];const r=document.createElement('div');r.className='lrow';
        const dd=document.createElement('span');dd.className='d';dd.textContent=`${+e.date.slice(5,7)}/${+e.date.slice(8)}`;
        const dot=document.createElement('span');dot.className='dot';dot.style.background=d.c;
        const t=document.createElement('div');t.className='t';const bb=document.createElement('b');bb.textContent=e.place||d.n;const s2=document.createElement('span');s2.textContent=d.n+(e.memo?' · '+e.memo:'');t.append(bb,s2);
        const a=document.createElement('span');a.className='a';a.textContent=e.amount.toLocaleString('ko-KR');r.append(dd,dot,t,a);det.appendChild(r)}
      box.appendChild(det)}
  }
}

/* ---------- husband tab (대표이사) ---------- */
const H_DED=[{id:'loan',n:'대출금',a:489101},{id:'mgmt',n:'관리비예산',a:300000},{id:'pocket',n:'남편용돈',a:300000},{id:'auto',n:'자동이체',a:1205793}];
const H_DED_TOTAL=H_DED.reduce((s,d)=>s+d.a,0);
let role='wife';try{role=localStorage.getItem('uri-role')||'wife'}catch(e){}
const H=()=>{const p=M(ym).paid||(M(ym).paid={});return p.h||(p.h={salary:0,bonus:0,salaryOk:false,bonusOk:false,ded:{},sent:false})};
const H_INC=[['salary','20일 급여'],['bonus','25일 상여금'],['extra','보너스']];
const hIncome=()=>{const h=H();return H_INC.reduce((s,[k])=>s+(h[k]||0),0)};
const hSend=()=>hIncome()-H_DED_TOTAL;
function bossLines(){const h=H();
  if(h.sent)return ['생활비 보냈다!',won(h.sentAmount||0),'이번 달도 화이팅!'];
  if(h.salaryOk&&h.bonusOk)return ['이번 달 급여랑 상여금','입력 완료!','공제하고 보낸다!'];
  return ['이번 달 급여랑','상여금 확인 중…','조금만 기다려!']}
function setRole(r){role=r;try{localStorage.setItem('uri-role',r)}catch(e){}
  document.querySelectorAll('.role').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.r===r)));
  $('bossView').hidden=r!=='boss';$('wifeMain').hidden=r==='boss';render();{const sc=$('scene');if(sc.scrollWidth>sc.clientWidth)sc.scrollTo({left:(sc.scrollWidth-sc.clientWidth)*(r==='boss'?1:0.35),behavior:'smooth'})}}
document.querySelectorAll('.role').forEach(b=>b.onclick=()=>setRole(b.dataset.r));
let hSaveT=0;const hSaveSoon=()=>{clearTimeout(hSaveT);hSaveT=setTimeout(()=>saveMonth(ym),600)};
function renderBoss(){
  const h=H();$('bPeriod').textContent=periodLabel(ym);
  // income rows
  const inc=$('bIncome');
  if(!inc.children.length){
    for(const [key,label] of H_INC){const ok=key+'Ok';
      const row=document.createElement('div');row.className='incrow';row.dataset.k=key;
      const box=document.createElement('button');box.type='button';box.className='box';box.setAttribute('aria-label',label+' 입금 확인');
      const nm=document.createElement('span');nm.className='nm';nm.textContent=label;
      const inp=document.createElement('input');inp.className='field';inp.inputMode='numeric';inp.placeholder='금액';inp.id='hin-'+key;inp.setAttribute('aria-label',label+' 금액');
      const st=document.createElement('span');st.className='stamp';
      inp.addEventListener('input',()=>{const n=num(inp.value);inp.value=n?n.toLocaleString('ko-KR'):'';H()[key]=n;hSaveSoon();renderBossNumbers()});
      box.onclick=()=>{const hh=H();hh[ok]=!hh[ok];saveMonth(ym);if(hh[ok])play('stamp');render()};
      row.append(box,nm,inp,st);inc.appendChild(row)}}
  for(const row of inc.children){const key=row.dataset.k,ok=key+'Ok',on=!!h[ok];row.classList.toggle('done',on);row.querySelector('.box').textContent=on?'✓':'';row.querySelector('.stamp').textContent=on?'입금 확인':'입금 대기';
    const inp=row.querySelector('input');if(document.activeElement!==inp)inp.value=h[key]?h[key].toLocaleString('ko-KR'):''}
  // deductions
  const ded=$('bDed');ded.textContent='';const done=H_DED.filter(d=>h.ded?.[d.id]).length;
  for(const d of H_DED){const on=!!h.ded?.[d.id];const b=document.createElement('button');b.type='button';b.className='fxrow'+(on?' done':'');
    const box=document.createElement('span');box.className='box';box.textContent=on?'✓':'';
    const nm=document.createElement('span');nm.className='nm';nm.textContent=d.n;
    const am=document.createElement('span');am.className='am';am.textContent=d.a.toLocaleString('ko-KR');
    const st=document.createElement('span');st.className='stamp';st.textContent=on?'결재 완료':'결재 대기';
    b.append(box,nm,am,st);b.setAttribute('aria-pressed',String(on));
    b.onclick=()=>{const hh=H();hh.ded={...(hh.ded||{}),[d.id]:!hh.ded?.[d.id]};saveMonth(ym);if(hh.ded[d.id]){play('stamp');if(H_DED.every(x=>hh.ded[x.id])){setTimeout(()=>play('fanfare'),250);toast('사전 공제 올 클리어!')}}render()};
    ded.appendChild(b)}
  $('bDedCount').textContent=`${done}/${H_DED.length} 완료 · ${won(H_DED_TOTAL)}`;setBar($('bDedBar'),done/H_DED.length,`${done}/${H_DED.length} 완료`,2);
  renderBossNumbers();
}
function renderBossNumbers(){
  const h=H(),inc=hIncome(),send=hSend();
  $('bIncTotal').textContent=won(inc);
  $('bCalc').textContent=`${won(inc)} − 공제 ${won(H_DED_TOTAL)} =`;
  const big=$('bSend');big.textContent=won(send);big.classList.toggle('neg',send<0);
  const b=$('bSendBtn');b.className='fxrow sendrow'+(h.sent?' done':'');b.textContent='';
  const box=document.createElement('span');box.className='box';box.textContent=h.sent?'✓':'';
  const nm=document.createElement('span');nm.className='nm';nm.textContent=h.sent?`아내에게 보낸 생활비 ${won(h.sentAmount||0)}`:'아내에게 보낼 생활비 이체';
  const am=document.createElement('span');am.className='am';am.textContent='';
  const st=document.createElement('span');st.className='stamp';st.textContent=h.sent?'이월 완료':'이체 대기';
  b.append(box,nm,am,st);b.disabled=!h.sent&&send<=0;
  $('bSendHint').classList.toggle('warn',!!(h.sent&&send!==h.sentAmount));$('bSendHint').textContent=h.sent&&send!==h.sentAmount?`보낸 뒤에 금액이 바뀌었어요 (지금 계산 ${won(send)}, 차이 ${won(send-(h.sentAmount||0))}). 이체를 한 번 취소했다가 다시 누르면 새 금액으로 반영돼요.`:h.sent?'아내탭의 "이번 달 받은 돈"에 반영됐어요. 다시 누르면 이체를 취소해요.':send<=0?'급여와 상여금을 입력하면 보낼 금액이 계산돼요.':'이체한 뒤 누르면 아내탭의 이번 달 받은 돈으로 자동 반영돼요.';
}
$('bSendBtn').onclick=()=>{const h=H(),m=M(ym);
  if(!h.sent){const amt=hSend();if(amt<=0)return;h.prevReceived=m.received||0;h.sent=true;h.sentAmount=amt;h.sentAt=new Date().toISOString();m.received=amt;play('coin');setTimeout(()=>play('fanfare'),250);toast(`생활비 ${won(amt)} 이월 완료!`)}
  else{m.received=(m.received===h.sentAmount)?(h.prevReceived||0):m.received;h.sent=false;h.sentAmount=0;toast('이체를 취소했어요')}
  saveMonth(ym);render()};

/* ---------- tabs ---------- */
function go(v){document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.v===v)));document.querySelectorAll('.view').forEach(x=>x.hidden=x.dataset.view!==v);try{localStorage.setItem('uri-tab',v)}catch(e){}}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>go(t.dataset.v));
try{const t=localStorage.getItem('uri-tab');if(t)go(t)}catch(e){}

/* ---------- form ---------- */
const num=v=>parseInt(String(v).replace(/[^0-9]/g,''),10)||0;
for(const id of['fAmt','recvIn'])$(id).addEventListener('input',e=>{const n=num(e.target.value);e.target.value=n?n.toLocaleString('ko-KR'):''});
$('fDate').value=today;
$('fMethod').onclick=e=>{const m=e.target.dataset?.m;if(m){method=m;$('fMethodCustom').value='';render()}};
$('fMethodCustom').addEventListener('input',e=>{const v=e.target.value.trim();method=v||METHODS[0];$('fMethod').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!v&&b.dataset.m===method)))});
function startEdit(e){editId=e.id;selDept=e.cat;method=e.method;$('fMethodCustom').value=METHODS.includes(e.method)?'':e.method;$('fDate').value=e.date;$('fPlace').value=e.place;$('fAmt').value=e.amount.toLocaleString('ko-KR');$('fMemo').value=e.memo||'';$('formTitle').textContent='품의서 수정';$('fSubmit').textContent='수정 결재';$('fCancel').hidden=false;go('var');render();$('fAmt').focus()}
function endEdit(){editId=null;$('form').reset();method=METHODS[0];$('fDate').value=today;$('formTitle').textContent='품의서 작성';$('fSubmit').textContent='결재 올리기';$('fCancel').hidden=true}
$('fCancel').onclick=()=>{endEdit();render()};
$('form').onsubmit=e=>{e.preventDefault();const amount=num($('fAmt').value);if(!amount){toast('금액을 입력해주세요');$('fAmt').focus();return}
  const rec={cat:selDept,place:$('fPlace').value.trim().slice(0,40),amount,method,memo:$('fMemo').value.trim().slice(0,60),date:$('fDate').value||today};
  const before=spentOf(ym);
  if(editId){const id=editId;const x=S.expenses.find(x=>x.id===id);Object.assign(x,rec);write(()=>sb.from('expenses').update({...rec,updated_at:new Date().toISOString()}).eq('id',id),'수정했어요')}
  else{const id=crypto.randomUUID();S.expenses.push({id,...rec,at:new Date().toISOString()});write(()=>sb.from('expenses').insert({id,...rec}));toast(`${DEPTS.find(d=>d.id===selDept).team} 결재 완료!`)}
  if(S.noSpend.includes(rec.date)){S.noSpend=S.noSpend.filter(d=>d!==rec.date);write(()=>sb.from('no_spend').delete().eq('date',rec.date))}
  play('coin');react(selDept,amount);
  const after=spentOf(ym);if(before<TARGET_MAX*.8&&after>=TARGET_MAX*.8){setTimeout(()=>play('alert'),300);toast('경고! 목표 생활비의 80%를 넘었어요')}
  endEdit();render()};
$('recvSave').onclick=()=>{M(ym).received=num($('recvIn').value);saveMonth(ym).then(()=>toast('받은 돈을 저장했어요'));play('coin');render()};
$('noSpendBtn').onclick=()=>{if(!S.noSpend.includes(today)){S.noSpend.push(today);write(()=>sb.from('no_spend').insert({date:today}));play('fanfare');toast('무지출 데이 달성!')}render()};

/* ---------- lock: login once, then PIN ---------- */
const PIN_KEY='uri-pin',SEEN_KEY='uri-last';let pinBuf='',pinMode='enter',pinFirst='',pinFails=0,userEmail='';
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const getPin=()=>{try{return localStorage.getItem(PIN_KEY)}catch(e){return null}};
const setPin=v=>{try{v?localStorage.setItem(PIN_KEY,v):localStorage.removeItem(PIN_KEY)}catch(e){}};
function showLock(view,msg=''){$('lock').hidden=false;$('app').hidden=true;$('lkLogin').hidden=view!=='login';$('lkPin').hidden=view!=='pin';$('lkErr').textContent=msg;if(view==='login')setTimeout(()=>$('lkEmail').focus(),50)}
function pinView(mode){pinMode=mode;pinBuf='';$('pinMsg').textContent=mode==='set'?'새 PIN 4자리를 정해주세요':mode==='confirm'?'한 번 더 눌러주세요':'PIN 4자리를 눌러주세요';$('forgot').hidden=mode!=='enter';drawDots();showLock('pin')}
function drawDots(){[...$('dots').children].forEach((d,i)=>d.classList.toggle('on',i<pinBuf.length))}
function shake(){const d=$('dots');d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake')}
{const pad=$('pad');for(const k of['1','2','3','4','5','6','7','8','9','','0','⌫']){const b=document.createElement('button');b.type='button';b.textContent=k;if(!k){b.disabled=true;b.style.visibility='hidden'}b.setAttribute('aria-label',k==='⌫'?'지우기':k);b.onclick=()=>pinKey(k);pad.appendChild(b)}
 document.addEventListener('keydown',e=>{if($('lkPin').hidden)return;if(/^[0-9]$/.test(e.key))pinKey(e.key);else if(e.key==='Backspace')pinKey('⌫')})}
async function pinKey(k){if(k==='⌫'){pinBuf=pinBuf.slice(0,-1);drawDots();return}if(pinBuf.length>=4)return;pinBuf+=k;drawDots();if(pinBuf.length<4)return;
  const v=pinBuf;await new Promise(r=>setTimeout(r,120));
  if(pinMode==='set'){pinFirst=v;pinView('confirm');return}
  if(pinMode==='confirm'){if(v===pinFirst){setPin(await sha(userEmail+':'+v));play('stamp');enterApp()}else{shake();$('lkErr').textContent='두 번 입력한 PIN이 달라요. 다시 정해주세요';pinView('set')}return}
  if(await sha(userEmail+':'+v)===getPin()){pinFails=0;play('coin');enterApp()}
  else{pinFails++;shake();pinBuf='';drawDots();if(pinFails>=5){setPin(null);await sb.auth.signOut({scope:'local'});showLock('login','PIN을 5번 틀려서 다시 로그인해야 해요')}else $('lkErr').textContent=`PIN이 맞지 않아요 (${pinFails}/5)`}}
$('forgot').onclick=async()=>{setPin(null);await sb.auth.signOut({scope:'local'});showLock('login')};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('lkGo').disabled=true;$('lkErr').textContent='';
  const {data,error}=await sb.auth.signInWithPassword({email:$('lkEmail').value.trim(),password:$('lkPw').value});
  $('lkGo').disabled=false;
  if(error){const m=(error.message||'')+'';console.error(error);
    $('lkErr').textContent=/invalid login/i.test(m)?'이메일이나 비밀번호가 맞지 않아요':/not confirmed/i.test(m)?'이메일 인증이 안 된 계정이에요. Supabase Users에서 계정을 확인(Confirm)해주세요':/api key|apikey|jwt/i.test(m)?'앱 설정 키가 맞지 않아요 ('+m+')':'로그인 오류: '+m;return}
  userEmail=data.user.email;$('lkPw').value='';
  const {data:mem,error:memErr}=await sb.from('members').select('email');
  if(memErr){console.error(memErr);await sb.auth.signOut({scope:'local'});showLock('login','데이터 통로에 연결하지 못했어요. Supabase에서 Data API가 켜져 있는지 확인해주세요 ('+(memErr.message||memErr.code||'')+')');return}
  if(!mem||!mem.length){await sb.auth.signOut({scope:'local'});showLock('login','이 계정은 사원 명부에 없어요. Supabase의 members 표에 이메일을 넣어주세요');return}
  if(getPin()){enterApp()}else pinView('set')};
async function enterApp(){$('lkErr').textContent='';try{localStorage.setItem(SEEN_KEY,String(Date.now()))}catch(e){}
  try{await loadAll()}catch(e){console.error(e);const m=String(e&&(e.message||e.code)||'');if(/session|jwt|refresh|token/i.test(m)){showLock('login','로그인이 풀렸어요. 다시 로그인해주세요 (PIN은 그대로예요)');}else showLock('pin','데이터를 불러오지 못했어요. 인터넷 연결을 확인하고 PIN을 다시 눌러주세요');return}
  $('lock').hidden=true;$('app').hidden=false;$('who').textContent=userEmail;subscribe();setRole(role);
  {const sc=$('scene');if(sc.scrollWidth>sc.clientWidth)sc.scrollLeft=(sc.scrollWidth-sc.clientWidth)*0.35}}
function lockNow(){if(!$('app').hidden){pinView('enter')}}
$('lockNow').onclick=lockNow;
$('changePin').onclick=()=>pinView('set');
$('logout').onclick=async()=>{setPin(null);await sb.auth.signOut({scope:'local'});showLock('login')};
/* ---------- PWA: offline shell + install ---------- */
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}
let installEvt=null;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(!installEvt)return;installEvt.prompt();const r=await installEvt.userChoice;if(r.outcome==='accepted'){toast('홈 화면에 설치했어요');$('installBtn').hidden=true}installEvt=null};
window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true});
$('installHint').textContent=standalone?'앱으로 실행 중이에요.':/iphone|ipad|ipod/i.test(navigator.userAgent)?'아이폰: Safari 아래 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있어요.':'안드로이드: 크롬 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"를 누르면 앱처럼 쓸 수 있어요.';
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'&&!$('app').hidden){showLock('login','로그인이 풀렸어요. 다시 로그인해주세요 (PIN은 그대로예요)')}});
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now()}else{if(hiddenAt&&Date.now()-hiddenAt>5*60*1000)lockNow();else if(loaded)scheduleReload()}});
(async()=>{
  if(!CFG.url||CFG.url.includes('YOUR')){showLock('login','설정이 아직 안 됐어요: config.js에 Supabase 주소와 키를 넣어주세요');$('lkGo').disabled=true;return}
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showLock('login');return}
  userEmail=session.user.email;
  if(!getPin())pinView('set');else pinView('enter');
})();
})();
