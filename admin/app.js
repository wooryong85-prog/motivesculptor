import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://cbxltnyccjzptqkmtsqf.supabase.co','sb_publishable_jDZmnxr0T23ubpMI72BLGA_grGTXqIY');
const $=id=>document.getElementById(id);
const won=n=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(Math.round(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const monthRange=()=>{const start=$('month').value+'-01',d=new Date(start+'T12:00:00');d.setMonth(d.getMonth()+1);return [start,new Intl.DateTimeFormat('en-CA').format(d)]};
const inMonth=(date,start,end)=>date&&date>=start&&date<end;
const net=e=>e.payment_method==='card'?Number(e.price)/1.1:e.payment_method==='cash'?Number(e.price):0;
const staffEmail=id=>id.toLowerCase()+'@staff.motivegym.co.kr';
let user=null,admin=false,ownTrainer=null,trainers=[],enrollments=[],sessions=[],editingEnrollmentId=null,slotPicked=false;
const message=s=>$('msg').textContent=s;
const empty=(id,cols)=>$(id).innerHTML='<tr><td colspan="'+cols+'" class="muted">내역이 없습니다.</td></tr>';
const mins=t=>{let [h,m]=String(t||'00:00').slice(0,5).split(':').map(Number);return h*60+m};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const dateAdd=(date,days)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const mondayOf=date=>{const d=new Date(date+'T12:00:00'),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return d.toISOString().slice(0,10)};
const weekValue=date=>{const d=new Date(mondayOf(date)+'T12:00:00');d.setDate(d.getDate()+3);const first=new Date(d.getFullYear(),0,4);const week=1+Math.round(((d-first)/86400000-(first.getDay()+6)%7)/7);return d.getFullYear()+'-W'+String(week).padStart(2,'0')};
const mondayFromWeek=week=>{if(!week)return mondayOf(today());const [year,no]=week.split('-W').map(Number),jan4=new Date(year,0,4),offset=(jan4.getDay()+6)%7;jan4.setDate(jan4.getDate()-offset+(no-1)*7);return jan4.toISOString().slice(0,10)};
const statusClass=remaining=>remaining<=2?'low':remaining<=5?'caution':'good';
function updateProgress(){const e=enrollments.find(x=>x.id===Number($('session-enrollment').value));if(!e){$('progress-state').textContent='회원 선택 후 진행 회차와 남은 수업 수를 확인할 수 있습니다.';$('progress-state').className='progress-state';return}const used=sessions.filter(s=>s.enrollment_id===e.id).reduce((n,s)=>n+Number(s.quantity),0),remaining=Math.max(0,Number(e.session_count)-used);$('progress-state').textContent=(used+1)+'/'+e.session_count+'회 진행 예정 · '+remaining+'회 남음';$('progress-state').className='progress-state '+statusClass(remaining);}
function renderWeeklySchedule(){
 const start=mondayFromWeek($('week-start').value), days=['월','화','수','목','금','토','일'], dates=days.map((_,i)=>dateAdd(start,i));
 const times=[];for(let min=540;min<=1320;min+=60)times.push(clock(min));
 const header='<thead><tr><th>시작 시간</th>'+dates.map((d,i)=>'<th>'+days[i]+'<br><small>'+d.slice(5).replace('-','/')+'</small></th>').join('')+'</tr></thead>';
 const body=times.map(time=>'<tr><td class="time">'+time+'</td>'+dates.map(date=>{
   const day=new Date(date+'T12:00:00').getDay(),minute=mins(time),closing=day===0?1080:day===6?960:1380,opening=day===0||day===6?600:540;
   if(minute<opening||minute>=closing)return '<td class="closed"></td>';
   const s=sessions.find(x=>x.session_date===date&&String(x.starts_at||'').slice(0,5)===time),e=s&&enrollments.find(x=>x.id===s.enrollment_id);
   if(s){const sequence=sessionNo(s.enrollment_id,s),total=Number(e?.session_count||0),remaining=Math.max(0,total-sequence);return '<td><div class="schedule-class '+(Number(s.duration_minutes)===30?'thirty ':'')+statusClass(remaining)+'"><small>'+esc(e?.member_name||'회원')+' · '+sequence+'/'+total+'</small>'+time+' · '+(s.duration_minutes||50)+'분</div></td>'}
   return '<td><button type="button" class="schedule-slot" data-slot-date="'+date+'" data-slot-time="'+time+'">＋</button></td>';
 }).join('')+'</tr>').join('');
 $('weekly-schedule').innerHTML=header+'<tbody>'+body+'</tbody>';
}
function sessionNo(id,session){
 const list=sessions.filter(s=>s.enrollment_id===id).sort((a,b)=>(a.session_date+(a.starts_at||'' )).localeCompare(b.session_date+(b.starts_at||''))||a.id-b.id);
 if(!session)return list.reduce((n,s)=>n+s.quantity,0)+1;
 let total=0;for(const item of list){total+=item.quantity;if(item.id===session.id)break}return total;
}
function setTimeOptions(){
 const date=$('session-date').value||today(),dow=new Date(date+'T12:00:00').getDay();
 const [opens,closes]=dow===0?[600,1080]:dow===6?[600,960]:[540,1380],duration=Number($('session-duration').value||50),old=$('session-time').value;
 const times=[];for(let time=opens;time+duration<=closes;time+=30)times.push(clock(time));
 $('session-time').innerHTML=times.map(t=>'<option value="'+t+'">'+t+'</option>').join('');
 if(times.includes(old))$('session-time').value=old;
 $('hours').textContent=(dow===0?'일요일 10:00–18:00':dow===6?'토요일 10:00–16:00':'평일 09:00–23:00')+' · '+duration+'분 수업을 기록합니다.';
}
function view(name){for(const [button,panel] of [['dashboard','dashboard'],['sessions','sessions-panel'],['trainers','trainers-panel']]){$('tab-'+button).setAttribute('aria-selected',String(button===name));$(panel).classList.toggle('hidden',button!==name)}}
function render(){
 const [start,end]=monthRange(),monthly=enrollments.filter(e=>inMonth(e.registered_at,start,end)),completed=sessions.filter(s=>inMonth(s.session_date,start,end));
 if(admin){
  const renew=monthly.filter(e=>e.is_renewal).length;
  $('sales').textContent=won(monthly.reduce((n,e)=>n+Number(e.price),0));$('count').textContent=monthly.length+'건 등록';
  $('new').textContent=new Set(monthly.filter(e=>!e.is_renewal).map(e=>e.member_name)).size;
  $('ended').textContent=new Set(enrollments.filter(e=>inMonth(e.ends_at,start,end)).map(e=>e.member_name)).size;
  $('rate').textContent=monthly.length?Math.round(100*renew/monthly.length)+'%':'0%';
  $('summary').innerHTML=trainers.map(t=>{let es=monthly.filter(e=>e.trainer_id===t.id),ss=completed.filter(s=>s.trainer_id===t.id),commission=ss.reduce((n,s)=>n+Number(s.payout_amount),0);return '<tr><td>'+esc(t.name)+'</td><td>'+won(es.reduce((n,e)=>n+Number(e.price),0))+'</td><td>'+ss.reduce((n,s)=>n+s.quantity,0)+'회</td><td>'+won(commission+Number(t.base_salary))+'</td><td>'+(es.length?Math.round(100*es.filter(e=>e.is_renewal).length/es.length):0)+'%</td></tr>'}).join('')||'<tr><td colspan="5">트레이너 없음</td></tr>';
  $('enrollment-list').innerHTML=enrollments.slice(0,40).map(e=>'<tr><td>'+e.registered_at+'</td><td>'+esc(e.member_name)+'</td><td>'+esc(trainers.find(t=>t.id===e.trainer_id)?.name||e.trainer_name)+'</td><td>'+e.session_count+'회</td><td>'+(e.ends_at||'미입력')+'</td><td>'+(e.is_renewal?'재등록':'신규')+'</td><td>'+(e.payment_method==='card'?'카드':e.payment_method==='cash'?'현금':'미지정')+'</td><td>'+won(e.price)+'</td><td><button class="small secondary" data-enrollment-id="'+e.id+'">수정</button></td></tr>').join('');if(!$('enrollment-list').innerHTML)empty('enrollment-list',9);
  $('trainer-list').innerHTML=trainers.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.login_id)+'</td><td><input aria-label="'+esc(t.name)+' 정산 비율" type="number" min="0" max="100" value="'+Math.round(Number(t.share_rate)*100)+'" data-share="'+t.id+'"></td><td><input aria-label="'+esc(t.name)+' 기본급" type="number" min="0" value="'+Number(t.base_salary)+'" data-base="'+t.id+'"></td><td>'+(t.active?'사용':'비활성')+'</td><td><button class="small" data-save-trainer="'+t.id+'">저장</button> <button class="small secondary" data-trainer-id="'+t.id+'">'+(t.active?'비활성화':'복구')+'</button></td></tr>').join('');
  let six=[];for(let offset=5;offset>=0;offset--){const d=new Date(start+'T12:00:00');d.setMonth(d.getMonth()-offset);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');for(const t of trainers){const es=enrollments.filter(e=>e.trainer_id===t.id&&e.registered_at?.startsWith(key)),renew=es.filter(e=>e.is_renewal).length;six.push('<tr><td>'+key+'</td><td>'+esc(t.name)+'</td><td>'+es.length+'건</td><td>'+renew+'건</td><td>'+(es.length?Math.round(100*renew/es.length):0)+'%</td></tr>')}}$('six-month').innerHTML=six.join('');if(!six.length)empty('six-month',5);
 }
 const allowed=enrollments.filter(e=>(admin||e.trainer_id===ownTrainer?.id)&&e.payment_method);
 const enrollmentOptions='<option value="">선택하세요</option>'+allowed.filter(e=>e.trainer_id).map(e=>{const used=sessions.filter(s=>s.enrollment_id===e.id).reduce((n,s)=>n+Number(s.quantity),0),next=used+1;return '<option value="'+e.id+'" '+(next>e.session_count?'disabled':'')+'>'+esc(e.member_name)+' · '+next+'/'+e.session_count+(next>e.session_count?' (완료)':'')+'</option>'}).join('');$('session-enrollment').innerHTML=enrollmentOptions;$('schedule-member').innerHTML=enrollmentOptions;
 $('trainer').innerHTML='<option value="">선택하세요</option>'+trainers.filter(t=>t.active).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
 $('session-list').innerHTML=completed.map(s=>{let e=enrollments.find(x=>x.id===s.enrollment_id),t=trainers.find(x=>x.id===s.trainer_id),seq=sessionNo(s.enrollment_id,s);return '<tr><td>'+s.session_date+'</td><td>'+(s.starts_at||'시간 미입력')+'</td><td>'+esc(e?.member_name)+'</td><td>'+esc(t?.name)+'</td><td>'+seq+'/'+(e?.session_count||0)+'</td><td>'+(s.duration_minutes||50)+'분</td><td>'+won(s.payout_amount)+'</td></tr>'}).join('');if(!$('session-list').innerHTML)empty('session-list',7);
 const own=admin?completed:completed.filter(s=>s.trainer_id===ownTrainer?.id),todayRows=own.filter(s=>s.session_date===today()),trainer=admin?null:trainers.find(t=>t.id===ownTrainer?.id),monthlyPay=own.reduce((n,s)=>n+Number(s.payout_amount),0)+(trainer?Number(trainer.base_salary):0);
 $('today-count').textContent=todayRows.reduce((n,s)=>n+Number(s.quantity),0)+'회';$('today-date').textContent=today();$('today-pay').textContent=won(todayRows.reduce((n,s)=>n+Number(s.payout_amount),0));$('month-count').textContent=own.reduce((n,s)=>n+Number(s.quantity),0)+'회';$('month-pay').textContent=won(monthlyPay);$('base-note').textContent=trainer&&Number(trainer.base_salary)?'기본급 '+won(trainer.base_salary)+' 포함':'수업 수당 기준';
 setTimeOptions();renderWeeklySchedule();updateProgress();
}
async function load(){
 const [tr,en,se]=await Promise.all([db.from('trainers').select('*').order('sort_order'),db.from('member_enrollments').select('*').order('registered_at',{ascending:false}).limit(5000),db.from('completed_sessions').select('*').order('session_date',{ascending:false}).limit(5000)]);
 const error=tr.error||en.error||se.error;if(error){message('데이터를 불러오지 못했습니다: '+error.message);return}
 trainers=tr.data||[];enrollments=en.data||[];sessions=se.data||[];ownTrainer=trainers.find(t=>t.login_id&&staffEmail(t.login_id)===user.email?.toLowerCase());
 render();
}
async function show(){
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;
 if(!user){$('login').classList.remove('hidden');$('app').classList.add('hidden');return}
 admin=user.id==='99446214-0f1e-409f-a8c9-efef0ad29075';
 if(!admin){const loginId=user.email?.toLowerCase().endsWith('@staff.motivegym.co.kr')?user.email.toLowerCase().split('@')[0]:'';const {data,error}=await db.from('trainers').select('id,name,login_id,active').eq('login_id',loginId).eq('active',true).maybeSingle();if(error||!data){await db.auth.signOut();message('등록된 직원 계정이 아닙니다. 관리자에게 계정 연결을 요청하세요.');$('login').classList.remove('hidden');$('app').classList.add('hidden');return}ownTrainer=data}
 $('login').classList.add('hidden');$('app').classList.remove('hidden');document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!admin));$('heading').textContent=admin?'센터 관리':'수업 기록';$('who').textContent=admin?'관리자':ownTrainer.name+' 트레이너';view(admin?'dashboard':'sessions');await load();
}
$('login-form').onsubmit=async ev=>{ev.preventDefault();const id=$('email').value.trim(),email=id.includes('@')?id:staffEmail(id);const {error}=await db.auth.signInWithPassword({email,password:$('password').value});$('password').value='';if(error)message('로그인 정보를 확인해 주세요.');else{message('');await show()}};
$('logout').onclick=async()=>{await db.auth.signOut();await show()};
for(const name of ['dashboard','sessions','trainers'])$('tab-'+name).onclick=()=>view(name);
$('refresh').onclick=()=>load();$('month').onchange=render;
$('enrollment-form').onsubmit=async ev=>{ev.preventDefault();const tid=Number($('trainer').value),trainer=trainers.find(t=>t.id===tid);if($('ends').value<$('registered').value){message('종료일은 등록일 이후로 입력하세요.');return}const record={member_name:$('member').value.trim(),trainer_id:tid,trainer_name:trainer.name,registered_at:$('registered').value,ends_at:$('ends').value,session_count:Number($('sessions').value),price:Number($('price').value),payment_method:$('payment').value,is_renewal:$('type').value==='renewal'};const result=editingEnrollmentId?await db.from('member_enrollments').update(record).eq('id',editingEnrollmentId):await db.from('member_enrollments').insert(record);if(result.error){message('등록 저장 실패: '+result.error.message);return}editingEnrollmentId=null;ev.target.reset();$('registered').value=today();ev.target.querySelector('button').textContent='등록 내역 저장';message('등록 내역을 저장했습니다.');await load()};
$('enrollment-list').onclick=ev=>{const b=ev.target.closest('button[data-enrollment-id]');if(!b)return;const e=enrollments.find(x=>x.id===Number(b.dataset.enrollmentId));if(!e)return;editingEnrollmentId=e.id;$('member').value=e.member_name;$('trainer').value=e.trainer_id||'';$('registered').value=e.registered_at;$('ends').value=e.ends_at||'';$('sessions').value=e.session_count;$('price').value=e.price;$('payment').value=e.payment_method||'';$('type').value=e.is_renewal?'renewal':'new';$('enrollment-form').querySelector('button').textContent='수정 내역 저장';$('enrollment-form').scrollIntoView({behavior:'smooth'});message('기존 등록을 수정 중입니다. 결제 방식과 종료일을 확인하세요.')};
$('session-date').onchange=()=>{setTimeOptions();slotPicked=false;$('selected-slot').textContent='시간표의 빈 칸을 선택하세요.'};$('session-duration').onchange=setTimeOptions;$('session-enrollment').onchange=()=>{$('schedule-member').value=$('session-enrollment').value;updateProgress()};$('schedule-member').onchange=()=>{$('session-enrollment').value=$('schedule-member').value;updateProgress()};$('week-start').onchange=renderWeeklySchedule;
$('weekly-schedule').onclick=ev=>{const slot=ev.target.closest('button[data-slot-date]');if(!slot)return;$('session-date').value=slot.dataset.slotDate;setTimeOptions();$('session-time').value=slot.dataset.slotTime;slotPicked=true;$('selected-slot').textContent=slot.dataset.slotDate+' '+slot.dataset.slotTime+' 선택됨';$('session-form').scrollIntoView({behavior:'smooth',block:'center'});message(slot.dataset.slotDate+' '+slot.dataset.slotTime+' 수업을 등록합니다.');};
$('session-form').onsubmit=async ev=>{ev.preventDefault();const id=Number($('session-enrollment').value),e=enrollments.find(x=>x.id===id),duration=Number($('session-duration').value),start=$('session-time').value;if(!e){message('등록 회원을 선택하세요.');return}if(!slotPicked){message('주간 수업 시간표에서 빈 시간 칸을 선택하세요.');return}const used=sessions.filter(s=>s.enrollment_id===id).reduce((n,s)=>n+s.quantity,0);if(used+1>e.session_count){message('등록한 수업 수를 초과합니다.');return}const {error}=await db.from('completed_sessions').insert({enrollment_id:id,trainer_id:e.trainer_id,session_date:$('session-date').value,starts_at:start,duration_minutes:duration,quantity:1});if(error){message('수업 저장 실패: '+error.message);return}slotPicked=false;$('selected-slot').textContent='시간표의 빈 칸을 선택하세요.';message('수업을 기록했습니다. '+(used+1)+'/'+e.session_count+'회 진행');await load()};
$('trainer-form').onsubmit=async ev=>{ev.preventDefault();const id=$('trainer-email').value.trim().toLowerCase();const {error}=await db.from('trainers').insert({name:$('trainer-name').value.trim(),login_id:id||null,share_rate:Number($('trainer-share').value)/100,base_salary:Number($('trainer-base').value),sort_order:Math.max(0,...trainers.map(t=>t.sort_order||0))+1,active:true});if(error){message('트레이너 추가 실패: '+error.message);return}ev.target.reset();message('트레이너를 추가했습니다. 로그인 사용자는 Supabase에서 '+staffEmail(id)+' 주소로 발급해야 합니다.');await load()};
$('trainer-list').onclick=async ev=>{const save=ev.target.closest('button[data-save-trainer]'),toggle=ev.target.closest('button[data-trainer-id]');if(!save&&!toggle)return;const id=Number((save||toggle).dataset.saveTrainer||(save||toggle).dataset.trainerId),t=trainers.find(x=>x.id===id);const values=save?{share_rate:Number(document.querySelector('[data-share="'+id+'"]').value)/100,base_salary:Number(document.querySelector('[data-base="'+id+'"]').value)}:{active:!t.active};const {error}=await db.from('trainers').update(values).eq('id',id);message(error?'트레이너 변경 실패: '+error.message:'트레이너 설정을 저장했습니다.');if(!error)await load()};
$('month').value=today().slice(0,7);$('registered').value=today();$('session-date').value=today();$('week-start').value=weekValue(today());setTimeOptions();show();

