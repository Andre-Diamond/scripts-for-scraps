import { extractDateHeadings, findClosestDate } from './dateUtils';
import { parseAgendaContent, hasAgendaContent } from './agendaParser';
import he from 'he';
import {
    ParsedMeetingData,
    AgendaItem,
    // Remove unused imports
    // ActionItem,
    // DecisionItem
} from './types';

// Type for the Supabase record that contains workgroup_id
interface SupabaseRecord {
    // Direct properties (for flattened records)
    workgroup?: string;
    workgroup_id?: string;
    meetingInfo?: {
        date?: string;
    };

    // Nested structure (for records with summary property)
    summary?: {
        workgroup?: string;
        workgroup_id?: string;
        meetingInfo?: {
            date?: string;
        };
    };

    // Allow other properties
    [key: string]: unknown;
}

// Helper function to extract actual workgroup ID from a SupabaseRecord
function extractWorkgroupId(record: SupabaseRecord): string | undefined {
    // Check direct properties first
    if (record.workgroup_id) {
        return record.workgroup_id;
    }

    // Then check nested summary
    if (record.summary?.workgroup_id) {
        return record.summary.workgroup_id;
    }

    return undefined;
}

// Helper function to get workgroup name from a SupabaseRecord
function getWorkgroup(record: SupabaseRecord): string | undefined {
    return record.workgroup || record.summary?.workgroup;
}

// Helper function to get meeting date from a SupabaseRecord
function getMeetingDate(record: SupabaseRecord): string | undefined {
    return record.meetingInfo?.date || record.summary?.meetingInfo?.date;
}

// Function to parse markdown content to JSON format
export function parseMarkdownToJson(
    markdown: string,
    supabaseData?: SupabaseRecord[]
): ParsedMeetingData | ParsedMeetingData[] | { error: string } {
    // First, check if there's any content to parse
    if (!markdown || markdown.trim() === '') {
        return { error: 'No content to parse' };
    }

    // Decode any HTML entities in the content
    markdown = he.decode(markdown);

    // First, identify all date headings in the document
    const dateHeadings = extractDateHeadings(markdown);

    // Split the markdown into sections by workgroup header (exact ### match with space)
    const workgroupPattern = /(?:^|\n)### ([^\n]+)/g;
    const workgroupMatches = [...markdown.matchAll(workgroupPattern)];

    // If no workgroups found, try to parse as a single document
    if (workgroupMatches.length === 0) {
        return parseSingleWorkgroup(markdown, findClosestDate(0, dateHeadings), supabaseData);
    }

    // Parse each workgroup section
    const allParsedData: ParsedMeetingData[] = [];
    for (let i = 0; i < workgroupMatches.length; i++) {
        const currentMatch = workgroupMatches[i];
        const nextMatch = workgroupMatches[i + 1];

        // Extract the section for this workgroup
        const startIndex = currentMatch.index || 0;
        const endIndex = nextMatch ? nextMatch.index : undefined;
        const workgroupSection = markdown.substring(startIndex, endIndex);

        // Find the closest date heading before this workgroup
        const closestDate = findClosestDate(startIndex, dateHeadings);

        // Parse this section with the associated date
        const parsedData = parseSingleWorkgroup(workgroupSection, closestDate, supabaseData);

        // Force consistent data structure
        ensureStringArrays(parsedData);

        allParsedData.push(parsedData);
    }

    // Return single object if only one workgroup, otherwise return array
    const finalData = allParsedData.length === 1 ? allParsedData[0] : allParsedData;

    // Final normalization before returning
    return Array.isArray(finalData) ? finalData.map(ensureStringArrays) : ensureStringArrays(finalData);
}

// Helper function to ensure all arrays contain strings, not character arrays
function ensureStringArrays(data: ParsedMeetingData): ParsedMeetingData {
    // Fix case sensitivity and duplicates in peoplePresent
    if (data.meetingInfo.peoplePresent) {
        const people = new Set<string>();
        data.meetingInfo.peoplePresent
            .split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .forEach(p => people.add(p));

        // Sort names alphabetically by converting to array first, sorting, then joining
        const sortedPeople = Array.from(people)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        data.meetingInfo.peoplePresent = sortedPeople.join(', ');
    }

    // Handle documenter case
    if (data.meetingInfo.documenter) {
        // Remove this line that forces lowercase
        // data.meetingInfo.documenter = data.meetingInfo.documenter.toLowerCase();
    }

    // Fix specific workingDocs links
    if (data.meetingInfo.workingDocs) {
        data.meetingInfo.workingDocs = data.meetingInfo.workingDocs.map(doc => {
            return doc;
        });
    }

    // Process each agenda item
    if (data.agendaItems && data.agendaItems.length > 0) {
        data.agendaItems.forEach(item => {
            // Fix meetingTopics character arrays
            if (item.meetingTopics && item.meetingTopics.length > 0) {
                // Create a completely new array with correct string format
                const newTopics: string[] = [];

                for (const topic of item.meetingTopics) {
                    // If it's already a string, use it directly
                    if (typeof topic === 'string') {
                        newTopics.push(topic);
                    }
                    // If it's an object that can be stringified, do that
                    else if (topic !== null && topic !== undefined) {
                        try {
                            const stringified = JSON.stringify(topic);
                            // Check if it looks like a string that was accidentally broken into an array of chars
                            if (stringified.startsWith('"[') && stringified.endsWith(']"')) {
                                // It seems to be a JSON string representation of an array
                                const parsed = JSON.parse(stringified.slice(1, -1));
                                if (Array.isArray(parsed)) {
                                    // Join the array back into a single string
                                    newTopics.push(parsed.join(''));
                                } else {
                                    newTopics.push(String(topic));
                                }
                            } else {
                                newTopics.push(String(topic));
                            }
                        }
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        catch (_) {
                            // If JSON parsing fails, fall back to string conversion
                            newTopics.push(String(topic));
                        }
                    }
                }

                // Replace the original array with our normalized one
                item.meetingTopics = newTopics;
            }

            // Fix discussionPoints
            if (item.discussionPoints && item.discussionPoints.length > 0) {
                item.discussionPoints = item.discussionPoints.map(point => {
                    // Normalize discussion points text with specific replacements
                    let text = String(point).trim();

                    // Ensure sentences end with proper punctuation
                    if (text && !text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
                        text += '.';
                    }

                    return text;
                });
            }
        });
    }

    return data;
}

// Helper function to parse a single workgroup section
function parseSingleWorkgroup(
    section: string,
    date: string | null,
    supabaseData?: SupabaseRecord[]
): ParsedMeetingData {
    const parsedData: ParsedMeetingData = {
        workgroup: '',
        workgroup_id: '', // Will need to be looked up or matched
        meetingInfo: {
            name: '',
            date: date || '', // Use the provided date from the closest date heading
            host: '',
            documenter: '',
            translator: '',
            peoplePresent: '',
            purpose: '',
            miroBoardLink: '',
            otherMediaLink: '',
            mediaLink: '',
            meetingVideoLink: '',
            transcriptLink: '',
            townHallNumber: '',
            googleSlides: '',
            workingDocs: []
        },
        agendaItems: [],
        tags: {
            topicsCovered: '',
            emotions: '',
            other: '',
            gamesPlayed: ''
        },
        type: 'Custom',
        noSummaryGiven: false,
        canceledSummary: false
    };

    // Extract workgroup name - making sure we match only ### headers (not #### or others)
    const workgroupMatch = section.match(/^### ([^\n]+)|(?<=\n)### ([^\n]+)/);
    if (workgroupMatch) {
        parsedData.workgroup = (workgroupMatch[1] || workgroupMatch[2]).trim();

        // If supabaseData is provided, look up the workgroup_id
        if (supabaseData && parsedData.workgroup) {
            // Try to find a matching supabase record by workgroup name
            const matchingRecord = supabaseData.find(record => {
                const recordWorkgroup = getWorkgroup(record);
                return recordWorkgroup?.toLowerCase() === parsedData.workgroup.toLowerCase();
            });

            // If found, use its workgroup_id
            if (matchingRecord) {
                const workgroupId = extractWorkgroupId(matchingRecord);
                if (workgroupId) {
                    parsedData.workgroup_id = workgroupId;
                }
            }
        }
    }

    // Extract meeting info
    const typeMatch = section.match(/- \*\*Type of meeting:\*\* ([^\n]+)/);
    if (typeMatch) {
        parsedData.meetingInfo.name = typeMatch[1].trim();
    }

    // The date is already set from the closest date heading, 
    // but we'll also check for an inline date in case it exists
    const inlineDateMatch = section.match(/- \*\*Date:\*\* ([^\n]+)/);
    if (inlineDateMatch) {
        // If there's an inline date, it should override the date from the heading
        parsedData.meetingInfo.date = inlineDateMatch[1].trim();

        // If we have the date and workgroup but no workgroup_id yet, try to match with both workgroup and date
        if (supabaseData && parsedData.workgroup && !parsedData.workgroup_id) {
            const recordWithSameDate = supabaseData.find(record => {
                const recordWorkgroup = getWorkgroup(record);
                const recordDate = getMeetingDate(record);
                return recordWorkgroup?.toLowerCase() === parsedData.workgroup.toLowerCase() &&
                    recordDate === parsedData.meetingInfo.date;
            });

            if (recordWithSameDate) {
                const workgroupId = extractWorkgroupId(recordWithSameDate);
                if (workgroupId) {
                    parsedData.workgroup_id = workgroupId;
                }
            }
        }
    }

    // Extract participants, facilitator and documenter
    const presentMatch = section.match(/- \*\*Present:\*\* ([^\n]+)/);
    if (presentMatch) {
        const presentText = presentMatch[1];
        let peoplePresent = presentText;

        // Extract facilitator
        const facilitatorMatch = presentText.match(/([^,]+?) \[\*\*facilitator\*\*\]/);
        if (facilitatorMatch) {
            parsedData.meetingInfo.host = facilitatorMatch[1].trim();
            peoplePresent = peoplePresent.replace(/\[\*\*facilitator\*\*\]/, '');
        }

        // Extract documenter
        const documenterMatch = presentText.match(/([^,\[]+) \[\*\*documenter\*\*\]/);
        if (documenterMatch) {
            parsedData.meetingInfo.documenter = documenterMatch[1].trim();
            peoplePresent = peoplePresent.replace(/\[\*\*documenter\*\*\]/, '');
        }

        // Extract translator if present
        const translatorMatch = presentText.match(/([^,\[]+) \[\*\*translator\*\*\]/);
        if (translatorMatch) {
            parsedData.meetingInfo.translator = translatorMatch[1].trim();
            peoplePresent = peoplePresent.replace(/\[\*\*translator\*\*\]/, '');
        }

        // Clean up and store all participants
        // Remove duplicates but preserve original casing
        const uniquePeopleMap = new Map<string, string>(); // Maps lowercase -> original casing
        peoplePresent
            .split(',')
            .map((p: string) => p.trim())
            .filter((p: string) => p)
            .forEach((p: string) => {
                // Use lowercase as key for deduplication, but keep original casing as value
                uniquePeopleMap.set(p.toLowerCase(), p);
            });

        // Get the values in an array and sort them alphabetically (case-insensitive)
        const sortedPeople = Array.from(uniquePeopleMap.values())
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Join the original-cased values
        parsedData.meetingInfo.peoplePresent = sortedPeople.join(', ');
    }

    // Extract purpose
    const purposeMatch = section.match(/- \*\*Purpose:\*\* ([^\n]+)/);
    if (purposeMatch) {
        parsedData.meetingInfo.purpose = purposeMatch[1].trim();
    }

    // Extract Town Hall Number
    const townHallMatch = section.match(/- \*\*Town Hall Number:\*\* ([^\n]+)/);
    if (townHallMatch) {
        parsedData.meetingInfo.townHallNumber = townHallMatch[1].trim();
    }

    // Extract video links
    const meetingVideoMatch = section.match(/- \*\*Meeting video:\*\* \[Link\]\(([^)]+)\)/i);
    if (meetingVideoMatch) {
        parsedData.meetingInfo.meetingVideoLink = meetingVideoMatch[1].trim();
    }

    // Extract Media link
    const mediaLinkMatch = section.match(/- \*\*Media link:\*\* \[Link\]\(([^)]+)\)/i);
    if (mediaLinkMatch) {
        parsedData.meetingInfo.mediaLink = mediaLinkMatch[1].trim();
    }

    // Extract Miro board link
    const miroBoardMatch = section.match(/- \*\*Miro board:\*\* \[Link\]\(([^)]+)\)/i);
    if (miroBoardMatch) {
        parsedData.meetingInfo.miroBoardLink = miroBoardMatch[1].trim();
    }

    // Extract Transcript link
    const transcriptMatch = section.match(/- \*\*Transcript:\*\* \[Link\]\(([^)]+)\)/i);
    if (transcriptMatch) {
        parsedData.meetingInfo.transcriptLink = transcriptMatch[1].trim();
    }

    // Extract Other media link
    const otherMediaMatch = section.match(/- \*\*Other media:\*\* \[Link\]\(([^)]+)\)/i);
    if (otherMediaMatch) {
        parsedData.meetingInfo.otherMediaLink = otherMediaMatch[1].trim();
    }

    // Extract Google Slides
    const slidesMatch = section.match(/{% embed url="([^"]+)" %}/);
    if (slidesMatch) {
        parsedData.meetingInfo.googleSlides = slidesMatch[1].trim();
    }

    // Extract working docs
    const workingDocsSection = section.match(/- \*\*Working Docs:\*\*([\s\S]*?)(?=\n\s*\n|\n####)/);
    if (workingDocsSection) {
        // Instead of using simple regex, we'll parse the markdown links more carefully
        // to handle titles with parentheses correctly
        const markdownContent = workingDocsSection[1];
        const workingDocs = [];

        // Use a more robust regex that finds markdown links
        // This regex will find markdown links where the link part starts right after the title part
        const linkRegex = /\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
        let match;

        while ((match = linkRegex.exec(markdownContent)) !== null) {
            const fullTitle = match[1].trim();
            // The URL is already properly captured in the second group
            const linkUrl = match[2].trim();

            workingDocs.push({
                title: fullTitle,
                link: linkUrl
            });
        }

        parsedData.meetingInfo.workingDocs = workingDocs;
    }

    // Extract agenda items - specifically looking for #### Agenda item pattern
    const agendaPattern = /#### Agenda item (\d+) - ([^-\n]+) - \[([^\]]+)\]([\s\S]*?)(?=\n#### Agenda item|\n### |$)/g;
    const agendaMatches = [...section.matchAll(agendaPattern)];

    // If we found explicit agenda items, process them
    if (agendaMatches.length > 0) {
        for (const match of agendaMatches) {
            const agendaTitle = match[2].trim();
            const agendaStatus = match[3].trim();
            const agendaContent = match[4];

            const agendaItem: AgendaItem = {
                agenda: agendaTitle,
                status: agendaStatus,
                discussionPoints: [],
                actionItems: [],
                decisionItems: [],
                townHallUpdates: '',
                townHallSummary: '',
                narrative: '',
                gameRules: '',
                discussion: '',
                learningPoints: [],
                meetingTopics: [],
                issues: [],
                leaderboard: [],
                peoplePresent: [],
                facilitator: '',
                documenter: ''
            };

            // Parse content sections
            parseAgendaContent(agendaContent, agendaItem);

            // Force meetingTopics to be properly stringified - prevents character-by-character issues
            if (agendaItem.meetingTopics && agendaItem.meetingTopics.length > 0) {
                // Create brand new array of proper strings
                const normalizedTopics = agendaItem.meetingTopics.map(topic => {
                    // Handle if topic is a string or an array of characters
                    if (typeof topic === 'string') {
                        return String(topic); // Create new string instance
                    } else if (Array.isArray(topic)) {
                        // Safely join arrays of any type to string
                        return (topic as unknown[]).map(c => String(c || '')).join('');
                    }
                    return String(topic || ''); // Fallback - convert to string
                });

                // Replace the original array with our normalized one
                agendaItem.meetingTopics = normalizedTopics;
            }

            parsedData.agendaItems.push(agendaItem);
        }
    } else {
        // No explicit agenda items found, create a default agenda item to contain all content

        // Find where the meeting info ends and content begins
        const meetingInfoEnd = section.search(/(?:#### Agenda Items:|#### Discussion Points|#### In this meeting we discussed|#### Action Items|#### Decision Items|#### Town Hall Updates|#### Town Hall Summary|#### Narrative|#### Game Rules|#### Discussion|#### Learning Points|#### Meeting Topics|#### Issues|#### Leaderboard)/i);

        // If we found content sections, extract them as a single agenda item
        if (meetingInfoEnd !== -1) {
            const contentSection = section.substring(meetingInfoEnd);

            // Create a default agenda item with "carry over" status
            const defaultAgendaItem: AgendaItem = {
                // No agenda title
                status: "carry over", // Default status
                discussionPoints: [],
                actionItems: [],
                decisionItems: [],
                townHallUpdates: '',
                townHallSummary: '',
                narrative: '',
                gameRules: '',
                discussion: '',
                learningPoints: [],
                meetingTopics: [],
                issues: [],
                leaderboard: [],
                peoplePresent: [],
                facilitator: '',
                documenter: ''
            };

            // Parse content sections using the same logic as for explicit agenda items
            parseAgendaContent(contentSection, defaultAgendaItem);

            // Force meetingTopics to be properly stringified - prevents character-by-character issues
            if (defaultAgendaItem.meetingTopics && defaultAgendaItem.meetingTopics.length > 0) {
                // Create brand new array of proper strings
                const normalizedTopics = defaultAgendaItem.meetingTopics.map(topic => {
                    // Handle if topic is a string or an array of characters
                    if (typeof topic === 'string') {
                        return String(topic); // Create new string instance
                    } else if (Array.isArray(topic)) {
                        // Safely join arrays of any type to string
                        return (topic as unknown[]).map(c => String(c || '')).join('');
                    }
                    return String(topic || ''); // Fallback - convert to string
                });

                // Replace with normalized array (without standardization)
                defaultAgendaItem.meetingTopics = normalizedTopics;
            }

            // Only add the agenda item if it has any content
            if (hasAgendaContent(defaultAgendaItem)) {
                parsedData.agendaItems.push(defaultAgendaItem);
            }
        }
    }

    // Parse tags/keywords
    const tagsSection = section.match(/#### Keywords\/tags:([\s\S]*?)(?=\n### |$)/);
    if (tagsSection) {
        const topicsCoveredMatch = tagsSection[1].match(/- \*\*topics covered:\*\* ([^\n]+)/i);
        if (topicsCoveredMatch) {
            parsedData.tags.topicsCovered = topicsCoveredMatch[1].trim();
        }

        const emotionsMatch = tagsSection[1].match(/- \*\*emotions:\*\* ([^\n]+)/i);
        if (emotionsMatch) {
            parsedData.tags.emotions = emotionsMatch[1].trim();
        }

        const otherMatch = tagsSection[1].match(/- \*\*other:\*\* ([^\n]+)/i);
        if (otherMatch) {
            parsedData.tags.other = otherMatch[1].trim();
        }

        const gamesPlayedMatch = tagsSection[1].match(/- \*\*games played:\*\* ([^\n]+)/i);
        if (gamesPlayedMatch) {
            parsedData.tags.gamesPlayed = gamesPlayedMatch[1].trim();
        }
    }

    // Check for no summary given or canceled meeting
    if (section.includes("No Summary Given")) {
        parsedData.noSummaryGiven = true;
        const summaryMatch = section.match(/No Summary Given/);
        if (summaryMatch) {
            parsedData.noSummaryGivenText = summaryMatch[0];
        }
    }

    if (section.includes("Meeting was cancelled")) {
        parsedData.canceledSummary = true;
        const cancelMatch = section.match(/Meeting was cancelled/);
        if (cancelMatch) {
            parsedData.canceledSummaryText = cancelMatch[0];
        }
    }

    return parsedData;
} 