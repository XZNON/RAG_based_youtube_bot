let currentVideoId = null; // To keep track of the currently active video

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "askRAG") {
        const { query, videoContext, backendUrl } = request;

        // Update current video ID when a RAG query is made
        if (videoContext && videoContext.videoId) {
            currentVideoId = videoContext.videoId;
        }

        fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, videoContext })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Error fetching from RAG backend:", error);
            sendResponse({ success: false, error: error.message || "Network error or backend issue." });
        });

        return true; // Indicate that sendResponse will be called asynchronously
    } else if (request.action === "clearVideoCache") {
        const { videoIdToClear } = request;
        console.log(`Background script received request to clear cache for video ID: ${videoIdToClear}`);

        // Send request to Node.js backend to clear cache
        fetch("http://localhost:3000/api/clear-cache", { // New endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoId: videoIdToClear })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Cache clear response from backend:', data);
            sendResponse({ success: true, message: data.response || "Cache clear request sent." });
        })
        .catch(error => {
            console.error("Error sending clear cache request to backend:", error);
            sendResponse({ success: false, error: error.message || "Failed to send clear cache request." });
        });
        return true; // Indicate async response
    } else if (request.action === "clearAllCaches") {
        console.log("Background script received request to clear all caches.");
        fetch("http://localhost:3000/api/clear-cache", { // New endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ clearAll: true })
        })
        .then(response => response.json())
        .then(data => {
            console.log('All cache clear response from backend:', data);
            sendResponse({ success: true, message: data.response || "All cache clear request sent." });
        })
        .catch(error => {
            console.error("Error sending clear all caches request to backend:", error);
            sendResponse({ success: false, error: error.message || "Failed to send clear all caches request." });
        });
        return true; // Indicate async response
    }
});

// Listener for tab updates to detect video changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab is fully loaded and it's a YouTube watch page
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        const newVideoId = new URL(tab.url).searchParams.get('v');
        if (newVideoId && currentVideoId && newVideoId !== currentVideoId) {
            console.log(`Video changed from ${currentVideoId} to ${newVideoId}. Clearing cache for old video.`);
            // Send message to self (background script) to clear cache for the old video
            chrome.runtime.sendMessage({ action: "clearVideoCache", videoIdToClear: currentVideoId });
            currentVideoId = newVideoId; // Update current video ID
        } else if (!currentVideoId && newVideoId) {
            // First time loading a video or after browser restart
            currentVideoId = newVideoId;
            console.log(`New video loaded: ${currentVideoId}`);
        }
    }
});

// Listener for tab removal to clear cache when a video tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // If the removed tab was the one we were tracking
    if (currentVideoId && removeInfo.isWindowClosing) { // Check if window is closing
        // This is a bit tricky: onRemoved fires for every tab in a closing window.

        console.log(`Tab with video ID ${currentVideoId} closed. Clearing its cache.`);
        chrome.runtime.sendMessage({ action: "clearVideoCache", videoIdToClear: currentVideoId });
        currentVideoId = null; // Reset current video ID
    }
    // If a single tab is closed but the window is not closing, we need to check if it was the active video
    // This is more complex and might require content scripts to send more granular messages.
});

// Optional: Clear all caches when the browser extension is unloaded (e.g., browser restart, extension disabled)
chrome.runtime.onSuspend.addListener(() => {
    console.log("Extension is suspending. Attempting to clear all caches.");
    chrome.runtime.sendMessage({ action: "clearAllCaches" });
    currentVideoId = null; // Reset current video ID
});

