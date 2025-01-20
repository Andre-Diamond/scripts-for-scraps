import { supabase } from '@/lib/supabaseClient';
import { MeetingSummary } from '@/scripts/schema/meetingSummary';

export async function fetchAllMeetingSummaries(): Promise<MeetingSummary[]> {
  const { data, error } = await supabase
    .from('meetingsummaries')
    .select('*');

  if (error) {
    throw new Error(`Error fetching meeting summaries: ${error.message}`);
  }

  return data as MeetingSummary[];
}