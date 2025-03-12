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
    
    // Parse discussion points
    const discussionPointsMatch = agendaContent.match(/#### (?:Discussion Points|In this meeting we discussed):([\s\S]*?)(?=\n#### |$)/);
    if (discussionPointsMatch) {
      const points = discussionPointsMatch[1].match(/- ([^\n]+)/g) || [];
      agendaItem.discussionPoints = points.map((p: string) => p.replace(/- /, '').trim());
    }
    
    // Parse action items
    const actionItemsMatch = agendaContent.match(/#### Action Items:([\s\S]*?)(?=\n#### |$)/);
    if (actionItemsMatch) {
      const actionPattern = /- \[\*\*action\*\*\] ([^\n]+)(?:\n(?:  - \[\*\*[^\]]+\*\*\] [^\n]+)*)?/g;
      const actionMatches = [...actionItemsMatch[1].matchAll(actionPattern)];
      
      for (const actionMatch of actionMatches) {
        const actionText = actionMatch[0];
        const textMatch = actionText.match(/- \[\*\*action\*\*\] ([^\n]+)/);
        const assigneeMatch = actionText.match(/\[\*\*assignee\*\*\] ([^\n\[\]]+)/);
        const statusMatch = actionText.match(/\[\*\*status\*\*\] ([^\n\[\]]+)/);
        const dueMatch = actionText.match(/\[\*\*due\*\*\] ([^\n\[\]]+)/);
        
        if (textMatch) {
          const actionItem: any = {
            text: textMatch[1].trim(),
            assignee: assigneeMatch ? assigneeMatch[1].trim() : '',
            status: statusMatch ? statusMatch[1].trim() : ''
          };
          
          if (dueMatch) {
            actionItem.dueDate = dueMatch[1].trim();
          }
          
          agendaItem.actionItems.push(actionItem);
        }
      }
    }
    
    // Parse decision items
    const decisionItemsMatch = agendaContent.match(/#### Decision Items:([\s\S]*?)(?=\n#### |$)/);
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
    const townHallUpdatesMatch = agendaContent.match(/#### Town Hall Updates:([\s\S]*?)(?=\n#### |$)/);
    if (townHallUpdatesMatch) {
      agendaItem.townHallUpdates = townHallUpdatesMatch[1].trim();
    }
    
    // Parse Town Hall Summary
    const townHallSummaryMatch = agendaContent.match(/#### Town Hall Summary:([\s\S]*?)(?=\n#### |$)/);
    if (townHallSummaryMatch) {
      agendaItem.townHallSummary = townHallSummaryMatch[1].trim();
    }
    
    // Parse Narrative
    const narrativeMatch = agendaContent.match(/#### Narrative:([\s\S]*?)(?=\n#### |$)/);
    if (narrativeMatch) {
      agendaItem.narrative = narrativeMatch[1].trim();
    }
    
    // Parse Game Rules
    const gameRulesMatch = agendaContent.match(/#### Game Rules:([\s\S]*?)(?=\n#### |$)/);
    if (gameRulesMatch) {
      agendaItem.gameRules = gameRulesMatch[1].trim();
    }
    
    // Parse Discussion
    const discussionMatch = agendaContent.match(/#### Discussion:([\s\S]*?)(?=\n#### |$)/);
    if (discussionMatch) {
      agendaItem.discussion = discussionMatch[1].trim();
    }
    
    // Parse Learning Points
    const learningPointsMatch = agendaContent.match(/#### Learning Points:([\s\S]*?)(?=\n#### |$)/);
    if (learningPointsMatch) {
      const points = learningPointsMatch[1].match(/- ([^\n]+)/g) || [];
      agendaItem.learningPoints = points.map((p: string) => p.replace(/- /, '').trim());
    }
    
    // Parse Meeting Topics
    const meetingTopicsMatch = agendaContent.match(/#### (?:Meeting Topics|In this meeting we discussed|Agenda Items):([\s\S]*?)(?=\n#### |$)/);
    if (meetingTopicsMatch) {
      const topics = meetingTopicsMatch[1].match(/- ([^\n]+)/g) || [];
      agendaItem.meetingTopics = topics.map((t: string) => t.replace(/- /, '').trim());
    }
    
    // Parse Issues
    const issuesMatch = agendaContent.match(/#### (?:Issues|To carry over for next meeting):([\s\S]*?)(?=\n#### |$)/);
    if (issuesMatch) {
      const issues = issuesMatch[1].match(/- ([^\n]+)/g) || [];
      agendaItem.issues = issues.map((i: string) => i.replace(/- /, '').trim());
    }
    
    // Parse Leaderboard
    const leaderboardMatch = agendaContent.match(/#### Leaderboard:([\s\S]*?)(?=\n#### |$)/);
    if (leaderboardMatch) {
      const items = leaderboardMatch[1].match(/- [^\n]+/g) || [];
      agendaItem.leaderboard = items.map((i: string) => i.replace(/- \d+(?:st|nd|rd|th) /, '').trim());
    }
    
    parsedData.agendaItems.push(agendaItem);
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

// Function to compare a GitBook entry with a Supabase entry
export function compareSummaries(gitbookData: any, supabaseData: any) {
  // Create a deep copy to avoid mutation issues
  const gitbook = JSON.parse(JSON.stringify(gitbookData));
  const supabase = JSON.parse(JSON.stringify(supabaseData));

  // If supabase data has a nested summary object, use that for comparison
  const supabaseSummary = supabase.summary || supabase;

  const differences = [];

  // Compare workgroup names
  if (gitbook.workgroup !== supabaseSummary.workgroup) {
    differences.push({
      field: 'workgroup',
      gitbook: gitbook.workgroup,
      supabase: supabaseSummary.workgroup
    });
  }

  // Compare meeting info fields
  for (const field of Object.keys(gitbook.meetingInfo)) {
    if (field === 'workingDocs') continue; // Handle workingDocs separately

    if (gitbook.meetingInfo[field] !== supabaseSummary.meetingInfo?.[field]) {
      differences.push({
        field: `meetingInfo.${field}`,
        gitbook: gitbook.meetingInfo[field],
        supabase: supabaseSummary.meetingInfo?.[field] || 'undefined'
      });
    }
  }

  // Compare working docs (titles and links)
  const gitbookDocs = gitbook.meetingInfo.workingDocs || [];
  const supabaseDocs = supabaseSummary.meetingInfo?.workingDocs || [];

  if (gitbookDocs.length !== supabaseDocs.length) {
    differences.push({
      field: 'meetingInfo.workingDocs.length',
      gitbook: gitbookDocs.length,
      supabase: supabaseDocs.length
    });
  }

  // Compare agenda items
  const gitbookAgendaItems = gitbook.agendaItems || [];
  const supabaseAgendaItems = supabaseSummary.agendaItems || [];

  if (gitbookAgendaItems.length !== supabaseAgendaItems.length) {
    differences.push({
      field: 'agendaItems.length',
      gitbook: gitbookAgendaItems.length,
      supabase: supabaseAgendaItems.length
    });
  }

  // Compare tags
  if (gitbook.tags?.topicsCovered !== supabaseSummary.tags?.topicsCovered) {
    differences.push({
      field: 'tags.topicsCovered',
      gitbook: gitbook.tags?.topicsCovered,
      supabase: supabaseSummary.tags?.topicsCovered
    });
  }

  return differences;
}