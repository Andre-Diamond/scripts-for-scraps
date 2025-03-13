import { extractDateHeadings, findClosestDate } from './dateUtils';
import { parseAgendaContent, hasAgendaContent } from './agendaParser';
import {
    ParsedMeetingData,
    AgendaItem,
    ActionItem,
    DecisionItem
} from './types';

// Function to parse markdown content to JSON format
export function parseMarkdownToJson(markdown: string): ParsedMeetingData | ParsedMeetingData[] | { error: string } {
    // First, check if there's any content to parse
    if (!markdown || markdown.trim() === '') {
        return { error: 'No content to parse' };
    }

    // First, identify all date headings in the document
    const dateHeadings = extractDateHeadings(markdown);

    // Split the markdown into sections by workgroup header (exact ### match with space)
    const workgroupPattern = /(?:^|\n)### ([^\n]+)/g;
    const workgroupMatches = [...markdown.matchAll(workgroupPattern)];

    // If no workgroups found, try to parse as a single document
    if (workgroupMatches.length === 0) {
        return parseSingleWorkgroup(markdown, findClosestDate(0, dateHeadings));
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
        const parsedData = parseSingleWorkgroup(workgroupSection, closestDate);
        allParsedData.push(parsedData);
    }

    // Return single object if only one workgroup, otherwise return array
    return allParsedData.length === 1 ? allParsedData[0] : allParsedData;
}

// Helper function to parse a single workgroup section
function parseSingleWorkgroup(section: string, date: string | null): ParsedMeetingData {
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
    }

    // Extract participants, facilitator and documenter
    const presentMatch = section.match(/- \*\*Present:\*\* ([^\n]+)/);
    if (presentMatch) {
        const presentText = presentMatch[1];
        let peoplePresent = presentText;

        // Extract facilitator
        const facilitatorMatch = presentText.match(/([^,\[]+) \[\*\*facilitator\*\*\]/);
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
        parsedData.meetingInfo.peoplePresent = peoplePresent
            .split(',')
            .map((p: string) => p.trim())
            .filter((p: string) => p)
            .join(', ');
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
        const docLinks = workingDocsSection[1].match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
        parsedData.meetingInfo.workingDocs = docLinks.map((link: string) => {
            const titleMatch = link.match(/\[([^\]]+)\]/);
            const urlMatch = link.match(/\(([^)]+)\)/);
            return {
                title: titleMatch ? titleMatch[1] : '',
                link: urlMatch ? urlMatch[1] : ''
            };
        });
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
                leaderboard: []
            };

            // Parse content sections
            parseAgendaContent(agendaContent, agendaItem);

            parsedData.agendaItems.push(agendaItem);
        }
    } else {
        // No explicit agenda items found, create a default agenda item to contain all content

        // Find where the meeting info ends and content begins
        const meetingInfoEnd = section.search(/(?:#### Discussion Points|#### In this meeting we discussed|#### Action Items|#### Decision Items|#### Town Hall Updates|#### Town Hall Summary|#### Narrative|#### Game Rules|#### Discussion|#### Learning Points|#### Meeting Topics|#### Issues|#### Leaderboard)/i);

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
                leaderboard: []
            };

            // Parse content sections using the same logic as for explicit agenda items
            parseAgendaContent(contentSection, defaultAgendaItem);

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