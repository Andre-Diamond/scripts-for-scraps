/**
 * Client-side service for GitHub operations that call the API endpoints
 */

// Function to commit a file to GitHub via the API endpoint
export const commitFile = async (path: string, content: string, message: string) => {
    try {
        const response = await fetch('/api/github-commit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path,
                content,
                message,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to commit file: ${response.statusText}, ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error committing file:', error);
        throw error;
    }
};

// Format file path for storing meeting data 
export const formatMeetingPath = (filePath: string, workgroup: string, date: string | undefined) => {
    if (!date) {
        return null;
    }

    // Extract year/month/week from the filePath
    // Example filePath: "timeline/2023/April/week-9.md"
    const pathParts = filePath.split('/');
    if (pathParts.length < 4) {
        return null;
    }

    const year = pathParts[1]; // e.g., "2023"
    const month = pathParts[2]; // e.g., "April"

    // Extract meeting name from the week file (e.g., "week-9" -> "week-9")
    let meetingName = pathParts[3].replace('.md', '');

    // Format workgroup name for the path (replace spaces with dashes, lowercase)
    const formattedWorkgroup = workgroup.replace(/\s+/g, '-').toLowerCase();

    // Format date for the folder name (replace slashes with dashes)
    const formattedDate = date.replace(/\//g, '-');

    // Create a folder name that combines date and workgroup
    const folderName = `${formattedDate}-${formattedWorkgroup}`;

    // Return path in the format: timeline/2023/April/week-9/01-03-2024-gamers-guild/
    return `timeline/${year}/${month}/${meetingName}/${folderName}`;
}; 