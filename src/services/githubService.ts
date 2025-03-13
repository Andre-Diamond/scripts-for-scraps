import { repoOwner, repoName, branch } from './clients';

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