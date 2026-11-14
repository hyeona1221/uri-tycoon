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
 {id:'etc',n:'기타비용',team:'긴급예산팀',c:'#7d8796'},
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
 income(){[784,988,1175,1568].forEach((f,i)=>tone(f,i*.07,.12));tone(2093,.3,.25,'triangle',.06)},
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
/* 부수입(당근 판매 등): months.paid.i 에 기록. to:'month' 면 그 기간 생활비에 더하고, 'vault' 면 금고에 바로 넣음 */
const incOf=p=>(S.months[p]?.paid?.i)||[];
const allInc=()=>Object.keys(S.months).flatMap(p=>incOf(p).map(x=>({...x,p})));
const incMonth=p=>incOf(p).filter(x=>x.to!=='vault').reduce((s,x)=>s+x.amount,0);
const incAll=p=>incOf(p).reduce((s,x)=>s+x.amount,0);
function surplus(m){return (S.months[m]?.received||0)-fxTotal()-spentOf(m)+monthAdj(m)+incMonth(m)}
function vaultNow(){return vaultBefore(ym)+allMoves().reduce((s,x)=>s+(x.type==='in'?x.amount:-x.amount),0)+allInc().filter(x=>x.to==='vault').reduce((s,x)=>s+x.amount,0)}
function vaultBefore(m){return monthsList().filter(k=>k<m).reduce((s,k)=>s+surplus(k),0)}
function nsStats(){const days=S.noSpend.filter(d=>periodOf(d)===ym);let combo=0;const set=new Set(S.noSpend);let t=new Date(now);for(;;){const k=`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;if(set.has(k)){combo++;t.setDate(t.getDate()-1)}else break}return {count:days.length,combo}}

/* 부서별 한도: months.paid.b 에 저장. 가장 최근에 정한 한도가 그 뒤 기간에도 계속 적용됨 */
function budgets(p){const k=Object.keys(S.months).filter(k=>k<=p&&S.months[k]?.paid?.b).sort().pop();return k?S.months[k].paid.b:{}}
const deptSpent=(p,id)=>exOf(p).filter(e=>e.cat===id).reduce((s,e)=>s+e.amount,0);
const man=v=>{const n=Math.round(Math.abs(v)/1000)/10;return (v<0?'-':'')+(n%1?n.toFixed(1):String(n))+'만'};
function dailyCalc(){const todaySpent=S.expenses.filter(e=>e.date===today).reduce((s,e)=>s+e.amount,0);const dl=daysLeftInPeriod(),pool=surplus(ym)+todaySpent,per=Math.max(0,Math.floor(pool/dl/100)*100);return {todaySpent,dl,pool,per,left:per-todaySpent}}
function bestCombo(){const d=[...new Set(S.noSpend)].sort();let best=0,run=0,prev=null;for(const x of d){const t=new Date(x+'T00:00:00');run=prev&&Math.round((t-prev)/864e5)===1?run+1:1;best=Math.max(best,run);prev=t}return best}

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
function wifeLines(){const left=surplus(ym),B=budgets(ym),d=dailyCalc();
  if(left<0)return ['생활비 초과!','금고 열어주세요'];
  const over=DEPTS.find(x=>B[x.id]&&deptSpent(ym,x.id)>B[x.id]);if(over)return [over.n,'한도 초과!'];
  if(S.noSpend.includes(today))return ['오늘 무지출','달성 중! 💎'];
  if(FIXED.length&&FIXED.every(f=>M(ym).paid?.[f.id])&&!d.todaySpent)return ['고정비 결재','전부 완료!'];
  if(!d.todaySpent)return ['오늘은 아직','무지출이에요!'];
  if(d.left<0)return ['오늘 권장 초과!','내일은 아껴요'];
  return ['오늘 남은 예산',won(d.left)]}
function drawScene(){const left=surplus(ym);{const wb=$('wifeBub');wb.textContent='';wifeLines().forEach((t,i)=>{if(i)wb.appendChild(document.createElement('br'));wb.appendChild(document.createTextNode(t))})}const bo=$('bossBub');bo.textContent='';bo.classList.toggle('grow',role==='boss');const bb=document.createElement('div');bo.appendChild(bb);const lines=role==='boss'?bossLines():left>=0?['이번 달 남은 돈',won(left)+'!','아껴 쓰자!']:['이번 달',won(-left)+' 초과!','금고에서 채우자!'];lines.forEach((t,i)=>{if(i)bb.appendChild(document.createElement('br'));const sp=document.createElement('span');sp.textContent=t;if(i===1){sp.style.color=role==='boss'?'#284f91':left>=0?'#2f7d2b':'#d2402f';sp.style.fontSize='1.15em'}bb.appendChild(sp)});$('vaultTag').textContent=Math.round(vaultNow()/10000).toLocaleString('ko-KR')+'만원'}
/* ---------- dept icons ---------- */
function deptIcon(c,d){const x=c.getContext('2d');c.width=14;c.height=14;x.fillStyle='#000';x.fillRect(2,2,10,10);x.fillStyle=d.c;x.fillRect(3,3,8,8);x.fillStyle='rgba(255,255,255,.55)';x.fillRect(3,3,8,2);x.fillStyle='#fff';x.font='bold 7px monospace';x.fillText(String(DEPTS.indexOf(d)+1%10),DEPTS.indexOf(d)>=9?2:5,10)}
function deptGrid(el,onPick,selected){el.textContent='';for(const d of DEPTS){const b=document.createElement('button');b.type='button';b.className='dept';b.setAttribute('aria-pressed',String(selected===d.id));const c=document.createElement('canvas');deptIcon(c,d);const t=document.createElement('b');t.textContent=d.n;b.title=`${d.n} [${d.team}]`;b.append(c,t);b.onclick=()=>onPick(d.id);el.appendChild(b)}}

/* ---------- receipt scan (Claude via Supabase Edge Function) ---------- */
function scanMsg(t,cls=''){const m=$('scanMsg');m.hidden=!t;m.textContent=t||'';m.className='scanmsg '+cls}
function shrink(file){return new Promise((res,rej)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const max=1568,s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.85).split(',')[1])};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('image'))};img.src=url})}
const SCAN_ERR={not_receipt:'영수증으로 보이지 않아요. 영수증이 화면에 꽉 차게 다시 찍어주세요.',not_member:'로그인이 풀렸어요. 다시 로그인해주세요.',api_key:'영수증 읽기 설정(API 키)이 아직 안 됐어요.',rate_limited:'잠시 후 다시 시도해주세요.',refused:'이 사진은 읽을 수 없어요. 다른 사진으로 해주세요.',bad_image:'사진이 너무 커요. 다시 찍어주세요.'};
async function scanFile(file){if(!file)return;scanMsg('영수증을 읽는 중이에요… (5초 정도)','busy');
  try{const image=await shrink(file);
    const {data,error}=await sb.functions.invoke('receipt',{body:{image,media_type:'image/jpeg',today}});
    if(error){let code='';try{code=(await error.context.json()).error}catch(_){}
      if(!code&&/not found|404/i.test(String(error.message)+String(error.context?.status)))throw new Error('영수증 읽기 기능이 아직 서버에 올라가지 않았어요.');
      throw new Error(SCAN_ERR[code]||'영수증을 읽지 못했어요. 다시 시도해주세요.')}
    if(data.date&&/^\d{4}-\d{2}-\d{2}$/.test(data.date))$('fDate').value=data.date;
    if(data.place)$('fPlace').value=data.place;
    if(data.amount>0)$('fAmt').value=Number(data.amount).toLocaleString('ko-KR');
    if(DEPTS.some(d=>d.id===data.category))selDept=data.category;
    if(data.method){if(METHODS.includes(data.method)){method=data.method;$('fMethodCustom').value=''}else{$('fMethodCustom').value=data.method;method=data.method}}
    if(data.memo)$('fMemo').value=data.memo;
    render();for(const id of['fDate','fPlace','fAmt','fMemo']){const el=$(id);el.classList.remove('filled');void el.offsetWidth;el.classList.add('filled')}
    play('coin');scanMsg('영수증을 읽었어요. 내용을 확인하고 [결재 올리기]를 눌러주세요.')}
  catch(e){console.error(e);scanMsg(e.message&&!/image/.test(e.message)?e.message:'사진을 열지 못했어요. 다시 시도해주세요.','err')}}
$('scanBox').hidden=!CFG.receipt;
for(const id of['scanCam','scanPick'])$(id).addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';scanFile(f)});

/* ---------- frequent places ---------- */
const PLACES_EXP=['당근','쿠팡','마트','편의점','네이버쇼핑'],PLACES_INC=['당근','환급','용돈','체험단'];
function renderPlaces(){const box=$('fPlaces');box.textContent='';const cur=$('fPlace').value.trim();const PLACES=kind==='inc'?PLACES_INC:PLACES_EXP;
  const freq={};for(const e of (kind==='inc'?allInc():S.expenses)){const p=(e.place||'').trim();if(p&&!PLACES.includes(p))freq[p]=(freq[p]||0)+1}
  const recent=Object.entries(freq).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([p])=>p);
  for(const p of [...PLACES,...recent]){const b=document.createElement('button');b.type='button';b.textContent=p;if(!PLACES.includes(p))b.className='recent';b.setAttribute('aria-pressed',String(cur===p));
    b.onclick=()=>{$('fPlace').value=cur===p?'':p;renderPlaces();if(!$('fAmt').value)$('fAmt').focus()};box.appendChild(b)}}
$('fPlace').addEventListener('input',renderPlaces);

/* ---------- state for form ---------- */
const METHODS=['하나카드','토스뱅크','우리은행','기업은행'];
let selDept='food',method=METHODS[0],editId=null,kind='exp',dest='month',editInc=null;
const DEST_HINT={month:'이번 달 남은 돈과 하루 권장 예산이 바로 늘어나요. 안 쓰고 남으면 마감 때 금고로 이월돼요.',vault:'이번 달 생활비는 그대로고, 금고 잔액만 늘어나요.'};
function setKind(k){kind=k;const inc=k==='inc';
  $('fKind').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.k===k)));
  $('form').classList.toggle('incmode',inc);
  for(const id of['fDepts','fMethod','fMethodCustom'])$(id).hidden=inc;$('scanBox').hidden=inc||!CFG.receipt;$('fDestBox').hidden=!inc;
  $('fPlace').placeholder=inc?'어디서 들어온 돈? (예: 당근)':'사용처 (예: 하나로마트)';$('fPlace').setAttribute('aria-label',inc?'들어온 곳':'사용처');
  $('fMemo').placeholder=inc?'메모 (예: 아기 바운서 판매)':'메모 (선택)';
  if(!editId&&!editInc)$('formTitle').textContent=inc?'부수입 입금 등록':'품의서 작성';
  if(!editId&&!editInc)$('fSubmit').textContent=inc?'입금 등록':'결재 올리기';
  setDest(dest);renderPlaces()}
function setDest(d){dest=d;$('fDest').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.d===d)));$('fDestHint').textContent=DEST_HINT[d]}
$('fKind').onclick=e=>{const k=e.target.closest('button')?.dataset.k;if(k&&!editId&&!editInc)setKind(k)};
$('fDest').onclick=e=>{const d=e.target.closest('button')?.dataset.d;if(d)setDest(d)};
function incRow(x){const r=document.createElement('div');r.className='lrow plus';
  const dd=document.createElement('span');dd.className='d';dd.textContent=shortDate(x.date);
  const dot=document.createElement('span');dot.className='dot';dot.style.background='var(--green)';
  const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=x.place||'부수입';const s=document.createElement('span');s.textContent=`부수입 → ${x.to==='vault'?'금고':'생활비'}${x.memo?' · '+x.memo:''}`;t.append(b,s);
  const a=document.createElement('span');a.className='a pos';a.textContent='+'+x.amount.toLocaleString('ko-KR');
  const acts=document.createElement('div');acts.className='acts';const ed=document.createElement('button');ed.textContent='수정';ed.onclick=()=>startEditInc(x);const del=document.createElement('button');del.textContent='삭제';
  del.onclick=()=>{if(del.dataset.c){removeInc(x.p,x.id);saveMonth(x.p);toast('삭제했어요');render()}else{del.dataset.c='1';del.textContent='정말?';del.className='danger';setTimeout(()=>{if(del.isConnected){delete del.dataset.c;del.textContent='삭제';del.className=''}},3000)}};
  acts.append(ed,del);r.append(dd,dot,t,a,acts);rowToggle(r);return r}
function removeInc(p,id){const m=M(p);m.paid={...(m.paid||{}),i:(m.paid?.i||[]).filter(y=>y.id!==id)}}
function addInc(p,rec){const m=M(p);m.paid={...(m.paid||{})};m.paid.i=[...(m.paid.i||[]),rec]}
function incCheer(rec){play('income');burst(286,70,['#4fa64a','#9be38f','#f2b632']);
  const carrot=/당근/.test(rec.place);floatText(carrot?'당근 거래 성사! 🥕':`부수입 +${rec.amount.toLocaleString('ko-KR')}`,'28','50');
  if(carrot){const n=allInc().filter(x=>/당근/.test(x.place)).length;const badge=n>=30?'당근 마스터':n>=10?'중고왕':n>=3?'당근 새싹':'';
    toast(`당근 거래 성사! ${won(rec.amount)} ${rec.to==='vault'?'금고에 넣었어요':'생활비에 더했어요'}${badge?` · 누적 ${n}건 「${badge}」`:''}`)}
  else toast(`${won(rec.amount)} ${rec.to==='vault'?'금고에 넣었어요':'생활비에 더했어요'}`)}

/* ---------- viewed period (장부·그래프·달력) ---------- */
let vm=ym;
$('pPrev').onclick=()=>{const ms=monthsList().filter(k=>k<vm);if(ms.length){vm=ymShift(vm,-1);if(vm<ms[0])vm=ms[0];render()}};
$('pNext').onclick=()=>{if(vm<ym){vm=ymShift(vm,1);render()}};
function rowToggle(r){r.tabIndex=0;r.setAttribute('role','button');const tg=()=>{const on=!r.classList.contains('open');r.parentElement.querySelectorAll('.lrow.open').forEach(x=>x.classList.remove('open'));r.classList.toggle('open',on)};
  r.addEventListener('click',e=>{if(e.target.closest('button'))return;tg()});r.addEventListener('keydown',e=>{if(e.target===r&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tg()}})}

/* ---------- calendar ---------- */
function renderCal(ex){const C=$('cal');C.textContent='';const [a,b]=periodRange(vm);const ns=new Set(S.noSpend),q=$('lSearch').value.trim();
  for(const w of '일월화수목금토'){const h=document.createElement('div');h.className='ch';h.textContent=w;C.appendChild(h)}
  for(let i=0;i<a.getDay();i++)C.appendChild(document.createElement('div'));
  const byDay={},incDay={};for(const e of ex)byDay[e.date]=(byDay[e.date]||0)+e.amount;for(const x of incOf(vm))incDay[x.date]=(incDay[x.date]||0)+x.amount;
  let nsN=0,dayN=0;
  for(let t=new Date(a);t<=b;t.setDate(t.getDate()+1)){const k=`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;const c=document.createElement('button');c.type='button';c.className='cd'+(k===today?' today':'')+(k>today?' future':'')+(q===k?' sel':'');
    const n=document.createElement('b');n.textContent=(t.getDate()===1||+t===+a)?`${t.getMonth()+1}/${t.getDate()}`:t.getDate();c.appendChild(n);
    if(byDay[k]){dayN++;const v=document.createElement('span');v.className='sp';v.textContent=Math.round(byDay[k]/1000)+'K';c.appendChild(v)}
    else if(ns.has(k)){nsN++;const g=document.createElement('span');g.className='gm';g.textContent='💎';c.appendChild(g)}
    if(incDay[k]){const v=document.createElement('span');v.className='in';v.textContent='+'+Math.round(incDay[k]/1000)+'K';c.appendChild(v)}
    c.setAttribute('aria-label',`${t.getMonth()+1}월 ${t.getDate()}일`+(byDay[k]?` 지출 ${won(byDay[k])}`:ns.has(k)?' 무지출':'')+(incDay[k]?` 부수입 ${won(incDay[k])}`:''));
    c.onclick=()=>{$('lSearch').value=q===k?'':k;render();if(q!==k)$('ledgerCard').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'})};C.appendChild(c)}
  $('calInfo').textContent=`지출한 날 ${dayN}일 · 무지출 ${nsN}일`}

/* ---------- dept budgets ---------- */
function bOpen(){const box=$('bRows');box.textContent='';const B=budgets(ym);for(const d of DEPTS){const l=document.createElement('label');l.className='brow';const n=document.createElement('span');n.textContent=d.n;const i=document.createElement('input');i.className='field';i.inputMode='numeric';i.placeholder='한도 없음';i.dataset.id=d.id;i.value=B[d.id]?B[d.id].toLocaleString('ko-KR'):'';i.setAttribute('aria-label',d.n+' 한도');
    i.addEventListener('input',e=>{const v=parseInt(e.target.value.replace(/[^0-9]/g,''),10)||0;e.target.value=v?v.toLocaleString('ko-KR'):'';bSum()});l.append(n,i);box.appendChild(l)}
  $('bBox').hidden=false;bSum()}
function bRead(){const o={};$('bRows').querySelectorAll('input').forEach(i=>{const v=parseInt(i.value.replace(/[^0-9]/g,''),10)||0;if(v)o[i.dataset.id]=v});return o}
function bSum(){const t=Object.values(bRead()).reduce((s,v)=>s+v,0);$('bSum').textContent=t?`한도 합계 ${won(t)} (목표 생활비 100~120만원)`:'금액을 비워두면 그 부서는 한도 없이 써요.'}
$('bEdit').onclick=()=>{if($('bBox').hidden)bOpen();else $('bBox').hidden=true};
$('bCancel').onclick=()=>{$('bBox').hidden=true};
$('bSave').onclick=()=>{const m=M(ym);m.paid={...(m.paid||{}),b:bRead()};saveMonth(ym);$('bBox').hidden=true;play('stamp');toast('부서별 한도를 저장했어요');render()};

/* ---------- achievements ---------- */
function achievements(){const closed=monthsList().filter(k=>k<ym),black=closed.filter(k=>(S.months[k]?.received||0)>0&&surplus(k)>0).length;
  const fxBest=FIXED.length?Math.max(0,...Object.keys(S.months).map(k=>FIXED.filter(f=>S.months[k].paid?.[f.id]).length)):0;
  const carrot=allInc().filter(x=>/당근/.test(x.place||'')).length,sent=Object.values(S.months).filter(m=>m.paid?.h?.sent).length;
  const kept=closed.filter(k=>{const B=budgets(k),ids=Object.keys(B);return ids.length&&exOf(k).length&&ids.every(id=>deptSpent(k,id)<=B[id])}).length;
  const n=S.expenses.length,ns=new Set(S.noSpend).size,combo=bestCombo(),v=vaultNow();
  return [
   ['first','📝','첫 결재','품의서를 처음 올리기',n,1],['e50','📚','결재의 달인','품의서 50건',n,50],['e200','🗂','장부 마스터','품의서 200건',n,200],
   ['ns1','💎','첫 무지출','무지출 데이 1일',ns,1],['ns10','💠','절약 습관','무지출 데이 누적 10일',ns,10],['c3','🔥','3일 콤보','무지출 3일 연속',combo,3],['c7','🌋','일주일 콤보','무지출 7일 연속',combo,7],
   ['fx','🖋','도장 올클리어','한 기간 고정비 전부 결재',fxBest,FIXED.length||1],['send','🤝','첫 이월','대표이사가 생활비 보내기',sent,1],
   ['k3','🥕','당근 새싹','당근 거래 3건',carrot,3],['k10','👑','중고왕','당근 거래 10건',carrot,10],
   ['b1','📈','흑자 마감','남은 돈이 있는 채로 기간 마감',black,1],['b3','🏆','흑자 3회','흑자 마감 3번',black,3],
   ['keep','🎯','한도 지킴이','모든 부서 한도를 지키고 마감',kept,1],
   ['v100','🏦','금고 100만','이월 금고 100만원',v,1000000],['v500','💰','금고 500만','이월 금고 500만원',v,5000000],
  ].map(([id,icon,n,desc,cur,goal])=>({id,icon,n,desc,cur:Math.max(0,cur),goal,done:cur>=goal}))}
let achT=0;
function checkAch(){if(!loaded)return;const a=achievements(),got=a.filter(x=>x.done).map(x=>x.id);$('achCnt').textContent=got.length;let seen=null;try{seen=JSON.parse(localStorage.getItem('uri-ach'))}catch(e){}
  if(!Array.isArray(seen)){try{localStorage.setItem('uri-ach',JSON.stringify(got))}catch(e){}return}
  const fresh=got.filter(id=>!seen.includes(id));if(!fresh.length)return;try{localStorage.setItem('uri-ach',JSON.stringify([...new Set([...seen,...got])]))}catch(e){}
  const x=a.find(y=>y.id===fresh[0]);clearTimeout(achT);achT=setTimeout(()=>{play('fanfare');burst(256,60,['#f2b632','#ffd96a','#7fe3ff']);toast(`업적 달성! ${x.icon} ${x.n}`+(fresh.length>1?` 외 ${fresh.length-1}개`:''))},1100)}
function achOpen(){const a=achievements(),L=$('achList');L.textContent='';$('achTitle').textContent=`업적 ${a.filter(x=>x.done).length}/${a.length}`;
  for(const x of a){const r=document.createElement('div');r.className='ach'+(x.done?' done':'');const ic=document.createElement('span');ic.className='ic';ic.textContent=x.done?x.icon:'🔒';ic.setAttribute('aria-hidden','true');
    const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=x.n;const d=document.createElement('span');const fmt=v=>x.goal>=10000?man(v):v;d.textContent=x.desc+(x.done?' · 달성!':` · ${fmt(Math.min(x.cur,x.goal))}/${fmt(x.goal)}`);
    const pb=document.createElement('div');pb.className='pb';const pi=document.createElement('i');pi.style.width=Math.min(100,x.cur/x.goal*100)+'%';pb.appendChild(pi);t.append(b,d,pb);r.append(ic,t);L.appendChild(r)}
  $('achModal').hidden=false;$('achClose').focus()}
$('lvBtn').onclick=achOpen;$('achClose').onclick=()=>{$('achModal').hidden=true;$('lvBtn').focus()};
$('achModal').addEventListener('click',e=>{if(e.target===$('achModal'))$('achModal').hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('achModal').hidden)$('achModal').hidden=true});

/* ---------- ledger search ---------- */
const shortDate=d=>(d.slice(0,4)!==today.slice(0,4)?d.slice(2,4)+'.':'')+`${+d.slice(5,7)}/${+d.slice(8)}`;
function searchHit(e,q){const d=DEPTS.find(x=>x.id===e.cat);
  const hay=[e.place,e.memo,e.method,e.inc?'부수입 '+(e.to==='vault'?'금고':'생활비'):d?.n,e.inc?'':d?.team,e.amount,e.date,`${+e.date.slice(5,7)}월`].join(' ').toLowerCase();
  return q.split(/\s+/).every(w=>{const n=w.replace(/[,원]/g,'');return hay.includes(w)||(n&&/^\d+$/.test(n)&&String(e.amount).includes(n))})}
$('lSearch').addEventListener('input',()=>render());
$('lSearchX').onclick=()=>{$('lSearch').value='';render();$('lSearch').focus()};

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
  const recv=M(ym).received||0,spent=spentOf(ym),reserved=fxTotal()-paidSum(ym),carry=vaultNow(),adj=monthAdj(ym),inc=incMonth(ym);
  const avail=surplus(ym);
  $('oMonth').textContent=periodLabel(ym);$('recvPeriod').textContent=periodLabel(ym)+' 살림';
  const kv=(el,rows)=>{el.textContent='';for(const [k,v,cls] of rows){const a=document.createElement('div');a.textContent=k;const b=document.createElement('div');b.className='v '+(cls||'');b.textContent=won(v);if(cls&&cls.includes('t'))a.className='t';el.append(a,b)}};
  kv($('oKv'),[['받은 돈',recv],...(inc?[['부수입 (생활비에 더함)',inc,'pos']]:[]),['고정비 (예약금 포함)',-fxTotal()],['쓴 돈',-spent],...(adj?[[adj>0?'금고에서 보탬':'금고로 옮김',adj]]:[]),['이번 달 남은 돈',avail,'t '+(avail<0?'neg':'pos')]]);
  setBar($('oVarBar'),spent/TARGET_MAX,`${won(spent)} / 목표 100~120만`);
  kv($('fKv'),[['받은 돈',recv],['결재 완료 고정비',-paidSum(ym)],['예약금 (결재 대기)',-reserved],['변동비로 쓸 수 있는 돈',recv-fxTotal(),'t '+(recv-fxTotal()<0?'neg':'pos')]]);
  if(document.activeElement!==$('recvIn'))$('recvIn').value=recv?recv.toLocaleString('ko-KR'):'';
  deptGrid($('oDepts'),id=>{selDept=id;go('var');$('fAmt').focus()},null);
  deptGrid($('fDepts'),id=>{selDept=id;render()},selDept);
  const ns=nsStats();$('nsCount').textContent=ns.count;$('nsCombo').textContent=ns.combo;
  const spentToday=S.expenses.some(e=>e.date===today);$('noSpendBtn').disabled=spentToday||S.noSpend.includes(today);$('noSpendBtn').textContent=S.noSpend.includes(today)?'오늘 무지출 달성 중':spentToday?'오늘은 지출이 있어요':'오늘 무지출 데이 선언';
  // chart
  const ex=exOf(vm);const tot=ex.reduce((s,e)=>s+e.amount,0);$('chartTotal').textContent=`합계 ${won(tot)}`;
  {const ms=monthsList();$('pLabel').textContent=periodLabel(vm,true)+(vm===ym?' (이번 달)':' (지난 기록)');$('pPrev').disabled=vm<=ms[0];$('pNext').disabled=vm>=ym}
  const B=budgets(vm),pv=ymShift(vm,-1),pex=exOf(pv),K=v=>Math.round(v/1000)+'K';
  const ch=$('chart');ch.textContent='';const sums=DEPTS.map(d=>({d,v:ex.filter(e=>e.cat===d.id).reduce((s,e)=>s+e.amount,0),pv:pex.filter(e=>e.cat===d.id).reduce((s,e)=>s+e.amount,0),lim:B[d.id]||0})).sort((a,b)=>b.v-a.v);const mx=Math.max(1,...sums.map(s=>s.v));
  for(const {d,v,pv:pvv,lim} of sums){const r=document.createElement('div');r.className='crow';const n=document.createElement('span');n.textContent=d.n;const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');
    const ratio=lim?v/lim:0;i.style.width=(lim?Math.min(100,ratio*100):v/mx*100)+'%';i.style.background=lim&&ratio>1?'var(--red)':d.c;if(lim)bar.classList.add('lim');bar.appendChild(i);
    const val=document.createElement('span');val.className='v'+(lim&&ratio>1?' neg':'');val.textContent=lim?`${K(v)}/${K(lim)}`:v?`${K(v)} · ${tot?Math.round(v/tot*100):0}%`:'-';r.append(n,bar,val);
    const notes=[];if(lim)notes.push(ratio>1?`한도 ${man(v-lim)} 초과`:`한도의 ${Math.round(ratio*100)}% · ${man(lim-v)} 남음`);
    if(pex.length&&(v||pvv)){const df=v-pvv;notes.push(df===0?'지난달과 같음':`지난달보다 ${df>0?'▲':'▼'}${man(Math.abs(df))}`)}
    if(notes.length){const m=document.createElement('small');m.className='cmeta'+(lim&&ratio>1?' neg':lim&&ratio>=.8?' warn':'');m.textContent=notes.join(' · ');r.appendChild(m)}
    ch.appendChild(r)}
  renderCal(ex);
  // ledger
  const L=$('ledger');L.textContent='';const q=$('lSearch').value.trim().toLowerCase();$('lSearchX').hidden=!q;
  const pool=q?[...S.expenses,...allInc().map(x=>({...x,inc:true}))]:[...ex,...incOf(vm).map(x=>({...x,inc:true,p:vm}))];
  const sorted=pool.filter(e=>!q||searchHit(e,q)).sort((a,b)=>(b.date+(b.at||'')).localeCompare(a.date+(a.at||'')));
  if(q){const sp=sorted.filter(e=>!e.inc).reduce((s,e)=>s+e.amount,0),it=sorted.filter(e=>e.inc).reduce((s,e)=>s+e.amount,0);
    $('ledgerCount').textContent=`검색 ${sorted.length}건`;$('lSearchSum').hidden=!sorted.length;$('lSearchSum').textContent='전체 기간에서 찾았어요'+(sp||!it?` · 지출 합계 ${won(sp)}`:'')+(it?` · 부수입 합계 +${won(it)}`:'')}
  else{$('lSearchSum').hidden=true;const it=incAll(vm);$('ledgerCount').textContent=`${sorted.length}건`+(it?` · 부수입 +${it.toLocaleString('ko-KR')}`:'')}
  if(!sorted.length){const e=document.createElement('div');e.className='empty';e.textContent=q?'검색 결과가 없어요. 다른 단어로 찾아보세요.':vm===ym?'이번 달 결재 내역이 없어요. 위에서 품의서를 올려보세요.':'이 기간에는 결재 내역이 없어요.';L.appendChild(e)}
  for(const e of sorted){if(e.inc){L.appendChild(incRow(e));continue}const d=DEPTS.find(x=>x.id===e.cat)||DEPTS[9];const r=document.createElement('div');r.className='lrow';
    const dd=document.createElement('span');dd.className='d';dd.textContent=shortDate(e.date);
    const dot=document.createElement('span');dot.className='dot';dot.style.background=d.c;
    const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=e.place||d.n;const s=document.createElement('span');s.textContent=`${d.n} · ${e.method}${e.memo?' · '+e.memo:''}`;t.append(b,s);
    const a=document.createElement('span');a.className='a';a.textContent=e.amount.toLocaleString('ko-KR');
    const acts=document.createElement('div');acts.className='acts';const ed=document.createElement('button');ed.textContent='수정';ed.onclick=()=>startEdit(e);const del=document.createElement('button');del.textContent='삭제';
    del.onclick=()=>{if(del.dataset.c){S.expenses=S.expenses.filter(x=>x.id!==e.id);render();write(()=>sb.from('expenses').delete().eq('id',e.id),'삭제했어요')}else{del.dataset.c='1';del.textContent='정말?';del.className='danger';setTimeout(()=>{if(del.isConnected){delete del.dataset.c;del.textContent='삭제';del.className=''}},3000)}};
    acts.append(ed,del);r.append(dd,dot,t,a,acts);rowToggle(r);L.appendChild(r)}
  // vault
  $('vaultBig').textContent=won(carry);
  const H=$('hist');H.textContent='';
  for(const m of monthsList().reverse()){const sp=surplus(m),im=incMonth(m);const r=document.createElement('div');r.className='hrow';const t=document.createElement('div');t.className='t';
    const b=document.createElement('b');b.textContent=periodLabel(m,true)+(m===ym?' (진행 중)':'');const sub=document.createElement('span');sub.textContent=`받은 돈 ${man(S.months[m]?.received||0)}${im?` · 부수입 +${man(im)}`:''} · 고정비 ${man(-fxTotal())} · 변동비 ${man(-spentOf(m))}${monthAdj(m)?` · 금고 ${monthAdj(m)>0?'+':''}${man(monthAdj(m))}`:''}`;t.append(b,sub);
    const a=document.createElement('span');a.className='a '+(sp<0?'neg':'pos');a.textContent=won(sp);r.append(t,a);H.appendChild(r)}
  drawSafe();
  $('fMethod').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!$('fMethodCustom').value.trim()&&b.dataset.m===method)));
  if(role==='boss')renderBoss();
  renderPlaces();renderPay();renderVault();renderDaily(avail);checkAch();
  drawScene();
}
function drawSafe(){const c=$('safeCv').getContext('2d');c.clearRect(0,0,40,40);c.fillStyle='#4b5262';c.fillRect(4,4,32,32);c.fillStyle='#6b7385';c.fillRect(6,6,28,28);c.fillStyle='#c9c9c9';c.fillRect(16,14,8,8);c.fillStyle='#888';c.fillRect(19,12,2,12);const n=Math.max(0,Math.min(12,Math.floor(vaultNow()/80000)));for(let i=0;i<n;i++){c.fillStyle='#f2b632';c.fillRect(8+(i%4)*6,32-Math.floor(i/4)*3,5,3)}}

/* ---------- daily recommended budget ---------- */
function daysLeftInPeriod(){const [,end]=periodRange(ym);const t=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.max(1,Math.round((end-t)/864e5)+1)}
function renderDaily(avail){const todaySpent=S.expenses.filter(e=>e.date===today).reduce((s,e)=>s+e.amount,0);
  const dl=daysLeftInPeriod(),pool=avail+todaySpent,per=Math.max(0,Math.floor(pool/dl/100)*100),left=per-todaySpent;
  const [,end]=periodRange(ym);
  for(const el of document.querySelectorAll('[data-daily]')){el.textContent='';
    const l=document.createElement('span');l.className='l';l.textContent='오늘 하루 권장 예산';
    const b=document.createElement('b');b.textContent=won(per);if(per<=0)b.className='zero';
    const s=document.createElement('small');s.textContent=pool<=0?`남은 생활비가 없어요 · ${end.getMonth()+1}/${end.getDate()}까지 ${dl}일`:`${end.getMonth()+1}/${end.getDate()}까지 ${dl}일 남음 · 오늘 쓴 돈 ${won(todaySpent)} · ${left>=0?'오늘 남은 권장액 '+won(left):won(-left)+' 초과'}`;
    el.append(l,b,s)}}

/* ---------- PDF report ---------- */
function loadScript(src){return new Promise((res,rej)=>{if(window.html2pdf)return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function reportHTML(){
  const recv=M(ym).received||0,ex=exOf(ym),spent=spentOf(ym),adj=monthAdj(ym),left=surplus(ym),paid=M(ym).paid||{},h=paid.h||{},inc=incMonth(ym),incs=incOf(ym);
  const row=(cells,cls='')=>`<tr class="${cls}">${cells.map(([v,n])=>`<td class="${n?'n':''}">${v}</td>`).join('')}</tr>`;
  const W=v=>esc(won(v));
  let o=`<div class="report"><h1>우리집 자산관리(주) 월간 리포트</h1><div class="sub">${esc(periodLabel(ym))} · 작성 ${esc(new Date().toLocaleString('ko-KR'))}</div>`;
  o+=`<div class="grid">${[['받은 돈',recv],...(inc?[['부수입 (생활비)',inc]]:[]),['고정비',-fxTotal()],['변동비',-spent],...(adj?[[adj>0?'금고에서 보탬':'금고로 옮김',adj]]:[]),['이번 기간 남은 돈',left],['이월 금고 잔액',vaultNow()]].map(([k,v])=>`<div class="kpi"><span>${esc(k)}</span><b class="${v<0?'neg':''}">${W(v)}</b></div>`).join('')}<div class="kpi"><span>무지출 데이</span><b>${nsStats().count}일</b></div><div class="kpi"><span>결재 건수</span><b>${ex.length}건</b></div></div>`;
  if(h.salary||h.bonus||h.extra){o+=`<h3>남편탭 (대표이사)</h3><table><tr><th>항목</th><th class="n">금액</th></tr>`;
    for(const [k,lab] of H_INC)if(h[k])o+=row([[esc(lab)+(h[k+'Ok']?' (입금 확인)':'')],[W(h[k]),1]]);
    o+=row([['사전 공제 합계'],[W(-H_DED_TOTAL),1]]);o+=row([['아내에게 보낸 생활비'+(h.sent?' (이월 완료)':' (미이체)')],[W(h.sent?h.sentAmount:hSend()),1]],'tot');o+='</table>'}
  o+=`<h3>고정비 결재 현황</h3><table><tr><th>항목</th><th>일정</th><th>상태</th><th class="n">금액</th></tr>`;
  for(const f of FIXED)o+=row([[esc(f.n)],[esc(f.w)],[paid[f.id]?'결재 완료':'<span class="neg">결재 대기</span>'],[W(f.a),1]]);
  o+=row([['합계'],[''],[`${FIXED.filter(f=>paid[f.id]).length}/${FIXED.length}`],[W(fxTotal()),1]],'tot')+'</table>';
  o+=`<h3>부서별 지출</h3><table><tr><th>부서</th><th class="n">건수</th><th class="n">비율</th><th class="n">금액</th></tr>`;
  for(const d of DEPTS){const it=ex.filter(e=>e.cat===d.id);if(!it.length)continue;const v=it.reduce((s,e)=>s+e.amount,0);o+=row([[esc(d.n+' ['+d.team+']')],[it.length,1],[(spent?Math.round(v/spent*100):0)+'%',1],[W(v),1]])}
  o+=row([['합계'],[ex.length,1],['100%',1],[W(spent),1]],'tot')+'</table>';
  const g={};for(const e of ex){const k=(e.method||'기타').trim()||'기타';g[k]=(g[k]||0)+e.amount}
  o+=`<h3>결제수단별</h3><table><tr><th>결제수단</th><th class="n">금액</th></tr>`+Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row([[esc(k)],[W(v),1]])).join('')+'</table>';
  if(incs.length){o+=`<h3>부수입</h3><table><tr><th>날짜</th><th>어디서</th><th>넣은 곳</th><th>메모</th><th class="n">금액</th></tr>`+[...incs].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>row([[esc(x.date.slice(5))],[esc(x.place)],[x.to==='vault'?'금고':'생활비'],[esc(x.memo)],['+'+esc(x.amount.toLocaleString('ko-KR')),1]])).join('')+row([['합계'],[''],[''],[''],['+'+esc(incAll(ym).toLocaleString('ko-KR')),1]],'tot')+'</table>'}
  const mv=allMoves().filter(x=>x.p===ym);
  if(mv.length){o+=`<h3>금고 입출금</h3><table><tr><th>날짜</th><th>구분</th><th>메모</th><th class="n">금액</th></tr>`+mv.map(x=>row([[esc(x.date)],[x.type==='out'?'꺼냄':'채움'],[esc(x.memo)],[(x.type==='out'?'-':'+')+esc(x.amount.toLocaleString('ko-KR')),1]])).join('')+'</table>'}
  o+=`<h3>결재 장부</h3><table><tr><th>날짜</th><th>사용처</th><th>부서</th><th>결제수단</th><th>메모</th><th class="n">금액</th></tr>`;
  for(const e of [...ex].sort((a,b)=>a.date.localeCompare(b.date))){const d=DEPTS.find(x=>x.id===e.cat)||DEPTS[9];o+=row([[esc(e.date.slice(5))],[esc(e.place)],[esc(d.n)],[esc(e.method)],[esc(e.memo)],[esc(e.amount.toLocaleString('ko-KR')),1]])}
  return o+'</table></div>'}
$('pdfBtn').onclick=async()=>{const b=$('pdfBtn');b.disabled=true;toast('리포트를 만들고 있어요…');
  try{await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    const wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-10000px;top:0';wrap.innerHTML=reportHTML();document.body.appendChild(wrap);
    const [a]=periodRange(ym);const name=`우리집가계부_${a.getFullYear()}-${pad(a.getMonth()+1)}-25_기간.pdf`;
    await window.html2pdf().set({margin:[8,8,8,8],filename:name,image:{type:'jpeg',quality:.95},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['tr','.kpi']}}).from(wrap.firstElementChild).save();
    wrap.remove();play('stamp');toast('PDF 리포트를 저장했어요')}
  catch(e){console.error(e);toast('PDF를 만들지 못했어요. 인터넷 연결을 확인해주세요')}
  finally{b.disabled=false}};

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
function renderVault(){const L=$('vList');L.textContent='';const mv=[...allMoves(),...allInc().filter(x=>x.to==='vault').map(x=>({...x,type:'in',inc:true}))].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id));$('vCount').textContent=mv.length?`${mv.length}건`:'';
  if(!mv.length){const e=document.createElement('div');e.className='empty';e.textContent='아직 금고에서 꺼내거나 채운 기록이 없어요.';L.appendChild(e);return}
  for(const x of mv){const r=document.createElement('div');r.className='vrow';
    const d=document.createElement('span');d.className='d';d.textContent=`${+x.date.slice(5,7)}/${+x.date.slice(8)}`;
    const tg=document.createElement('span');tg.className='tag2 '+x.type;tg.textContent=x.inc?'부수입':x.type==='out'?'꺼냄':'채움';
    const t=document.createElement('div');t.className='t';const b=document.createElement('b');b.textContent=x.inc?[x.place,x.memo].filter(Boolean).join(' · ')||'부수입':x.memo||(x.type==='out'?'금고에서 꺼냄':'금고 채움');const s=document.createElement('span');s.textContent=x.inc?'부수입 → 금고 (수정·삭제는 결재 장부에서)':V_KINDS[x.type].find(k=>k[0]===!!x.month)[1];t.append(b,s);
    const a=document.createElement('span');a.className='a '+(x.type==='out'?'neg':'pos');a.textContent=(x.type==='out'?'-':'+')+x.amount.toLocaleString('ko-KR');
    const del=document.createElement('button');del.className='del';del.textContent='삭제';del.style.cssText='background:#fff;border:2px solid #000;border-radius:3px;font-size:11px;padding:2px 6px';
    del.onclick=()=>{if(!del.dataset.c){del.dataset.c='1';del.textContent='정말?';del.style.background='var(--red)';del.style.color='#fff';setTimeout(()=>{if(del.isConnected){delete del.dataset.c;del.textContent='삭제';del.style.background='#fff';del.style.color=''}},3000);return}
      const m=M(x.p);m.paid={...(m.paid||{}),v:(m.paid?.v||[]).filter(y=>y.id!==x.id)};saveMonth(x.p);toast('삭제했어요');render()};
    if(x.inc){r.append(d,tg,t,a);L.appendChild(r);continue}
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
function startEdit(e){editInc=null;if(kind!=='exp')setKind('exp');editId=e.id;selDept=e.cat;method=e.method;$('fMethodCustom').value=METHODS.includes(e.method)?'':e.method;$('fDate').value=e.date;$('fPlace').value=e.place;$('fAmt').value=e.amount.toLocaleString('ko-KR');$('fMemo').value=e.memo||'';$('formTitle').textContent='품의서 수정';$('fSubmit').textContent='수정 결재';$('fCancel').hidden=false;go('var');render();$('fAmt').focus()}
function startEditInc(x){editInc={id:x.id,p:x.p,at:x.at,by:x.by};setKind('inc');setDest(x.to==='vault'?'vault':'month');$('fDate').value=x.date;$('fPlace').value=x.place||'';$('fAmt').value=x.amount.toLocaleString('ko-KR');$('fMemo').value=x.memo||'';$('formTitle').textContent='부수입 수정';$('fSubmit').textContent='수정 저장';$('fCancel').hidden=false;go('var');render();$('fAmt').focus()}
function endEdit(){scanMsg('');editId=null;editInc=null;$('form').reset();method=METHODS[0];$('fDate').value=today;$('formTitle').textContent=kind==='inc'?'부수입 입금 등록':'품의서 작성';$('fSubmit').textContent=kind==='inc'?'입금 등록':'결재 올리기';$('fCancel').hidden=true}
$('fCancel').onclick=()=>{endEdit();render()};
$('form').onsubmit=e=>{e.preventDefault();const amount=num($('fAmt').value);if(!amount){toast('금액을 입력해주세요');$('fAmt').focus();return}
  if(kind==='inc'){const date=$('fDate').value||today,p=periodOf(date);
    const rec={id:editInc?.id||crypto.randomUUID(),date,place:$('fPlace').value.trim().slice(0,40),amount,memo:$('fMemo').value.trim().slice(0,60),to:dest,at:editInc?.at||new Date().toISOString(),by:editInc?.by||userEmail};
    if(editInc){removeInc(editInc.p,editInc.id);if(editInc.p!==p)saveMonth(editInc.p)}
    addInc(p,rec);saveMonth(p);if(editInc)toast('수정했어요');else incCheer(rec);
    vm=p<=ym?p:ym;
    endEdit();render();return}
  const rec={cat:selDept,place:$('fPlace').value.trim().slice(0,40),amount,method,memo:$('fMemo').value.trim().slice(0,60),date:$('fDate').value||today};
  const before=spentOf(ym),lim=budgets(ym)[selDept]||0,dBefore=deptSpent(ym,selDept),dCat=selDept;
  if(editId){const id=editId;const x=S.expenses.find(x=>x.id===id);Object.assign(x,rec);write(()=>sb.from('expenses').update({...rec,updated_at:new Date().toISOString()}).eq('id',id),'수정했어요')}
  else{const id=crypto.randomUUID();S.expenses.push({id,...rec,at:new Date().toISOString()});write(()=>sb.from('expenses').insert({id,...rec}));toast(`${DEPTS.find(d=>d.id===selDept).team} 결재 완료!`)}
  if(S.noSpend.includes(rec.date)){S.noSpend=S.noSpend.filter(d=>d!==rec.date);write(()=>sb.from('no_spend').delete().eq('date',rec.date))}
  play('coin');react(selDept,amount);
  const after=spentOf(ym);if(before<TARGET_MAX*.8&&after>=TARGET_MAX*.8){setTimeout(()=>play('alert'),300);toast('경고! 목표 생활비의 80%를 넘었어요')}
  if(lim){const dAfter=deptSpent(ym,dCat),nm=DEPTS.find(d=>d.id===dCat).n;if(dBefore<=lim&&dAfter>lim){setTimeout(()=>play('alert'),300);toast(`${nm} 한도 초과! (${man(dAfter-lim)} 넘음)`)}else if(dBefore<lim*.8&&dAfter>=lim*.8)toast(`${nm} 한도의 80%를 썼어요 (${man(lim-dAfter)} 남음)`)}
  {const rp=periodOf(rec.date);vm=rp<=ym?rp:ym}
  endEdit();render()};
$('recvSave').onclick=()=>{M(ym).received=num($('recvIn').value);saveMonth(ym).then(()=>toast('받은 돈을 저장했어요'));play('coin');render()};
$('noSpendBtn').onclick=()=>{if(!S.noSpend.includes(today)){S.noSpend.push(today);write(()=>sb.from('no_spend').insert({date:today}));play('fanfare');toast('무지출 데이 달성!')}render()};

/* ---------- lock: login once, then PIN ---------- */
const PIN_KEY='uri-pin',SEEN_KEY='uri-last';let pinBuf='',pinMode='enter',pinFirst='',pinFails=0,userEmail='';
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const getPin=()=>{try{return localStorage.getItem(PIN_KEY)}catch(e){return null}};
const setPin=v=>{try{v?localStorage.setItem(PIN_KEY,v):localStorage.removeItem(PIN_KEY)}catch(e){}};
function showLock(view,msg=''){$('lock').hidden=false;$('app').hidden=true;$('lkLogin').hidden=view!=='login';$('lkPin').hidden=view!=='pin';$('lkErr').textContent=msg;if(view==='login')setTimeout(()=>$('lkEmail').focus(),50)}
function pinView(mode){pinMode=mode;pinBuf='';pinFails=0;$('pinMsg').textContent=mode==='set'?'새 PIN 4자리를 정해주세요':mode==='confirm'?'한 번 더 눌러주세요':'PIN 4자리를 눌러주세요';$('forgot').hidden=mode!=='enter';drawDots();showLock('pin')}
function drawDots(){[...$('dots').children].forEach((d,i)=>d.classList.toggle('on',i<pinBuf.length))}
function shake(){const d=$('dots');d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake')}
{const pad=$('pad');for(const k of['1','2','3','4','5','6','7','8','9','','0','⌫']){const b=document.createElement('button');b.type='button';b.textContent=k;if(!k){b.disabled=true;b.style.visibility='hidden'}b.setAttribute('aria-label',k==='⌫'?'지우기':k);b.onclick=()=>pinKey(k);pad.appendChild(b)}
 document.addEventListener('keydown',e=>{if($('lock').hidden||$('lkPin').hidden)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;if(/^[0-9]$/.test(e.key))pinKey(e.key);else if(e.key==='Backspace')pinKey('⌫')})}
async function pinKey(k){if($('lock').hidden)return;if(k==='⌫'){pinBuf=pinBuf.slice(0,-1);drawDots();return}if(pinBuf.length>=4)return;pinBuf+=k;drawDots();if(pinBuf.length<4)return;
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
