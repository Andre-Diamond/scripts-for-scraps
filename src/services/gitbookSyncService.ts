import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (you'll need to replace with your actual credentials)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GitHub repository information
const repoOwner = 'SingularityNET-Archive';
const repoName = 'SingularityNET-Archive-GitBook';
const branch = 'main';
const timelinePath = 'timeline';

// Function to fetch directory contents from GitHub
export async function fetchDirectoryContents(path: string) {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch directory contents: ${response.statusText}`);
  }

  return await response.json();
}

// Function to fetch a specific file content from GitHub
export async function fetchFileContent(path: string) {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch file content: ${response.statusText}`);
  }

  const data = await response.json();
  // GitHub API returns content as base64 encoded
  return atob(data.content);
}

// Function to fetch meeting summaries from Supabase
export async function fetchMeetingSummariesFromSupabase() {
  console.log('Attempting to fetch data from Supabase...');

  // Logging Supabase connection details (omitting the key for security)
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase key available:', !!supabaseKey);

  // Verify Supabase client has been initialized properly
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials are missing');
    throw new Error('Supabase credentials are missing. Check your environment variables.');
  }

  try {
    // Fetch data with detailed logging
    console.log('Executing Supabase query on meetingsummaries table...');
    const { data, error, status, statusText } = await supabase
      .from('meetingsummaries')
      .select('*');

    console.log('Supabase response status:', status, statusText);

    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Failed to fetch meeting summaries from Supabase: ${error.message}`);
    }

    console.log(`Successfully fetched ${data?.length || 0} records from Supabase`);

    if (!data || data.length === 0) {
      console.warn('No data returned from Supabase');
    }

    return data || [];
  } catch (err) {
    console.error('Exception during Supabase query:', err);
    throw err;
  }
}

// Function to parse markdown content to JSON format
export function parseMarkdownToJson(markdown: string) {
  // First, check if there's any content to parse
  if (!markdown || markdown.trim() === '') {
    return { error: 'No content to parse' };
  }

  // First, identify all date headings in the document
  const dateHeadings = [];
  const datePattern = /## ([A-Za-z]+) (\d+)(?:st|nd|rd|th) ([A-Za-z]+) (\d{4})/g;
  let dateMatch;
  while ((dateMatch = datePattern.exec(markdown)) !== null) {
    const day = dateMatch[2].padStart(2, '0');
    const month = dateMatch[3];
    const year = dateMatch[4];

    // Convert month name to number
    const monthMap: Record<string, string> = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    const monthNum = monthMap[month];

    // Format as YYYY-MM-DD
    const formattedDate = `${year}-${monthNum}-${day}`;

    dateHeadings.push({
      index: dateMatch.index,
      date: formattedDate
    });
  }

  // Split the markdown into sections by workgroup header (exact ### match with space)
  const workgroupPattern = /(?:^|\n)### ([^\n]+)/g;
  const workgroupMatches = [...markdown.matchAll(workgroupPattern)];

  // If no workgroups found, try to parse as a single document
  if (workgroupMatches.length === 0) {
    return parseSingleWorkgroup(markdown, findClosestDate(0, dateHeadings));
  }

  // Parse each workgroup section
  const allParsedData = [];
  for (let i = 0; i < workgroupMatches.length; i++) {
    const currentMatch = workgroupMatches[i];
    const nextMatch = workgroupMatches[i + 1];

    // Extract the section for this workgroup
    const startIndex = currentMatch.index;
    const endIndex = nextMatch ? nextMatch.index : undefined;
    const workgroupSection = markdown.substring(startIndex, endIndex);

    // Find the closest date heading before this workgroup
    const closestDate = findClosestDate(startIndex, dateHeadings);

    // Parse this section with the associated date
    const parsedData = parseSingleWorkgroup(workgroupSection, closestDate);
    allParsedData.push(parsedData);
  }

  // Return single object if only one workgroup, otherwise return array
  return allParsedData.length === 1 ? allParsedData[0] : allParsedData;
}

// Helper function to find the closest date heading before a given position
function findClosestDate(position, dateHeadings) {
  let closestDate = null;
  let closestDistance = Infinity;

  for (const dateHeading of dateHeadings) {
    // Only consider date headings that come before the current position
    if (dateHeading.index < position && (position - dateHeading.index) < closestDistance) {
      closestDistance = position - dateHeading.index;
      closestDate = dateHeading.date;
    }
  }

  return closestDate;
}

// Helper function to parse a single workgroup section
function parseSingleWorkgroup(section: string, date: string | null) {
  const parsedData: any = {
    workgroup: '',
    workgroup_id: '', // Will need to be looked up or matched
    meetingInfo: {
      name: '',
      date: date || '', // Use the provided date from the closest date heading
      host: '',
      documenter: '',
      translator: '',
      peoplePresent: '',
      purpose: '',
      miroBoardLink: '',
      otherMediaLink: '',
      mediaLink: '',
      meetingVideoLink: '',
      transcriptLink: '',
      townHallNumber: '',
      googleSlides: '',
      workingDocs: []
    },
    agendaItems: [],
    tags: {
      topicsCovered: '',
      emotions: '',
      other: '',
      gamesPlayed: ''
    },
    type: 'Custom',
    noSummaryGiven: false,
    canceledSummary: false
  };

  // Extract workgroup name - making sure we match only ### headers (not #### or others)
  const workgroupMatch = section.match(/^### ([^\n]+)|(?<=\n)### ([^\n]+)/);
  if (workgroupMatch) {
    parsedData.workgroup = (workgroupMatch[1] || workgroupMatch[2]).trim();
  }

  // Extract meeting info
  const typeMatch = section.match(/- \*\*Type of meeting:\*\* ([^\n]+)/);
  if (typeMatch) {
    parsedData.meetingInfo.name = typeMatch[1].trim();
  }

  // The date is already set from the closest date heading, 
  // but we'll also check for an inline date in case it exists
  const inlineDateMatch = section.match(/- \*\*Date:\*\* ([^\n]+)/);
  if (inlineDateMatch) {
    // If there's an inline date, it should override the date from the heading
    parsedData.meetingInfo.date = inlineDateMatch[1].trim();
  }

  // Extract participants, facilitator and documenter
  const presentMatch = section.match(/- \*\*Present:\*\* ([^\n]+)/);
  if (presentMatch) {
    const presentText = presentMatch[1];
    let peoplePresent = presentText;

    // Extract facilitator
    const facilitatorMatch = presentText.match(/([^,\[]+) \[\*\*facilitator\*\*\]/);
    if (facilitatorMatch) {
      parsedData.meetingInfo.host = facilitatorMatch[1].trim();
      peoplePresent = peoplePresent.replace(/\[\*\*facilitator\*\*\]/, '');
    }

    // Extract documenter
    const documenterMatch = presentText.match(/([^,\[]+) \[\*\*documenter\*\*\]/);
    if (documenterMatch) {
      parsedData.meetingInfo.documenter = documenterMatch[1].trim();
      peoplePresent = peoplePresent.replace(/\[\*\*documenter\*\*\]/, '');
    }

    // Extract translator if present
    const translatorMatch = presentText.match(/([^,\[]+) \[\*\*translator\*\*\]/);
    if (translatorMatch) {
      parsedData.meetingInfo.translator = translatorMatch[1].trim();
      peoplePresent = peoplePresent.replace(/\[\*\*translator\*\*\]/, '');
    }

    // Clean up and store all participants
    parsedData.meetingInfo.peoplePresent = peoplePresent
      .split(',')
      .map((p: string) => p.trim())
      .filter((p: string) => p)
      .join(', ');
  }

  // Extract purpose
  const purposeMatch = section.match(/- \*\*Purpose:\*\* ([^\n]+)/);
  if (purposeMatch) {
    parsedData.meetingInfo.purpose = purposeMatch[1].trim();
  }

  // Extract Town Hall Number
  const townHallMatch = section.match(/- \*\*Town Hall Number:\*\* ([^\n]+)/);
  if (townHallMatch) {
    parsedData.meetingInfo.townHallNumber = townHallMatch[1].trim();
  }

  // Extract video links
  const meetingVideoMatch = section.match(/- \*\*Meeting video:\*\* \[Link\]\(([^)]+)\)/i);
  if (meetingVideoMatch) {
    parsedData.meetingInfo.meetingVideoLink = meetingVideoMatch[1].trim();
  }

  // Extract Media link
  const mediaLinkMatch = section.match(/- \*\*Media link:\*\* \[Link\]\(([^)]+)\)/i);
  if (mediaLinkMatch) {
    parsedData.meetingInfo.mediaLink = mediaLinkMatch[1].trim();
  }

  // Extract Miro board link
  const miroBoardMatch = section.match(/- \*\*Miro board:\*\* \[Link\]\(([^)]+)\)/i);
  if (miroBoardMatch) {
    parsedData.meetingInfo.miroBoardLink = miroBoardMatch[1].trim();
  }

  // Extract Transcript link
  const transcriptMatch = section.match(/- \*\*Transcript:\*\* \[Link\]\(([^)]+)\)/i);
  if (transcriptMatch) {
    parsedData.meetingInfo.transcriptLink = transcriptMatch[1].trim();
  }

  // Extract Other media link
  const otherMediaMatch = section.match(/- \*\*Other media:\*\* \[Link\]\(([^)]+)\)/i);
  if (otherMediaMatch) {
    parsedData.meetingInfo.otherMediaLink = otherMediaMatch[1].trim();
  }

  // Extract Google Slides
  const slidesMatch = section.match(/{% embed url="([^"]+)" %}/);
  if (slidesMatch) {
    parsedData.meetingInfo.googleSlides = slidesMatch[1].trim();
  }

  // Extract working docs
  const workingDocsSection = section.match(/- \*\*Working Docs:\*\*([\s\S]*?)(?=\n\s*\n|\n####)/);
  if (workingDocsSection) {
    const docLinks = workingDocsSection[1].match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    parsedData.meetingInfo.workingDocs = docLinks.map((link: string) => {
      const titleMatch = link.match(/\[([^\]]+)\]/);
      const urlMatch = link.match(/\(([^)]+)\)/);
      return {
        title: titleMatch ? titleMatch[1] : '',
        link: urlMatch ? urlMatch[1] : ''
      };
    });
  }

  // Extract agenda items - specifically looking for #### Agenda item pattern
  const agendaPattern = /#### Agenda item (\d+) - ([^-\n]+) - \[([^\]]+)\]([\s\S]*?)(?=\n#### Agenda item|\n### |$)/g;
  const agendaMatches = [...section.matchAll(agendaPattern)];

  // If we found explicit agenda items, process them
  if (agendaMatches.length > 0) {
    for (const match of agendaMatches) {
      const agendaNumber = match[1];
      const agendaTitle = match[2].trim();
      const agendaStatus = match[3].trim();
      const agendaContent = match[4];

      const agendaItem: any = {
        agenda: agendaTitle,
        status: agendaStatus,
        discussionPoints: [],
        actionItems: [],
        decisionItems: [],
        townHallUpdates: '',
        townHallSummary: '',
        narrative: '',
        gameRules: '',
        discussion: '',
        learningPoints: [],
        meetingTopics: [],
        issues: [],
        leaderboard: []
      };

      // Parse content sections
      parseAgendaContent(agendaContent, agendaItem);

      parsedData.agendaItems.push(agendaItem);
    }
  } else {
    // No explicit agenda items found, create a default agenda item to contain all content

    // Find where the meeting info ends and content begins
    const meetingInfoEnd = section.search(/(?:#### Discussion Points|#### In this meeting we discussed|#### Action Items|#### Decision Items|#### Town Hall Updates|#### Town Hall Summary|#### Narrative|#### Game Rules|#### Discussion|#### Learning Points|#### Meeting Topics|#### Issues|#### Leaderboard)/i);

    // If we found content sections, extract them as a single agenda item
    if (meetingInfoEnd !== -1) {
      const contentSection = section.substring(meetingInfoEnd);

      // Create a default agenda item with "carry over" status
      const defaultAgendaItem: any = {
        // No agenda title
        status: "carry over", // Default status
        discussionPoints: [],
        actionItems: [],
        decisionItems: [],
        townHallUpdates: '',
        townHallSummary: '',
        narrative: '',
        gameRules: '',
        discussion: '',
        learningPoints: [],
        meetingTopics: [],
        issues: [],
        leaderboard: []
      };

      // Parse content sections using the same logic as for explicit agenda items
      parseAgendaContent(contentSection, defaultAgendaItem);

      // Only add the agenda item if it has any content
      if (hasAgendaContent(defaultAgendaItem)) {
        parsedData.agendaItems.push(defaultAgendaItem);
      }
    }
  }

  // Parse tags/keywords
  const tagsSection = section.match(/#### Keywords\/tags:([\s\S]*?)(?=\n### |$)/);
  if (tagsSection) {
    const topicsCoveredMatch = tagsSection[1].match(/- \*\*topics covered:\*\* ([^\n]+)/i);
    if (topicsCoveredMatch) {
      parsedData.tags.topicsCovered = topicsCoveredMatch[1].trim();
    }

    const emotionsMatch = tagsSection[1].match(/- \*\*emotions:\*\* ([^\n]+)/i);
    if (emotionsMatch) {
      parsedData.tags.emotions = emotionsMatch[1].trim();
    }

    const otherMatch = tagsSection[1].match(/- \*\*other:\*\* ([^\n]+)/i);
    if (otherMatch) {
      parsedData.tags.other = otherMatch[1].trim();
    }

    const gamesPlayedMatch = tagsSection[1].match(/- \*\*games played:\*\* ([^\n]+)/i);
    if (gamesPlayedMatch) {
      parsedData.tags.gamesPlayed = gamesPlayedMatch[1].trim();
    }
  }

  // Check for no summary given or canceled meeting
  if (section.includes("No Summary Given")) {
    parsedData.noSummaryGiven = true;
    parsedData.noSummaryGivenText = section.match(/No Summary Given/)[0];
  }

  if (section.includes("Meeting was cancelled")) {
    parsedData.canceledSummary = true;
    parsedData.canceledSummaryText = section.match(/Meeting was cancelled/)[0];
  }

  return parsedData;
}

// Helper function to parse content sections of an agenda item
function parseAgendaContent(content: string, agendaItem: any) {
  // Parse discussion points
  const discussionPointsMatch = content.match(/#### (?:Discussion Points|In this meeting we discussed):([\s\S]*?)(?=\n#### |$)/);
  if (discussionPointsMatch) {
    const points = discussionPointsMatch[1].match(/- ([^\n]+)/g) || [];
    agendaItem.discussionPoints = points.map((p: string) => p.replace(/- /, '').trim());
  }

  // Parse action items
  const actionItemsMatch = content.match(/#### Action Items:([\s\S]*?)(?=\n#### |$)/);
  if (actionItemsMatch) {
    // First, split by action items (lines that start with "- [**action**]")
    const actionBlocks = actionItemsMatch[1].split(/(?=\n?- \[\*\*action\*\*\])/);

    for (const block of actionBlocks) {
      if (!block.trim()) continue;

      // Extract the full line that contains the action and possibly metadata
      const actionFullLine = block.match(/- \[\*\*action\*\*\].*$/m);

      if (actionFullLine) {
        const fullLineText = actionFullLine[0];

        // Check if the action line already contains metadata
        const containsInlineMetadata =
          fullLineText.includes("[**assignee**]") ||
          fullLineText.includes("[**due**]") ||
          fullLineText.includes("[**status**]");

        let actionText = '';
        let assignee = '';
        let status = '';
        let dueDate = '';

        if (containsInlineMetadata) {
          // Handle case where all metadata is on the same line as the action

          // Extract action text - it's everything between "[**action**]" and the first metadata tag
          const actionExtract = fullLineText.match(/- \[\*\*action\*\*\] (.*?)(?=\s+\[\*\*assignee\*\*\]|\s+\[\*\*due\*\*\]|\s+\[\*\*status\*\*\]|$)/);
          actionText = actionExtract ? actionExtract[1].trim() : '';

          // Extract assignee
          const assigneeMatch = fullLineText.match(/\[\*\*assignee\*\*\] ([^\[\]]*?)(?=\s+\[\*\*due\*\*\]|\s+\[\*\*status\*\*\]|$)/);
          assignee = assigneeMatch ? assigneeMatch[1].trim() : '';

          // Extract due date
          const dueMatch = fullLineText.match(/\[\*\*due\*\*\] ([^\[\]]*?)(?=\s+\[\*\*assignee\*\*\]|\s+\[\*\*status\*\*\]|$)/);
          dueDate = dueMatch ? dueMatch[1].trim() : '';

          // Extract status
          const statusMatch = fullLineText.match(/\[\*\*status\*\*\] ([^\[\]]*?)(?=\s+\[\*\*assignee\*\*\]|\s+\[\*\*due\*\*\]|$)/);
          status = statusMatch ? statusMatch[1].trim() : '';
        } else {
          // Extract the main action text (without metadata)
          const actionLineMatch = block.match(/- \[\*\*action\*\*\] ([^\n]+)/);
          actionText = actionLineMatch ? actionLineMatch[1].trim() : '';

          // Look for assignee and status on the following line without a dash
          const metadataLine = block.match(/\n\s+\[\*\*assignee\*\*\]|\n\s+\[\*\*status\*\*\]|\n\s+\[\*\*due\*\*\]/);

          if (metadataLine) {
            // Extract metadata from the line following the action
            const assigneeMatch = block.match(/\[\*\*assignee\*\*\]\s+([^\[\]]+?)(?=\s+\[\*\*|\s*$)/);
            const statusMatch = block.match(/\[\*\*status\*\*\]\s+([^\[\]]+?)(?=\s+\[\*\*|\s*$)/);
            const dueMatch = block.match(/\[\*\*due\*\*\]\s+([^\[\]]+?)(?=\s+\[\*\*|\s*$)/);

            assignee = assigneeMatch ? assigneeMatch[1].trim() : '';
            status = statusMatch ? statusMatch[1].trim() : '';
            dueDate = dueMatch ? dueMatch[1].trim() : '';
          } else {
            // Fall back to original format with dashes if no metadata line is found
            const assigneeMatch = block.match(/\n\s+- \[\*\*assignee\*\*\] ([^\n]+)/);
            const statusMatch = block.match(/\n\s+- \[\*\*status\*\*\] ([^\n]+)/);
            const dueMatch = block.match(/\n\s+- \[\*\*due\*\*\] ([^\n]+)/);

            assignee = assigneeMatch ? assigneeMatch[1].trim() : '';
            status = statusMatch ? statusMatch[1].trim() : '';
            dueDate = dueMatch ? dueMatch[1].trim() : '';
          }
        }

        // Create the action item if we have any text
        if (actionText) {
          const actionItem: any = {
            text: actionText,
            assignee: assignee,
            status: status
          };

          if (dueDate) {
            actionItem.dueDate = dueDate;
          }

          agendaItem.actionItems.push(actionItem);
        }
      }
    }
  }

  // Parse decision items
  const decisionItemsMatch = content.match(/#### Decision Items:([\s\S]*?)(?=\n#### |$)/);
  if (decisionItemsMatch) {
    const decisionBlocks = decisionItemsMatch[1].split(/(?=- [^\n]+\n  - \[\*\*(?:effect|rationale|opposing)\*\*\])/);

    for (const block of decisionBlocks) {
      if (!block.trim()) continue;

      const decisionMatch = block.match(/- ([^\n]+)/);
      const effectMatch = block.match(/  - \[\*\*effect\*\*\] ([^\n]+)/);
      const rationaleMatch = block.match(/  - \[\*\*rationale\*\*\] ([^\n]+)/);
      const opposingMatch = block.match(/  - \[\*\*opposing\*\*\] ([^\n]+)/);

      if (decisionMatch) {
        const decisionItem: any = {
          decision: decisionMatch[1].trim(),
          effect: effectMatch ? effectMatch[1].trim() : '',
          rationale: rationaleMatch ? rationaleMatch[1].trim() : '',
          opposing: opposingMatch ? opposingMatch[1].trim() : ''
        };
        agendaItem.decisionItems.push(decisionItem);
      }
    }
  }

  // Parse Town Hall Updates
  const townHallUpdatesMatch = content.match(/#### Town Hall Updates:([\s\S]*?)(?=\n#### |$)/);
  if (townHallUpdatesMatch) {
    agendaItem.townHallUpdates = townHallUpdatesMatch[1].trim();
  }

  // Parse Town Hall Summary
  const townHallSummaryMatch = content.match(/#### Town Hall Summary:([\s\S]*?)(?=\n#### |$)/);
  if (townHallSummaryMatch) {
    agendaItem.townHallSummary = townHallSummaryMatch[1].trim();
  }

  // Parse Narrative
  const narrativeMatch = content.match(/#### Narrative:([\s\S]*?)(?=\n#### |$)/);
  if (narrativeMatch) {
    agendaItem.narrative = narrativeMatch[1].trim();
  }

  // Parse Game Rules
  const gameRulesMatch = content.match(/#### Game Rules:([\s\S]*?)(?=\n#### |$)/);
  if (gameRulesMatch) {
    agendaItem.gameRules = gameRulesMatch[1].trim();
  }

  // Parse Discussion
  const discussionMatch = content.match(/#### Discussion:([\s\S]*?)(?=\n#### |$)/);
  if (discussionMatch) {
    agendaItem.discussion = discussionMatch[1].trim();
  }

  // Parse Learning Points
  const learningPointsMatch = content.match(/#### Learning Points:([\s\S]*?)(?=\n#### |$)/);
  if (learningPointsMatch) {
    const points = learningPointsMatch[1].match(/- ([^\n]+)/g) || [];
    agendaItem.learningPoints = points.map((p: string) => p.replace(/- /, '').trim());
  }

  // Parse Meeting Topics
  const meetingTopicsMatch = content.match(/#### (?:Meeting Topics|In this meeting we discussed|Agenda Items):([\s\S]*?)(?=\n#### |$)/);
  if (meetingTopicsMatch) {
    const topics = meetingTopicsMatch[1].match(/- ([^\n]+)/g) || [];
    agendaItem.meetingTopics = topics.map((t: string) => t.replace(/- /, '').trim());
  }

  // Parse Issues
  const issuesMatch = content.match(/#### (?:Issues|To carry over for next meeting):([\s\S]*?)(?=\n#### |$)/);
  if (issuesMatch) {
    const issues = issuesMatch[1].match(/- ([^\n]+)/g) || [];
    agendaItem.issues = issues.map((i: string) => i.replace(/- /, '').trim());
  }

  // Parse Leaderboard
  const leaderboardMatch = content.match(/#### Leaderboard:([\s\S]*?)(?=\n#### |$)/);
  if (leaderboardMatch) {
    const items = leaderboardMatch[1].match(/- [^\n]+/g) || [];
    agendaItem.leaderboard = items.map((i: string) => i.replace(/- \d+(?:st|nd|rd|th) /, '').trim());
  }
}

// Helper function to check if an agenda item has any content
function hasAgendaContent(agendaItem: any): boolean {
  return (
    agendaItem.discussionPoints.length > 0 ||
    agendaItem.actionItems.length > 0 ||
    agendaItem.decisionItems.length > 0 ||
    agendaItem.townHallUpdates.trim() !== '' ||
    agendaItem.townHallSummary.trim() !== '' ||
    agendaItem.narrative.trim() !== '' ||
    agendaItem.gameRules.trim() !== '' ||
    agendaItem.discussion.trim() !== '' ||
    agendaItem.learningPoints.length > 0 ||
    agendaItem.meetingTopics.length > 0 ||
    agendaItem.issues.length > 0 ||
    agendaItem.leaderboard.length > 0
  );
}

// Function to compare a GitBook entry with a Supabase entry
export function compareSummaries(gitbookData: any, supabaseData: any) {
  // Create deep copies to avoid mutation issues
  const gitbook = JSON.parse(JSON.stringify(gitbookData));
  const supabase = JSON.parse(JSON.stringify(supabaseData));

  // If supabase data has a nested summary object, use that for comparison
  const supabaseSummary = supabase.summary || supabase;

  // Clean and preprocess the data before comparison
  const cleanedGitbook = preprocessData(gitbook);
  const cleanedSupabase = preprocessData(supabaseSummary);

  // Compare the cleaned data
  return compareObjects(cleanedGitbook, cleanedSupabase);
}

// Preprocess the data to fix common issues
function preprocessData(data: any): any {
  if (!data) return data;

  // Deep clone to avoid modifying the original
  const processed = JSON.parse(JSON.stringify(data));

  // If data has agendaItems, process each item
  if (processed.agendaItems && Array.isArray(processed.agendaItems)) {
    processed.agendaItems = processed.agendaItems.map(item => {
      // Process discussionPoints
      if (item.discussionPoints) {
        // Ensure discussionPoints is an array of strings (not characters)
        if (Array.isArray(item.discussionPoints)) {
          // Convert each item to a string and clean it
          item.discussionPoints = item.discussionPoints.map(point => {
            if (typeof point === 'string') {
              return cleanString(point);
            }
            return point;
          });
        }
      }

      // Process actionItems
      if (item.actionItems && Array.isArray(item.actionItems)) {
        item.actionItems = item.actionItems.map(action => {
          if (action.text) {
            // Clean action text and remove metadata tags
            action.text = cleanActionText(action.text);
          }
          return action;
        });
      }

      // Process decisionItems
      if (item.decisionItems && Array.isArray(item.decisionItems)) {
        item.decisionItems = item.decisionItems.map(decision => {
          if (decision.decision) {
            // Clean decision text and normalize year references
            decision.decision = cleanDecisionText(decision.decision);
          }
          return decision;
        });
      }

      return item;
    });
  }

  return processed;
}

// Clean action text by removing metadata and normalizing
function cleanActionText(text: string): string {
  if (!text) return text;

  return text
    .replace(/\[\*\*assignee\*\*\].*?(?=\[|$)/g, '')
    .replace(/\[\*\*status\*\*\].*?(?=\[|$)/g, '')
    .replace(/\[\*\*due\*\*\].*?(?=\[|$)/g, '')
    .replace(/\[\*\*action\*\*\]/g, '')
    .replace(/Quarter\s+(\d)\s+2025/gi, 'Quarter $1')
    .replace(/Q(\d)\s+2025/gi, 'Q$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean decision text by normalizing
function cleanDecisionText(text: string): string {
  if (!text) return text;

  return text
    .replace(/Quarter\s+(\d)\s+2025/gi, 'Quarter $1')
    .replace(/Q(\d)\s+2025/gi, 'Q$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean general strings
function cleanString(text: string): string {
  if (!text) return text;

  return text
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper function to normalize strings for comparison
function normalizeString(str: any): string {
  if (typeof str !== 'string') return String(str);

  // Trim whitespace, normalize spacing, and convert to lowercase
  let normalized = str.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // Remove metadata tags commonly found in GitBook but not in database
  normalized = normalized
    .replace(/\[\*\*assignee\*\*\]\s+[^\[\]]+/g, '')
    .replace(/\[\*\*status\*\*\]\s+[^\[\]]+/g, '')
    .replace(/\[\*\*due\*\*\]\s+[^\[\]]+/g, '')
    .replace(/\[\*\*action\*\*\]/g, '')
    .replace(/\[\*\*effect\*\*\]/g, '')
    .replace(/\[\*\*rationale\*\*\]/g, '')
    .replace(/\[\*\*opposing\*\*\]/g, '');

  // Normalize year references (2025 vs just 25)
  normalized = normalized
    .replace(/\b(q[1-4])\s+2025\b/gi, '$1')
    .replace(/\bquarter\s+[1-4]\s+2025\b/gi, 'quarter $1');

  // Clean up any double spaces created during replacements
  return normalized.replace(/\s+/g, ' ').trim();
}

// Helper function to compare objects and collect differences
function compareObjects(gitbook: any, supabase: any, path: string = ''): any[] {
  const differences = [];

  // Specifically handle discussionPoints differently
  if (path.includes('discussionPoints')) {
    // For discussionPoints, we want to compare whole strings, not character by character
    if (typeof gitbook === 'string' && typeof supabase === 'string') {
      if (normalizeString(gitbook) !== normalizeString(supabase)) {
        differences.push({
          field: path,
          gitbook: gitbook,
          supabase: supabase
        });
      }
      return differences;
    }
  }

  // Special handling for action items text field
  if (path.includes('actionItems') && path.endsWith('.text')) {
    // For action item text, use extra normalization
    if (typeof gitbook === 'string' && typeof supabase === 'string') {
      const normalizedGitbook = normalizeString(gitbook);
      const normalizedSupabase = normalizeString(supabase);

      if (normalizedGitbook !== normalizedSupabase) {
        differences.push({
          field: path,
          gitbook: gitbook,
          supabase: supabase
        });
      }
      return differences;
    }
  }

  // Special handling for decision items
  if (path.includes('decisionItems') && path.endsWith('.decision')) {
    // For decision item text, use extra normalization
    if (typeof gitbook === 'string' && typeof supabase === 'string') {
      const normalizedGitbook = normalizeString(gitbook);
      const normalizedSupabase = normalizeString(supabase);

      if (normalizedGitbook !== normalizedSupabase) {
        differences.push({
          field: path,
          gitbook: gitbook,
          supabase: supabase
        });
      }
      return differences;
    }
  }

  // Compare primitive values and collect differences
  for (const key of new Set([...Object.keys(gitbook || {}), ...Object.keys(supabase || {})])) {
    const currentPath = path ? `${path}.${key}` : key;
    const gitbookValue = gitbook?.[key];
    const supabaseValue = supabase?.[key];

    // Skip comparison for specific fields that we don't want to report differences on
    if (currentPath.includes('discussionPoints') && /\.\d+\.\d+$/.test(currentPath)) {
      continue; // Skip character-by-character comparison for discussionPoints
    }

    // Compare types
    if (typeof gitbookValue !== typeof supabaseValue) {
      differences.push({
        field: currentPath,
        gitbook: gitbookValue,
        supabase: supabaseValue
      });
      continue;
    }

    // Handle objects and arrays
    if (typeof gitbookValue === 'object' && gitbookValue !== null) {
      if (Array.isArray(gitbookValue)) {
        if (!Array.isArray(supabaseValue) || gitbookValue.length !== supabaseValue.length) {
          // Only report array length differences for non-discussionPoints
          if (!currentPath.includes('discussionPoints')) {
            differences.push({
              field: `${currentPath}.length`,
              gitbook: gitbookValue.length,
              supabase: supabaseValue?.length || 0
            });
          }
        }

        // Handle array element comparison
        if (Array.isArray(supabaseValue)) {
          // For discussionPoints arrays, compare element by element
          if (currentPath === 'agendaItems.discussionPoints' ||
            currentPath.match(/agendaItems\[\d+\]\.discussionPoints$/)) {
            const maxLen = Math.max(gitbookValue.length, supabaseValue.length);
            for (let i = 0; i < maxLen; i++) {
              const gitItem = gitbookValue[i];
              const supItem = supabaseValue[i];

              if (i >= gitbookValue.length) {
                differences.push({
                  field: `${currentPath}[${i}]`,
                  gitbook: undefined,
                  supabase: supItem
                });
              } else if (i >= supabaseValue.length) {
                differences.push({
                  field: `${currentPath}[${i}]`,
                  gitbook: gitItem,
                  supabase: undefined
                });
              } else if (normalizeString(gitItem) !== normalizeString(supItem)) {
                differences.push({
                  field: `${currentPath}[${i}]`,
                  gitbook: gitItem,
                  supabase: supItem
                });
              }
            }
          } else {
            // Regular array comparison
            for (let i = 0; i < gitbookValue.length; i++) {
              if (i < supabaseValue.length) {
                differences.push(...compareObjects(
                  gitbookValue[i],
                  supabaseValue[i],
                  `${currentPath}[${i}]`
                ));
              }
            }
          }
        }
      } else {
        // Regular object comparison
        differences.push(...compareObjects(gitbookValue, supabaseValue, currentPath));
      }
    } else if (typeof gitbookValue === 'string' && typeof supabaseValue === 'string') {
      // String comparison with normalization
      if (normalizeString(gitbookValue) !== normalizeString(supabaseValue)) {
        differences.push({
          field: currentPath,
          gitbook: gitbookValue,
          supabase: supabaseValue
        });
      }
    } else if (gitbookValue !== supabaseValue) {
      // Other primitive value comparison
      differences.push({
        field: currentPath,
        gitbook: gitbookValue,
        supabase: supabaseValue
      });
    }
  }

  return differences;
}