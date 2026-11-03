import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://cbxltnyccjzptqkmtsqf.supabase.co','sb_publishable_jDZmnxr0T23ubpMI72BLGA_grGTXqIY');
const $=id=>document.getElementById(id);
const mobileDays=document.createElement('div');mobileDays.id='mobile-days';mobileDays.className='mobile-days';$('weekly-schedule').before(mobileDays);
const dailyActions=document.createElement('div');dailyActions.id='daily-actions';dailyActions.className='daily-actions';$('weekly-schedule').closest('.card').querySelector('.schedule-legend').after(dailyActions);
const archivePanel=document.createElement('section');archivePanel.id='archive-panel';archivePanel.className='card';archivePanel.innerHTML='<h2 id="archive-heading">월별 수업 기록</h2><p id="archive-status" class="note"></p><button id="archive-month" type="button">이달 기록 저장</button><div id="archive-admin"></div>';$('sessions-panel').prepend(archivePanel);
const weekControls=document.createElement('div');weekControls.className='week-controls';weekControls.innerHTML='<div><label for="week-year">연도</label><select id="week-year"></select></div><div><label for="week-month">월</label><select id="week-month"></select></div><div><label for="week-number">몇째 주</label><select id="week-number"></select></div>';$('week-start').closest('.field').after(weekControls);$('week-start').closest('.field').classList.add('hidden');
const won=n=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(Math.round(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const monthRange=()=>{const start=$('month').value+'-01',d=new Date(start+'T12:00:00');d.setMonth(d.getMonth()+1);return [start,new Intl.DateTimeFormat('en-CA').format(d)]};
const inMonth=(date,start,end)=>date&&date>=start&&date<end;
const net=e=>e.payment_method==='card'?Number(e.price)/1.1:e.payment_method==='cash'?Number(e.price):0;
const staffEmail=id=>id.toLowerCase()+'@staff.motivegym.co.kr';
async function accountAction(body){
 const {data,error}=await db.functions.invoke('trainer-accounts',{body});
 if(error){let detail;try{detail=await error.context?.json()}catch{}throw new Error(detail?.error||error.message||'계정 처리 실패')}
 if(data?.error)throw new Error(data.error);
 return data;
}
let user=null,admin=false,ownTrainer=null,trainers=[],enrollments=[],sessions=[],closedMonths=[],dailyConfirmations=[],monthlyArchives=[],editingEnrollmentId=null,selectedMemberFileId=null,slotPicked=false,pendingLessons=[],mobileDate=today();
const isClosed=date=>closedMonths.includes(String(date).slice(0,7));
const isPastMonth=date=>String(date).slice(0,7)<today().slice(0,7);
const selectedMonth=()=>$('week-year').value+'-'+String($('week-month').value).padStart(2,'0');
const isSelectedMonthDate=date=>String(date).slice(0,7)===selectedMonth();
const isArchived=(date,trainerId)=>monthlyArchives.some(x=>x.month.slice(0,7)===String(date).slice(0,7)&&x.trainer_id===trainerId);
const isDayFixed=(date,trainerId)=>dailyConfirmations.some(x=>x.session_date===date&&x.trainer_id===trainerId);
const lessonLocked=(date,trainerId)=>isClosed(date)||isDayFixed(date,trainerId)||isArchived(date,trainerId)||(!admin&&(isPastMonth(date)||selectedMonth()!==today().slice(0,7)));
const message=s=>$('msg').textContent=s;
const availableEnrollment=e=>e.status!=='refunded'&&!e.removed_at;
const usedSessions=e=>sessions.filter(s=>s.enrollment_id===e.id).reduce((n,s)=>n+Number(s.quantity),0);
const refundEstimate=e=>Math.round(Number(e.price)*Math.max(0,Number(e.session_count)-usedSessions(e))/Number(e.session_count));
const empty=(id,cols)=>$(id).innerHTML='<tr><td colspan="'+cols+'" class="muted">내역이 없습니다.</td></tr>';
const mins=t=>{let [h,m]=String(t||'00:00').slice(0,5).split(':').map(Number);return h*60+m};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const dateText=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dateAdd=(date,days)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return dateText(d)};
function updateEnrollmentEndDate(){
 const registered=$('registered').value,count=Number($('sessions').value);
 $('ends').value=registered&&Number.isInteger(count)&&count>0?dateAdd(registered,count*4):'';
}
const koreanDay=date=>Number(String(date).slice(5,7))+'월 '+Number(String(date).slice(8,10))+'일';
const mondayOf=date=>{const d=new Date(date+'T12:00:00'),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return dateText(d)};
const weekValue=date=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+4-(d.getDay()||7));const year=d.getFullYear(),first=new Date(year,0,1,12),week=Math.ceil((((d-first)/86400000)+1)/7);return year+'-W'+String(week).padStart(2,'0')};
const mondayFromWeek=week=>{if(!week)return mondayOf(today());const [year,no]=week.split('-W').map(Number),jan4=new Date(year,0,4),offset=(jan4.getDay()+6)%7;jan4.setDate(jan4.getDate()-offset+(no-1)*7);return dateText(jan4)};
function refreshWeekNumbers(selectedStart){const year=Number($('week-year').value),month=Number($('week-month').value),monthStart=year+'-'+String(month).padStart(2,'0')+'-01',first=mondayOf(monthStart),last=dateText(new Date(year,month,0,12)),weeks=[];for(let start=first;start<=last;start=dateAdd(start,7))weeks.push(start);$('week-number').innerHTML=weeks.map((start,i)=>{const from=start<monthStart?monthStart:start,end=dateAdd(start,6),to=end>last?last:end,label=from.slice(5).replace('-','/')+(from===to?'':'~'+to.slice(5).replace('-','/'));return '<option value="'+start+'">'+(i+1)+'째 주 · '+label+'</option>'}).join('');$('week-number').value=weeks.includes(selectedStart)?selectedStart:weeks[0]}
function initializeWeekPicker(){const current=new Date(today()+'T12:00:00').getFullYear(),selected=mondayFromWeek($('week-start').value),year=current,month=Number(today().slice(5,7));$('week-year').innerHTML=Array.from({length:51},(_,i)=>2020+i).map(y=>'<option value="'+y+'">'+y+'년</option>').join('');$('week-month').innerHTML=Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'월</option>').join('');$('week-year').value=String(year);$('week-month').value=String(month);refreshWeekNumbers(selected)}
const statusClass=remaining=>remaining<=2?'low':remaining<=5?'caution':'good';
async function savePendingDay(date){
 if(!isSelectedMonthDate(date)||(!admin&&selectedMonth()>today().slice(0,7))){message('현재 월의 수업만 저장할 수 있습니다.');return false}
 if(isClosed(date)){message('월 정산이 확정되어 이 달 수업을 변경할 수 없습니다.');return false}
 const rows=pendingLessons.filter(x=>x.date===date);
 if(!rows.length){message('저장할 수업을 먼저 선택하세요.');return false}
 for(const row of rows){
  const enrollment=enrollments.find(e=>e.id===row.enrollmentId);
  if(!enrollment||!availableEnrollment(enrollment)||Number(enrollment.contract_duration_minutes)!==row.duration){message('회원의 등록 상태와 계약 수업 시간을 확인해 주세요.');return false}
 }
 const month=date.slice(0,7);
 for(const trainerId of new Set(rows.filter(x=>x.sessionType==='service').map(x=>x.trainerId))){
  const saved=sessions.filter(s=>s.trainer_id===trainerId&&s.session_date.startsWith(month)&&s.session_type==='service').length;
  const queued=rows.filter(x=>x.trainerId===trainerId&&x.sessionType==='service').length;
  if(saved+queued>10){message('트레이너별 서비스 수업은 월 10회까지입니다.');return false}
 }
 for(const row of rows){
  if(isArchived(date,row.trainerId)||(!admin&&isPastMonth(date))){message('월 기록이 보관되어 수정할 수 없습니다.');return false}
  const service=row.sessionType==='service';
  const {error}=await db.from('completed_sessions').insert({enrollment_id:row.enrollmentId,trainer_id:row.trainerId,session_date:row.date,starts_at:row.time,duration_minutes:row.duration,attendance_status:service?'attended':row.attendanceStatus||'attended',session_type:service?'service':'regular',quantity:service?0:1});
  if(error){message('수업 저장 실패: '+error.message);return false}
 }
 pendingLessons=pendingLessons.filter(x=>x.date!==date);
 message(date+' 수업 '+rows.length+'건을 저장했습니다.');
 await load();return true
}
function openMemberPicker(date, time, editingSession = null) {
  if (!isSelectedMonthDate(date)) { message('선택한 월의 날짜만 편집할 수 있습니다.'); return; }
  if (lessonLocked(date, editingSession?.trainer_id || ownTrainer?.id)) {
    message('확정된 수업일 또는 보관된 월의 수업은 변경할 수 없습니다.');
    return;
  }
  let picker = $('member-picker');
  if (!picker) {
    picker = document.createElement('dialog');
    picker.id = 'member-picker';
    document.body.append(picker);
  }
  const queuedLesson = pendingLessons.find(x => x.date === date && x.time === time);
  const allowed = enrollments.filter(e => availableEnrollment(e) && (admin || e.trainer_id === ownTrainer?.id) && e.payment_method);
  let selectedEnrollmentId = editingSession?.enrollment_id || queuedLesson?.enrollmentId || null;
  let sessionType = editingSession?.session_type || queuedLesson?.sessionType || null;
  let attendanceStatus = editingSession?.attendance_status || queuedLesson?.attendanceStatus || 'attended';
  const chosen = () => allowed.find(e => e.id === selectedEnrollmentId);
  if (selectedEnrollmentId && !chosen()) { selectedEnrollmentId = null; sessionType = null; }
  const lessonLength = e => Number(e?.contract_duration_minutes || 0);
  const serviceUsage = () => {
    const trainerId = chosen()?.trainer_id || ownTrainer?.id;
    return sessions.filter(s => s.trainer_id === trainerId && s.session_date.startsWith(date.slice(0, 7)) && s.session_type === 'service').length;
  };
  const memberList = allowed.map(e => {
    const used = sessions.filter(s => s.enrollment_id === e.id).reduce((n, s) => n + Number(s.quantity), 0);
    const remaining = Math.max(0, Number(e.session_count) - used);
    const length = lessonLength(e);
    const unavailable = !length || (time.endsWith(':30') && length === 50);
    const detail = !length ? '계약 시간 미설정 · 관리자 설정 필요' : time.endsWith(':30') && length === 50 ? '50분 계약 · 정시 칸에서 선택' : length + '분 · ' + (used + 1) + '/' + e.session_count + ' 예정 · ' + remaining + '회 남음';
    return '<button type="button" data-pick-member="' + e.id + '" class="' + statusClass(remaining) + (unavailable ? ' unavailable' : '') + (selectedEnrollmentId === e.id ? ' selected' : '') + '"><b>' + esc(e.member_name) + '</b><span>' + esc(detail) + '</span></button>';
  }).join('') || '<p>선택 가능한 회원이 없습니다.</p>';
  const choiceMarkup = () => {
    const e = chosen();
    if (!e) return '<p class="note">먼저 위에서 회원을 선택하세요.</p>';
    const minutes = lessonLength(e);
    if (!minutes) return '<p class="note">관리자가 이 등록의 계약 수업 시간을 먼저 설정해야 합니다.</p>';
    if (time.endsWith(':30') && minutes === 50) return '<p class="note">50분 계약 수업은 정시 칸에서 선택하세요.</p>';
    const options = [
      {kind: 'regular', status: 'attended', label: minutes === 30 ? 'PT' : '수업'},
      {kind: 'regular', status: 'no_show', label: 'NOSHOW (차감)'},
      {kind: 'service', status: 'attended', label: '서비스'}
    ];
    return '<p class="note">' + esc(e.member_name) + ' · 계약 ' + minutes + '분 수업</p><div class="duration-choice">' + options.map(option => {
      const active = sessionType === option.kind && attendanceStatus === option.status;
      return '<button type="button" data-pick-kind="' + option.kind + '" data-pick-attendance="' + option.status + '" aria-pressed="' + active + '" class="' + (active ? 'active' : '') + '">' + minutes + '분 ' + option.label + '</button>';
    }).join('') + '</div><p class="note">서비스: 회원 회차 차감 없음 · 수당 없음 · 트레이너별 월 10회 · 이번 달 ' + serviceUsage() + '/10회</p>';
  };
  const pendingCount = () => pendingLessons.filter(x => x.date === date).length;
  picker.innerHTML = '<style>#member-picker{border:0;border-radius:12px;padding:20px;width:min(460px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 18px 50px #0005}#member-picker::backdrop{background:#0007}.member-picker-list{max-height:min(35vh,320px);overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;display:grid;gap:8px}.member-picker-list button{display:flex;width:100%;justify-content:space-between;align-items:center;text-align:left;padding:12px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#222;gap:8px}.member-picker-list button:disabled{opacity:.55;cursor:not-allowed}.member-picker-list button.selected{background:#fff0e6;border-color:#ff5b1f;outline:3px solid #ff5b1f;outline-offset:-3px;box-shadow:0 0 0 4px #ff5b1f55;font-weight:800}.member-picker-list button span{font-size:11px;text-align:right}.member-picker-list button.good{border-left:7px solid #36a65d}.member-picker-list button.caution{border-left:7px solid #e6b800}.member-picker-list button.low{border-left:7px solid #de4040}.duration-choice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.duration-choice button{width:100%;border:1px solid #bbb;border-radius:6px;padding:10px;background:#fff;color:#222}.duration-choice button[data-pick-attendance="no_show"]{border-style:dashed}.duration-choice button.active{background:#ff5b1f;color:#fff;border-color:#ff5b1f}.dialog-actions{display:flex;justify-content:flex-end;gap:8px}.close,.confirm{border:0;border-radius:5px;padding:8px 12px}.close{background:#333;color:#fff}.confirm{background:#ff5b1f;color:#fff}</style>' +
    '<div class="dialog-actions"><button type="button" class="close" data-close>닫기</button><button type="button" class="confirm" data-confirm-day>' + (editingSession ? '변경 저장' : '확인 · ' + pendingCount() + '건 저장') + '</button></div>' +
    '<h2>' + date + ' ' + time + (editingSession ? ' 수업 변경' : ' 수업 선택') + '</h2><p>회원을 먼저 고른 뒤 수업 종류를 선택하세요.</p><div class="member-picker-list">' + memberList + '</div><div id="lesson-choices">' + choiceMarkup() + '</div><p id="picker-selection" role="status">' + (chosen() ? '선택한 회원: ' + esc(chosen().member_name) : '회원을 선택하세요.') + '</p>';
  picker.querySelector('style').textContent += '.member-picker-list button{display:block}.member-picker-list button b,.member-picker-list button span{display:block;text-align:left}.member-picker-list button span{margin-top:5px;font-size:12px}.member-picker-list button.unavailable{border-style:dashed}';
  picker.onclick = async ev => {
    if (ev.target.closest('[data-close]')) { picker.close(); return; }
    if (ev.target.closest('[data-confirm-day]')) {
      if (editingSession) {
        const e = chosen();
        if (!e || ![30, 50].includes(lessonLength(e)) || !sessionType) { message('회원과 계약 수업 시간을 확인한 뒤 수업 종류를 선택하세요.'); return; }
        const {error} = await db.from('completed_sessions').update({
          enrollment_id: e.id, trainer_id: e.trainer_id, duration_minutes: lessonLength(e),
          attendance_status: sessionType === 'service' ? 'attended' : attendanceStatus,
          session_type: sessionType, quantity: sessionType === 'service' ? 0 : 1
        }).eq('id', editingSession.id);
        if (error) { message('수업 변경 실패: ' + error.message); return; }
        picker.close(); message('수업 내용을 변경했습니다.'); await load(); return;
      }
      if (!pendingCount()) { message('회원과 수업 종류를 먼저 선택하세요.'); return; }
      if (await savePendingDay(date)) picker.close();
      return;
    }
    const memberButton = ev.target.closest('button[data-pick-member]');
    if (memberButton) {
      const nextId = Number(memberButton.dataset.pickMember);
      if (selectedEnrollmentId !== nextId) {
        selectedEnrollmentId = nextId;
        sessionType = null;
        attendanceStatus = 'attended';
        if (!editingSession) {
          pendingLessons = pendingLessons.filter(x => x.date !== date || x.time !== time);
          renderWeeklySchedule(); renderDaily();
        }
      }
      picker.querySelectorAll('[data-pick-member]').forEach(x => x.classList.toggle('selected', Number(x.dataset.pickMember) === nextId));
      picker.querySelector('#lesson-choices').innerHTML = choiceMarkup();
      picker.querySelector('#picker-selection').textContent = '선택한 회원: ' + chosen().member_name + (lessonLength(chosen()) ? ' · 계약 ' + lessonLength(chosen()) + '분' : ' · 계약 시간 미설정');
      picker.querySelector('[data-confirm-day]').textContent = editingSession ? '변경 저장' : '확인 · ' + pendingCount() + '건 저장';
      return;
    }
    const choiceButton = ev.target.closest('button[data-pick-kind]');
    if (!choiceButton || !chosen()) return;
    sessionType = choiceButton.dataset.pickKind;
    attendanceStatus = sessionType === 'service' ? 'attended' : choiceButton.dataset.pickAttendance;
    if (!editingSession) {
      const row = {enrollmentId: chosen().id, trainerId: chosen().trainer_id, date, time,
        duration: lessonLength(chosen()), attendanceStatus, sessionType};
      const index = pendingLessons.findIndex(x => x.date === date && x.time === time);
      if (index >= 0) pendingLessons[index] = row; else pendingLessons.push(row);
      renderWeeklySchedule(); renderDaily();
    }
    picker.querySelector('#lesson-choices').innerHTML = choiceMarkup();
    picker.querySelector('#picker-selection').textContent = '선택한 회원: ' + chosen().member_name + ' · ' + time + ' · ' + lessonLength(chosen()) + '분 · ' + (sessionType === 'service' ? '서비스' : attendanceStatus === 'no_show' ? 'NOSHOW (차감)' : '정규수업');
    picker.querySelector('[data-confirm-day]').textContent = editingSession ? '변경 저장' : '확인 · ' + pendingCount() + '건 저장';
    if (!editingSession) message(date + ' ' + time + ' 수업을 저장 대기 목록에 추가했습니다.');
  };
  picker.showModal();
}
function updateProgress(){const e=enrollments.find(x=>x.id===Number($('session-enrollment').value));if(!e){$('progress-state').textContent='회원 선택 후 진행 회차와 남은 수업 수를 확인할 수 있습니다.';$('progress-state').className='progress-state';return}const used=sessions.filter(s=>s.enrollment_id===e.id).reduce((n,s)=>n+Number(s.quantity),0),remaining=Math.max(0,Number(e.session_count)-used);$('progress-state').textContent=(used+1)+'/'+e.session_count+'회 진행 예정 · '+remaining+'회 남음';$('progress-state').className='progress-state '+statusClass(remaining);}
function renderWeeklySchedule(){
 const start=mondayFromWeek($('week-start').value), days=['월','화','수','목','금','토','일'], dates=days.map((_,i)=>dateAdd(start,i));
 const visibleDates=dates.filter(isSelectedMonthDate);
 $('mobile-days').style.gridTemplateColumns='repeat('+visibleDates.length+',minmax(0,1fr))';
 if(!visibleDates.includes(mobileDate))mobileDate=visibleDates[0];
 $('mobile-days').innerHTML=dates.map((date,i)=>isSelectedMonthDate(date)?'<button type="button" data-mobile-date="'+date+'" aria-pressed="'+(mobileDate===date)+'">'+days[i]+'<small>'+date.slice(5).replace('-','/')+'</small></button>':'').join('');
 const times=[];for(let min=540;min<=1320;min+=60)times.push(clock(min));
 const header='<thead><tr><th>시작 시간</th>'+dates.map((d,i)=>{if(!isSelectedMonthDate(d))return '<th class="outside-month mobile-other"></th>';const dayRows=sessions.filter(s=>s.session_date===d&&(admin||s.trainer_id===ownTrainer?.id)),count=dayRows.length,queued=pendingLessons.filter(s=>s.date===d).length,dayTrainers=[...new Set(dayRows.map(s=>s.trainer_id))],confirmed=admin?dayTrainers.filter(id=>isDayFixed(d,id)).length:isDayFixed(d,ownTrainer?.id),state=admin?(count?'수업 '+count+'건 · 확정 '+confirmed+'/'+dayTrainers.length+'명':''):queued?'대기 '+queued+'건':count?(confirmed?'확정 · ':'수업 ')+count+'건':'';return '<th class="'+(d===mobileDate?'mobile-active selected-day':'mobile-other')+'"><button type="button" class="schedule-day" data-mobile-date="'+d+'" aria-pressed="'+(d===mobileDate)+'"><span>'+days[i]+' '+d.slice(5).replace('-','/')+'</span>'+(state?'<small>'+state+'</small>':'')+'</button></th>'}).join('')+'</tr></thead>';
 const body=times.map(time=>'<tr><td class="time">'+time+'</td>'+dates.map(date=>{const mobileClass=date===mobileDate?'mobile-active':'mobile-other';
   if(!isSelectedMonthDate(date))return '<td class="closed outside-month '+mobileClass+'"></td>';
   const day=new Date(date+'T12:00:00').getDay(),minute=mins(time),closing=day===0?1080:day===6?960:1380,opening=day===0||day===6?600:540;
   if(minute<opening||minute>=closing)return '<td class="closed '+mobileClass+'"></td>';
   const half=clock(minute+30),lessonAt=slot=>sessions.find(x=>x.session_date===date&&String(x.starts_at||'').slice(0,5)===slot)||(()=>{const p=pendingLessons.find(x=>x.date===date&&x.time===slot);return p?{pending:true,enrollment_id:p.enrollmentId,trainer_id:p.trainerId,duration_minutes:p.duration,attendance_status:p.attendanceStatus||'attended',session_type:p.sessionType||'regular',quantity:p.sessionType==='service'?0:1,session_date:date,starts_at:slot}:null})(),first=lessonAt(time),second=lessonAt(half);
   const card=(s,slot)=>{if(!s)return lessonLocked(date,ownTrainer?.id)?'<span class="schedule-slot" title="정산 확정">🔒</span>':'<button type="button" class="schedule-slot" data-slot-date="'+date+'" data-slot-time="'+slot+'">＋</button>';const e=enrollments.find(x=>x.id===s.enrollment_id),sequence=s.pending?sessions.filter(x=>x.enrollment_id===s.enrollment_id).reduce((n,x)=>n+Number(x.quantity),0)+1:sessionNo(s.enrollment_id,s),total=Number(e?.session_count||0),remaining=Math.max(0,total-sequence);return '<button type="button" class="schedule-class '+(Number(s.duration_minutes)===30?'thirty ':'')+statusClass(remaining)+(s.pending?' pending':'')+(s.session_type==='service'?' service':s.attendance_status==='no_show'?' no-show':' regular')+'" '+(s.pending?'data-slot-date="'+date+'" data-slot-time="'+slot+'"':'data-edit-session="'+s.id+'"')+' '+(lessonLocked(date,s.trainer_id)?'disabled title="수업일 확정 또는 월 정산 확정"':'')+'><small>'+esc(e?.member_name||'회원')+(s.session_type==='service'?' · 서비스':s.attendance_status==='no_show'?' · NOSHOW · '+sequence+'/'+total:' · 정규 · '+sequence+'/'+total)+(s.pending?' · 저장 대기':'')+'</small>'+slot+' · '+(s.duration_minutes||50)+'분'+(lessonLocked(date,s.trainer_id)?' 🔒':'')+'</button>'};
   if(!first&&!second)return '<td class="'+mobileClass+'">'+card(null,time)+'</td>';
   if(first&&Number(first.duration_minutes)!==30)return '<td class="'+mobileClass+'">'+card(first,time)+'</td>';
   return '<td class="hour-split '+mobileClass+'" style="padding:0"><div style="height:50%;border-bottom:1px solid #ddd">'+card(first,time)+'</div><div style="height:50%">'+card(second,half)+'</div></td>';
 }).join('')+'</tr>').join('');
 $('weekly-schedule').innerHTML=header+'<tbody>'+body+'</tbody>';
}
function renderDaily(){
 if(admin){$('daily-actions').innerHTML='';return}
 const date=mobileDate,ownId=ownTrainer?.id,count=sessions.filter(s=>s.session_date===date&&s.trainer_id===ownId).length,queued=pendingLessons.filter(x=>x.date===date).length,fixed=isDayFixed(date,ownId),readOnly=isClosed(date)||isArchived(date,ownId)||isPastMonth(date)||selectedMonth()<today().slice(0,7),disabled=fixed||readOnly||date>today()||count===0||queued>0;
 $('daily-actions').innerHTML='<button type="button" data-confirm-date="'+date+'" '+(disabled?'disabled':'')+'>'+(fixed?koreanDay(date)+' 확정 완료':readOnly?koreanDay(date)+' 읽기 전용':koreanDay(date)+' 수업 확정하고 퇴근하기')+'</button>';
}
function renderArchive(){const month=$('week-year').value+'-'+String($('week-month').value).padStart(2,'0'),ownId=ownTrainer?.id,archived=monthlyArchives.find(x=>x.month.slice(0,7)===month&&x.trainer_id===ownId),rows=sessions.filter(s=>s.session_date.startsWith(month)&&(admin||s.trainer_id===ownId)),serviceCount=rows.filter(s=>s.session_type==='service').length,unfixed=rows.some(s=>!isDayFixed(s.session_date,s.trainer_id)),past=isPastMonth(month),queued=pendingLessons.some(x=>x.date.startsWith(month));$('archive-heading').textContent=month.slice(0,4)+'년 '+Number(month.slice(5))+'월 수업 기록';$('archive-month').classList.toggle('hidden',admin);$('archive-month').disabled=admin||!!archived||isClosed(month)||month>today().slice(0,7)||rows.length===0||queued||(!past&&!isClosed(month)&&unfixed);$('archive-month').textContent=archived?'월 기록 보관 완료':'이달 기록 저장';$('archive-status').textContent=admin?'트레이너별 월 보관 현황':archived?'보관 완료 · '+archived.session_count+'회 · 수업 수당 '+won(archived.payout_total)+' · 읽기 전용':isClosed(month)?'급여정산 확정 · 읽기 전용 · '+rows.length+'건':past?'지난달 기록 · 읽기 전용'+(rows.length?' · '+rows.length+'건':''):month>today().slice(0,7)?'예정된 월 · 아직 기록할 수 없습니다':rows.length+'건 기록 · '+(unfixed?'일별 수업 확정 후 월 기록을 저장하세요':'월 기록을 저장하면 읽기 전용으로 보관됩니다');$('archive-admin').innerHTML=admin?'<div class="scroll"><table><thead><tr><th>트레이너</th><th>수업</th><th>월 보관</th></tr></thead><tbody>'+trainers.filter(t=>t.active).map(t=>{const entry=monthlyArchives.find(x=>x.month.slice(0,7)===month&&x.trainer_id===t.id);return '<tr><td>'+esc(t.name)+'</td><td>'+rows.filter(s=>s.trainer_id===t.id).length+'건</td><td>'+(entry?'보관 완료':'미보관')+'</td></tr>'}).join('')+'</tbody></table></div>':'';if(!admin)$('archive-status').textContent+=' · 서비스 '+serviceCount+'/10회'}
function sessionNo(id,session){
 const list=sessions.filter(s=>s.enrollment_id===id).sort((a,b)=>(a.session_date+(a.starts_at||'' )).localeCompare(b.session_date+(b.starts_at||''))||a.id-b.id);
 if(!session)return list.reduce((n,s)=>n+s.quantity,0)+1;
 let total=0;for(const item of list){total+=item.quantity;if(item.id===session.id)break}return total;
}
function setTimeOptions(){
 const date=$('session-date').value||today(),dow=new Date(date+'T12:00:00').getDay();
 const [opens,closes]=dow===0?[600,1080]:dow===6?[600,960]:[540,1380],duration=Number($('session-duration').value||50),old=$('session-time').value;
 const times=[];for(let time=opens;time+duration<=closes;time+=(duration===30?30:60))times.push(clock(time));
 $('session-time').innerHTML=times.map(t=>'<option value="'+t+'">'+t+'</option>').join('');
 if(times.includes(old))$('session-time').value=old;
 $('hours').textContent=(dow===0?'일요일 10:00–18:00':dow===6?'토요일 10:00–16:00':'평일 09:00–23:00')+' · '+duration+'분 수업을 기록합니다.';
}
function view(name){for(const [button,panel] of [['dashboard','dashboard'],['sessions','sessions-panel'],['trainers','trainers-panel']]){$('tab-'+button).setAttribute('aria-selected',String(button===name));$(panel).classList.toggle('hidden',button!==name)}}
function renderRenewalCharts(start){
 const months=Array.from({length:6},(_,i)=>{const d=new Date(start+'T12:00:00');d.setMonth(d.getMonth()-5+i);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')});
 $('six-month').innerHTML=trainers.map(t=>{
  const points=months.map(key=>{const rows=enrollments.filter(e=>e.trainer_id===t.id&&e.registered_at?.startsWith(key)),total=rows.length,renew=rows.filter(e=>e.is_renewal).length;return {key,total,renew,rate:total?Math.round(100*renew/total):null}});
  const total=points.reduce((sum,p)=>sum+p.total,0),renew=points.reduce((sum,p)=>sum+p.renew,0);
  const bars=points.map(p=>{
   const label=p.total?p.key+' 등록 '+p.total+'건 중 재등록 '+p.renew+'건, '+p.rate+'%':p.key+' 등록 기록 없음';
   return '<div class="renewal-month'+(p.total?'':' no-data')+'" role="listitem" aria-label="'+label+'"><span class="renewal-value">'+(p.total?p.rate+'%':'—')+'</span><div class="renewal-plot" aria-hidden="true"><span class="renewal-fill" style="height:'+(p.total?Math.max(4,p.rate):4)+'%"></span></div><strong>'+p.key.slice(2).replace('-','.')+'</strong><small>'+(p.total?p.renew+'/'+p.total+'건':'등록 없음')+'</small></div>';
  }).join('');
  return '<section class="renewal-chart" aria-label="'+esc(t.name)+' 재등록률"><div class="renewal-chart-head"><h3>'+esc(t.name)+'</h3><span>'+(total?'6개월 재등록 '+renew+'/'+total+'건 · '+Math.round(100*renew/total)+'%':'6개월 등록 기록 없음')+'</span></div><div class="renewal-bars" role="list">'+bars+'</div></section>';
 }).join('')||'<p class="muted">트레이너가 없습니다.</p>';
}
function renderEvaluationChart(start,end){
 const first=new Date(start+'T12:00:00');first.setMonth(first.getMonth()-5);const since=dateText(first);
 const nameKey=e=>e.member_name.trim().toLocaleLowerCase();
 const results=trainers.map(t=>{
  const ended=enrollments.filter(e=>e.trainer_id===t.id&&e.status!=='refunded'&&e.ends_at>=since&&e.ends_at<end&&e.ends_at<=today());
  const success=ended.filter(e=>enrollments.some(next=>next.id!==e.id&&next.trainer_id===t.id&&next.is_renewal&&nameKey(next)===nameKey(e)&&next.registered_at>e.registered_at&&next.registered_at<=today()&&next.registered_at<=dateAdd(e.ends_at,30))).length;
  const failure=ended.length-success;
  const refunds=enrollments.filter(e=>e.trainer_id===t.id&&e.refunded_at>=since&&e.refunded_at<end).length;
  return {name:t.name,success,failure,refunds};
 });
 const maximum=Math.max(1,...results.flatMap(r=>[r.success,r.failure,r.refunds*1.5]));
 $('evaluation-chart').innerHTML=results.map(r=>{
  const bars=[['success',r.success,r.success],['failure',r.failure,r.failure],['refund',r.refunds,r.refunds*1.5]].map(([kind,count,weighted])=>'<div class="evaluation-column '+kind+'" aria-label="'+(kind==='success'?'재등록 성공':kind==='failure'?'재등록 실패':'환불')+' '+count+'건'+(kind==='refund'?' · 평가 가중치 '+weighted:'')+'"><strong>'+count+'</strong><span class="bar" style="height:'+(weighted?Math.max(4,Math.round(weighted/maximum*115)):0)+'px"></span></div>').join('');
  return '<section class="evaluation-trainer" aria-label="'+esc(r.name)+' 평가"><h3>'+esc(r.name)+'</h3><div class="evaluation-bars">'+bars+'</div><div class="evaluation-labels"><span>성공</span><span>실패</span><span>환불</span></div><p>종료 '+(r.success+r.failure)+'건 · 환불 '+r.refunds+'건 · 가중 환불 '+(r.refunds*1.5)+'건</p></section>';
 }).join('')||'<p class="muted">트레이너가 없습니다.</p>';
}
function renderMemberFiles(){
 const query=$('member-search').value.trim().toLocaleLowerCase(),showRemoved=$('show-removed').checked;
 const rows=enrollments.filter(e=>(showRemoved||!e.removed_at)&&(!query||(e.member_name+' '+(trainers.find(t=>t.id===e.trainer_id)?.name||e.trainer_name||'')).toLocaleLowerCase().includes(query)));
 $('enrollment-list').innerHTML=rows.map(e=>{
  const state=e.removed_at?'<span class="status-badge removed">삭제됨</span>':e.status==='refunded'?'<span class="status-badge refunded">환불</span>':'<span class="status-badge">이용 중</span>';
  return '<tr><td>'+e.registered_at+'</td><td>'+esc(e.member_name)+'</td><td>'+esc(trainers.find(t=>t.id===e.trainer_id)?.name||e.trainer_name)+'</td><td>'+e.session_count+'회</td><td>'+(e.contract_duration_minutes?e.contract_duration_minutes+'분':'<strong>미설정</strong>')+'</td><td>'+(e.ends_at||'미입력')+'</td><td>'+(e.is_renewal?'재등록':'신규')+'</td><td>'+(e.payment_method==='card'?'카드':e.payment_method==='cash'?'현금':'미지정')+'</td><td>'+won(e.price)+'</td><td>'+state+'</td><td><button class="small secondary" data-enrollment-id="'+e.id+'">보기·수정</button></td></tr>';
 }).join('');
 if(!rows.length)empty('enrollment-list',11);
}
function render(){
 if(!admin)$('month').value=$('week-year').value+'-'+String($('week-month').value).padStart(2,'0');
 const [start,end]=monthRange(),monthly=enrollments.filter(e=>inMonth(e.registered_at,start,end)),refunded=enrollments.filter(e=>inMonth(e.refunded_at,start,end)),completed=sessions.filter(s=>inMonth(s.session_date,start,end));
 $('settlement-state').textContent=isClosed(start)?'정산 확정 · 수업 수정 잠김':'정산 전 · 수업 수정 가능';$('finalize-month').disabled=isClosed(start);$('finalize-month').textContent=isClosed(start)?'확정 완료':'급여정산 확정';
 if(admin){
  const renew=monthly.filter(e=>e.is_renewal).length;
  $('sales').textContent=won(monthly.reduce((n,e)=>n+Number(e.price),0)-refunded.reduce((n,e)=>n+Number(e.refund_amount||0),0));$('count').textContent=monthly.length+'건 등록';$('refund-total').textContent=won(refunded.reduce((n,e)=>n+Number(e.refund_amount||0),0));$('refund-count').textContent='조회 월 환불 '+refunded.length+'건';
  $('new').textContent=new Set(monthly.filter(e=>!e.is_renewal).map(e=>e.member_name)).size;
  $('ended').textContent=new Set(enrollments.filter(e=>availableEnrollment(e)&&inMonth(e.ends_at,start,end)).map(e=>e.member_name)).size;
  $('rate').textContent=monthly.length?Math.round(100*renew/monthly.length)+'%':'0%';
  $('summary').innerHTML=trainers.map(t=>{let es=monthly.filter(e=>e.trainer_id===t.id),rs=refunded.filter(e=>e.trainer_id===t.id),ss=completed.filter(s=>s.trainer_id===t.id),noShow=ss.filter(s=>s.attendance_status==='no_show').reduce((n,s)=>n+Number(s.quantity),0),service=ss.filter(s=>s.session_type==='service').length,commission=ss.reduce((n,s)=>n+Number(s.payout_amount),0);return '<tr><td>'+esc(t.name)+'</td><td>'+won(es.reduce((n,e)=>n+Number(e.price),0)-rs.reduce((n,e)=>n+Number(e.refund_amount||0),0))+'</td><td>'+ss.reduce((n,s)=>n+Number(s.quantity),0)+'회'+(noShow?' · NOSHOW '+noShow+'회':'')+(service?' · 서비스 '+service+'회':'')+'</td><td>'+won(commission+Number(t.base_salary))+'</td><td>'+(es.length?Math.round(100*es.filter(e=>e.is_renewal).length/es.length):0)+'%</td></tr>'}).join('')||'<tr><td colspan="5">트레이너 없음</td></tr>';
  renderMemberFiles();
  $('trainer-list').innerHTML=trainers.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.login_id)+'</td><td>'+(t.auth_user_id?(t.password_change_required?'비밀번호 변경 필요':'발급 완료'):'미발급')+'</td><td><input aria-label="'+esc(t.name)+' 초기화 비밀번호" type="password" minlength="6" maxlength="72" value="111111" data-initial="'+t.id+'"></td><td><input aria-label="'+esc(t.name)+' 정산 비율" type="number" min="0" max="100" value="'+Math.round(Number(t.share_rate)*100)+'" data-share="'+t.id+'"></td><td><input aria-label="'+esc(t.name)+' 기본급" type="number" min="0" value="'+Number(t.base_salary)+'" data-base="'+t.id+'"></td><td>'+(t.active?'사용':'비활성')+'</td><td><button class="small secondary" data-reset-trainer="'+t.id+'">계정 초기화</button> <button class="small" data-save-trainer="'+t.id+'">저장</button> <button class="small secondary" data-trainer-id="'+t.id+'">'+(t.active?'비활성화':'복구')+'</button></td></tr>').join('');
  renderRenewalCharts(start);
  renderEvaluationChart(start,end);
 }
 const allowed=enrollments.filter(e=>availableEnrollment(e)&&(admin||e.trainer_id===ownTrainer?.id)&&e.payment_method);
 const enrollmentOptions='<option value="">선택하세요</option>'+allowed.filter(e=>e.trainer_id).map(e=>{const used=sessions.filter(s=>s.enrollment_id===e.id).reduce((n,s)=>n+Number(s.quantity),0),next=used+1;return '<option value="'+e.id+'" '+(next>e.session_count?'disabled':'')+'>'+esc(e.member_name)+' · '+next+'/'+e.session_count+(next>e.session_count?' (완료)':'')+'</option>'}).join('');$('session-enrollment').innerHTML=enrollmentOptions;$('schedule-member').innerHTML=enrollmentOptions;
 $('trainer').innerHTML='<option value="">선택하세요</option>'+trainers.filter(t=>t.active).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
 const own=admin?completed:completed.filter(s=>s.trainer_id===ownTrainer?.id),todayRows=own.filter(s=>s.session_date===today()),trainer=admin?null:trainers.find(t=>t.id===ownTrainer?.id),monthlyPay=own.reduce((n,s)=>n+Number(s.payout_amount),0)+(trainer?Number(trainer.base_salary):0);
 const totalOf=rows=>rows.reduce((n,s)=>n+Number(s.quantity),0),noShowOf=rows=>totalOf(rows.filter(s=>s.attendance_status==='no_show')),serviceOf=rows=>rows.filter(s=>s.session_type==='service').length;
 $('today-count').textContent=totalOf(todayRows)+'회';$('today-date').textContent=today()+' · 실제 '+(totalOf(todayRows)-noShowOf(todayRows))+'회 · NOSHOW '+noShowOf(todayRows)+'회 · 서비스 '+serviceOf(todayRows)+'회';$('today-pay').textContent=won(todayRows.reduce((n,s)=>n+Number(s.payout_amount),0));$('month-count').textContent=totalOf(own)+'회';$('month-breakdown').textContent='실제 '+(totalOf(own)-noShowOf(own))+'회 · NOSHOW '+noShowOf(own)+'회 · 서비스 '+serviceOf(own)+'회';$('month-pay').textContent=won(monthlyPay);$('base-note').textContent=trainer&&Number(trainer.base_salary)?'기본급 '+won(trainer.base_salary)+' 포함':'수업 수당 기준';
 setTimeOptions();renderWeeklySchedule();renderDaily();renderArchive();updateProgress();
}
async function fetchMonthSessions(){const month=selectedMonth(),start=month+'-01',end=dateText(new Date(Number(month.slice(0,4)),Number(month.slice(5)),1,12)),rows=[];for(let offset=0;offset<100000;offset+=1000){const result=await db.from('completed_sessions').select('*').gte('session_date',start).lt('session_date',end).order('session_date',{ascending:false}).range(offset,offset+999);if(result.error)return result;rows.push(...result.data);if(result.data.length<1000)break}return {data:rows,error:null}}
async function load(){
 const [tr,en,se,cl,dc,ma]=await Promise.all([db.from('trainers').select('*').order('sort_order'),db.from('member_enrollments').select('*').order('registered_at',{ascending:false}).limit(5000),db.from('completed_sessions').select('*').order('session_date',{ascending:false}).limit(5000),db.from('monthly_settlements').select('month'),db.from('daily_confirmations').select('session_date,trainer_id,confirmed_at').order('session_date',{ascending:false}).limit(5000),db.from('trainer_monthly_archives').select('month,trainer_id,session_count,payout_total,saved_at').order('month',{ascending:false}).limit(5000)]);
 const error=tr.error||en.error||se.error||cl.error||dc.error||ma.error;if(error){message('데이터를 불러오지 못했습니다: '+error.message);return}
 const page=await fetchMonthSessions();if(page.error){message('월별 수업을 불러오지 못했습니다: '+page.error.message);return}
 trainers=tr.data||[];enrollments=en.data||[];sessions=[...new Map([...(se.data||[]),...page.data].map(s=>[s.id,s])).values()];closedMonths=(cl.data||[]).map(x=>x.month.slice(0,7));dailyConfirmations=dc.data||[];monthlyArchives=ma.data||[];ownTrainer=trainers.find(t=>t.login_id&&staffEmail(t.login_id)===user.email?.toLowerCase());
 const missing=[...new Set(page.data.map(s=>s.enrollment_id))].filter(id=>!enrollments.some(e=>e.id===id));for(let i=0;i<missing.length;i+=100){const extra=await db.from('member_enrollments').select('*').in('id',missing.slice(i,i+100));if(extra.error){message('과거 회원 정보를 불러오지 못했습니다: '+extra.error.message);return}enrollments.push(...extra.data)}
 render();
}
async function show(){
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;
 $('password-panel').classList.add('hidden');
 if(!user){$('login').classList.remove('hidden');$('app').classList.add('hidden');return}
 admin=user.id==='99446214-0f1e-409f-a8c9-efef0ad29075';
 if(!admin){
  let state;try{state=await accountAction({action:'status'})}catch(error){await db.auth.signOut();message('계정 확인 실패: '+error.message);$('login').classList.remove('hidden');$('app').classList.add('hidden');return}
  if(state.mustChange){$('login').classList.add('hidden');$('app').classList.add('hidden');$('password-panel').classList.remove('hidden');$('password-guide').textContent='초기 비밀번호로 로그인했습니다. 수업 기록을 보기 전에 새 비밀번호를 설정하세요.';$('password-cancel').classList.add('hidden');return}
  const loginId=user.email?.toLowerCase().endsWith('@staff.motivegym.co.kr')?user.email.toLowerCase().split('@')[0]:'';const {data,error}=await db.from('trainers').select('id,name,login_id,active').eq('login_id',loginId).eq('active',true).maybeSingle();if(error||!data){await db.auth.signOut();message('등록된 직원 계정이 아닙니다. 관리자에게 계정 연결을 요청하세요.');$('login').classList.remove('hidden');$('app').classList.add('hidden');return}ownTrainer=data
 }
 $('login').classList.add('hidden');$('app').classList.remove('hidden');$('change-password-trigger').classList.toggle('hidden',admin);document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!admin));$('heading').textContent=admin?'센터 관리':'수업 기록';$('who').textContent=admin?'관리자':ownTrainer.name+' 트레이너';view(admin?'dashboard':'sessions');await load();
}
function openMemberFile(id){
 if(!admin)return;
 const e=enrollments.find(x=>x.id===id);if(!e)return;
 selectedMemberFileId=id;$('refund-box').classList.add('hidden');$('refund-amount').value='';$('refund-error').textContent='';
 const used=usedSessions(e),remaining=Math.max(0,Number(e.session_count)-used),lessonRows=sessions.filter(s=>s.enrollment_id===id).sort((a,b)=>b.session_date.localeCompare(a.session_date));
 $('member-file-title').textContent=e.member_name+' · 회원 등록 파일';
 $('member-file-detail').innerHTML='<dl><dt>담당 트레이너</dt><dd>'+esc(trainers.find(t=>t.id===e.trainer_id)?.name||e.trainer_name)+'</dd><dt>등록일 · 종료일</dt><dd>'+e.registered_at+' · '+(e.ends_at||'미입력')+'</dd><dt>수업</dt><dd>'+e.contract_duration_minutes+'분 · '+used+'/'+e.session_count+'회 사용 · '+remaining+'회 남음</dd><dt>결제</dt><dd>'+won(e.price)+' · '+(e.payment_method==='card'?'카드':e.payment_method==='cash'?'현금':'미지정')+'</dd><dt>등록 구분</dt><dd>'+(e.is_renewal?'재등록':'신규')+'</dd><dt>상태</dt><dd>'+(e.removed_at?'삭제됨':e.status==='refunded'?'환불 완료':'이용 중')+'</dd>'+(e.status==='refunded'?'<dt>환불 내역</dt><dd>'+e.refunded_at+' · '+won(e.refund_amount)+' · 당시 '+e.refund_used_sessions+'회 사용</dd>':'')+'</dl><h3>수업 기록 · '+lessonRows.length+'건</h3><div class="scroll"><table><thead><tr><th>수업일</th><th>시작</th><th>구분</th><th>수당</th></tr></thead><tbody>'+lessonRows.map(s=>'<tr><td>'+s.session_date+'</td><td>'+String(s.starts_at).slice(0,5)+'</td><td>'+(s.session_type==='service'?'서비스':s.attendance_status==='no_show'?'NOSHOW':'정규')+'</td><td>'+won(s.payout_amount)+'</td></tr>').join('')+'</tbody></table></div>';
 $('file-edit').disabled=!availableEnrollment(e);$('file-refund').disabled=!availableEnrollment(e);$('file-remove').disabled=!!e.removed_at;
 $('refund-guide').textContent='사용 '+used+'회 · 남은 '+remaining+'회 · 단순 회차 비례 참고액 '+won(refundEstimate(e))+'입니다. 실제 환불액은 계약과 적용 기준을 확인해 직접 입력하세요. 이 화면은 환불 내역만 기록하며 카드 취소·송금은 별도로 진행해야 합니다. 완료 수업 수당은 유지됩니다.';
 $('member-file').showModal();
}
function beginMemberEdit(){
 const e=enrollments.find(x=>x.id===selectedMemberFileId);if(!e||!availableEnrollment(e))return;
 const hasLessons=sessions.some(s=>s.enrollment_id===e.id),settled=isClosed(e.registered_at),lockTerms=hasLessons||settled;
 editingEnrollmentId=e.id;$('member').value=e.member_name;$('trainer').value=e.trainer_id||'';$('registered').value=e.registered_at;$('ends').value=e.ends_at||'';$('sessions').value=e.session_count;$('contract-duration').value=e.contract_duration_minutes||'';$('price').value=e.price;$('payment').value=e.payment_method||'';$('type').value=e.is_renewal?'renewal':'new';
 for(const id of ['trainer','registered','sessions','contract-duration','price','payment'])$(id).disabled=lockTerms;
 $('type').disabled=settled;$('enrollment-form').querySelector('button').textContent='수정 내역 저장';$('member-file').close();$('enrollment-form').scrollIntoView({behavior:'smooth'});
 message(lockTerms?'기록이 있는 계약은 이름·종료일 등 수정 가능한 항목만 변경할 수 있습니다.':'회원 등록 내용을 수정 중입니다.');
}
$('login-form').onsubmit=async ev=>{ev.preventDefault();const id=$('email').value.trim(),email=id.includes('@')?id:staffEmail(id);const {error}=await db.auth.signInWithPassword({email,password:$('password').value});$('password').value='';if(error)message('로그인 정보를 확인해 주세요.');else{message('');await show()}};
$('change-password-trigger').onclick=()=>{$('app').classList.add('hidden');$('password-panel').classList.remove('hidden');$('password-guide').textContent='현재 비밀번호를 확인하고 새 비밀번호를 설정하세요.';$('password-cancel').classList.remove('hidden');$('password-error').textContent='';$('current-password').focus()};
$('password-cancel').onclick=()=>{$('change-password-form').reset();$('password-panel').classList.add('hidden');$('app').classList.remove('hidden')};
$('change-password-form').onsubmit=async ev=>{ev.preventDefault();const current=$('current-password').value,next=$('new-password').value,confirm=$('confirm-password').value;if(next!==confirm){$('password-error').textContent='새 비밀번호가 서로 다릅니다.';return}if(next.length<8||next==='111111'||next===current){$('password-error').textContent='새 비밀번호는 8자 이상이며 초기·현재 비밀번호와 달라야 합니다.';return}try{await accountAction({action:'change_password',currentPassword:current,newPassword:next})}catch(error){$('password-error').textContent=error.message;return}ev.target.reset();await db.auth.signOut();await show();message('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인하세요.')};
$('logout').onclick=async()=>{await db.auth.signOut();await show()};
for(const name of ['dashboard','sessions','trainers'])$('tab-'+name).onclick=()=>view(name);
$('refresh').onclick=()=>load();$('month').onchange=render;
$('enrollment-form').onsubmit=async ev=>{ev.preventDefault();const tid=Number($('trainer').value),trainer=trainers.find(t=>t.id===tid);if(!trainer){message('담당 트레이너를 확인하세요.');return}if($('ends').value<$('registered').value){message('종료일은 등록일 이후로 입력하세요.');return}const record={member_name:$('member').value.trim(),trainer_id:tid,trainer_name:trainer.name,registered_at:$('registered').value,ends_at:$('ends').value,session_count:Number($('sessions').value),contract_duration_minutes:Number($('contract-duration').value),price:Number($('price').value),payment_method:$('payment').value,is_renewal:$('type').value==='renewal'};const result=editingEnrollmentId?await db.from('member_enrollments').update(record).eq('id',editingEnrollmentId):await db.from('member_enrollments').insert(record);if(result.error){message('등록 저장 실패: '+result.error.message);return}editingEnrollmentId=null;ev.target.reset();for(const field of ev.target.querySelectorAll('input,select'))field.disabled=false;$('registered').value=today();ev.target.querySelector('button').textContent='등록 내역 저장';message('등록 내역을 저장했습니다.');await load()};
$('enrollment-list').onclick=ev=>{const b=ev.target.closest('button[data-enrollment-id]');if(b)openMemberFile(Number(b.dataset.enrollmentId))};
$('member-search').oninput=renderMemberFiles;$('show-removed').onchange=renderMemberFiles;
$('file-close').onclick=()=>$('member-file').close();
$('file-edit').onclick=beginMemberEdit;
$('file-refund').onclick=()=>{$('refund-box').classList.toggle('hidden')};
$('refund-submit').onclick=async()=>{const e=enrollments.find(x=>x.id===selectedMemberFileId),amount=Number($('refund-amount').value);if(!e||!availableEnrollment(e))return;if($('refund-amount').value===''||!Number.isInteger(amount)||amount<0||amount>Number(e.price)){$('refund-error').textContent='환불액을 0원부터 결제 금액까지 원 단위로 입력하세요.';return}if(!window.confirm(e.member_name+' 회원에게 '+won(amount)+' 환불을 기록할까요? 남은 수업은 중단되고 완료된 수업 수당은 유지됩니다.'))return;const {error}=await db.rpc('refund_member_enrollment',{p_enrollment_id:e.id,p_amount:amount});if(error){$('refund-error').textContent='환불 처리 실패: '+error.message;return}pendingLessons=pendingLessons.filter(x=>x.enrollmentId!==e.id);$('member-file').close();message(e.member_name+' 환불 '+won(amount)+'을 기록했습니다.');await load()};
$('file-remove').onclick=async()=>{const e=enrollments.find(x=>x.id===selectedMemberFileId);if(!e||e.removed_at)return;if(!window.confirm(e.member_name+' 회원 파일을 목록에서 숨길까요? 기록과 매출은 보존되며, 환불이 필요하면 먼저 환불 처리하세요.'))return;const {error}=await db.rpc('hide_member_enrollment',{p_enrollment_id:e.id});if(error){message('삭제 처리 실패: '+error.message);return}pendingLessons=pendingLessons.filter(x=>x.enrollmentId!==e.id);$('member-file').close();message(e.member_name+' 회원 파일을 숨겼습니다. 삭제된 기록 표시에서 확인할 수 있습니다.');await load()};
$('registered').addEventListener('input',updateEnrollmentEndDate);
$('registered').addEventListener('change',updateEnrollmentEndDate);
$('sessions').addEventListener('input',updateEnrollmentEndDate);
$('session-date').onchange=()=>{setTimeOptions();slotPicked=false;$('selected-slot').textContent='시간표의 빈 칸을 선택하세요.'};$('session-duration').onchange=setTimeOptions;$('session-enrollment').onchange=()=>{$('schedule-member').value=$('session-enrollment').value;updateProgress()};$('schedule-member').onchange=()=>{$('session-enrollment').value=$('schedule-member').value;updateProgress()};$('week-start').onchange=()=>{mobileDate=mondayFromWeek($('week-start').value);renderWeeklySchedule();renderDaily()};
$('weekly-schedule').onclick=ev=>{const day=ev.target.closest('button[data-mobile-date]');if(day){mobileDate=day.dataset.mobileDate;renderWeeklySchedule();renderDaily();return}const edit=ev.target.closest('button[data-edit-session]');if(edit){const s=sessions.find(x=>x.id===Number(edit.dataset.editSession));if(s)openMemberPicker(s.session_date,String(s.starts_at||'').slice(0,5),s);return}const slot=ev.target.closest('button[data-slot-date]');if(!slot)return;openMemberPicker(slot.dataset.slotDate,slot.dataset.slotTime)};
$('mobile-days').onclick=ev=>{const button=ev.target.closest('[data-mobile-date]');if(!button)return;mobileDate=button.dataset.mobileDate;renderWeeklySchedule();renderDaily()};
const chooseWeek=()=>{const start=$('week-number').value;mobileDate=start;$('week-start').value=weekValue(start);const month=$('week-year').value+'-'+String($('week-month').value).padStart(2,'0'),url=new URL(location.href);url.searchParams.set('month',month);history.replaceState(null,'',url);render()};
$('week-year').onchange=async()=>{refreshWeekNumbers();chooseWeek();await load()};$('week-month').onchange=async()=>{refreshWeekNumbers();chooseWeek();await load()};$('week-number').onchange=chooseWeek;
$('daily-actions').onclick=async ev=>{const button=ev.target.closest('[data-confirm-date]');if(!button)return;const date=button.dataset.confirmDate;if(admin||!isSelectedMonthDate(date)||isPastMonth(date)||isArchived(date,ownTrainer?.id)||date>today()||isClosed(date)||isDayFixed(date,ownTrainer?.id)||pendingLessons.some(x=>x.date===date))return;if(!window.confirm(koreanDay(date)+' 수업을 확정하고 퇴근할까요? 이 날짜의 수업만 잠기며 다른 날짜는 계속 입력·수정할 수 있습니다.'))return;const {error}=await db.from('daily_confirmations').insert({session_date:date,trainer_id:ownTrainer.id});if(error){message('하루 수업 확정 실패: '+error.message);return}message(koreanDay(date)+' 수업을 확정했습니다. 다른 날짜는 계속 편집할 수 있습니다.');await load()};
$('archive-month').onclick=async()=>{if(admin)return;const month=$('week-year').value+'-'+String($('week-month').value).padStart(2,'0'),rows=sessions.filter(s=>s.trainer_id===ownTrainer.id&&s.session_date.startsWith(month));if(isClosed(month)||month>today().slice(0,7)||isArchived(month,ownTrainer.id)||!rows.length||pendingLessons.some(x=>x.date.startsWith(month))||(!isPastMonth(month)&&!isClosed(month)&&rows.some(s=>!isDayFixed(s.session_date,s.trainer_id))))return;if(!window.confirm(month+' 수업 기록을 보관할까요? 저장 후에는 해당 월 기록을 수정할 수 없습니다.'))return;const {error}=await db.from('trainer_monthly_archives').insert({month:month+'-01',trainer_id:ownTrainer.id});if(error){message('월 기록 저장 실패: '+error.message);return}message(month+' 수업 기록을 보관했습니다.');await load()};
$('session-form').onsubmit=async ev=>{ev.preventDefault();const id=Number($('session-enrollment').value),e=enrollments.find(x=>x.id===id),duration=Number($('session-duration').value),start=$('session-time').value;if(!e||!availableEnrollment(e)){message('이용 중인 등록 회원을 선택하세요.');return}if(!slotPicked){message('주간 수업 시간표에서 빈 시간 칸을 선택하세요.');return}const used=sessions.filter(s=>s.enrollment_id===id).reduce((n,s)=>n+s.quantity,0);if(used+1>e.session_count){message('등록한 수업 수를 초과합니다.');return}const {error}=await db.from('completed_sessions').insert({enrollment_id:id,trainer_id:e.trainer_id,session_date:$('session-date').value,starts_at:start,duration_minutes:duration,quantity:1});if(error){message('수업 저장 실패: '+error.message);return}slotPicked=false;$('selected-slot').textContent='시간표의 빈 칸을 선택하세요.';message('수업을 기록했습니다. '+(used+1)+'/'+e.session_count+'회 진행');await load()};
$('trainer-form').onsubmit=async ev=>{ev.preventDefault();const id=$('trainer-email').value.trim().toLowerCase(),initial=$('trainer-initial-password').value;try{await accountAction({action:'create',name:$('trainer-name').value.trim(),loginId:id,initialPassword:initial,shareRate:Number($('trainer-share').value)/100,baseSalary:Number($('trainer-base').value)})}catch(error){message('트레이너 계정 추가 실패: '+error.message);return}ev.target.reset();message('트레이너 계정 '+id+'을 발급했습니다. 첫 로그인에서 비밀번호 변경이 필요합니다.');await load()};
$('trainer-list').onclick=async ev=>{const reset=ev.target.closest('button[data-reset-trainer]'),save=ev.target.closest('button[data-save-trainer]'),toggle=ev.target.closest('button[data-trainer-id]');if(!reset&&!save&&!toggle)return;const id=Number(reset?.dataset.resetTrainer||save?.dataset.saveTrainer||toggle?.dataset.trainerId),t=trainers.find(x=>x.id===id);if(!t)return;if(reset){const initial=document.querySelector('[data-initial="'+id+'"]').value;if(initial.length<6){message('초기 비밀번호는 6자 이상이어야 합니다.');return}if(!window.confirm(t.name+' 트레이너의 로그인 비밀번호를 초기화할까요? 기존 비밀번호는 더 이상 사용할 수 없고, 첫 로그인 때 새 비밀번호를 설정해야 합니다.'))return;try{await accountAction({action:'reset',trainerId:id,initialPassword:initial})}catch(error){message('계정 초기화 실패: '+error.message);return}message(t.name+' 계정을 발급·초기화했습니다. 첫 로그인에서 비밀번호 변경이 필요합니다.');await load();return}const values=save?{share_rate:Number(document.querySelector('[data-share="'+id+'"]').value)/100,base_salary:Number(document.querySelector('[data-base="'+id+'"]').value)}:{active:!t.active};const {error}=await db.from('trainers').update(values).eq('id',id);message(error?'트레이너 변경 실패: '+error.message:'트레이너 설정을 저장했습니다.');if(!error)await load()};
$('session-form').closest('.card').classList.add('hidden');$('schedule-member').closest('.field').classList.add('hidden');$('refresh').insertAdjacentHTML('afterend','<span id="settlement-state" class="note admin-only"></span><button id="finalize-month" type="button" class="admin-only secondary">급여정산 확정</button>');$('finalize-month').onclick=async()=>{const month=$('month').value;if(isClosed(month))return;if(!window.confirm(month+' 월 급여정산을 확정할까요? 확정 후에는 해당 월 수업을 추가하거나 수정할 수 없습니다.'))return;const {error}=await db.from('monthly_settlements').insert({month:month+'-01'});if(error){message('정산 확정 실패: '+error.message);return}pendingLessons=pendingLessons.filter(x=>!x.date.startsWith(month));message(month+' 월 급여정산을 확정했습니다.');await load()};$('month').value=today().slice(0,7);$('registered').value=today();$('session-date').value=today();$('week-start').value=weekValue(today());initializeWeekPicker();const requestedMonth=new URL(location.href).searchParams.get('month');if(/^20(?:2[0-9]|[3-6][0-9]|70)-(0[1-9]|1[0-2])$/.test(requestedMonth||'')){$('week-year').value=requestedMonth.slice(0,4);$('week-month').value=String(Number(requestedMonth.slice(5)));refreshWeekNumbers();mobileDate=$('week-number').value;$('week-start').value=weekValue(mobileDate)}setTimeOptions();show();
setInterval(()=>{if(user&&$('password-panel').classList.contains('hidden')&&!document.activeElement?.closest('#trainer-form,#trainer-list,#enrollment-form,#member-file'))load()},15000);
