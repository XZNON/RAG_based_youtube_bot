import os
import sys
import json
from langchain_google_genai import ChatGoogleGenerativeAI,GoogleGenerativeAIEmbeddings
from youtube_transcript_api import YouTubeTranscriptApi,TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv

load_dotenv()
##############################################################################################################
yttApi = YouTubeTranscriptApi()

#Global in memory caching for the vector store and the llm component
video_cache = {}

global_llm = None
global_embedding = None

def initialize_llm_embedding():
    global global_llm,global_embedding

    try:
        if global_embedding is None:
            global_embedding = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
            sys.stderr.write("Global Embeddings initialized.\n")
        
        if global_llm is None:
            global_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
            sys.stderr.write("Global LLM initialized.\n")
        return True
    except Exception as e:
        sys.stderr.write(f"Error initializing global LLM/Embeddings: {e}\n")
        return False

if not initialize_llm_embedding():
    sys.stderr.write("Could not initialize the Global LLM/embedding\n")
    sys.exit(1)

#-----------------------------In memory cache management------------------------------------------------

def loadFromCache(video_id):
    #loads the transcript and vector store from the cache
    if video_id in video_cache:
        sys.stderr.write(f"Loaded data from {video_id} from the cache\n")
        cachedData = video_cache[video_id]
        return cachedData['transcript'],cachedData['vectorStore']
    return None,None


def saveToCache(video_id,transcript,vectorStore):
    try:
        video_cache[video_id]={
            'transcripit':transcript,
            'vectorStore':vectorStore
        }
        sys.stderr.write(f"Saved data in cache for video :{video_id}")
        return True
    except Exception as e:
        sys.stderr.write(f"Error saving in memory cache for video: {video_id}")
        return False

def clearCache(video_id = None, clearAll = False):
    global video_cache

    try:
        if clearAll:
            video_cache.clear()
            sys.stderr.write("All cache cleared")
        elif video_id and video_id in video_cache:
            video_cache.pop(video_id)
            sys.stderr.write(f"Cache cleared for {video_id}")
        elif video_id and video_id not in video_cache:
            sys.stderr.write(f"No cache found for video ID: {video_id} in in-memory cache.\n")
            return f"No cache found for video ID: {video_id}."
        else:
            return "Invalid cache clear request"
    except Exception as e:
        sys.stderr.write(f"Encountered an error while clearing cache:\n {e}")
        return f"Error encountered while clearing cache: {e}"
    
#######################################################################################################

def formatDocuments(retrievedDocs):
    try:
        contextText = "\n\n".join(docs.page_content for docs in retrievedDocs)
        return contextText
    except Exception as e:
        sys.stderr.write(f"Encountered an error while formatting docs:\n {e}")
        return f"Error while formatting docs: {e}"

def run_rag(query,video_id: str):

    if global_llm is None or global_embedding is None:
        sys.stderr.write(f"Error initializing global LLM and embeddings")
        return f"Error init global LLM"

    transcript,vectorStore = loadFromCache(video_id)

    if transcript and vectorStore:
        sys.stderr.write(f"Using transcript and vector stores stored in Memory cache")
    else:
        sys.stderr.write(f"Processing new video ID: {video_id}. Caching results in memory.\n")
        transcript = ""

        #fetch transcript
        try:

            transcriptObj = yttApi.fetch(video_id)
            transcriptRaw = transcriptObj.to_raw_data()

            transcript = " ".join(chunk['text'] for chunk in transcriptRaw)
            sys.stderr.write(f"Transcript Fetched")
        except TranscriptsDisabled:
            sys.stderr.write("Transcripts are disabled for this video.\n")
            return "Error: Transcripts are disabled for this video."
        except NoTranscriptFound:
            sys.stderr.write("No transcript found for this video.\n")
            return "Error: No transcript found for this video."
        except VideoUnavailable:
            sys.stderr.write("The video is unavailable.\n")
            return "Error: The video is unavailable."
        except Exception as e:
            sys.stderr.write(f"Unexpected error fetching transcript: {e}\n")
            return f"Error: Unexpected error fetching transcript: {e}"

        if not transcript:
            return "Error: No transcript available to process."
        
        #splitting the text
        chunks = []
        try:
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000,chunk_overlap=200)
            chunks = splitter.create_documents([transcript])
            sys.stderr.write(f"Text split successfully into {len(chunks)} chunks.\n")
        except Exception as e:
            sys.stderr.write(f"Error splitting text:\n {e}\n")
            return f"Error: Could not split text: {e}"

        #create the vector store
        try:
            vectorStore = FAISS.from_documents(chunks, global_embedding)
            sys.stderr.write("Vector store created.\n")
        except Exception as e:
            sys.stderr.write(f"Error creating vector store: {e}\n")
            return f"Error: Vector store was not created, {e}"
        
        if not vectorStore:
            return "Error: Vector store creation failed."
        
        #save to cahce
        if not saveToCache(video_id,transcript,vectorStore):
            sys.stderr.write("Warning: Failed to save video data to in-memory cache.\n")
        
        retriever = vectorStore.as_retriever(search_type="similarity", search_kwargs={"k": 4})

    prompt = PromptTemplate(
        template="""
        You are a helpful assistant.
        Answer only from the transcript context provided.
        If the context is insufficient just answer I DONT KNOW.
        Context: {context}
        Question: {question}
        """,
        input_variables=["context", "question"]
    )

    parser = StrOutputParser()
    
    parallelChain = RunnableParallel({
        "context": retriever | RunnableLambda(formatDocuments),
        "question": RunnablePassthrough()
    })

    mainChain = parallelChain | prompt | global_llm | parser

    res = ""
    try:
        res = mainChain.invoke(query)
        sys.stderr.write("RAG chain invoked successfully.\n")
    except Exception as e:
        sys.stderr.write(f"Error invoking RAG chain: {e}\n")
        res = f"Error: Failed to get response from RAG chain, {e}"
    
    return res
####################################################################################################################

if __name__=="__main__":
    # Check for cache clear arguments first
    if len(sys.argv) > 1 and sys.argv[1] == '--clear-cache':
        if len(sys.argv) > 2 and sys.argv[2] == '--all':
            result = clearCache(clear_all=True)
        elif len(sys.argv) > 2:
            video_id_to_clear = sys.argv[2]
            result = clearCache(video_id=video_id_to_clear)
        else:
            result = "Error: Missing video ID or --all flag for --clear-cache command."
        sys.stdout.write(result) # This output is intended for the Node.js backend
        sys.stdout.flush()
        sys.exit(0) # Exit after handling cache clear command

    # Original RAG query logic
    if len(sys.argv) > 2:
        user_query = sys.argv[1]
        video_id = sys.argv[2]

        result = run_rag(user_query, video_id)
        
        # --- DEBUGGING: Wrap final print in try-except to catch excepthook errors ---
        try:
            sys.stdout.write(result) # This is the only intended output for the Node.js backend
            sys.stdout.flush() # Ensure buffer is flushed
        except Exception as e:
            sys.stderr.write(f"Error during final stdout write: {e}\n")
            sys.exit(1) # Exit with error code if printing fails
        # --- END DEBUGGING ---

    else:
        sys.stderr.write("Usage: python your_rag_program.py <query> <video_id> or --clear-cache [--all | <video_id>]\n")
        sys.stderr.write("Error: Missing query or video ID for RAG, or invalid clear cache command.\n")


