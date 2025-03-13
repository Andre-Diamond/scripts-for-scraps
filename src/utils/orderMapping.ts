import { MeetingSummary, AgendaItem } from '../../types';

// Define the workgroup-specific order mapping
export const orderMapping: Record<string, string[]> = {
    "Gamers Guild": ["narrative", "discussionPoints", "decisionItems", "actionItems", "gameRules", "leaderboard"],
    "Writers Workgroup": ["narrative", "decisionItems", "actionItems", "learningPoints"],
    "Video Workgroup": ["discussionPoints", "decisionItems", "actionItems"],
    "Archives Workgroup": ["decisionItems", "actionItems", "learningPoints"],
    "Treasury Guild": ["discussionPoints", "decisionItems", "actionItems"],
    "Treasury Policy WG": ["discussionPoints", "decisionItems", "actionItems"],
    "Treasury Automation WG": ["discussionPoints", "decisionItems", "actionItems"],
    "Dework PBL": ["discussionPoints", "decisionItems", "actionItems"],
    "Knowledge Base Workgroup": ["discussionPoints", "decisionItems", "actionItems"],
    "Onboarding Workgroup": ["townHallUpdates", "discussionPoints", "decisionItems", "actionItems", "learningPoints", "issues"],
    "Research and Development Guild": ["meetingTopics", "discussionPoints", "decisionItems", "actionItems"],
    "Governance Workgroup": ["narrative", "discussionPoints", "decisionItems", "actionItems"],
    "Education Workgroup": ["meetingTopics", "discussionPoints", "decisionItems", "actionItems"],
    "Marketing Guild": ["discussionPoints", "decisionItems", "actionItems"],
    "Ambassador Town Hall": ["townHallSummary"],
    "Deep Funding Town Hall": ["townHallSummary"],
    "One-off Event": ["narrative"],
    "AI Ethics WG": ["narrative", "decisionItems", "actionItems"],
    "African Guild": ["narrative", "decisionItems", "actionItems"],
    "Strategy Guild": ["narrative", "decisionItems", "actionItems"],
    "LatAm Guild": ["narrative", "decisionItems", "actionItems"],
    "WG Sync Call": ["meetingTopics", "discussion", "decisionItems", "actionItems", "issues"],
    "AI Sandbox/Think-tank": ["townHallUpdates", "discussionPoints", "decisionItems", "actionItems", "learningPoints", "issues"],
    "GitHub PBL WG": ["discussionPoints", "decisionItems", "actionItems"]
};

// Default order to use if a workgroup doesn't have a specific mapping
export const defaultOrder: string[] = [
    "narrative",
    "meetingTopics",
    "discussionPoints",
    "decisionItems",
    "actionItems",
    "learningPoints",
    "issues",
    "townHallUpdates",
    "townHallSummary",
    "gameRules",
    "leaderboard",
    "discussion"
];

/**
 * Applies the workgroup-specific order to agenda items
 * and filters out empty sections
 */
export function applyWorkgroupOrder(meetingSummary: MeetingSummary): MeetingSummary {
    const { workgroup, agendaItems } = meetingSummary;

    // Deep clone to avoid mutating the original
    const clonedSummary = JSON.parse(JSON.stringify(meetingSummary)) as MeetingSummary;

    // Get the specific order for this workgroup or use the default
    const orderFields = orderMapping[workgroup] || defaultOrder;

    // Apply the order to each agenda item
    if (clonedSummary.agendaItems && clonedSummary.agendaItems.length > 0) {
        clonedSummary.agendaItems = clonedSummary.agendaItems.map(agendaItem => {
            const orderedItem = {} as AgendaItem;

            // Always include these fields first
            orderedItem.agenda = agendaItem.agenda;
            orderedItem.status = agendaItem.status;

            // Add fields in the specified order if they contain data
            orderFields.forEach(field => {
                const value = agendaItem[field as keyof AgendaItem];

                // Only include non-empty fields
                if (value) {
                    if (Array.isArray(value)) {
                        if (value.length > 0) {
                            orderedItem[field as keyof AgendaItem] = value;
                        }
                    } else if (typeof value === 'string') {
                        if (value.trim() !== '') {
                            orderedItem[field as keyof AgendaItem] = value;
                        }
                    } else {
                        orderedItem[field as keyof AgendaItem] = value;
                    }
                }
            });

            // Initialize any missing required arrays as empty
            if (!orderedItem.discussionPoints) orderedItem.discussionPoints = [];
            if (!orderedItem.actionItems) orderedItem.actionItems = [];
            if (!orderedItem.decisionItems) orderedItem.decisionItems = [];
            if (!orderedItem.meetingTopics) orderedItem.meetingTopics = [];
            if (!orderedItem.issues) orderedItem.issues = [];
            if (!orderedItem.learningPoints) orderedItem.learningPoints = [];

            return orderedItem;
        });
    }

    return clonedSummary;
} 