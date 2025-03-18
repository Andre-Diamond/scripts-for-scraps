// Type definitions for better type safety
// Remove unused imports
import { } from './types';

export interface SummaryData {
    [key: string]: unknown;
    summary?: SummaryData;
    meetingInfo?: { peoplePresent?: string | string[] };
    agendaItems?: AgendaItemLike[];
}

export interface AgendaItemLike {
    peoplePresent?: string[];
    discussionPoints?: string[] | string[][];
    actionItems?: ActionItemLike[];
    decisionItems?: DecisionItemLike[];
}

export interface ActionItemLike {
    text?: string;
    [key: string]: unknown;
}

export interface DecisionItemLike {
    decision?: string;
    [key: string]: unknown;
}

export interface Difference {
    field: string;
    gitbook: unknown;
    supabase: unknown;
}

// Function to compare a GitBook entry with a Supabase entry
export function compareSummaries(gitbookData: SummaryData, supabaseData: SummaryData): Difference[] {
    // Create deep copies to avoid mutation issues
    const gitbook = JSON.parse(JSON.stringify(gitbookData));
    const supabase = JSON.parse(JSON.stringify(supabaseData));

    // If supabase data has a nested summary object, use that for comparison
    const supabaseSummary = supabase.summary || supabase;

    // Clean and preprocess the data before comparison
    const cleanedGitbook = preprocessData(gitbook);
    const cleanedSupabase = preprocessData(supabaseSummary);

    // Compare the cleaned data
    return compareObjects(cleanedGitbook, cleanedSupabase);
}

// Preprocess the data to fix common issues
function preprocessData(data: SummaryData): SummaryData {
    if (!data) return data;

    // Deep clone to avoid modifying the original
    const processed = JSON.parse(JSON.stringify(data));

    // Sort peoplePresent for meetingInfo if it exists
    if (processed.meetingInfo && processed.meetingInfo.peoplePresent) {
        // If it's a comma-separated string, split, sort, and join back
        if (typeof processed.meetingInfo.peoplePresent === 'string') {
            const people = processed.meetingInfo.peoplePresent
                .split(',')
                .map((p: string) => p.trim())
                .filter(Boolean);

            // Sort alphabetically (case-insensitive)
            people.sort((a: string, b: string) =>
                a.toLowerCase().localeCompare(b.toLowerCase()));

            processed.meetingInfo.peoplePresent = people.join(', ');
        }
    }

    // If data has agendaItems, process each item
    if (processed.agendaItems && Array.isArray(processed.agendaItems)) {
        processed.agendaItems = processed.agendaItems.map((item: AgendaItemLike) => {
            // Sort peoplePresent in each agenda item if it exists as an array
            if (item.peoplePresent && Array.isArray(item.peoplePresent)) {
                item.peoplePresent.sort((a: string, b: string) =>
                    a.toLowerCase().localeCompare(b.toLowerCase()));
            }

            // Process discussionPoints
            if (item.discussionPoints) {
                // Ensure discussionPoints is an array of strings (not characters)
                if (Array.isArray(item.discussionPoints)) {
                    // Convert each item to a string and clean it
                    item.discussionPoints = item.discussionPoints.map((point: unknown) => {
                        if (typeof point === 'string') {
                            return cleanString(point);
                        }
                        return String(point);
                    }) as string[];
                }
            }

            // Process actionItems
            if (item.actionItems && Array.isArray(item.actionItems)) {
                item.actionItems = item.actionItems.map((action: ActionItemLike) => {
                    if (action.text) {
                        // Clean action text and remove metadata tags
                        action.text = cleanActionText(action.text);
                    }
                    return action;
                });
            }

            // Process decisionItems
            if (item.decisionItems && Array.isArray(item.decisionItems)) {
                item.decisionItems = item.decisionItems.map((decision: DecisionItemLike) => {
                    if (decision.decision) {
                        // Clean decision text and normalize year references
                        decision.decision = cleanDecisionText(decision.decision);
                    }
                    return decision;
                });
            }

            return item;
        });
    }

    return processed;
}

// Clean action text by removing metadata and normalizing
function cleanActionText(text: string): string {
    if (!text) return text;

    return text
        .replace(/\[\*\*assignee\*\*\].*?(?=\[|$)/g, '')
        .replace(/\[\*\*status\*\*\].*?(?=\[|$)/g, '')
        .replace(/\[\*\*due\*\*\].*?(?=\[|$)/g, '')
        .replace(/\[\*\*action\*\*\]/g, '')
        .replace(/Quarter\s+(\d)\s+2025/gi, 'Quarter $1')
        .replace(/Q(\d)\s+2025/gi, 'Q$1')
        .replace(/\s+/g, ' ')
        .trim();
}

// Clean decision text by normalizing
function cleanDecisionText(text: string): string {
    if (!text) return text;

    return text
        .replace(/Quarter\s+(\d)\s+2025/gi, 'Quarter $1')
        .replace(/Q(\d)\s+2025/gi, 'Q$1')
        .replace(/\s+/g, ' ')
        .trim();
}

// Clean general strings
function cleanString(text: string): string {
    if (!text) return text;

    return text
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to normalize strings for comparison
function normalizeString(str: unknown): string {
    if (typeof str !== 'string') return String(str);

    // Trim whitespace, normalize spacing, and convert to lowercase
    let normalized = str.trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    // Remove metadata tags commonly found in GitBook but not in database
    normalized = normalized
        .replace(/\[\*\*assignee\*\*\]\s+[^\[\]]+/g, '')
        .replace(/\[\*\*status\*\*\]\s+[^\[\]]+/g, '')
        .replace(/\[\*\*due\*\*\]\s+[^\[\]]+/g, '')
        .replace(/\[\*\*action\*\*\]/g, '')
        .replace(/\[\*\*effect\*\*\]/g, '')
        .replace(/\[\*\*rationale\*\*\]/g, '')
        .replace(/\[\*\*opposing\*\*\]/g, '');

    // Normalize year references (2025 vs just 25)
    normalized = normalized
        .replace(/\b(q[1-4])\s+2025\b/gi, '$1')
        .replace(/\bquarter\s+[1-4]\s+2025\b/gi, 'quarter $1');

    // Clean up any double spaces created during replacements
    return normalized.replace(/\s+/g, ' ').trim();
}

// Helper function to compare objects and collect differences
function compareObjects(gitbook: SummaryData, supabase: SummaryData, path: string = ''): Difference[] {
    const differences: Difference[] = [];

    // Special handling for discussionPoints array path
    if (path.includes('discussionPoints')) {
        // For discussionPoints, we want to compare whole strings, not character by character
        if (typeof gitbook === 'string' && typeof supabase === 'string') {
            if (normalizeString(gitbook) !== normalizeString(supabase)) {
                differences.push({
                    field: path,
                    gitbook: gitbook,
                    supabase: supabase
                });
            }
            return differences;
        }
    }

    // Special handling for meetingTopics array path
    if (path.includes('meetingTopics')) {
        // For meetingTopics, we want to compare whole strings, not character by character
        if (typeof gitbook === 'string' && typeof supabase === 'string') {
            if (normalizeString(gitbook) !== normalizeString(supabase)) {
                differences.push({
                    field: path,
                    gitbook: gitbook,
                    supabase: supabase
                });
            }
            return differences;
        }
    }

    // Special handling for action items text field
    if (path.includes('actionItems') && path.endsWith('.text')) {
        // For action item text, use extra normalization
        if (typeof gitbook === 'string' && typeof supabase === 'string') {
            const normalizedGitbook = normalizeString(gitbook);
            const normalizedSupabase = normalizeString(supabase);

            if (normalizedGitbook !== normalizedSupabase) {
                differences.push({
                    field: path,
                    gitbook: gitbook,
                    supabase: supabase
                });
            }
            return differences;
        }
    }

    // Special handling for decision items
    if (path.includes('decisionItems') && path.endsWith('.decision')) {
        // For decision item text, use extra normalization
        if (typeof gitbook === 'string' && typeof supabase === 'string') {
            const normalizedGitbook = normalizeString(gitbook);
            const normalizedSupabase = normalizeString(supabase);

            if (normalizedGitbook !== normalizedSupabase) {
                differences.push({
                    field: path,
                    gitbook: gitbook,
                    supabase: supabase
                });
            }
            return differences;
        }
    }

    // Adding null checks and handling empty objects for the gitbook and supabase
    const gitbookKeys = gitbook ? Object.keys(gitbook) : [];
    const supabaseKeys = supabase ? Object.keys(supabase) : [];

    // Compare primitive values and collect differences
    for (const key of new Set([...gitbookKeys, ...supabaseKeys])) {
        const currentPath = path ? `${path}.${key}` : key;
        const gitbookValue = gitbook?.[key];
        const supabaseValue = supabase?.[key];

        // Skip comparison for specific fields that we don't want to report differences on
        if (currentPath.includes('discussionPoints') && /\.\d+\.\d+$/.test(currentPath)) {
            continue; // Skip character-by-character comparison for discussionPoints
        }

        // Skip character-by-character comparison for meetingTopics too
        if (currentPath.includes('meetingTopics') && /\.\d+\.\d+$/.test(currentPath)) {
            continue;
        }

        // Compare types
        if (typeof gitbookValue !== typeof supabaseValue) {
            differences.push({
                field: currentPath,
                gitbook: gitbookValue,
                supabase: supabaseValue
            });
            continue;
        }

        // Handle objects and arrays
        if (typeof gitbookValue === 'object' && gitbookValue !== null) {
            if (Array.isArray(gitbookValue)) {
                const supabaseValueArray = Array.isArray(supabaseValue) ? supabaseValue : [];

                if (!Array.isArray(supabaseValue) || gitbookValue.length !== supabaseValueArray.length) {
                    // Only report array length differences for non-discussionPoints
                    if (!currentPath.includes('discussionPoints')) {
                        differences.push({
                            field: `${currentPath}.length`,
                            gitbook: gitbookValue.length,
                            supabase: supabaseValueArray.length
                        });
                    }
                }

                // Handle array element comparison
                if (Array.isArray(supabaseValue)) {
                    // For discussionPoints arrays, compare element by element
                    if (currentPath === 'agendaItems.discussionPoints' ||
                        currentPath.match(/agendaItems\[\d+\]\.discussionPoints$/) ||
                        currentPath === 'agendaItems.meetingTopics' ||
                        currentPath.match(/agendaItems\[\d+\]\.meetingTopics$/)) {
                        const maxLen = Math.max(gitbookValue.length, supabaseValue.length);
                        for (let i = 0; i < maxLen; i++) {
                            const gitItem = gitbookValue[i];
                            const supItem = supabaseValue[i];

                            if (i >= gitbookValue.length) {
                                differences.push({
                                    field: `${currentPath}[${i}]`,
                                    gitbook: undefined,
                                    supabase: supItem
                                });
                            } else if (i >= supabaseValue.length) {
                                differences.push({
                                    field: `${currentPath}[${i}]`,
                                    gitbook: gitItem,
                                    supabase: undefined
                                });
                            } else if (normalizeString(gitItem) !== normalizeString(supItem)) {
                                differences.push({
                                    field: `${currentPath}[${i}]`,
                                    gitbook: gitItem,
                                    supabase: supItem
                                });
                            }
                        }
                    } else {
                        // Regular array comparison
                        for (let i = 0; i < gitbookValue.length; i++) {
                            if (i < supabaseValue.length) {
                                differences.push(...compareObjects(
                                    gitbookValue[i] as SummaryData,
                                    supabaseValue[i] as SummaryData,
                                    `${currentPath}[${i}]`
                                ));
                            }
                        }
                    }
                }
            } else {
                // Regular object comparison
                differences.push(...compareObjects(
                    gitbookValue as SummaryData,
                    supabaseValue as SummaryData,
                    currentPath
                ));
            }
        } else if (typeof gitbookValue === 'string' && typeof supabaseValue === 'string') {
            // String comparison with normalization
            if (normalizeString(gitbookValue) !== normalizeString(supabaseValue)) {
                differences.push({
                    field: currentPath,
                    gitbook: gitbookValue,
                    supabase: supabaseValue
                });
            }
        } else if (gitbookValue !== supabaseValue) {
            // Other primitive value comparison
            differences.push({
                field: currentPath,
                gitbook: gitbookValue,
                supabase: supabaseValue
            });
        }
    }

    return differences;
} 