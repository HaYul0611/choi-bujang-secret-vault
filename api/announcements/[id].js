import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  const { id } = request.query;
  if (!id) {
    return response.status(400).json({ error: 'BAD_REQUEST', message: 'id 파라미터가 필요합니다.' });
  }

  // 2. GET: 공지 단건 조회. 로그인한 사용자는 공지 구역을 읽을 수 있습니다.
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '공지를 찾을 수 없습니다.' });
      }

      return response.status(200).json({ id: data.id, title: data.title, body: data.body });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // 쓰기 공통: 강사 권한을 DB 명부로 재확인합니다. 일반 학생의 공지 수정·삭제는 거부됩니다.
  if (request.method === 'PUT' || request.method === 'DELETE') {
    if (!(await isInstructor(supabase, user))) {
      console.warn(`announcements.write.denied reason=not_instructor subject=${user.userId}`);
      return response.status(403).json({ error: 'FORBIDDEN', message: '강사만 공지를 수정하거나 삭제할 수 있습니다.' });
    }
  }

  // 3. PUT: 공지 수정. 저장된 작성자(author_id)와 검증된 강사 ID가 일치해야 합니다.
  if (request.method === 'PUT') {
    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

      // 본문에서 작성자를 타인으로 바꾸려는 시도 차단
      if (body?.author_id !== undefined && body.author_id !== user.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '작성자를 변경할 수 없습니다.' });
      }

      const { data: existing, error: fetchError } = await supabase
        .from('announcements')
        .select('id, author_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !existing) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '수정할 공지를 찾을 수 없습니다.' });
      }

      const isAuthor = existing.author_id === user.userId
        || (user.kind === 'judge' && user.identity === 'a');

      if (!isAuthor) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '본인이 작성한 공지만 수정할 수 있습니다.' });
      }

      const title = body?.title;
      const content = body?.body ?? body?.content;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.body = content;
      updateData.author_id = user.userId;

      const { data, error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .eq('author_id', user.userId)
        .select('id, title, body')
        .maybeSingle();

      if (error || !data) {
        return response.status(500).json({ error: 'FAILED_TO_UPDATE_ANNOUNCEMENT' });
      }

      return response.status(200).json({ id: data.id, title: data.title, body: data.body });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // 4. DELETE: 공지 삭제. 저장된 작성자와 검증된 강사 ID가 일치해야 합니다.
  if (request.method === 'DELETE') {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('announcements')
        .select('id, author_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !existing) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '삭제할 공지를 찾을 수 없습니다.' });
      }

      const isAuthor = existing.author_id === user.userId
        || (user.kind === 'judge' && user.identity === 'a');

      if (!isAuthor) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '본인이 작성한 공지만 삭제할 수 있습니다.' });
      }

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)
        .eq('author_id', user.userId);

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_DELETE_ANNOUNCEMENT' });
      }

      return response.status(200).json({ id, deleted: true });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
