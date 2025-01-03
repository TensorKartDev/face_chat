import React, { useState } from "react";
import Camera from "./components/Camera";

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
            // Call the backend API for face recognition
            const response = await fetch("http://localhost:8000/recognize-face/", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API returned status: ${response.status}`);
            }

            const data = await response.json();
            console.log("API Response:", data);

            // Update recognized name from API response
            setRecognizedName(data.name || "Unknown");
            setResponseMessage(""); // Clear any previous error messages
        } catch (error) {
            console.error("Error recognizing face:", error);
            setResponseMessage("Failed to recognize face. Please try again.");
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