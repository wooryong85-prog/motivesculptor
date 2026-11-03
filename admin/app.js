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
let user=null,admin=false,ownTrainer=null,trainers=[],enrollments=[],sessions=[],editingEnrollmentId=null;
const message=s=>$('msg').textContent=s;
const empty=(id,cols)=>$(id).innerHTML='<tr><td colspan="'+cols+'" class="muted">내역이 없습니다.</td></tr>';
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
 }
 const allowed=enrollments.filter(e=>(admin||e.trainer_id===ownTrainer?.id)&&e.payment_method);
 $('session-enrollment').innerHTML='<option value="">선택하세요</option>'+allowed.filter(e=>e.trainer_id).map(e=>'<option value="'+e.id+'">'+esc(e.member_name)+' · '+esc(trainers.find(t=>t.id===e.trainer_id)?.name)+'</option>').join('');
 $('trainer').innerHTML='<option value="">선택하세요</option>'+trainers.filter(t=>t.active).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
 $('session-list').innerHTML=completed.map(s=>{let e=enrollments.find(x=>x.id===s.enrollment_id),t=trainers.find(x=>x.id===s.trainer_id);return '<tr><td>'+s.session_date+'</td><td>'+esc(e?.member_name)+'</td><td>'+esc(t?.name)+'</td><td>'+s.quantity+'</td><td>'+won(s.payout_amount)+'</td></tr>'}).join('');if(!$('session-list').innerHTML)empty('session-list',5);
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
$('session-form').onsubmit=async ev=>{ev.preventDefault();const id=Number($('session-enrollment').value),e=enrollments.find(x=>x.id===id),qty=Number($('session-qty').value);if(!e){message('등록 회원을 선택하세요.');return}const used=sessions.filter(s=>s.enrollment_id===id).reduce((n,s)=>n+s.quantity,0);if(used+qty>e.session_count){message('등록한 수업 수를 초과합니다.');return}const {error}=await db.from('completed_sessions').insert({enrollment_id:id,trainer_id:e.trainer_id,session_date:$('session-date').value,quantity:qty});if(error){message('수업 저장 실패: '+error.message);return}message('수업을 기록했습니다.');await load()};
$('trainer-form').onsubmit=async ev=>{ev.preventDefault();const id=$('trainer-email').value.trim().toLowerCase();const {error}=await db.from('trainers').insert({name:$('trainer-name').value.trim(),login_id:id||null,share_rate:Number($('trainer-share').value)/100,base_salary:Number($('trainer-base').value),sort_order:Math.max(0,...trainers.map(t=>t.sort_order||0))+1,active:true});if(error){message('트레이너 추가 실패: '+error.message);return}ev.target.reset();message('트레이너를 추가했습니다. 로그인 사용자는 Supabase에서 '+staffEmail(id)+' 주소로 발급해야 합니다.');await load()};
$('trainer-list').onclick=async ev=>{const save=ev.target.closest('button[data-save-trainer]'),toggle=ev.target.closest('button[data-trainer-id]');if(!save&&!toggle)return;const id=Number((save||toggle).dataset.saveTrainer||(save||toggle).dataset.trainerId),t=trainers.find(x=>x.id===id);const values=save?{share_rate:Number(document.querySelector('[data-share="'+id+'"]').value)/100,base_salary:Number(document.querySelector('[data-base="'+id+'"]').value)}:{active:!t.active};const {error}=await db.from('trainers').update(values).eq('id',id);message(error?'트레이너 변경 실패: '+error.message:'트레이너 설정을 저장했습니다.');if(!error)await load()};
$('month').value=today().slice(0,7);$('registered').value=today();$('session-date').value=today();show();

