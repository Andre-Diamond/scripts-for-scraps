import { NextApiRequest, NextApiResponse } from 'next';
import { commitFileToGitHub, createDirectoryIfNotExists } from '../../services/githubService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed, only POST is supported' });
    }

    try {
        const { path, content, message } = req.body;

        // Validate required fields
        if (!path || !content || !message) {
            return res.status(400).json({ error: 'Missing required fields: path, content, and message are required' });
        }

        // Extract directory path from file path
        const directoryPath = path.substring(0, path.lastIndexOf('/'));

        // Create directory structure if it doesn't exist
        if (directoryPath) {
            await createDirectoryIfNotExists(directoryPath);
        }

        // Commit the file
        const result = await commitFileToGitHub(path, content, message);

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error in github-commit API:', error);
        return res.status(500).json({
            error: 'Failed to commit to GitHub',
            message: error instanceof Error ? error.message : String(error)
        });
    }
} 