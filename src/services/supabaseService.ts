import { supabase, supabaseUrl, supabaseKey } from './clients';

// Function to fetch meeting summaries from Supabase
export async function fetchMeetingSummariesFromSupabase() {
    console.log('Attempting to fetch data from Supabase...');

    // Logging Supabase connection details (omitting the key for security)
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase key available:', !!supabaseKey);

    // Verify Supabase client has been initialized properly
    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials are missing');
        throw new Error('Supabase credentials are missing. Check your environment variables.');
    }

    try {
        // Fetch data with detailed logging
        console.log('Executing Supabase query on meetingsummaries table...');
        const { data, error, status, statusText } = await supabase
            .from('meetingsummaries')
            .select('*')
            .eq('confirmed', true);

        console.log('Supabase response status:', status, statusText);

        if (error) {
            console.error('Supabase query error:', error);
            throw new Error(`Failed to fetch meeting summaries from Supabase: ${error.message}`);
        }

        console.log(`Successfully fetched ${data?.length || 0} records from Supabase`);

        if (!data || data.length === 0) {
            console.warn('No data returned from Supabase');
        }

        return data || [];
    } catch (err) {
        console.error('Exception during Supabase query:', err);
        throw err;
    }
} 