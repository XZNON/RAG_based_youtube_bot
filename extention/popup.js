// extension/popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const videoTitleSpan = document.getElementById('video-title');
    const queryInput = document.getElementById('query-input');
    const askButton = document.getElementById('ask-button');
    const responseArea = document.getElementById('response-area');
    const ragResponseParagraph = document.getElementById('rag-response');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');
    const errorTextParagraph = document.getElementById('error-text');

    let currentVideoContext = null;

    // Request video info from content script when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes('youtube.com/watch')) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getVideoInfo" }, (response) => {
                if (response && response.videoTitle) {
                    videoTitleSpan.textContent = response.videoTitle;
                    currentVideoContext = {
                        title: response.videoTitle,
                        url: tabs[0].url,
                        videoId: new URL(tabs[0].url).searchParams.get('v')
                    };
                } else {
                    videoTitleSpan.textContent = "Not on a YouTube video page.";
                    askButton.disabled = true;
                    queryInput.disabled = true;
                }
            });
        } else {
            videoTitleSpan.textContent = "Not on a YouTube video page.";
            askButton.disabled = true;
            queryInput.disabled = true;
        }
    });

    askButton.addEventListener('click', async () => {
        const query = queryInput.value.trim();
        if (!query) {
            showError("Please enter a query.");
            return;
        }
        if (!currentVideoContext) {
            showError("Could not get video context. Please refresh the YouTube page.");
            return;
        }

        responseArea.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        askButton.disabled = true; // Disable button during processing

        try {
            // Send message to background script to handle the fetch request
            const response = await chrome.runtime.sendMessage({
                action: "askRAG",
                query: query,
                // IMPORTANT: The backend URL now includes '/api' prefix
                backendUrl: "http://localhost:3000/api/ask-rag",
                videoContext: currentVideoContext
            });

            if (response.success) {
                ragResponseParagraph.textContent = response.data.response;
                responseArea.classList.remove('hidden');
            } else {
                showError(response.error || "An unknown error occurred.");
            }
        } catch (error) {
            console.error("Error communicating with background script:", error);
            showError("Failed to get response. Check console for details.");
        } finally {
            loadingIndicator.classList.add('hidden');
            askButton.disabled = false; // Re-enable button
        }
    });

    function showError(message) {
        errorTextParagraph.textContent = message;
        errorMessageDiv.classList.remove('hidden');
    }
});