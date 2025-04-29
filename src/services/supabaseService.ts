import { supabase, supabaseUrl, supabaseKey } from './clients';
import { MeetingSummary } from '../../types';

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

// Function to update a meeting summary in Supabase
export async function updateSupabaseMeetingSummary(
    workgroup: string,
    meetingDate: string,
    updatedData: MeetingSummary
) {
    console.log('Attempting to update meeting summary in Supabase...');
    console.log('Workgroup:', workgroup);
    console.log('Meeting Date:', meetingDate);
    console.log('Workgroup ID:', updatedData.workgroup_id);

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials are missing');
        throw new Error('Supabase credentials are missing. Check your environment variables.');
    }

    try {
        // Find the existing record using workgroup_id from the GitBook data
        const { data: existingData, error: findError } = await supabase
            .from('meetingsummaries')
            .select('meeting_id')
            .eq('workgroup_id', updatedData.workgroup_id)
            .eq('date', meetingDate)
            .eq('confirmed', true)
            .single();

        if (findError) {
            console.error('Error finding existing record:', findError);
            throw new Error(`Failed to find existing meeting summary: ${findError.message}`);
        }

        if (!existingData) {
            throw new Error('No matching record found to update');
        }

        // Update the record
        const { error: updateError } = await supabase
            .from('meetingsummaries')
            .update({
                summary: updatedData,
                updated_at: new Date().toISOString(),
                confirmed: true  // Mark as confirmed since it's from GitBook
            })
            .eq('meeting_id', existingData.meeting_id);

        if (updateError) {
            console.error('Error updating record:', updateError);
            throw new Error(`Failed to update meeting summary: ${updateError.message}`);
        }

        console.log('Successfully updated meeting summary in Supabase');
        return true;

    } catch (err) {
        console.error('Exception during Supabase update:', err);
        throw err;
    }
} 