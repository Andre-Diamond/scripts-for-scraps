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
    // Decode base64 to bytes
    const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
    // Convert bytes to UTF-8 string
    return new TextDecoder('utf-8').decode(bytes);
} 