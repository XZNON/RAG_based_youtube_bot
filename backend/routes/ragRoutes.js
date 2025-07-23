import { Router } from 'express';
import { spawn } from 'child_process'; 
import process from 'process';
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import 'dotenv/config';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();


function runPythonScript(scriptName, args, res) {

    const pythonExecutable = process.platform === 'win32' ?
                             path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe') : // Windows
                             path.join(__dirname, '..', 'venv', 'bin', 'python'); // macOS/Linux

    // Retrieve API Key from environment variable
    const ragApiKey = process.env.GOOGLE_API_KEY;

    if (!ragApiKey) {
        console.error("MY_RAG_API_KEY or GOOGLE_API_KEY environment variable is not set.");
        if (!res.headersSent) {
            return res.status(500).json({ error: 'RAG API key is not configured on the server.' });
        }
        return;
    }

    console.log(`Using Python executable: ${pythonExecutable}`);
    console.log(`Running Python script: ${scriptName} with args: ${args}`);

    const pythonProcess = spawn(pythonExecutable, [scriptName, ...args], {
        env: { ...process.env, GOOGLE_API_KEY: ragApiKey }
    });

    let scriptOutput = '';
    let scriptError = '';

    pythonProcess.stdout.on('data', (data) => {
        scriptOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        scriptError += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}: ${scriptError}`);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Python script failed.', details: scriptError });
            }
        }
        if (!res.headersSent) {
            console.log('Python script output:', scriptOutput);
            res.json({ response: scriptOutput.trim() });
        }
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python script process:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start Python script process.', details: err.message });
        }
        return;
    });
}


// --- API Endpoint for Asking RAG ---
router.post('/ask-rag', (req, res) => {
    console.log('Received Content-Type:', req.headers['content-type']);
    console.log('Received req.body:', req.body);

    const { query, videoContext } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required.' });
    }
    if (!videoContext || !videoContext.videoId) {
        return res.status(400).json({ error: 'Video ID is required in videoContext.' });
    }

    const videoId = videoContext.videoId;
    console.log(`Received query: "${query}" for video ID: "${videoId}"`);

    // Call the helper function to run the RAG Python script
    runPythonScript('rag_section.py', [query, videoId], res);
});


// --- NEW API Endpoint for Clearing Cache ---
router.post('/clear-cache', (req, res) => {
    console.log('Received Content-Type for clear-cache:', req.headers['content-type']);
    console.log('Received req.body for clear-cache:', req.body);

    const { videoId, clearAll } = req.body;

    if (!videoId && !clearAll) {
        return res.status(400).json({ error: 'Either videoId or clearAll flag is required for clearing cache.' });
    }

    let args = ['--clear-cache'];
    if (clearAll) {
        args.push('--all');
        console.log('Request to clear all video caches.');
    } else if (videoId) {
        args.push(videoId);
        console.log(`Request to clear cache for video ID: ${videoId}`);
    }

    runPythonScript('rag_section.py', args, res);
});

export default router; // Export the router

