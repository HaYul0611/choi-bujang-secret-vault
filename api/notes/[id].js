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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabaseClient();
  if (!supabase) {
    return response.status(500).json({ error: 'DATABASE_CONFIGURATION_MISSING' });
  }

  // 요청 토큰 검증
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

  // GET: 단건 조회 (본인 메모만 허용)
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, body, owner_id')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '메모를 찾을 수 없습니다.' });
      }

      if (data.owner_id !== user.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
      }

      return response.status(200).json({
        id: data.id,
        title: data.title,
        body: data.body,
      });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // PUT: 메모 수정 (기존 행과 새 행 소유자가 모두 본인인지 확인)
  if (request.method === 'PUT') {
    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

      // 본문에서 타인으로 소유자를 변경하려는 시도 차단
      if (body?.owner_id !== undefined && body.owner_id !== user.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '소유자를 변경할 수 없습니다.' });
      }

      // 기존 행 조회 및 소유자 확인
      const { data: existing, error: fetchError } = await supabase
        .from('notes')
        .select('id, owner_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !existing) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '수정할 메모를 찾을 수 없습니다.' });
      }

      if (existing.owner_id !== user.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '본인의 메모만 수정할 수 있습니다.' });
      }

      const title = body?.title;
      const content = body?.body ?? body?.content;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.body = content;
      updateData.owner_id = user.userId;

      const { data, error } = await supabase
        .from('notes')
        .update(updateData)
        .eq('id', id)
        .eq('owner_id', user.userId)
        .select('id, title, body')
        .maybeSingle();

      if (error || !data) {
        return response.status(500).json({ error: 'FAILED_TO_UPDATE_NOTE' });
      }

      return response.status(200).json({
        id: data.id,
        title: data.title,
        body: data.body,
      });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // DELETE: 메모 삭제 (본인 메모만 삭제 허용)
  if (request.method === 'DELETE') {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('notes')
        .select('id, owner_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !existing) {
        return response.status(404).json({ error: 'NOT_FOUND', message: '삭제할 메모를 찾을 수 없습니다.' });
      }

      if (existing.owner_id !== user.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', message: '본인의 메모만 삭제할 수 있습니다.' });
      }

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.userId);

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_DELETE_NOTE' });
      }

      return response.status(200).json({ id, deleted: true });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
