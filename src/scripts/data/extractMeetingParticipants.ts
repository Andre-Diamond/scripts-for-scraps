import { fetchAllMeetingSummaries } from '@/lib/db/meetingSummaries';
import { extractUniqueNames, normalizeNames } from '@/scripts/utils/nameProcessor';
import { MeetingSummary, ScriptResult } from '@/scripts/schema/meetingSummary';

export async function extractMeetingParticipants(): Promise<ScriptResult<string[]>> {
  try {
    console.log('Starting to extract meeting participants...');

    // Fetch all meeting summaries
    const summaries = await fetchAllMeetingSummaries();
    console.log(`Retrieved ${summaries.length} meeting summaries`);

    // Extract and collect all peoplePresent strings
    const allParticipants = new Set<string>();

    summaries.forEach((summary: MeetingSummary) => {
      try {
        if (summary.summary && summary.summary.meetingInfo) {
          const peoplePresent = summary.summary.meetingInfo.peoplePresent;
          if (peoplePresent) {
            const names = extractUniqueNames(peoplePresent);
            names.forEach(name => allParticipants.add(name));
          }
        }
      } catch (err) {
        console.warn(`Skipping malformed summary (ID: ${summary.id}):`, err);
      }
    });

    // Convert to array, normalize names, and sort alphabetically
    const uniqueParticipants = normalizeNames([...allParticipants]).sort((a, b) => a.localeCompare(b));

    // Log results
    console.log('\nUnique Participants Found:', uniqueParticipants.length);
    console.log('----------------------------');
    uniqueParticipants.forEach(name => console.log(name));

    return {
      success: true,
      message: `Successfully extracted ${uniqueParticipants.length} unique participants`,
      data: uniqueParticipants
    };

  } catch (error) {
    console.error('Error extracting meeting participants:', error);
    return {
      success: false,
      message: 'Failed to extract meeting participants',
      error: error as Error
    };
  }
}