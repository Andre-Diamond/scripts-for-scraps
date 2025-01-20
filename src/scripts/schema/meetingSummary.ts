interface WorkingDoc {
  title: string;
  link: string;
}

interface ActionItem {
  dueDate: string;
  status: 'todo' | 'done' | 'in_progress';
}

interface AgendaItem {
  status: 'carry over' | 'completed' | 'in progress';
  actionItems: ActionItem[];
}

interface MeetingInfo {
  name: string;
  date: string;
  host: string;
  documenter: string;
  peoplePresent: string;
  purpose: string;
  workingDocs: WorkingDoc[];
}

interface Tags {
  topicsCovered: string;
  emotions: string;
}

export interface MeetingSummary {
  id: string;
  summary: {
    workgroup: string;
    workgroup_id: string;
    meetingInfo: MeetingInfo;
    agendaItems: AgendaItem[];
    tags: Tags;
    type: string;
    noSummaryGiven: boolean;
    canceledSummary: boolean;
  };
  created_at: string;
}

export interface ScriptResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: Error;
}