import React from 'react';
import GitbookSync from '../components/GitbookSync';

export default function GitbookSyncPage() {
  return (
    <div className="container">
      <h1>GitBook Sync Tool</h1>
      <p>This tool compares meeting summaries from GitBook with those in the database.</p>
      
      <GitbookSync />
    </div>
  );
}