import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

// GitHub repository information
export const repoOwner = 'SingularityNET-Archive';
export const repoName = 'SingularityNET-Archive-GitBook';
export const branch = 'main';
export const timelinePath = 'timeline'; 