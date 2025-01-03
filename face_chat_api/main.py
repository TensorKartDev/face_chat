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

app = FastAPI()

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
@app.post("/participant-response")
async def participant_response(request: MessageRequest):
    """
    Handles a user message and generates an AI response.
    """
    global conversation_history

    # Extract user message
    user_message = request.message

    system_prompt = (
    "You are a thoughtful, observant, and conversational individual at an . "
    "Engage in meaningful and natural conversations, showing genuine curiosity and interest. "
    "Your responses should feel human, relatable, and insightful, focusing on connecting through shared thoughts or experiences. "
    "Do not overly assist or guide; instead, participate as someone enjoying a conversation with others. "
    "Avoid emoticons or overly formal language, keeping the tone authentic and friendly."
)

    # Construct the message structure for the model
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    try:
        # Call the AI model
        model = "wizardlm2"  # Replace with your actual model name
        response = speak(messages, model)  # Call the speak function to get AI response
        generated_message = response.get("content", "")

        # Append to conversation history
        conversation_history.append({
            "speaker": "User",
            "message": user_message
        })
        conversation_history.append({
            "speaker": "AI",
            "message": generated_message
        })

        return {
            "response": generated_message,
            "conversation_history": conversation_history
        }

    except Exception as e:
        # Log and handle errors
        error_message = f"Error generating response: {str(e)}"
        print(error_message)
        conversation_history.append({
            "speaker": "System",
            "message": error_message
        })
        raise HTTPException(status_code=500, detail=error_message)

@app.post("/recognize-face/")
async def recognize_face(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    temp_file_path = f"/tmp/{file.filename}"
    with open(temp_file_path, "wb") as f:
        f.write(await file.read())

    # Add your face recognition logic here
    # For now, return a placeholder response
    return {"message": f"Received file {file.filename}"}
@app.post("/recognize-face/")
async def recognize_face_endpoint(file: UploadFile = File(...)):
    """Endpoint to recognize a face from an uploaded image."""
    image_bytes = await file.read()
    image = io.BytesIO(image_bytes)
    person = recognize_face(image)
    return JSONResponse(content={"name": person})