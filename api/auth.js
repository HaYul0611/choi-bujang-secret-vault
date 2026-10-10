import { createClient } from '@supabase/supabase-js';

let supabaseClient;
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

function formatAuthError(message) {
  if (!message) return '인증 처리 중 오류가 발생했습니다.';
  const msg = message.toLowerCase();
  if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format') || msg.includes('valid') || msg.includes('syntax'))) {
    return '유효하지 않은 이메일 주소 형식입니다. 올바른 이메일을 입력해 주세요.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 일치하지 않습니다.';
  }
  if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('already in use')) {
    return '이미 등록된 이메일 주소입니다. 로그인 탭에서 로그인해 주세요.';
  }
  if (msg.includes('password') && (msg.includes('least 6') || msg.includes('characters') || msg.includes('short') || msg.includes('weak') || msg.includes('length'))) {
    return '비밀번호는 최소 6자 이상이어야 합니다.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (msg.includes('signups not allowed')) {
    return '현재 회원가입이 허용되지 않은 환경입니다.';
  }
  return message;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return response.status(500).json({ error: 'DATABASE_CONFIGURATION_MISSING' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const action = body?.action || 'login';
    const email = body?.email?.trim();
    const password = body?.password;

    if (action === 'reset_password') {
      if (!email) {
        return response.status(400).json({ error: '이메일 주소를 입력해 주세요.' });
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return response.status(400).json({ error: formatAuthError(error.message) });
      }
      return response.status(200).json({
        ok: true,
        message: '비밀번호 재설정 이메일이 발송되었습니다. 수신함을 확인해 주세요.',
      });
    }

    if (action === 'update_password') {
      const authHeader = request.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        return response.status(401).json({ error: '로그인 인증 세션이 만료되었습니다.' });
      }
      const currentPassword = body?.currentPassword;
      const newPassword = body?.newPassword || password;

      if (!currentPassword) {
        return response.status(400).json({ error: '현재 사용 중인 비밀번호를 입력해 주세요.' });
      }
      if (!newPassword || newPassword.length < 6) {
        return response.status(400).json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' });
      }
      if (currentPassword === newPassword) {
        return response.status(400).json({ error: '새 비밀번호는 기존 비밀번호와 달라야 합니다.' });
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return response.status(401).json({ error: '유효한 로그인 세션이 아닙니다.' });
      }

      // 1. 현재 비밀번호 검증
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        return response.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.' });
      }

      // 2. 새 비밀번호로 업데이트
      const { error: updateError } = await supabase.auth.admin.updateUserById(userData.user.id, {
        password: newPassword,
      });
      if (updateError) {
        return response.status(400).json({ error: formatAuthError(updateError.message) });
      }
      return response.status(200).json({
        ok: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      });
    }

    if (!email || !password) {
      return response.status(400).json({ error: '이메일과 비밀번호를 모두 입력해 주세요.' });
    }

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return response.status(401).json({ error: formatAuthError(error.message) });
      }
      return response.status(200).json({
        access_token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      });
    }

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return response.status(400).json({ error: formatAuthError(error.message) });
      }
      return response.status(200).json({
        access_token: data.session?.access_token || null,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    return response.status(400).json({ error: '유효하지 않은 요청(action)입니다.' });
  } catch (err) {
    return response.status(500).json({ error: err.message || '서버 인증 처리 오류' });
  }
}
