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

// GitHub API constants for commit service
const TARGET_REPO_OWNER = 'Andre-Diamond';
const TARGET_REPO_NAME = 'test';
const TARGET_BRANCH = 'main';

// Function to commit a file to GitHub
export async function commitFileToGitHub(path: string, content: string, message: string) {
    // Server-side only to use the token
    if (typeof window !== 'undefined') {
        throw new Error('This function can only be called server-side');
    }

    const github_token = process.env.GITHUB_TOKEN;
    if (!github_token) {
        throw new Error('GITHUB_TOKEN environment variable is not set');
    }

    // Check if file exists to determine if we should create or update
    const apiUrl = `https://api.github.com/repos/${TARGET_REPO_OWNER}/${TARGET_REPO_NAME}/contents/${path}`;
    let sha = '';

    try {
        // Try to get the current file (if it exists)
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${github_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            sha = data.sha;
        }
    } catch (_error) {
        // File doesn't exist, will be created
        console.log(`File ${path} doesn't exist, creating new file`);
    }

    // Prepare the commit payload
    const payload: {
        message: string;
        content: string;
        branch: string;
        sha?: string;
    } = {
        message,
        content: btoa(unescape(encodeURIComponent(content))), // Convert to base64
        branch: TARGET_BRANCH
    };

    // If the file exists, include its SHA to update it
    if (sha) {
        payload.sha = sha;
    }

    // Create or update the file
    const commitResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${github_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(payload)
    });

    if (!commitResponse.ok) {
        const errorData = await commitResponse.json();
        throw new Error(`Failed to commit file: ${commitResponse.statusText}, ${JSON.stringify(errorData)}`);
    }

    return await commitResponse.json();
}

// Function to create a directory structure by committing a README file
export async function createDirectoryIfNotExists(path: string) {
    try {
        // Check if directory exists by trying to fetch contents
        await fetchDirectoryContents(path);
        return true; // Directory exists
    } catch (_error) {
        // Directory doesn't exist, create it with a README file
        try {
            await commitFileToGitHub(
                `${path}/README.md`,
                'This directory was automatically created by the GitBook Sync tool.',
                `Create directory ${path}`
            );
            return true;
        } catch (error) {
            console.error(`Failed to create directory ${path}:`, error);
            throw error;
        }
    }
} 