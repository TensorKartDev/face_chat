import React, { useState } from "react";
import Camera from "./components/Camera";
import axios from "axios";
function App() {
    const [recognizedName, setRecognizedName] = useState(""); // Stores the recognized name
    const [responseMessage, setResponseMessage] = useState(""); // To display API responses or errors

    // Handle the recognized name or file from the Camera component
    const handleRecognition = async (file) => {
        console.log("Image file received for recognition:", file);
    
        if (!file) {
            setResponseMessage("No file captured for recognition.");
            return;
        }
    
        // Prepare form data for the API call
        const formData = new FormData();
        formData.append("file", file);
    
        try {
            // Call the backend API for face recognition using axios
            console.log("Calling API...");
            const response = await axios.post("http://localhost:8000/recognize-face", formData, {
                headers: {
                    "Content-Type": "multipart/form-data", // Set content type for form data
                },
            });
    
            console.log("API Response:", response.data);
    
            // Update recognized name from API response
            setRecognizedName(response.data.name || "Unknown");
            setResponseMessage(""); // Clear any previous error messages
        } catch (error) {
            console.error("Error recognizing face:", error);
    
            // Provide a user-friendly error message
            if (error.response) {
                console.error("API Error Response:", error.response.data);
                setResponseMessage(error.response.data?.error || "Failed to recognize face. Please try again.");
            } else if (error.request) {
                console.error("No response received from API:", error.request);
                setResponseMessage("No response received from the server. Please try again later.");
            } else {
                console.error("Error setting up request:", error.message);
                setResponseMessage("An error occurred. Please try again.");
            }
        }
    };

    return (
        <div style={{ textAlign: "center", padding: "20px" }}>
            <h1>Face Recognition App</h1>
            <div style={{ marginBottom: "20px" }}>
                {/* Pass handleRecognition as a prop to Camera */}
                <Camera onRecognition={handleRecognition} />
            </div>
            {recognizedName && (
                <div>
                    <h2>Hello, {recognizedName}!</h2>
                </div>
            )}
            {responseMessage && (
                <div style={{ color: "red", marginTop: "20px" }}>
                    <p>{responseMessage}</p>
                </div>
            )}
        </div>
    );
}

export default App;