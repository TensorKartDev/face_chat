from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import json
from fastapi import Request
from fastapi import FastAPI, HTTPException
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from face_recog import generate_embeddings, recognize_face
import io
from PIL import Image
from services.llm import speak
from typing import List
import lancedb
import torch
from torchvision import transforms
from PIL import Image
from facenet_pytorch import InceptionResnetV1
from typing import Dict, List

app = FastAPI()
if torch.backends.mps.is_available():
    device = torch.device("mps")  # Use Metal Performance Shaders for Apple Silicon
    print("Using Metal (MPS) backend for Apple Silicon.")
elif torch.cuda.is_available():
    device = torch.device("cuda")  # Use CUDA for NVIDIA GPUs
    print("Using CUDA backend.")
else:
    device = torch.device("cpu")  # Default to CPU
    print("Using CPU backend.")

# Initialize the model
model = InceptionResnetV1(pretrained="vggface2").eval().to(device)
# Global data stores
user_context: Dict[str, List[Dict[str, str]]] = {}  # Stores conversations for each user
active_user: str = None  # Tracks the current active user

preprocess = transforms.Compose([
    transforms.Resize((160, 160)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002", "http://127.0.0.1:3001"],  # Allow the React frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)
# Global conversation history
# Request model
class MessageRequest(BaseModel):
    message: str
# Helper function to add conversation
def add_to_user_context(username: str, role: str, content: str):
    if username not in user_context:
        user_context[username] = []
    user_context[username].append({"role": role, "content": content})

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}
@app.post("/generate-embeddings/")
def generate_embeddings_endpoint():
    """Endpoint to generate embeddings from persona data."""
    generate_embeddings("data/")
    return {"message": "Embeddings generated successfully."}

# Global variables for demonstration


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming request method: {request.method}")
    print(f"Incoming Origin: {request.headers.get('Origin')}")
    response = await call_next(request)
    print(f"Response status: {response.status_code}")
    return response
@app.options("/participant-response")
async def preflight_options():
    return {
        "message": "Preflight request handled."
    }
# Global conversation history
conversation_history = []

@app.post("/greet")
async def greet_user(request: MessageRequest):
    """
    Handles a user greeting and generates an AI response to start the conversation.
    """
    global active_user, conversation_history

    username = request.message
    # Set the active user
    active_user = username
    # Initialize context for the user if not already there
    if username not in user_context:
        user_context[username] = []
    # Construct a personalized user message
    user_message = f"My name is {username}"

    # Prepare the updated system prompt
    system_prompt = (
    "You are a friendly and engaging conversational partner at a tech event. "
    f"Your goal is to make meaningful conversations with {active_user}, by asking insightful questions and engaging naturally. "
    "Do not summarize the conversation history explicitly unless prompted by the user.And don't add placehoders in your responses "
    "Use the context to guide your responses in a conversational tone without explicitly mentioning the history. "
    "Maintain a warm and approachable tone and prioritize making the conversation feel seamless and natural."
    "Let your conversations be short,personalized and polite at all times "
)
    # Construct the message structure
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history to provide context
    # messages.extend(conversation_history)

    # Add the user's introduction
    messages.append({"role": "user", "content": user_message})

    try:
        # Call the AI model
        model = "mistral-nemo"  # Replace with your actual model name
        response = speak(messages, model)  # Call the speak function to get the AI response
        generated_message = response.get("content", "")
        print(username, " in greet user")

       # Add AI response to the user context
        add_to_user_context(username, "AI", generated_message)

        return {
            "response": generated_message,
            "conversation_history": user_context[username],
        }


    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        print(error_message)
        conversation_history.append({"role": "system", "content": error_message})
        raise HTTPException(status_code=500, detail=error_message)
    
@app.post("/participant-response")
async def participant_response(request: MessageRequest):
    """
    Handles a user message and generates an AI response using conversation history as context.
    """
    global active_user, user_context
    if not active_user:
        raise HTTPException(status_code=400, detail="No active user set. Please call /greet first.")

    user_message = request.message
    
    print(active_user, " in participant response")
    # Add the user's message to the conversation history
    add_to_user_context(active_user, "user", user_message)

    # Prepare system prompt
    system_prompt = (
        "You are a thoughtful, observant, and conversational individual in a friendly gathering. "
        "You are provided with the conversation history to ensure continuity and to remember details like names or key points discussed earlier. "
        "Engage in meaningful, natural conversations, showing genuine curiosity and interest. "
        "Focus on building connections through shared thoughts and experiences. "
        "Your responses should be human-like, relatable, and insightful. Avoid overly formal language, emoticons, or excessive assistance. "
        "Use the conversation history to make your responses relevant and engaging."
        f"Remember to make a one to one conversation with user {active_user}"
    )

    # Construct the message structure
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history to the context
    # Add the active user's conversation history
    messages.extend(user_context.get(active_user, []))


    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    try:
        # Call the AI model
        model = "mistral-nemo"  # Replace with your actual model name
        response = speak(messages, model)  # Call the speak function
        generated_message = response.get("content", "")

       # Add AI response to the active user's conversation history
        add_to_user_context(active_user, "AI", generated_message)

        return {
            "response": generated_message,
            "conversation_history": user_context[active_user],
        }

    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        print(error_message)
        add_to_user_context(active_user, "system", error_message)
        raise HTTPException(status_code=500, detail=error_message)

@app.post("/recognize-face")
async def recognize_face(file: UploadFile = File(...)):
    """
    Recognize a face by matching against the embeddings in LanceDB.
    """
    try:
        # Load the image
        print("file recieved for recognition ...")
        image = Image.open(file.file).convert("RGB")
        img_tensor = preprocess(image).unsqueeze(0).to(device)
        print("Image preprocessed ...")
        # Generate embedding
        with torch.no_grad():
            embedding = model(img_tensor).squeeze().cpu().numpy()
            print("embedding generated for this captured image...")

        # Perform vector search in LanceDB
        db = lancedb.connect("./lance_faces")
        table = db.open_table("faces")
        print("lancedb table opened...")
        print("Table schema:", table.schema)
        print("Total rows in table:", len(table))
        print("Query embedding dimensions:", len(embedding))
        results = table.search(embedding.tolist()).limit(1).to_list()
        
        print("results:",len(results))
        
        print("best match found",results[0]["label"])
        if len(results) > 0:
            best_match = results[0]
            
            return {"name": results[0]["label"]}
        else:
            return {"label": "Unknown", "similarity": 0.0}

    except Exception as e:
        return {"error": str(e)}