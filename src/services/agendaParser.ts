import { AgendaItem } from './types';

// Function to detect and repair character-by-character storage issues
function repairTopicsArray(topics: unknown[]): string[] {
    if (!topics || topics.length === 0) return [];

    // Check if this might be a character-by-character array
    const isSingleCharArray = topics.length > 5 &&
        topics.filter(t => typeof t === 'string' && t.length === 1).length > topics.length * 0.7;

    if (isSingleCharArray) {
        console.log('Detected character-by-character array, repairing...');

        // Attempt to reconstruct original strings based on specific patterns
        const reconstructed: string[] = [];
        let currentWord = '';
        let i = 0;

        while (i < topics.length) {
            const char = String(topics[i] || '');

            // If empty space and we have accumulated characters, 
            // this might be a word boundary
            if ((char === ' ' || char === '') && currentWord.length > 0) {
                // Decide whether to add a space or start a new word
                // Check if next chars form a new word (capital letter followed by lowercase)
                const nextIndex = i + 1;
                if (nextIndex < topics.length) {
                    const nextChar = String(topics[nextIndex] || '');
                    if (nextChar.match(/[A-Z]/) &&
                        nextIndex + 1 < topics.length &&
                        String(topics[nextIndex + 1] || '').match(/[a-z]/)) {
                        // Likely a new word - add current and start new
                        reconstructed.push(currentWord);
                        currentWord = '';
                    } else {
                        // Just a space within the same word/phrase
                        currentWord += ' ';
                    }
                } else {
                    // End of array, push the current word
                    reconstructed.push(currentWord);
                    currentWord = '';
                }
            } else {
                // Add character to current word
                currentWord += char;
            }
            i++;
        }

        // Add any remaining word
        if (currentWord.length > 0) {
            reconstructed.push(currentWord);
        }

        // If reconstruction produced nothing useful, fall back to joining everything
        if (reconstructed.length === 0) {
            return [topics.map(char => String(char || '')).join('')];
        }

        // Final refinement of reconstructed array
        const result: string[] = [];
        for (const item of reconstructed) {
            // Check if it might be multiple topics joined
            if (item.length > 40 && item.includes(',')) {
                // Split by commas and add each as a separate item
                const parts = item.split(',').map(p => p.trim()).filter(Boolean);
                result.push(...parts);
            } else {
                result.push(item);
            }
        }

        return result;
    }

    // Not a character array, just ensure all items are strings
    return topics.map(topic => String(topic || ''));
}

// Helper function to check if an agenda item has any content
export function hasAgendaContent(agendaItem: AgendaItem): boolean {
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
        agendaItem.leaderboard.length > 0 ||
        agendaItem.peoplePresent.length > 0 ||
        agendaItem.facilitator.trim() !== '' ||
        agendaItem.documenter.trim() !== ''
    );
}

// Helper function to parse content sections of an agenda item
export function parseAgendaContent(content: string, agendaItem: AgendaItem): void {
    console.log('Starting agenda content parsing...');

    // Initialize meetingTopics array to ensure it's never undefined
    if (!agendaItem.meetingTopics) {
        agendaItem.meetingTopics = [];
    }

    // Initialize peoplePresent array
    if (!agendaItem.peoplePresent) {
        agendaItem.peoplePresent = [];
    }

    // Initialize facilitator and documenter
    if (!agendaItem.facilitator) {
        agendaItem.facilitator = '';
    }

    if (!agendaItem.documenter) {
        agendaItem.documenter = '';
    }

    // For debugging: log what we're working with
    console.log('Content to parse length:', content?.length);

    // Parse People Present - maintaining original casing
    const peopleMatch = content.match(/#### (?:People|Attendees|People Present):([\s\S]*?)(?=\n#### |$)/i);
    if (peopleMatch) {
        const peopleText = peopleMatch[1].trim();
        console.log('Original peoplePresent text from markdown:', peopleText);

        // If the list is formatted as bullet points
        const bulletPoints = peopleText.match(/^-\s+([^\n]+)/gm);
        if (bulletPoints && bulletPoints.length > 0) {
            agendaItem.peoplePresent = bulletPoints.map(p => p.replace(/^-\s+/, '').trim());
        } else {
            // Otherwise, try comma-separated list
            const people = peopleText.split(',').map(p => p.trim()).filter(Boolean);
            if (people.length > 0) {
                agendaItem.peoplePresent = people;
            } else {
                // Last option: split by newlines
                const lines = peopleText.split('\n').map(line => line.trim()).filter(Boolean);
                agendaItem.peoplePresent = lines;
            }
        }
        console.log('Preserved original case for peoplePresent:', agendaItem.peoplePresent);
    }

    // Parse Facilitator - maintaining original casing
    const facilitatorMatch = content.match(/#### Facilitator:([\s\S]*?)(?=\n#### |$)/i);
    if (facilitatorMatch) {
        const originalFacilitator = facilitatorMatch[1].trim();
        console.log('Original facilitator text from markdown:', originalFacilitator);
        agendaItem.facilitator = originalFacilitator;
        console.log('Preserved original case for facilitator:', agendaItem.facilitator);
    }

    // Parse Documenter - maintaining original casing
    const documenterMatch = content.match(/#### (?:Documenter|Note Taker):([\s\S]*?)(?=\n#### |$)/i);
    if (documenterMatch) {
        const originalDocumenter = documenterMatch[1].trim();
        console.log('Original documenter text from markdown:', originalDocumenter);
        agendaItem.documenter = originalDocumenter;
        console.log('Preserved original case for documenter:', agendaItem.documenter);
    }

    // Remove facilitator and documenter from peoplePresent if they exist there
    // Use case-insensitive comparison, but maintain original casing for remaining entries
    if (agendaItem.facilitator && agendaItem.peoplePresent.length > 0) {
        const facilitatorLower = agendaItem.facilitator.toLowerCase();
        const peopleBeforeFilter = [...agendaItem.peoplePresent];

        agendaItem.peoplePresent = agendaItem.peoplePresent.filter(
            person => person.toLowerCase() !== facilitatorLower
        );

        if (peopleBeforeFilter.length !== agendaItem.peoplePresent.length) {
            console.log('Removed facilitator from peoplePresent while preserving case for others');
        }
    }

    if (agendaItem.documenter && agendaItem.peoplePresent.length > 0) {
        const documenterLower = agendaItem.documenter.toLowerCase();
        const peopleBeforeFilter = [...agendaItem.peoplePresent];

        agendaItem.peoplePresent = agendaItem.peoplePresent.filter(
            person => person.toLowerCase() !== documenterLower
        );

        if (peopleBeforeFilter.length !== agendaItem.peoplePresent.length) {
            console.log('Removed documenter from peoplePresent while preserving case for others');
        }
    }

    // Sort peoplePresent alphabetically while preserving original case
    if (agendaItem.peoplePresent.length > 0) {
        agendaItem.peoplePresent.sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
        console.log('Sorted peoplePresent alphabetically');
    }

    // Final verification of case preservation
    console.log('Final data with preserved case:');
    console.log('- facilitator:', agendaItem.facilitator);
    console.log('- documenter:', agendaItem.documenter);
    console.log('- peoplePresent:', agendaItem.peoplePresent);

    // FIRST PRIORITY: Look specifically for #### Agenda Items: format
    const agendaItemsHeadingMatch = content.match(/####\s+Agenda\s+Items\s*:/i);
    console.log('Agenda Items heading found:', !!agendaItemsHeadingMatch);

    if (agendaItemsHeadingMatch) {
        // Find the position of the heading
        const headingPosition = agendaItemsHeadingMatch.index || 0;

        // Extract the content after the heading until the next heading or end of content
        const afterHeading = content.substring(headingPosition + agendaItemsHeadingMatch[0].length);
        const nextHeadingMatch = afterHeading.match(/####/);
        const itemsContent = nextHeadingMatch
            ? afterHeading.substring(0, nextHeadingMatch.index).trim()
            : afterHeading.trim();

        console.log('Items content length:', itemsContent.length);

        // Get all bullet point items - matching only lines that start with a dash
        const bulletPoints = itemsContent.match(/^-\s+(.+)$/gm);
        console.log('Bullet points found:', bulletPoints?.length);

        if (bulletPoints && bulletPoints.length > 0) {
            // Process bullet points by removing only the leading dash prefix
            agendaItem.meetingTopics = bulletPoints.map(line =>
                line.replace(/^-\s+/, '').trim()
            );
            console.log('Successfully extracted agenda items:', agendaItem.meetingTopics);

            // If we successfully processed the items, we can skip other methods
            if (agendaItem.meetingTopics.length > 0) {
                console.log('Agenda items found and processed, skipping other methods');
                // Continue with the rest of the parsing logic below
            }
        }
    }

    // If we still don't have agenda items, try the previous methods
    if (!agendaItem.meetingTopics || agendaItem.meetingTopics.length === 0) {
        console.log('Falling back to previous methods');

        // Handle the specific format shown in the example with very precise regex
        // Match the "#### Agenda Items:" heading and capture everything until the next heading
        const specificAgendaMatch = content.match(/####\s+Agenda\s+Items:\s*\n((?:- [^\n]+\n?)+)/);
        console.log('Specific Agenda Match found:', !!specificAgendaMatch);

        if (specificAgendaMatch) {
            // Extract just the list items
            console.log('Matched content:', specificAgendaMatch[1]);

            // Get all lines starting with "- "
            const lines = specificAgendaMatch[1].split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('-'));

            console.log('Found agenda item lines:', lines);

            // Process the lines to remove the dash prefix
            if (lines.length > 0) {
                agendaItem.meetingTopics = lines.map(line => line.substring(1).trim());
                console.log('Successfully extracted agenda items:', agendaItem.meetingTopics);

                // If we successfully parsed the items, we can skip the other methods
                if (agendaItem.meetingTopics.length > 0) {
                    console.log('Agenda items found, skipping other methods');
                    // Continue with the rest of the parsing
                }
            }
        }
    }

    // If we still don't have agenda items, try the previous methods
    if (!agendaItem.meetingTopics || agendaItem.meetingTopics.length === 0) {
        console.log('Falling back to previous methods');

        // First try to parse Agenda Items directly - with improved regex for the sample format
        // Note the change in regex pattern - now more permissive with whitespace and captures multi-line content better
        const agendaItemsMatch = content.match(/####\s*Agenda\s+Items\s*:([^#]*?)(?=\n\s*####|$)/i);
        console.log('Direct Agenda Items parsing attempt:', { found: !!agendaItemsMatch });

        if (agendaItemsMatch) {
            // Extract bullet points, filtering out empty lines and non-bullet point content
            const bulletPointsText = agendaItemsMatch[1].trim();
            console.log('Raw agenda items section:', bulletPointsText);

            // First try to match bullet point format directly
            const bulletPoints = bulletPointsText.match(/^\s*-\s+([^\n]+)$/gm);

            if (bulletPoints && bulletPoints.length > 0) {
                // Process bullet points
                agendaItem.meetingTopics = bulletPoints.map(bp => bp.replace(/^\s*-\s+/, '').trim());
                console.log('Processed bullet point items:', agendaItem.meetingTopics);
            } else {
                // Fallback to line-by-line parsing
                const lines = bulletPointsText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                // Check if any lines start with a dash - this is a simpler bullet point check
                const hasDashLines = lines.some(line => line.startsWith('-'));

                if (hasDashLines) {
                    // Process as dash-prefixed lines - only removing the leading dash
                    const processedLines = lines
                        .filter(line => line.startsWith('-'))
                        .map(line => {
                            // Only remove the first dash and space, preserving any internal hyphens
                            return line.replace(/^-\s+/, '').trim();
                        });

                    console.log('Processed dash-prefixed lines:', processedLines);

                    if (processedLines.length > 0) {
                        agendaItem.meetingTopics = processedLines;
                    }
                } else {
                    // Process as normal lines
                    console.log('Fallback line-by-line parsing:', lines);

                    if (lines.length > 0) {
                        agendaItem.meetingTopics = lines;
                    }
                }
            }
        } else {
            // Try the more general Meeting Topics parser as a fallback
            const meetingTopicsMatch = content.match(/####\s*(?:Meeting\s+Topics|In\s+this\s+meeting\s+we\s+discussed|Agenda\s+Items)\s*:([^#]*?)(?=\n\s*####|$)/i);
            console.log('Meeting Topics parsing attempt:', { found: !!meetingTopicsMatch });

            if (meetingTopicsMatch) {
                const topicsText = meetingTopicsMatch[1].trim();

                // Try to match bullet points
                const bulletPoints = topicsText.match(/^\s*-\s+([^\n]+)$/gm);

                if (bulletPoints && bulletPoints.length > 0) {
                    agendaItem.meetingTopics = bulletPoints.map(bp => bp.replace(/^\s*-\s+/, '').trim());
                    console.log('Processed Meeting Topics bullet points:', agendaItem.meetingTopics);
                } else {
                    // Fallback to line-by-line for Meeting Topics
                    const lines = topicsText.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);

                    // Check if any lines start with a dash - this is a simpler bullet point check
                    const hasDashLines = lines.some(line => line.startsWith('-'));

                    if (hasDashLines) {
                        // Process as dash-prefixed lines
                        const processedLines = lines
                            .filter(line => line.startsWith('-'))
                            .map(line => line.substring(1).trim());

                        console.log('Processed Meeting Topics dash-prefixed lines:', processedLines);

                        if (processedLines.length > 0) {
                            agendaItem.meetingTopics = processedLines;
                        }
                    } else {
                        // Process as normal lines
                        console.log('Fallback line-by-line parsing for Meeting Topics:', lines);

                        if (lines.length > 0) {
                            agendaItem.meetingTopics = lines;
                        }
                    }
                }
            }
        }
    }

    // Last resort - if all other methods failed, do a direct search for the exact heading and extract content
    if (!agendaItem.meetingTopics || agendaItem.meetingTopics.length === 0) {
        console.log('All regex methods failed, attempting direct search...');

        // Find the exact "#### Agenda Items:" line
        const lines = content.split('\n');
        const agendaItemsIndex = lines.findIndex(line =>
            line.trim() === '#### Agenda Items:' ||
            line.trim() === '#### Agenda Items:'
        );

        if (agendaItemsIndex !== -1) {
            console.log('Found agenda items header at line', agendaItemsIndex);

            // Extract bullet points until the next header (starts with ####)
            const bulletPoints = [];
            for (let i = agendaItemsIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();

                // Stop if we hit another header
                if (line.startsWith('####')) {
                    break;
                }

                // If it's a bullet point line, add it
                if (line.startsWith('-')) {
                    bulletPoints.push(line.substring(1).trim());
                }
            }

            console.log('Direct extraction found bullet points:', bulletPoints);

            if (bulletPoints.length > 0) {
                agendaItem.meetingTopics = bulletPoints;
                console.log('Successfully extracted agenda items using direct search');
            }
        }
    }

    // Ensure meetingTopics are processed consistently
    if (agendaItem.meetingTopics && agendaItem.meetingTopics.length > 0) {
        // First check if this is a character-by-character array
        agendaItem.meetingTopics = repairTopicsArray(agendaItem.meetingTopics);

        // Apply standard normalization
        // First, ensure each topic is a proper string
        const fixedTopics: string[] = [];

        for (let i = 0; i < agendaItem.meetingTopics.length; i++) {
            const topic = agendaItem.meetingTopics[i];

            // Check if this topic is already a proper string
            if (typeof topic === 'string' && topic.length > 0) {
                // If it looks like a single character and the next few items are also single characters,
                // this is likely a word that got split into individual characters
                if (topic.length === 1 && i < agendaItem.meetingTopics.length - 1 &&
                    typeof agendaItem.meetingTopics[i + 1] === 'string' &&
                    agendaItem.meetingTopics[i + 1].length === 1) {

                    // Try to collect characters until we hit a full word or end of array
                    let combinedWord = topic;
                    let j = i + 1;

                    while (j < agendaItem.meetingTopics.length &&
                        typeof agendaItem.meetingTopics[j] === 'string' &&
                        agendaItem.meetingTopics[j].length === 1) {
                        combinedWord += agendaItem.meetingTopics[j];
                        j++;
                    }

                    // If we found a sequence of characters, add the combined word and skip ahead
                    if (combinedWord.length > 1) {
                        fixedTopics.push(combinedWord);
                        i = j - 1; // Skip to the end of the combined sequence
                        continue;
                    }
                }

                // Regular string - use as is
                fixedTopics.push(topic);
            }
            else if (topic) {
                // Convert any non-string to string
                fixedTopics.push(String(topic));
            }
        }

        // Replace the original array with our fixed version
        agendaItem.meetingTopics = fixedTopics;

        // Final sanitization
        agendaItem.meetingTopics = agendaItem.meetingTopics.map(topic => {
            // Remove any weird characters or normalize spacing
            return topic.trim()
                .replace(/\s+/g, ' ') // Normalize spaces
                .replace(/^\W+|\W+$/g, ''); // Remove non-word chars at start/end
        }).filter(Boolean); // Remove any empty strings

        // Check for and split items that contain newlines
        const expandedTopics: string[] = [];
        for (const topic of agendaItem.meetingTopics) {
            if (topic.includes("\n")) {
                // This is likely two topics combined with a newline
                // Split them and add each part separately
                const parts = topic.split("\n").map(part => part.trim()).filter(Boolean);
                expandedTopics.push(...parts);
            } else {
                expandedTopics.push(topic);
            }
        }

        // Replace with the expanded list
        agendaItem.meetingTopics = expandedTopics;
    }

    // Parse discussion points
    const discussionPointsMatch = content.match(/#### (?:Discussion Points|In this meeting we discussed):([\s\S]*?)(?=\n#### |$)/);
    if (discussionPointsMatch) {
        // Updated to match each bullet point line more precisely
        const points = discussionPointsMatch[1].match(/^- ([^\n]+)/gm) || [];
        agendaItem.discussionPoints = points.map((p: string) => {
            // Normalize discussion points text
            let text = p.replace(/^- /, '').trim();

            // Ensure complete sentences by adding periods if missing
            if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
                text += '.';
            }

            return text;
        });
    }

    // Parse action items
    const actionItemsMatch = content.match(/#### Action Items:([\s\S]*?)(?=\n#### |$)/);
    if (actionItemsMatch) {
        // First, split by action items (lines that start with "- [**action**]")
        const actionBlocks = actionItemsMatch[1].split(/(?=\n?- \[\*\*action\*\*\])/);

        for (const block of actionBlocks) {
            if (!block.trim()) continue;

            // Extract the full line that contains the action and possibly metadata
            const actionFullLine = block.match(/^- \[\*\*action\*\*\].*$/m);

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
                    // Updated regex to properly handle text with internal hyphens
                    const actionExtract = fullLineText.match(/^- \[\*\*action\*\*\] (.*?)(?=\s+\[\*\*assignee\*\*\]|\s+\[\*\*due\*\*\]|\s+\[\*\*status\*\*\]|$)/);
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
                    const actionLineMatch = block.match(/^- \[\*\*action\*\*\] ([^\n]+)/m);
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
                    interface ActionItem {
                        text: string;
                        assignee: string;
                        status: string;
                        dueDate?: string;
                    }

                    const actionItem: ActionItem = {
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
        // The previous splitting approach was causing issues with hyphens inside decision text
        // Instead, let's extract decision blocks more precisely by finding all lines that look like top-level bullet points
        const decisionText = decisionItemsMatch[1].trim();
        const decisionLines = decisionText.split('\n');

        let currentDecisionBlock = '';
        const decisionBlocks: string[] = [];

        // Process line by line to build decision blocks
        for (let i = 0; i < decisionLines.length; i++) {
            const line = decisionLines[i];

            // If this line starts a new decision (top-level bullet point)
            if (line.match(/^\s*-\s+(?!\[\*\*)/)) {
                // If we were already building a block, save it
                if (currentDecisionBlock) {
                    decisionBlocks.push(currentDecisionBlock);
                }
                // Start a new block
                currentDecisionBlock = line;
            } else {
                // Add this line to the current block
                if (currentDecisionBlock) {
                    currentDecisionBlock += '\n' + line;
                }
            }
        }

        // Add the last block if there is one
        if (currentDecisionBlock) {
            decisionBlocks.push(currentDecisionBlock);
        }

        // Process each decision block
        for (const block of decisionBlocks) {
            if (!block.trim()) continue;

            // Match the decision text (first line after removing the bullet)
            const decisionMatch = block.match(/^\s*-\s+([^\n]+)/m);
            // Match metadata lines
            const effectMatch = block.match(/\s*-\s+\[\*\*effect\*\*\]\s+([^\n]+)/);
            const rationaleMatch = block.match(/\s*-\s+\[\*\*rationale\*\*\]\s+([^\n]+)/);
            const opposingMatch = block.match(/\s*-\s+\[\*\*opposing\*\*\]\s+([^\n]+)/);

            if (decisionMatch) {
                const decisionItem = {
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
        const points = learningPointsMatch[1].match(/^- ([^\n]+)/gm) || [];
        agendaItem.learningPoints = points.map((p: string) => p.replace(/^- /, '').trim());
    }

    // Parse Issues
    const issuesMatch = content.match(/#### (?:Issues|To carry over for next meeting):([\s\S]*?)(?=\n#### |$)/);
    if (issuesMatch) {
        const issues = issuesMatch[1].match(/^- ([^\n]+)/gm) || [];
        agendaItem.issues = issues.map((i: string) => i.replace(/^- /, '').trim());
    }

    // Parse Leaderboard
    const leaderboardMatch = content.match(/#### Leaderboard:([\s\S]*?)(?=\n#### |$)/);
    if (leaderboardMatch) {
        const items = leaderboardMatch[1].match(/^- [^\n]+/gm) || [];
        agendaItem.leaderboard = items.map((i: string) => i.replace(/^- \d+(?:st|nd|rd|th) /, '').trim());
    }
} 