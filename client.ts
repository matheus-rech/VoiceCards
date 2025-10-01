import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database client singleton
let supabaseClient: SupabaseClient | null = null;

export function initializeDatabase(supabaseUrl: string, supabaseKey: string): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Key are required');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // MCP server doesn't need session persistence
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

export function getDatabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return supabaseClient;
}

// Helper function to execute raw SQL queries (for complex operations)
export async function executeQuery<T>(query: string, params?: any[]): Promise<T> {
  const db = getDatabase();
  const { data, error } = await db.rpc('execute_sql', { 
    query, 
    params 
  });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as T;
}
