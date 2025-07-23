YouTube RAG AI Assistant 🚀

A full-stack browser extension that leverages Retrieval Augmented Generation (RAG) to provide AI-powered Q&A and summarization for YouTube video transcripts. This project demonstrates a robust architecture for integrating frontend browser capabilities with a powerful Python-based AI backend.
✨ Features

    Intelligent Q&A: Ask natural language questions about any YouTube video, and get answers derived directly from its transcript.

    Video Summarization: Quickly grasp the main points of a video without watching the entire content.

    Dynamic In-Memory Caching: Optimizes performance by storing processed video transcripts and vector stores in memory, with intelligent invalidation upon video changes or tab closure.

    Seamless Browser Integration: A user-friendly browser popup (Chrome/Edge) communicates efficiently with a local Node.js backend.

    Modular Architecture: Separates concerns across frontend (JavaScript/HTML/CSS), backend (Node.js/Express), and AI logic (Python/LangChain/Gemini API).

    Real-time Context Awareness: Utilizes MutationObserver to detect dynamic video changes on YouTube's Single Page Application (SPA), ensuring the RAG system always processes the correct video's context.

🛠️ Technologies Used

    Frontend (Browser Extension): HTML, CSS (Tailwind CSS), JavaScript (Browser APIs, chrome.runtime, chrome.tabs, MutationObserver)

    Backend (API Server): Node.js, Express.js, dotenv

    AI/RAG Core: Python, LangChain, Google Gemini API (gemini-1.5-pro, embedding-001), youtube-transcript-api, FAISS (for vector storage), python-dotenv

🧠 How it Works (The Pipeline)

The YouTube RAG AI Assistant operates through a sophisticated multi-component pipeline to deliver its functionality:

    Browser Extension (Frontend):

        Content Script (content.js): Injected directly into YouTube video pages. It intelligently monitors the page for video changes (title, URL) using a MutationObserver and extracts the current video's title and ID. It also sends messages to the background script to signal video changes or tab closures for cache invalidation.

        Popup UI (popup.html, popup.js): Activated when the user clicks the extension icon. It displays the current video's title and provides an input field for user queries. It sends these queries, along with the video context, to the background script.

        Background Script (background.js): Functions as the central communication hub. It receives user queries from the popup and video context from the content script. It then forwards these requests to the Node.js backend and relays the AI-generated responses back to the popup. It also orchestrates cache clearing based on signals from the content script.

    Node.js Backend (API Server):

        A lightweight Express.js server that acts as a secure bridge between the browser extension and the Python RAG program.

        It exposes two primary API endpoints:

            POST /api/ask-rag: Receives user queries and video context.

            POST /api/clear-cache: Handles requests to invalidate specific video caches or clear all cached data.

        It dynamically loads the GOOGLE_API_KEY from a local .env file and securely passes it to the Python environment.

        It's responsible for spawning the Python RAG program as a child process, managing its execution, passing arguments, and capturing its standard output and error streams.

    Python RAG Program (AI Core):

        (rag_section.py) This is where the core AI magic happens.

        It accepts the user's query and video ID as command-line arguments from the Node.js backend.

        In-Memory Caching: To optimize performance, it maintains an in-memory cache of previously processed video transcripts and their corresponding FAISS vector stores. If data for a video is already cached, it's retrieved instantly, avoiding redundant processing.

        Transcript Fetching: If the video's data is not in the cache, it uses the youtube-transcript-api to fetch the video's transcript.

        Text Processing: The raw transcript is then intelligently split into smaller, manageable chunks using RecursiveCharacterTextSplitter.

        Vector Store Creation: GoogleGenerativeAIEmbeddings are generated from these text chunks, and a FAISS vector store is built, enabling efficient semantic search.

        Retrieval Augmented Generation (RAG): LangChain orchestrates the AI workflow:

            A retriever component identifies and fetches the most semantically relevant text chunks from the FAISS vector store based on the user's query.

            A PromptTemplate constructs a tailored prompt, combining the retrieved context with the user's original question.

            ChatGoogleGenerativeAI (powered by the gemini-1.5-pro model) then generates a precise and contextually relevant answer.

        The final response (or any error messages) is printed to standard output, which is then captured and relayed back by the Node.js backend.

        It also contains logic to clear specific or all in-memory caches when invoked with the --clear-cache argument.

Simplified Data Flow Visual:

User Query (Popup) ➡️ popup.js ➡️ background.js ➡️ Node.js Backend ➡️ Python RAG Program ➡️ Node.js Backend ➡️ background.js ➡️ popup.js ➡️ Display Response (Popup)
🚀 Installation & Local Setup

Follow these comprehensive steps to get the YouTube RAG AI Assistant up and running on your local machine.
Prerequisites

Before you begin, ensure you have the following installed:

    Node.js: v18 or higher recommended (Download Node.js)

    Python: v3.8 or higher recommended (Download Python)

    npm: Comes bundled with Node.js.

    pip: Comes bundled with Python.

    Git: For cloning the repository (Download Git)

    Google Gemini API Key: Obtain one from Google AI Studio.

1. Clone the Repository

First, open your terminal or command prompt and clone this GitHub repository:

git clone https://github.com/YOUR_GITHUB_USERNAME/youtube-rag-plugin.git
cd youtube-rag-plugin

(Replace YOUR_GITHUB_USERNAME with your actual GitHub username and youtube-rag-plugin with your repository name if it's different.)
2. Backend Setup (Node.js & Python)

Navigate into the backend directory of your cloned project:

cd backend

A. Node.js Dependencies

Install the necessary Node.js packages using npm:

npm install

B. Python Virtual Environment & Dependencies

It's highly recommended to use a Python virtual environment to manage dependencies.

# 1. Create the virtual environment
python -m venv venv

# 2. Activate the virtual environment
# On Windows:
.\venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# 3. Install Python packages
If you have a requirements.txt file (recommended for reproducibility):
pip install -r requirements.txt

# If you need to generate requirements.txt:
pip freeze > requirements.txt
Then commit this file to your repo.

# Alternatively, if installing manually (ensure venv is active):
pip install youtube-transcript-api langchain-google-genai langchain-core langchain-community python-dotenv faiss-cpu

C. Configure API Key

Important: The .env file stores sensitive information and is intentionally excluded from version control for security. You must create this file manually.

Create a new file named .env directly inside your backend directory (youtube-rag-plugin/backend/.env) and add your Google Gemini API key:

GOOGLE_API_KEY="YOUR_ACTUAL_GOOGLE_GEMINI_API_KEY_HERE"

(Replace "YOUR_ACTUAL_GOOGLE_GEMINI_API_KEY_HERE" with your real API key. Do not include quotes around the key itself if it's just the key string.)
3. Run the Backend Server

From the backend directory, start the Node.js server:

node server.js

You should see output similar to: Node.js RAG backend listening at http://localhost:3000. Keep this terminal window open as long as you are using the extension.
4. Browser Extension Setup

Navigate to the extension directory:

cd ../extension

A. Prepare Icons

Ensure you have three icon files in extension/icons/:

    icon16.png (16x16 pixels)

    icon48.png (48x48 pixels)

    icon128.png (128x128 pixels)
    You can use simple placeholder images or create custom ones for testing.

B. Load the Extension in Your Browser

    Open your browser's Extensions page:

        Chrome: Type chrome://extensions in the address bar and press Enter.

        Edge: Type edge://extensions in the address bar and press Enter.

    Enable Developer Mode: Toggle the "Developer mode" switch to ON (usually found in the top-right corner).

    Load Unpacked Extension: Click the "Load unpacked" button.

    Select the extension folder: In the file dialog, navigate to and select the youtube-rag-plugin/extension directory (this is the folder containing manifest.json, popup.html, etc.).

    Verify: Your "YouTube RAG Plugin" should now appear in the list of extensions. You might need to click the puzzle piece icon (Extensions icon) in your browser's toolbar and "pin" the extension to make its icon permanently visible.

5. Test the Extension

    Open a new tab and navigate to any YouTube video (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ).

    Click on the "YouTube RAG Plugin" icon in your browser's toolbar.

    The popup should appear, displaying the video title.

    Type a question into the input field (e.g., "What is this video about?") and click "Get RAG Response".

    Observe the AI-generated response in the popup. For debugging, check your Node.js terminal for backend logs and the browser's developer console (F12) for extension-related messages.

🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.
📄 License

This project is licensed under the MIT License - see the LICENSE file for details (if you plan to add one).
📧 Contact

For any questions or feedback, feel free to reach out.

Enjoy your YouTube RAG AI Assistant! 🎉
