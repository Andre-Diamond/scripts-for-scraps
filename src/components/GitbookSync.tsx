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
import { commitFile, formatMeetingPath } from '../services/clientGithubService';

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
  commitStatus?: {
    gitbookCommitted?: boolean;
    supabaseCommitted?: boolean;
    bothCommitted?: boolean;
  };
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
  const [committing, setCommitting] = useState<{ [key: string]: boolean }>({});

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
      // First, fetch the Supabase data to pass to the parser
      const supabaseData = await fetchMeetingSummariesFromSupabase() as DatabaseRecord[];

      const filePath = `timeline/${selectedYear}/${selectedMonth}/${selectedFile}`;
      const markdownContent = await fetchFileContent(filePath);

      // Pass the supabaseData to the parser to enable workgroup_id lookup
      const parsedData = parseMarkdownToJson(markdownContent, supabaseData);

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
      setError('Please select a year and month');
      return;
    }

    setIsComparing(true);
    setError(null);
    setComparisonResults([]);

    try {
      // First, fetch the Supabase data to pass to all parsers
      const supabaseData = await fetchMeetingSummariesFromSupabase() as DatabaseRecord[];

      const contents = await fetchDirectoryContents(`timeline/${selectedYear}/${selectedMonth}`);
      const markdownFiles = contents
        .filter((item: GitHubItem) => item.type === 'file' && item.name.endsWith('.md'))
        .map((item: GitHubItem) => item.name);

      const allResults: ComparisonResult[] = [];

      for (const file of markdownFiles) {
        const filePath = `timeline/${selectedYear}/${selectedMonth}/${file}`;
        const markdownContent = await fetchFileContent(filePath);

        // Pass the supabaseData to the parser to enable workgroup_id lookup
        const parsedData = parseMarkdownToJson(markdownContent, supabaseData);

        // Skip files with parsing errors
        if ('error' in parsedData) {
          console.error(`Error parsing ${file}: ${parsedData.error}`);
          continue;
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

  // Helper function to update the commit status of a specific result
  const updateResultCommitStatus = (index: number, status: Partial<ComparisonResult['commitStatus']>) => {
    const newResults = [...comparisonResults];
    const currentStatus = newResults[index].commitStatus || {};
    newResults[index].commitStatus = { ...currentStatus, ...status };
    setComparisonResults(newResults);
  };

  // Commit GitBook data to GitHub
  const commitGitbookData = async (result: ComparisonResult, index: number) => {
    try {
      const commitId = `${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: true }));

      // Generate appropriate file path for the GitBook data
      const basePath = formatMeetingPath(
        result.filePath,
        result.workgroup,
        result.gitbookData.meetingInfo?.date
      );

      if (!basePath) {
        throw new Error('Could not generate file path from meeting data');
      }

      const gitbookPath = `${basePath}/gitbook-data.json`;
      const changesViewPath = `${basePath}/changes-commit-view.json`;

      // Commit the GitBook data to the original file
      await commitFile(
        gitbookPath,
        JSON.stringify(result.orderedGitbookData, null, 2),
        `Add GitBook data for ${result.workgroup} meeting on ${result.gitbookData.meetingInfo?.date}`
      );

      // Also commit to the changes-commit-view.json file
      const changesViewData = {
        source: "gitbook",
        timestamp: new Date().toISOString(),
        workgroup: result.workgroup,
        meetingDate: result.gitbookData.meetingInfo?.date,
        data: result.orderedGitbookData
      };

      await commitFile(
        changesViewPath,
        JSON.stringify(changesViewData, null, 2),
        `Update changes view with GitBook data for ${result.workgroup} meeting on ${result.gitbookData.meetingInfo?.date}`
      );

      // Update the commit status
      updateResultCommitStatus(index, { gitbookCommitted: true });

    } catch (error) {
      setError(`Failed to commit GitBook data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      const commitId = `${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: false }));
    }
  };

  // Commit Supabase data to GitHub
  const commitSupabaseData = async (result: ComparisonResult, index: number) => {
    if (!result.supabaseData) {
      setError('No Supabase data to commit');
      return;
    }

    try {
      const commitId = `supabase-${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: true }));

      // Generate appropriate file path for the Supabase data
      const basePath = formatMeetingPath(
        result.filePath,
        result.workgroup,
        result.supabaseData.meetingInfo?.date
      );

      if (!basePath) {
        throw new Error('Could not generate file path from meeting data');
      }

      const supabasePath = `${basePath}/supabase-data.json`;
      const changesViewPath = `${basePath}/changes-commit-view.json`;

      // Commit the Supabase data to the original file
      await commitFile(
        supabasePath,
        JSON.stringify(result.orderedSupabaseData, null, 2),
        `Add Supabase data for ${result.workgroup} meeting on ${result.supabaseData.meetingInfo?.date}`
      );

      // Also commit to the changes-commit-view.json file
      const changesViewData = {
        source: "supabase",
        timestamp: new Date().toISOString(),
        workgroup: result.workgroup,
        meetingDate: result.supabaseData.meetingInfo?.date,
        data: result.orderedSupabaseData
      };

      await commitFile(
        changesViewPath,
        JSON.stringify(changesViewData, null, 2),
        `Update changes view with Supabase data for ${result.workgroup} meeting on ${result.supabaseData.meetingInfo?.date}`
      );

      // Update the commit status
      updateResultCommitStatus(index, { supabaseCommitted: true });

    } catch (error) {
      setError(`Failed to commit Supabase data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      const commitId = `supabase-${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: false }));
    }
  };

  // Commit both data files to GitHub
  const commitBothDataFiles = async (result: ComparisonResult, index: number) => {
    try {
      const commitId = `both-${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: true }));

      // Generate appropriate file path for the data
      const basePath = formatMeetingPath(
        result.filePath,
        result.workgroup,
        result.gitbookData.meetingInfo?.date
      );

      if (!basePath) {
        throw new Error('Could not generate file path from meeting data');
      }

      const changesPath = `${basePath}/data-differences.json`;

      // Create a data object with only the differences
      const changesData = {
        workgroup: result.workgroup,
        meetingDate: result.gitbookData.meetingInfo?.date,
        differences: result.differences
      };

      // Commit the changes data
      await commitFile(
        changesPath,
        JSON.stringify(changesData, null, 2),
        `Add differences for ${result.workgroup} meeting on ${result.gitbookData.meetingInfo?.date}`
      );

      // Update the commit status
      updateResultCommitStatus(index, { bothCommitted: true });

    } catch (error) {
      setError(`Failed to commit differences data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      const commitId = `both-${result.workgroup}-${index}`;
      setCommitting(prev => ({ ...prev, [commitId]: false }));
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
                  <JSONFormatter
                    data={result.orderedGitbookData}
                    showCommitButton={true}
                    commitLabel={committing[`${result.workgroup}-${index}`] ? 'Committing...' : 'Commit GitBook Data'}
                    onCommit={() => commitGitbookData(result, index)}
                  />
                  {result.commitStatus?.gitbookCommitted && (
                    <div className="commit-success">✓ GitBook data committed</div>
                  )}
                </div>

                {result.supabaseData && (
                  <div className="preview-column">
                    <h4>Supabase Data (Ordered):</h4>
                    <JSONFormatter
                      data={result.orderedSupabaseData}
                      showCommitButton={true}
                      commitLabel={committing[`supabase-${result.workgroup}-${index}`] ? 'Committing...' : 'Commit Supabase Data'}
                      onCommit={() => commitSupabaseData(result, index)}
                    />
                    {result.commitStatus?.supabaseCommitted && (
                      <div className="commit-success">✓ Supabase data committed</div>
                    )}
                  </div>
                )}
              </div>

              <div className="commit-both-container">
                <button
                  className="commit-both-button"
                  onClick={() => commitBothDataFiles(result, index)}
                  disabled={committing[`both-${result.workgroup}-${index}`]}
                >
                  {committing[`both-${result.workgroup}-${index}`] ? 'Committing...' : 'Commit Data Comparison'}
                </button>
                {result.commitStatus?.bothCommitted && (
                  <span className="commit-success">✓ Comparison data committed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}