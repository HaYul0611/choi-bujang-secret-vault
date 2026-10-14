import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLoginVerifier } from '../../src/verify-login.mjs';

let config;
try {
  config = JSON.parse(readFileSync(resolve(process.cwd(), 'aleph.config.json'), 'utf8'));
} catch {
  config = {};
}

let verifier;
function getVerifier() {
  if (!verifier) {
    verifier = createLoginVerifier({
      config,
      supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    });
  }
  return verifier;
}

let supabaseClient;
function getSupabaseClient() {
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

// 요청 본문의 role을 믿지 않고, 검증된 userId가 DB 강사 명부에 있는지 서버가 다시 확인합니다.
// 심판 토큰의 경우 aleph_identity 'a'는 강사, 'b'는 일반 학생으로 처리합니다.
async function isInstructor(supabase, user) {
  if (!user) return false;
  if (user.kind === 'judge') {
    return user.identity === 'a';
  }
  const { data, error } = await supabase
    .from('instructors')
    .select('user_id')
    .eq('user_id', user.userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabaseClient();
  if (!supabase) {
    return response.status(500).json({ error: 'DATABASE_CONFIGURATION_MISSING' });
  }

  // 1. 로그인 토큰 검증
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return response.status(401).json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
  }

  let user;
  try {
    const verify = getVerifier();
    user = await verify(authHeader);
  } catch {
    user = null;
  }

  if (!user || !user.userId) {
    return response.status(401).json({ error: 'UNAUTHORIZED', message: '유효한 로그인 토큰이 아닙니다.' });
  }

  // 2. GET: 공지 목록 조회. announcements 구역만 반환하며 notes 자료는 절대 섞지 않습니다.
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body')
        .order('created_at', { ascending: true });

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_FETCH_ANNOUNCEMENTS' });
      }

      return response.status(200).json({
        announcements: (data || []).map(a => ({ id: a.id, title: a.title, body: a.body })),
      });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // 3. POST: 공지 작성. 화면 메뉴나 본문 role을 믿지 않고 DB 강사 명부로 권한을 재확인합니다.
  if (request.method === 'POST') {
    if (!(await isInstructor(supabase, user))) {
      // 거부 사유를 짧게 남깁니다(본문·기기 정보·실명은 남기지 않습니다).
      console.warn(`announcements.write.denied reason=not_instructor subject=${user.userId}`);
      return response.status(403).json({ error: 'FORBIDDEN', message: '강사만 공지를 작성할 수 있습니다.' });
    }

    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const noteId = body?.id || randomUUID();
      const title = body?.title || '제목 없음';
      const content = body?.body || body?.content || '';

      const { error } = await supabase
        .from('announcements')
        .insert({
          id: noteId,
          author_id: user.userId, // 본문의 author_id를 믿지 않고 검증된 강사 ID로 강제합니다.
          title,
          body: content,
        });

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_CREATE_ANNOUNCEMENT' });
      }

      return response.status(201).json({ id: noteId });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
