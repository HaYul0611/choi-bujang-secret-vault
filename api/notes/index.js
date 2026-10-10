import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLoginVerifier } from '../src/verify-login.mjs';

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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response.status(500).json({ error: 'DATABASE_CONFIGURATION_MISSING' });
  }

  // 1. 요청 토큰 검증
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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // GET: 메모 목록 조회
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, body, owner_id')
        .or(`owner_id.eq.${user.userId},owner_id.is.null`)
        .order('created_at', { ascending: true });

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_FETCH_NOTES' });
      }

      return response.status(200).json({
        notes: (data || []).map(n => ({ id: n.id, title: n.title, body: n.body }))
      });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // POST: 새 메모 생성
  if (request.method === 'POST') {
    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const noteId = body?.id || randomUUID();
      const title = body?.title || '제목 없음';
      const content = body?.body || body?.content || '';

      const { error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          owner_id: user.userId,
          title,
          body: content,
        });

      if (error) {
        return response.status(500).json({ error: 'FAILED_TO_CREATE_NOTE' });
      }

      return response.status(201).json({ id: noteId });
    } catch {
      return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
