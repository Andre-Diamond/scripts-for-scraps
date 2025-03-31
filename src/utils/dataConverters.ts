import { ParsedMeetingData, AgendaItem as ServiceAgendaItem, ActionItem as ServiceActionItem, DecisionItem as ServiceDecisionItem } from '../services/types';
import {
    MeetingSummary,
    MeetingInfo,
    TimestampedVideo,
    AgendaItem as AppAgendaItem,
    ActionItem,
    DecisionItem
} from '../../types';

// Helper function to normalize special characters
function normalizeSpecialCharacters(text: string): string {
    const charMap: Record<string, string> = {
        'Ã©': 'é',
        'Ã¨': 'è',
        'Ã«': 'ë',
        'Ã¯': 'ï',
        'Ã®': 'î',
        'Ã¢': 'â',
        'Ã ': 'à',
        'Ã¤': 'ä',
        'Ã¥': 'å',
        'Ã¦': 'æ',
        'Ã§': 'ç',
        'Ã±': 'ñ',
        'Ã³': 'ó',
        'Ã²': 'ò',
        'Ã¶': 'ö',
        'Ã´': 'ô',
        'Ã¸': 'ø',
        'Ã¼': 'ü',
        'Ã»': 'û',
        'Ã¹': 'ù',
        'Ã½': 'ý',
        '\u0160': 'Š',
        '\u0161': 'š',
        '\u017D': 'Ž',
        '\u017E': 'ž',
        '\u0153': 'œ',
        '\u0152': 'Œ',
        'Ã': 'Á',
        'Â': 'À'
    };

    return text.replace(/Ã.|[\u0152-\u017E]|Â/g, match => charMap[match] || match);
}

// Helper function to recursively normalize special characters in an object
function normalizeObjectCharacters<T>(obj: T): T {
    if (typeof obj === 'string') {
        return normalizeSpecialCharacters(obj) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => normalizeObjectCharacters(item)) as T;
    }

    if (obj !== null && typeof obj === 'object') {
        const normalized = {} as T;
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            (normalized as Record<string, unknown>)[key] = normalizeObjectCharacters(value);
        }
        return normalized;
    }

    return obj;
}

/**
 * Converts ParsedMeetingData from the markdown parser to the MeetingSummary type
 * used in the application
 */
export function convertToMeetingSummary(data: ParsedMeetingData): MeetingSummary {
    // Create empty timestampedVideo object which is required in MeetingSummary but not in ParsedMeetingData
    const timestampedVideo: TimestampedVideo = {
        url: '',
        intro: '',
        timestamps: ''
    };

    // Create the MeetingInfo with all required fields
    const meetingInfo: MeetingInfo = {
        ...data.meetingInfo,
        timestampedVideo: timestampedVideo
    };

    // Convert agendaItems from service format to app format
    const agendaItems = data.agendaItems.map(convertAgendaItem);

    // Create the initial MeetingSummary
    const summary: MeetingSummary = {
        workgroup: data.workgroup,
        workgroup_id: data.workgroup_id || '',
        meetingInfo: meetingInfo,
        agendaItems: agendaItems,
        tags: data.tags,
        type: data.type as "Custom" | "Weekly" | "Monthly",
        noSummaryGiven: data.noSummaryGiven,
        canceledSummary: data.canceledSummary,
        noSummaryGivenText: data.noSummaryGivenText || '',
        canceledSummaryText: data.canceledSummaryText || ''
    };

    // Normalize special characters in the entire object
    return normalizeObjectCharacters(summary);
}

/**
 * Convert a single agenda item from service format to app format
 */
function convertAgendaItem(item: ServiceAgendaItem): AppAgendaItem {
    return {
        agenda: item.agenda || '',
        status: item.status as "carry over" | "completed" | "in-progress",
        townHallUpdates: item.townHallUpdates || '',
        townHallSummary: item.townHallSummary || '',
        narrative: item.narrative || '',
        discussion: item.discussion || '',
        gameRules: item.gameRules || '',
        meetingTopics: item.meetingTopics || [],
        issues: item.issues || [],
        actionItems: (item.actionItems || []).map(convertActionItem),
        decisionItems: (item.decisionItems || []).map(convertDecisionItem),
        discussionPoints: item.discussionPoints || [],
        learningPoints: item.learningPoints || []
    };
}

/**
 * Convert action items from service format to app format
 */
function convertActionItem(item: ServiceActionItem): ActionItem {
    return {
        text: item.text || '',
        assignee: item.assignee || '',
        dueDate: item.dueDate || '',
        status: (item.status as "todo" | "in-progress" | "done") || "todo"
    };
}

/**
 * Convert decision items from service format to app format
 */
function convertDecisionItem(item: ServiceDecisionItem): DecisionItem {
    // Default effect value if not valid
    let effect: "affectsOnlyThisWorkgroup" | "affectsOtherWorkgroups" = "affectsOnlyThisWorkgroup";

    // If item has a valid effect value, use it
    if (item.effect === "affectsOnlyThisWorkgroup" || item.effect === "affectsOtherWorkgroups") {
        effect = item.effect;
    }

    return {
        decision: item.decision || '',
        rationale: item.rationale || '',
        opposing: item.opposing || '',
        effect: effect
    };
}

/**
 * Converts an array of ParsedMeetingData to an array of MeetingSummary
 */
export function convertToMeetingSummaryArray(dataArray: ParsedMeetingData[]): MeetingSummary[] {
    return dataArray.map(convertToMeetingSummary);
}

/**
 * Converts either a single ParsedMeetingData or an array to the corresponding MeetingSummary format
 */
export function convertParsedDataToMeetingSummary(
    data: ParsedMeetingData | ParsedMeetingData[]
): MeetingSummary | MeetingSummary[] {
    if (Array.isArray(data)) {
        return convertToMeetingSummaryArray(data);
    }
    return convertToMeetingSummary(data);
} 