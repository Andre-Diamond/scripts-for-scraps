import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GitbookSyncContextType {
  isComparing: boolean;
  setIsComparing: (value: boolean) => void;
  comparisonResults: any[];
  setComparisonResults: (results: any[]) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const GitbookSyncContext = createContext<GitbookSyncContextType | undefined>(undefined);

export const GitbookSyncProvider = ({ children }: { children: ReactNode }) => {
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
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