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

preprocess = transforms.Compose([
    transforms.Resize((160, 160)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002", "http://127.0.0.1:3002"],  # Allow the React frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)
# Global conversation history
conversation_history = []

# Request model
class MessageRequest(BaseModel):
    message: str

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

@app.post("/participant-response")
async def participant_response(request: MessageRequest):
    """
    Handles a user message and generates an AI response using conversation history as context.
    """
    global conversation_history

    user_message = request.message

    # Add the user's message to the conversation history
    conversation_history.append({"role": "user", "content": user_message})

    # Prepare system prompt
    system_prompt = (
        "You are a thoughtful, observant, and conversational individual in a friendly gathering. "
        "You are provided with the conversation history to ensure continuity and to remember details like names or key points discussed earlier. "
        "Engage in meaningful, natural conversations, showing genuine curiosity and interest. "
        "Focus on building connections through shared thoughts and experiences. "
        "Your responses should be human-like, relatable, and insightful. Avoid overly formal language, emoticons, or excessive assistance. "
        "Use the conversation history to make your responses relevant and engaging."
    )

    # Construct the message structure
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history to the context
    messages.extend(conversation_history)

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    try:
        # Call the AI model
        model = "mistral-nemo"  # Replace with your actual model name
        response = speak(messages, model)  # Call the speak function
        generated_message = response.get("content", "")

        # Add AI response to the conversation history
        conversation_history.append({"role": "AI", "content": generated_message})

        return {
            "response": generated_message,
            "conversation_history": conversation_history,
        }

    except Exception as e:
        error_message = f"Error generating response: {str(e)}"
        print(error_message)
        conversation_history.append({"role": "system", "content": error_message})
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
        print(results[0]['image_path'])
        if len(results) > 0:
            best_match = results[0]
            print("best match found",best_match["score"])
            return {"label": best_match["label"], "similarity": best_match["score"]}
        else:
            return {"label": "Unknown", "similarity": 0.0}

    except Exception as e:
        return {"error": str(e)}
# @app.post("/recognize-face/")
# async def recognize_face_endpoint(file: UploadFile = File(...)):
#     """Endpoint to recognize a face from an uploaded image."""
#     image_bytes = await file.read()
#     image = io.BytesIO(image_bytes)
#     person = recognize_face(image)
#     return JSONResponse(content={"name": person})