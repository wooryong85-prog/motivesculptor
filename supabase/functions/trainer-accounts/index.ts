import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicDb = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const adminDb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const adminId = '99446214-0f1e-409f-a8c9-efef0ad29075';
const staffEmail = (id: string) => `${id}@staff.motivegym.co.kr`;

function answer(body: Record<string, unknown>, status = 200, origin = '') {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ['https://motivegym.co.kr', 'https://www.motivegym.co.kr'].includes(origin) ? origin : 'https://motivegym.co.kr',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  } });
}

async function findAuthUser(email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await adminDb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find(user => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return answer({}, 204, origin);
  if (req.method !== 'POST') return answer({ error: 'POST 요청만 허용합니다.' }, 405, origin);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return answer({ error: '로그인이 필요합니다.' }, 401, origin);
  const { data: auth, error: authError } = await publicDb.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return answer({ error: '로그인이 만료되었습니다.' }, 401, origin);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  try {
    if (action === 'status' || action === 'change_password') {
      if (user.id === adminId) return answer({ error: '트레이너 계정만 사용할 수 있습니다.' }, 403, origin);
      const { data: trainer, error } = await adminDb.from('trainers')
        .select('id,login_id,active,password_change_required').eq('auth_user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!trainer || !trainer.active || user.email?.toLowerCase() !== staffEmail(trainer.login_id))
        return answer({ error: '등록된 트레이너 계정이 아닙니다.' }, 403, origin);
      if (action === 'status') return answer({ mustChange: trainer.password_change_required }, 200, origin);
      const current = String(body.currentPassword || '');
      const next = String(body.newPassword || '');
      if (next.length < 8 || next === current || next === '111111')
        return answer({ error: '새 비밀번호는 8자 이상이며 기존 비밀번호와 달라야 합니다.' }, 400, origin);
      const { error: checkError } = await publicDb.auth.signInWithPassword({ email: user.email!, password: current });
      if (checkError) return answer({ error: '현재 비밀번호가 맞지 않습니다.' }, 400, origin);
      const { error: updateError } = await adminDb.auth.admin.updateUserById(user.id, { password: next });
      if (updateError) throw updateError;
      const { error: rowError } = await adminDb.from('trainers').update({ password_change_required: false }).eq('id', trainer.id);
      if (rowError) throw rowError;
      return answer({ ok: true }, 200, origin);
    }

    if (user.id !== adminId) return answer({ error: '관리자만 계정을 발급할 수 있습니다.' }, 403, origin);
    const initial = String(body.initialPassword || '');
    if (initial.length < 6 || initial.length > 72)
      return answer({ error: '초기 비밀번호는 6자 이상 72자 이하로 입력하세요.' }, 400, origin);

    if (action === 'create') {
      const loginId = String(body.loginId || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const shareRate = Number(body.shareRate);
      const baseSalary = Number(body.baseSalary);
      if (!/^[a-z0-9_]{3,30}$/.test(loginId) || !name || name.length > 80 ||
          !Number.isFinite(shareRate) || shareRate < 0 || shareRate > 1 ||
          !Number.isInteger(baseSalary) || baseSalary < 0)
        return answer({ error: '이름·아이디·정산 설정을 확인하세요.' }, 400, origin);
      const { data: existing } = await adminDb.from('trainers').select('id').eq('login_id', loginId).maybeSingle();
      if (existing) return answer({ error: '이미 사용 중인 트레이너 아이디입니다.' }, 409, origin);
      const { data: created, error: createError } = await adminDb.auth.admin.createUser({
        email: staffEmail(loginId), password: initial, email_confirm: true,
      });
      if (createError || !created.user) return answer({ error: createError?.message || '로그인 계정을 만들지 못했습니다.' }, 400, origin);
      const { data: last } = await adminDb.from('trainers').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data: trainer, error: rowError } = await adminDb.from('trainers').insert({
        name, login_id: loginId, auth_user_id: created.user.id, password_change_required: true,
        share_rate: shareRate, base_salary: baseSalary, sort_order: Number(last?.sort_order || 0) + 1, active: true,
      }).select('id').single();
      if (rowError) {
        await adminDb.auth.admin.deleteUser(created.user.id);
        return answer({ error: '트레이너 저장 실패: ' + rowError.message }, 400, origin);
      }
      return answer({ ok: true, trainerId: trainer.id }, 200, origin);
    }

    if (action === 'reset') {
      const trainerId = Number(body.trainerId);
      if (!Number.isInteger(trainerId) || trainerId < 1) return answer({ error: '트레이너를 선택하세요.' }, 400, origin);
      const { data: trainer, error } = await adminDb.from('trainers')
        .select('id,login_id,auth_user_id').eq('id', trainerId).maybeSingle();
      if (error) throw error;
      if (!trainer?.login_id) return answer({ error: '로그인 아이디가 없는 트레이너입니다.' }, 400, origin);
      let authId = trainer.auth_user_id;
      if (!authId) authId = (await findAuthUser(staffEmail(trainer.login_id)))?.id || null;
      const { error: lockError } = await adminDb.from('trainers')
        .update({ password_change_required: true }).eq('id', trainer.id);
      if (lockError) throw lockError;
      if (authId) {
        const { error: resetError } = await adminDb.auth.admin.updateUserById(authId, { password: initial, email_confirm: true });
        if (resetError) throw resetError;
      } else {
        const { data: created, error: createError } = await adminDb.auth.admin.createUser({
          email: staffEmail(trainer.login_id), password: initial, email_confirm: true,
        });
        if (createError || !created.user) throw createError || new Error('계정 생성 실패');
        authId = created.user.id;
      }
      const { error: linkError } = await adminDb.from('trainers').update({ auth_user_id: authId }).eq('id', trainer.id);
      if (linkError) throw linkError;
      return answer({ ok: true, created: !trainer.auth_user_id }, 200, origin);
    }
    return answer({ error: '지원하지 않는 요청입니다.' }, 400, origin);
  } catch (error) {
    const detail = error && typeof error === 'object' && 'message' in error
      ? String(error.message) : '계정 처리 중 오류가 발생했습니다.';
    console.error('trainer-accounts failed:', detail);
    return answer({ error: detail }, 500, origin);
  }
});
