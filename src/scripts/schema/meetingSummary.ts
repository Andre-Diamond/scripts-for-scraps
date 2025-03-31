interface WorkingDoc {
  title: string;
  link: string;
}

interface TimestampedVideo {
  url: string;
  intro: string;
  timestamps: string;
}

interface ActionItem {
  text: string;
  assignee: string;
  dueDate: string;
  status: 'todo' | 'in-progress' | 'done';
}

interface DecisionItem {
  decision: string;
  rationale: string;
  opposing: string;
  effect: 'affectsOnlyThisWorkgroup' | 'affectsOtherWorkgroups';
}

interface AgendaItem {
  agenda: string;
  status: 'carry over' | 'completed' | 'in-progress';
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
}

interface MeetingInfo {
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
}

interface Tags {
  topicsCovered: string;
  emotions: string;
  other: string;
  gamesPlayed: string;
}

export interface MeetingSummary {
  id?: string;
  created_at?: string;
  summary?: {
    workgroup: string;
    workgroup_id: string;
    meetingInfo: MeetingInfo;
    agendaItems: AgendaItem[];
    tags: Tags;
    type: 'Custom' | 'Weekly' | 'Monthly';
    noSummaryGiven: boolean;
    canceledSummary: boolean;
    noSummaryGivenText?: string;
    canceledSummaryText?: string;
  };
  workgroup?: string;
  workgroup_id?: string;
  meetingInfo?: MeetingInfo;
  agendaItems?: AgendaItem[];
  tags?: Tags;
  type?: 'Custom' | 'Weekly' | 'Monthly';
  noSummaryGiven?: boolean;
  canceledSummary?: boolean;
  noSummaryGivenText?: string;
  canceledSummaryText?: string;
}

export interface ScriptResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: Error;
}