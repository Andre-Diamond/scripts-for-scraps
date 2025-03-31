import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MeetingSummary } from '../../types';

interface ComparisonResult {
  workgroup: string;
  filePath: string;
  gitbookData: MeetingSummary;
  orderedGitbookData: MeetingSummary;
  supabaseData: MeetingSummary | null;
  orderedSupabaseData: MeetingSummary | null;
  differences: Array<{
    field: string;
    gitbook: unknown;
    supabase: unknown;
  }>;
  commitStatus?: {
    gitbookCommitted?: boolean;
    supabaseCommitted?: boolean;
    bothCommitted?: boolean;
  };
}

interface GitbookSyncContextType {
  isComparing: boolean;
  setIsComparing: (value: boolean) => void;
  comparisonResults: ComparisonResult[];
  setComparisonResults: (results: ComparisonResult[]) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const GitbookSyncContext = createContext<GitbookSyncContextType | undefined>(undefined);

export const GitbookSyncProvider = ({ children }: { children: ReactNode }) => {
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <GitbookSyncContext.Provider
      value={{
        isComparing,
        setIsComparing,
        comparisonResults,
        setComparisonResults,
        error,
        setError,
      }}
    >
      {children}
    </GitbookSyncContext.Provider>
  );
};

export const useGitbookSync = () => {
  const context = useContext(GitbookSyncContext);
  if (context === undefined) {
    throw new Error('useGitbookSync must be used within a GitbookSyncProvider');
  }
  return context;
};