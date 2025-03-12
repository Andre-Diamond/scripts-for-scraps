import React, { useState } from 'react';
import { 
  fetchDirectoryContents, 
  fetchFileContent, 
  fetchMeetingSummariesFromSupabase,
  parseMarkdownToJson,
  compareSummaries
} from '../services/gitbookSyncService';
import { useGitbookSync } from '../contexts/GitbookSyncContext';
import JSONFormatter from './JSONFormatter';

export default function GitbookSync() {
  const { 
    isComparing, 
    setIsComparing, 
    comparisonResults, 
    setComparisonResults,
    error,
    setError
  } = useGitbookSync();
  
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  
  // Fetch years from the timeline directory
  const fetchYears = async () => {
    try {
      const contents = await fetchDirectoryContents('timeline');
      const yearDirs = contents
        .filter((item: any) => item.type === 'dir')
        .map((item: any) => item.name);
      setYears(yearDirs);
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // Fetch months from the selected year
  const fetchMonths = async (year: string) => {
    try {
      const contents = await fetchDirectoryContents(`timeline/${year}`);
      const monthDirs = contents
        .filter((item: any) => item.type === 'dir')
        .map((item: any) => item.name);
      setMonths(monthDirs);
      setSelectedYear(year);
      setSelectedMonth('');
      setSelectedFile('');
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // Fetch files from the selected month
  const fetchFiles = async (month: string) => {
    try {
      const contents = await fetchDirectoryContents(`timeline/${selectedYear}/${month}`);
      const markdownFiles = contents
        .filter((item: any) => item.type === 'file' && item.name.endsWith('.md'))
        .map((item: any) => item.name);
      setFiles(markdownFiles);
      setSelectedMonth(month);
      setSelectedFile('');
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // Compare the selected file with Supabase data
  const compareSelected = async () => {
    if (!selectedYear || !selectedMonth || !selectedFile) {
      setError('Please select a file to compare');
      return;
    }
    
    setIsComparing(true);
    setError(null);
    
    try {
      // Fetch GitBook markdown content
      const filePath = `timeline/${selectedYear}/${selectedMonth}/${selectedFile}`;
      const markdownContent = await fetchFileContent(filePath);
      
      // Parse markdown to JSON
      let gitbookData = parseMarkdownToJson(markdownContent);
      
      // Ensure gitbookData is an array for consistent processing
      if (!Array.isArray(gitbookData)) {
        gitbookData = [gitbookData];
      }
      
      // Log the parsed GitBook data to console
      console.log('GitBook Data:', gitbookData);
      
      // Fetch Supabase data
      const supabaseData = await fetchMeetingSummariesFromSupabase();
      console.log('Supabase Data:', supabaseData);
      
      // Process each workgroup in the GitBook data
      const results = [];
      
      for (const workgroupData of gitbookData) {
        console.log('Processing workgroup:', workgroupData.workgroup);
        console.log('Date:', workgroupData.meetingInfo.date);
        
        // Find matching summary in Supabase data
        let matchingSummary = findMatchingSummary(workgroupData, supabaseData);
        
        console.log('Matching summary:', matchingSummary);
        
        if (matchingSummary) {
          // Compare the two data sources
          const differences = compareSummaries(workgroupData, matchingSummary);
          console.log('Differences:', differences);
          
          results.push({
            workgroup: workgroupData.workgroup,
            filePath,
            gitbookData: workgroupData,
            supabaseData: matchingSummary,
            differences
          });
        } else {
          // No matching summary found
          console.log('No matching record found for', workgroupData.workgroup);
          
          results.push({
            workgroup: workgroupData.workgroup,
            filePath,
            gitbookData: workgroupData,
            supabaseData: null,
            differences: [{ field: 'entire record', message: 'No matching record found in database' }]
          });
        }
      }
      
      setComparisonResults(results);
    } catch (err: any) {
      setError(err.message);
      console.error('Error during comparison:', err);
    } finally {
      setIsComparing(false);
    }
  };
  
  // Helper function to find matching summary in Supabase data
const findMatchingSummary = (gitbookData: any, supabaseData: any[]) => {
    return supabaseData.find((record: any) => {
      // Extract the date from GitBook data for comparison
      const gitbookDate = gitbookData.meetingInfo?.date;
      
      // Skip records with invalid dates
      if (!gitbookDate) {
        console.log('GitBook record has no valid date:', gitbookData);
        return false;
      }
      
      // Try to format the date safely
      let formattedDate = gitbookDate;
      // Only attempt ISO conversion if the date is in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(gitbookDate)) {
        try {
          const dateObj = new Date(gitbookDate);
          // Check if date is valid before calling toISOString
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toISOString().split('T')[0];
          } else {
            console.log('Invalid date object created from:', gitbookDate);
          }
        } catch (e) {
          console.warn('Error formatting date:', gitbookDate, e);
        }
      } else {
        console.log('Date not in YYYY-MM-DD format:', gitbookDate);
      }
      
      // Try matching directly with the summary field
      if (record.summary) {
        if (
          record.summary.workgroup === gitbookData.workgroup && 
          record.summary.meetingInfo?.date === gitbookDate
        ) {
          return true;
        }
        
        // Try case-insensitive match
        if (
          record.summary.workgroup?.toLowerCase() === gitbookData.workgroup.toLowerCase() && 
          record.summary.meetingInfo?.date === gitbookDate
        ) {
          return true;
        }
      }
      
      // Try matching with top-level fields
      if (
        record.workgroup === gitbookData.workgroup && 
        (record.date === gitbookDate || 
         (record.date && record.date.includes(gitbookDate)))
      ) {
        return true;
      }
      
      // Try substring matching for dates (handle timezone differences)
      if (record.date && typeof record.date === 'string' && formattedDate) {
        const recordDateStr = record.date.substring(0, 10); // Extract YYYY-MM-DD part
        
        if (
          record.workgroup === gitbookData.workgroup && 
          recordDateStr === formattedDate
        ) {
          return true;
        }
        
        // Case-insensitive workgroup match with date
        if (
          record.workgroup?.toLowerCase() === gitbookData.workgroup.toLowerCase() && 
          recordDateStr === formattedDate
        ) {
          return true;
        }
      }
      
      // Check summary date with similar substring approach
      if (record.summary?.meetingInfo?.date && formattedDate) {
        const summaryDateStr = typeof record.summary.meetingInfo.date === 'string' 
          ? record.summary.meetingInfo.date.substring(0, 10) 
          : record.summary.meetingInfo.date;
          
        if (
          record.summary.workgroup === gitbookData.workgroup && 
          summaryDateStr === formattedDate
        ) {
          return true;
        }
      }
      
      return false;
    });
  };
  
  // Compare all files in the current month
  const compareAll = async () => {
    if (!selectedYear || !selectedMonth) {
      setError('Please select a month to compare');
      return;
    }
    
    setIsComparing(true);
    setError(null);
    setComparisonResults([]);
    
    try {
      // Fetch Supabase data once
      const supabaseData = await fetchMeetingSummariesFromSupabase();
      console.log('All Database Records Count:', supabaseData.length);
      
      // Process each file
      const allResults = [];
      
      for (const file of files) {
        const filePath = `timeline/${selectedYear}/${selectedMonth}/${file}`;
        const markdownContent = await fetchFileContent(filePath);
        let gitbookData = parseMarkdownToJson(markdownContent);
        
        // Ensure gitbookData is an array for consistent processing
        if (!Array.isArray(gitbookData)) {
          gitbookData = [gitbookData];
        }
        
        // Process each workgroup in the file
        for (const workgroupData of gitbookData) {
          console.log(`Processing workgroup ${workgroupData.workgroup} from ${filePath}`);
          
          // Find matching summary in Supabase data
          let matchingSummary = findMatchingSummary(workgroupData, supabaseData);
          
          if (matchingSummary) {
            const differences = compareSummaries(workgroupData, matchingSummary);
            console.log(`Differences for ${workgroupData.workgroup}:`, differences);
            
            allResults.push({
              workgroup: workgroupData.workgroup,
              filePath,
              gitbookData: workgroupData,
              supabaseData: matchingSummary,
              differences
            });
          } else {
            console.log(`No matching record found for ${workgroupData.workgroup}`);
            
            allResults.push({
              workgroup: workgroupData.workgroup,
              filePath,
              gitbookData: workgroupData,
              supabaseData: null,
              differences: [{ field: 'entire record', message: 'No matching record found in database' }]
            });
          }
        }
      }
      
      setComparisonResults(allResults);
    } catch (err: any) {
      setError(err.message);
      console.error('Error during comparison:', err);
    } finally {
      setIsComparing(false);
    }
  };
  
  // Initialize component by fetching years
  React.useEffect(() => {
    fetchYears();
  }, []);
  
  return (
    <div className="gitbook-sync">
      <h1>GitBook to Database Sync</h1>
      
      <div className="selector-container">
        <div>
          <h2>Select Year</h2>
          <div className="year-buttons">
            {years.map(year => (
              <button 
                key={year} 
                onClick={() => fetchMonths(year)}
                className={selectedYear === year ? 'selected' : ''}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
        
        {selectedYear && (
          <div>
            <h2>Select Month</h2>
            <div className="month-buttons">
              {months.map(month => (
                <button 
                  key={month} 
                  onClick={() => fetchFiles(month)}
                  className={selectedMonth === month ? 'selected' : ''}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {selectedMonth && (
          <div>
            <h2>Select File</h2>
            <div className="file-buttons">
              {files.map(file => (
                <button 
                  key={file} 
                  onClick={() => setSelectedFile(file)}
                  className={selectedFile === file ? 'selected' : ''}
                >
                  {file}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="action-buttons">
        <button 
          onClick={compareSelected} 
          disabled={!selectedFile || isComparing}
        >
          Compare Selected
        </button>
        <button 
          onClick={compareAll} 
          disabled={!selectedMonth || isComparing}
        >
          Compare All in Month
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {isComparing && (
        <div className="loading">
          Comparing... Please wait.
        </div>
      )}
      
      {comparisonResults.length > 0 && (
        <div className="results">
          <h2>Comparison Results</h2>
          {comparisonResults.map((result, index) => (
            <div key={index} className="result-item">
              <h3>{result.workgroup} - {result.filePath}</h3>
              
              {!result.supabaseData ? (
                <div className="not-found">
                  No matching record found in the database
                </div>
              ) : result.differences.length === 0 ? (
                <div className="no-differences">
                  Records match! No differences found.
                </div>
              ) : (
                <div className="differences">
                  <h4>Differences Found:</h4>
                  <ul>
                    {result.differences.map((diff, idx) => (
                      <li key={idx}>
                        <strong>{diff.field}:</strong>
                        <div>GitBook: {diff.gitbook}</div>
                        <div>Database: {diff.supabase}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="data-preview">
                <div className="preview-column">
                  <h4>GitBook Data:</h4>
                  <JSONFormatter data={result.gitbookData} />
                </div>
                
                {result.supabaseData && (
                  <div className="preview-column">
                    <h4>Database Data:</h4>
                    <JSONFormatter data={result.supabaseData} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}