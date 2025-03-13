// Common type definitions for gitbook-related services

// Meeting information
export interface MeetingInfo {
    name: string;
    date: string;
    host: string;
    documenter: string;
    translator: string;
    peoplePresent: string;
    purpose: string;
    miroBoardLink: string;
    otherMediaLink: string;
    mediaLink: string;
    meetingVideoLink: string;
    transcriptLink: string;
    townHallNumber: string;
    googleSlides: string;
    workingDocs: WorkingDoc[];
}

export interface WorkingDoc {
    title: string;
    link: string;
}

// Action item
export interface ActionItem {
    text: string;
    assignee: string;
    status: string;
    dueDate?: string;
}

// Decision item
export interface DecisionItem {
    decision: string;
    effect: string;
    rationale: string;
    opposing: string;
}

// Tags
export interface Tags {
    topicsCovered: string;
    emotions: string;
    other: string;
    gamesPlayed: string;
}

// Agenda item
export interface AgendaItem {
    agenda?: string;
    status: string;
    discussionPoints: string[];
    actionItems: ActionItem[];
    decisionItems: DecisionItem[];
    townHallUpdates: string;
    townHallSummary: string;
    narrative: string;
    gameRules: string;
    discussion: string;
    learningPoints: string[];
    meetingTopics: string[];
    issues: string[];
    leaderboard: string[];
}

// Full parsed meeting data
export interface ParsedMeetingData {
    workgroup: string;
    workgroup_id: string;
    meetingInfo: MeetingInfo;
    agendaItems: AgendaItem[];
    tags: Tags;
    type: string;
    noSummaryGiven: boolean;
    canceledSummary: boolean;
    noSummaryGivenText?: string;
    canceledSummaryText?: string;
} 