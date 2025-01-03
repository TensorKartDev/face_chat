import React, { useRef, useState, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
let recognition;

const Camera = ({ onRecognition }) => {
    const [streaming, setStreaming] = useState(false); // Track if the camera and microphone are streaming
    const [transcriptions, setTranscriptions] = useState([]); // Store line-by-line transcriptions
    const [preview, setPreview] = useState(null); // Captured image preview
    const videoRef = useRef(null); // Reference to the <video> element
    const canvasRef = useRef(null); // Reference to the <canvas> element
    const mediaStreamRef = useRef(null); // Store the combined video/audio stream
    const [listening, setListening] = useState(false); // Indicates if speech recognition is active
    const [username, setUsername] = useState("User"); // Placeholder for user identification

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
            alert("Speech recognition is not supported in your browser.");
            return;
        }

        // Initialize SpeechRecognition
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = "en-US"; // Set language to English
        recognition.continuous = false; // Automatically stop after each phrase
        recognition.interimResults = true; // Show interim results

        recognition.onstart = () => {
            console.log("Speech recognition started...");
            setListening(true);
        };

        recognition.onresult = async (event) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript.trim();
                }
            }
            console.log("Final Transcript:", finalTranscript);

            if (finalTranscript) {
                setTranscriptions((prev) => [...prev, { username, text: finalTranscript }]); // Add user transcription
                await handleApiResponse(finalTranscript); // Send to API and handle response
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
        };

        recognition.onend = () => {
            console.log("Speech recognition stopped. Restarting...");
            setListening(false);
            startSpeechRecognition(); // Restart recognition
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
                    onRecognition(file);
                    // Update username after recognition (mock for now)
                    setUsername("Identified User"); // Replace with actual user recognition logic
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
                setTranscriptions((prev) => [
                    ...prev,
                    { username: "AI Model", text: data.response },
                ]);
    
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
            // Stop any ongoing speech synthesis
            window.speechSynthesis.cancel();
    
            const utterance = new SpeechSynthesisUtterance(text);
    
            // Find Samantha's voice
            const voices = window.speechSynthesis.getVoices();
            const samanthaVoice = voices.find((voice) => voice.name === "Samantha");
    
            if (samanthaVoice) {
                utterance.voice = samanthaVoice;
                console.log("Using Samantha's voice.");
            } else {
                console.warn("Samantha's voice not found. Using the default voice.");
            }
    
            // Speak the text
            utterance.rate = 1; // Normal speaking rate
            utterance.pitch = 1; // Normal pitch
            utterance.volume = 1; // Full volume
    
            // Event listeners for debugging and feedback
            utterance.onstart = () => console.log("Speech started.");
            utterance.onend = () => console.log("Speech ended.");
            utterance.onerror = (event) => console.error("Speech synthesis error:", event.error);
    
            window.speechSynthesis.speak(utterance);
        } else {
            console.error("Speech synthesis not supported in this browser.");
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
                        Start Camera & Microphone
                    </button>
                )}
                {streaming && (
                    <div style={{ marginTop: "10px" }}>
                        <button onClick={captureImage} style={{ marginRight: "10px" }}>
                            Capture Image
                        </button>
                        <button onClick={stopCameraAndMicrophone}>Stop Camera</button>
                    </div>
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