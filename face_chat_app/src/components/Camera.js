import React, { useRef, useState, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { FaCamera, FaMicrophone, FaStop } from "react-icons/fa"; // ReactIcons for UI
let recognition;

const Camera = ({ onRecognition }) => {
    const [streaming, setStreaming] = useState(false); // Track if the camera and microphone are streaming
    const [transcriptions, setTranscriptions] = useState([]); // Store line-by-line transcriptions
    const [preview, setPreview] = useState(null); // Captured image preview
    const videoRef = useRef(null); // Reference to the <video> element
    const canvasRef = useRef(null); // Reference to the <canvas> element
    const [recognizedName, setRecognizedName] = useState("");
    const mediaStreamRef = useRef(null); // Store the combined video/audio stream
    const [speaking, setSpeaking] = useState(false);
    const [listening, setListening] = useState(false); // Indicates if speech recognition is active
    const [username, setUsername] = useState("User"); // Placeholder for user identification
    const [ttsActive, setTtsActive] = useState(false); // Tracks if TTS is speaking
    let isRecognitionRunning = false; 
    const handleRecognition = async (imageFile) => {
        try {
            const formData = new FormData();
            formData.append("file", imageFile);

            const response = await axios.post("http://localhost:8000/recognize-face", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const newName = response.data.name || "Unknown";

            if (newName !== recognizedName) {
                setRecognizedName(newName);
                setUsername(newName);

                if (newName !== "Unknown") {
                    await greetUser(newName);
                }
            }
        } catch (error) {
            console.error("Error recognizing face:", error);
        }
    };
    const greetUser = async (name) => {
        try {
            const response = await axios.post("http://localhost:8000/greet", { message: name });
            if (response.data.response) {
                setTranscriptions((prev) => [
                    ...prev,
                    { username: "AI", text: response.data.response },
                ]);
                // Read the greeting aloud
                readTextAloud(response.data.response);
            }
        } catch (error) {
            console.error("Error greeting the user:", error);
        }
    };
    const startCameraAndMicrophone = async () => {
        try {
            console.log("Requesting camera and microphone access...");
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log("MediaStream acquired:", mediaStream);

            // Assign the MediaStream to the video element
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                await videoRef.current.play();
                console.log("Camera is now streaming.");
                setStreaming(true); // Update streaming state
            }

            mediaStreamRef.current = mediaStream; // Store the MediaStream for later use
            startSpeechRecognition(); // Start speech recognition
        } catch (error) {
            console.error("Error accessing the camera or microphone:", error);
            alert("Unable to access the camera or microphone. Please check your permissions.");
        }
    };

    const startSpeechRecognition = () => {
        if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
            console.error("Speech recognition is not supported in this browser.");
            return;
        }
    
        // Avoid starting recognition if it's already running
        if (isRecognitionRunning) {
            console.warn("Speech recognition is already running.");
            return;
        }
    
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
    
        recognition.onstart = () => {
            console.log("Speech recognition started...");
            isRecognitionRunning = true; // Set flag to true
            setListening(true);
        };
    
        recognition.onresult = (event) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript.trim();
                }
            }
            console.log("Final Transcript:", finalTranscript);
    
            if (finalTranscript) {
                updateTranscription(finalTranscript, "user"); // Use recognized name
                handleApiResponse(finalTranscript); // Process transcript
            }
        };
    
        recognition.onend = () => {
            console.log("Speech recognition stopped.");
            isRecognitionRunning = false; // Reset flag
            if (!window.speechSynthesis.speaking) {
                setTimeout(() => {
                    console.log("Restarting recognition...");
                    startSpeechRecognition();
                }, 500); // Debounce restart
            }
            setListening(false);
        };
    
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            isRecognitionRunning = false; // Reset flag
            setListening(false);
        };
    
        recognition.start();
    };

    const stopSpeechRecognition = () => {
        if (recognition) {
            recognition.stop();
            setListening(false);
            console.log("Speech recognition stopped.");
        }
    };

    const stopCameraAndMicrophone = useCallback(() => {
        if (mediaStreamRef.current) {
            const tracks = mediaStreamRef.current.getTracks();
            tracks.forEach((track) => track.stop());
            mediaStreamRef.current = null;
            setStreaming(false);
            console.log("Camera and microphone stopped.");
        }

        stopSpeechRecognition(); // Stop speech recognition
    }, []);

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;

            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            const imageDataUrl = canvas.toDataURL("image/png");
            setPreview(imageDataUrl);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "captured-image.png", { type: "image/png" });
                    handleRecognition(file);
                }
            });
        }
    };

    const handleApiResponse = async (transcribedText) => {
        try {
            // Send the request to the API using axios
            const response = await axios.post("http://localhost:8000/participant-response", {
                message: transcribedText, // Ensure "message" matches backend schema
            });
    
            const data = response.data; // Axios automatically parses JSON responses
            console.log(data);
    
            // Process the API response
            if (data && data.response) {
                console.log("API Response:", data.response);
    
                // Add AI response to transcription list
                updateTranscription(data.response, "ai");

                // Read the response aloud
                readTextAloud(data.response);
            }
        } catch (error) {
            // Handle errors
            if (error.response) {
                console.error("API error:", error.response.data);
            } else if (error.request) {
                console.error("No response received from API:", error.request);
            } else {
                console.error("Error creating request:", error.message);
            }
        }
    };

    const readTextAloud = (text) => {
        if ("speechSynthesis" in window) {
            console.log("Pausing recognition for text-to-speech...");
    
            // Stop ongoing recognition temporarily
            if (recognition) {
                recognition.stop();
            }
    
            // Configure speech synthesis
            const utterance = new SpeechSynthesisUtterance(text);
    
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find((voice) => voice.name === "Samantha");
    
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
    
            utterance.rate = 1; // Normal speaking rate
            utterance.pitch = 1; // Normal pitch
            utterance.volume = 1; // Full volume
    
            utterance.onend = () => {
                console.log("Text-to-speech finished. Resuming recognition...");
                setTimeout(() => {
                    if (recognition) {
                        recognition.start();
                    }
                }, 500); // Small delay to ensure smooth transition
            };
    
            utterance.onerror = (event) => {
                console.error("Speech synthesis error:", event.error);
                if (recognition) {
                    recognition.start(); // Ensure recognition resumes even on error
                }
            };
    
            window.speechSynthesis.speak(utterance);
        } else {
            console.error("Speech synthesis is not supported in this browser.");
        }
    };
    // Update transcriptions dynamically with recognizedName
    const updateTranscription = (text, role = "user") => {
        setTranscriptions((prev) => [
            ...prev,
            {
                username: role === "user" ? recognizedName || "User" : "AI Model",
                text,
            },
        ]);
    };
    const stopSpeaking = () => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            console.log("Speech stopped.");
        }
    };
    useEffect(() => {
        console.log("Camera component mounted.");
        return () => stopCameraAndMicrophone(); // Cleanup on unmount
    }, [stopCameraAndMicrophone]);

    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                backgroundColor: "#f0f0f0",
            }}
        >
            {/* Video Section */}
            <div
                style={{
                    flex: 2,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#000",
                    position: "relative",
                }}
            >
                <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    style={{
                        width: "100%",
                        height: "auto",
                        objectFit: "cover",
                        border: "1px solid #ccc",
                    }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                {/* Thumbnail Preview */}
                {preview && (
                    <img
                        src={preview}
                        alt="Preview"
                        style={{
                            position: "absolute",
                            bottom: "10px",
                            right: "10px",
                            width: "100px",
                            height: "100px",
                            objectFit: "cover",
                            border: "2px solid #fff",
                            borderRadius: "5px",
                        }}
                    />
                )}
                {!streaming && (
                    <button
                        onClick={startCameraAndMicrophone}
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            padding: "10px 20px",
                            fontSize: "16px",
                            backgroundColor: "green",
                            color: "white",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                        }}
                    >
                        <FaCamera /> Start Camera, <FaMicrophone /> Microphone
                    </button>
                )}
                
            </div>

            {/* Transcriptions Section */}
            <div
                style={{
                    flex: 1,
                    padding: "20px",
                    overflowY: "auto",
                    borderLeft: "1px solid #ccc",
                    backgroundColor: "#fff",
                }}
            >
                <div>
                {streaming && (
                    <div style={{ marginTop: "10px" }}>
                        <button onClick={captureImage} style={{ marginRight: "10px" }}>
                        <FaCamera />Capture Image
                        </button>
                        <button onClick={stopCameraAndMicrophone}>Stop Camera</button>
                        <button onClick={stopSpeaking} disabled={!speaking}>
                            <FaStop /> Stop Speaking
                        </button>
                    </div>
                )}
                    {transcriptions.length === 0 ? (
                        <p>No words transcribed yet.</p>
                    ) : (
                        transcriptions.map((t, index) => (
                            <p key={index}>
                                <strong>{t.username}:</strong>
                                <ReactMarkdown>{t.text}</ReactMarkdown>
                            </p>
                        ))
                    )}
                </div>
                {listening && (
                    <div style={{ marginTop: "20px", fontSize: "16px", color: "green" }}>
                        <span role="img" aria-label="Listening">
                            🎙️ Listening...
                        </span>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
};

export default Camera;