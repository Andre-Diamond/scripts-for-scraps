export type WorkingDoc = {
    title: string;
    link: string;
};

export type TimestampedVideo = {
    url: string;
    intro: string;
    timestamps: string;
};

export type ActionItem = {
    text: string;
    assignee: string;
    dueDate: string;
    status: "todo" | "in-progress" | "done";
};

export type DecisionItem = {
    decision: string;
    rationale: string;
    opposing: string;
    effect: "affectsOnlyThisWorkgroup" | "affectsOtherWorkgroups";
};

export type AgendaItem = {
    agenda: string;
    status: "carry over" | "completed" | "in-progress";
    townHallUpdates: string;
    townHallSummary: string;
    narrative: string;
    discussion: string;
    gameRules: string;
    meetingTopics: string[];
    issues: string[];
    actionItems: ActionItem[];
    decisionItems: DecisionItem[];
    discussionPoints: string[];
    learningPoints: string[];
};

export type MeetingInfo = {
    name: string;
    date: string;
    host: string;
    documenter: string;
    translator: string;
    peoplePresent: string;
    purpose: string;
    townHallNumber: string;
    googleSlides: string;
    meetingVideoLink: string;
    miroBoardLink: string;
    otherMediaLink: string;
    transcriptLink: string;
    mediaLink: string;
    workingDocs: WorkingDoc[];
    timestampedVideo: TimestampedVideo;
};

export type Tags = {
    topicsCovered: string;
    emotions: string;
    other: string;
    gamesPlayed: string;
};

export type MeetingSummary = {
    workgroup: string;
    workgroup_id: string;
    meetingInfo: MeetingInfo;
    agendaItems: AgendaItem[];
    tags: Tags;
    type: "Custom" | "Weekly" | "Monthly";
    noSummaryGiven: boolean;
    canceledSummary: boolean;
    noSummaryGivenText: string;
    canceledSummaryText: string;
};

export type DatabaseRecord = {
    id?: string;
    created_at?: string;
    summary: MeetingSummary;
    workgroup?: string;
    date?: string;
} | MeetingSummary; 