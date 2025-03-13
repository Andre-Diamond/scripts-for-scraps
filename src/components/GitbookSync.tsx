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
import { MeetingSummary, DatabaseRecord } from '../../types';
import { applyWorkgroupOrder } from '../utils/orderMapping';
import { removeEmptyValues } from '../utils/cleanUtils';
import { convertParsedDataToMeetingSummary } from '../utils/dataConverters';

interface GitHubItem {
  type: string;
  name: string;
}

interface ComparisonDifference {
  field: string;
  gitbook: unknown;
  supabase: unknown;
}

interface ComparisonResult {
  workgroup: string;
  filePath: string;
  gitbookData: MeetingSummary;
  orderedGitbookData: MeetingSummary;
  supabaseData: MeetingSummary | null;
  orderedSupabaseData: MeetingSummary | null;
  differences: ComparisonDifference[];
}

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
        .filter((item: GitHubItem) => item.type === 'dir')
        .map((item: GitHubItem) => item.name);
      setYears(yearDirs);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  // Fetch months from the selected year
  const fetchMonths = async (year: string) => {
    try {
      const contents = await fetchDirectoryContents(`timeline/${year}`);
      const monthDirs = contents
        .filter((item: GitHubItem) => item.type === 'dir')
        .map((item: GitHubItem) => item.name);
      setMonths(monthDirs);
      setSelectedYear(year);
      setSelectedMonth('');
      setSelectedFile('');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  // Fetch files from the selected month
  const fetchFiles = async (month: string) => {
    try {
      const contents = await fetchDirectoryContents(`timeline/${selectedYear}/${month}`);
      const markdownFiles = contents
        .filter((item: GitHubItem) => item.type === 'file' && item.name.endsWith('.md'))
        .map((item: GitHubItem) => item.name);
      setFiles(markdownFiles);
      setSelectedMonth(month);
      setSelectedFile('');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  // Helper function to extract MeetingSummary from DatabaseRecord
  const extractMeetingSummary = (record: DatabaseRecord): MeetingSummary => {
    if ('summary' in record) {
      return record.summary;
    }
    return record;
  };

  // Helper function to find matching summary in Supabase data
  const findMatchingSummary = (gitbookData: MeetingSummary, supabaseData: DatabaseRecord[]): MeetingSummary | null => {
    const matchingRecord = supabaseData.find((record) => {
      const gitbookDate = gitbookData.meetingInfo?.date;
      const recordSummary = extractMeetingSummary(record);

      if (!gitbookDate) {
        console.log('GitBook record has no valid date:', gitbookData);
        return false;
      }

      if (
        recordSummary.workgroup === gitbookData.workgroup &&
        recordSummary.meetingInfo?.date === gitbookDate
      ) {
        return true;
      }

      // Try case-insensitive match
      if (
        recordSummary.workgroup?.toLowerCase() === gitbookData.workgroup.toLowerCase() &&
        recordSummary.meetingInfo?.date === gitbookDate
      ) {
        return true;
      }

      return false;
    });

    return matchingRecord ? extractMeetingSummary(matchingRecord) : null;
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
      const filePath = `timeline/${selectedYear}/${selectedMonth}/${selectedFile}`;
      const markdownContent = await fetchFileContent(filePath);
      const parsedData = parseMarkdownToJson(markdownContent);

      // Handle potential error in parsing
      if ('error' in parsedData) {
        setError(`Error parsing markdown: ${parsedData.error}`);
        setIsComparing(false);
        return;
      }

      // Convert ParsedMeetingData to MeetingSummary
      let gitbookData = convertParsedDataToMeetingSummary(parsedData);

      if (!Array.isArray(gitbookData)) {
        gitbookData = [gitbookData];
      }

      const supabaseData = await fetchMeetingSummariesFromSupabase() as DatabaseRecord[];
      const results: ComparisonResult[] = [];

      for (const workgroupData of gitbookData) {
        // First apply workgroup-specific ordering to the GitBook data
        const orderedGitbookData = applyWorkgroupOrder(workgroupData);

        // Then clean by removing empty values
        const cleanedOrderedGitbookData = removeEmptyValues(orderedGitbookData) as MeetingSummary;

        // Find matching summary in Supabase data
        const matchingSummary = findMatchingSummary(workgroupData, supabaseData);

        if (matchingSummary) {
          // Apply the same workgroup-specific ordering to Supabase data
          const orderedSupabaseData = applyWorkgroupOrder(matchingSummary);

          // Clean the Supabase data as well to remove empty values
          const cleanedOrderedSupabaseData = removeEmptyValues(orderedSupabaseData) as MeetingSummary;

          // Compare the cleaned and ordered versions of both data sources
          const differences = compareSummaries(
            cleanedOrderedGitbookData,
            cleanedOrderedSupabaseData
          ) as ComparisonDifference[];

          results.push({
            workgroup: workgroupData.workgroup,
            filePath,
            gitbookData: workgroupData,
            orderedGitbookData: cleanedOrderedGitbookData,
            supabaseData: matchingSummary,
            orderedSupabaseData: cleanedOrderedSupabaseData,
            differences
          });
        } else {
          results.push({
            workgroup: workgroupData.workgroup,
            filePath,
            gitbookData: workgroupData,
            orderedGitbookData: cleanedOrderedGitbookData,
            supabaseData: null,
            orderedSupabaseData: null,
            differences: [{
              field: 'entire record',
              gitbook: cleanedOrderedGitbookData,
              supabase: null
            }]
          });
        }
      }

      setComparisonResults(results);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      console.error('Error during comparison:', error);
    } finally {
      setIsComparing(false);
    }
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
      const supabaseData = await fetchMeetingSummariesFromSupabase() as DatabaseRecord[];
      const allResults: ComparisonResult[] = [];

      for (const file of files) {
        const filePath = `timeline/${selectedYear}/${selectedMonth}/${file}`;
        const markdownContent = await fetchFileContent(filePath);
        const parsedData = parseMarkdownToJson(markdownContent);

        // Handle potential error in parsing
        if ('error' in parsedData) {
          setError(`Error parsing markdown: ${parsedData.error}`);
          setIsComparing(false);
          return;
        }

        // Convert ParsedMeetingData to MeetingSummary
        let gitbookData = convertParsedDataToMeetingSummary(parsedData);

        if (!Array.isArray(gitbookData)) {
          gitbookData = [gitbookData];
        }

        for (const workgroupData of gitbookData) {
          // First apply workgroup-specific ordering to the GitBook data
          const orderedGitbookData = applyWorkgroupOrder(workgroupData);

          // Then clean by removing empty values
          const cleanedOrderedGitbookData = removeEmptyValues(orderedGitbookData) as MeetingSummary;

          // Find matching summary in Supabase data
          const matchingSummary = findMatchingSummary(workgroupData, supabaseData);

          if (matchingSummary) {
            // Apply the same workgroup-specific ordering to Supabase data
            const orderedSupabaseData = applyWorkgroupOrder(matchingSummary);

            // Clean the Supabase data as well to remove empty values
            const cleanedOrderedSupabaseData = removeEmptyValues(orderedSupabaseData) as MeetingSummary;

            // Compare the cleaned and ordered versions of both data sources
            const differences = compareSummaries(
              cleanedOrderedGitbookData,
              cleanedOrderedSupabaseData
            ) as ComparisonDifference[];

            allResults.push({
              workgroup: workgroupData.workgroup,
              filePath,
              gitbookData: workgroupData,
              orderedGitbookData: cleanedOrderedGitbookData,
              supabaseData: matchingSummary,
              orderedSupabaseData: cleanedOrderedSupabaseData,
              differences
            });
          } else {
            allResults.push({
              workgroup: workgroupData.workgroup,
              filePath,
              gitbookData: workgroupData,
              orderedGitbookData: cleanedOrderedGitbookData,
              supabaseData: null,
              orderedSupabaseData: null,
              differences: [{
                field: 'entire record',
                gitbook: cleanedOrderedGitbookData,
                supabase: null
              }]
            });
          }
        }
      }

      setComparisonResults(allResults);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      console.error('Error during comparison:', error);
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
          {comparisonResults.map((result: ComparisonResult, index: number) => (
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
                        <div>GitBook: {typeof diff.gitbook === 'object' ?
                          JSON.stringify(diff.gitbook, null, 2) :
                          String(diff.gitbook)}</div>
                        <div>Database: {typeof diff.supabase === 'object' ?
                          JSON.stringify(diff.supabase, null, 2) :
                          String(diff.supabase)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="data-preview">
                <div className="preview-column">
                  <h4>GitBook Data (Ordered):</h4>
                  <JSONFormatter data={result.orderedGitbookData} />
                </div>

                {result.supabaseData && (
                  <div className="preview-column">
                    <h4>Supabase Data (Ordered):</h4>
                    <JSONFormatter data={result.orderedSupabaseData} />
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