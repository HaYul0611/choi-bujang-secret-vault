import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl && !supabaseKey) {
    return response.status(500).json({ error: 'MISSING_BOTH_SUPABASE_URL_AND_SECRET_KEY' });
  }
  if (!supabaseUrl) {
    return response.status(500).json({ error: 'MISSING_SUPABASE_URL' });
  }
  if (!supabaseKey) {
    return response.status(500).json({ error: 'MISSING_SUPABASE_SECRET_KEY' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('notes')
      .select('title, content')
      .order('id', { ascending: true });

    if (error) {
      return response.status(500).json({ error: 'SUPABASE_QUERY_ERROR', details: error.message });
    }

    return response.status(200).json({ notes: data || [] });
  } catch (err) {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}
