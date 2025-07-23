// This script runs on YouTube video pages.

// Send initial video info to background script when content script loads

const initialVideoTitleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
const initialVideoTitle = initialVideoTitleElement ? initialVideoTitleElement.textContent : 'Video Title Not Found';
const initialVideoId = new URL(window.location.href).searchParams.get('v');

if (initialVideoId) {
    chrome.runtime.sendMessage({
        action: "videoLoaded",
        videoId: initialVideoId,
        videoTitle: initialVideoTitle
    });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getVideoInfo") {
        const videoTitleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
        const videoTitle = videoTitleElement ? videoTitleElement.textContent : 'Video Title Not Found';
        
        sendResponse({ videoTitle: videoTitle });
    }
});

// Detect navigation away from the current YouTube video page
// This is crucial for clearing cache when user navigates within YouTube or to another site
window.addEventListener('beforeunload', () => {
    const currentVideoId = new URL(window.location.href).searchParams.get('v');
    if (currentVideoId) {
        console.log(`Content script: Navigating away from video ${currentVideoId}. Requesting cache clear.`);
        // Send message to background script to clear cache for this specific video ID
        chrome.runtime.sendMessage({ action: "clearVideoCache", videoIdToClear: currentVideoId });
    }
});
