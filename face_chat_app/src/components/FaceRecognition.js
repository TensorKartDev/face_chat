import React, { useState } from "react"; // Import useState from React
import axios from "axios"; // Import Axios for HTTP requests
const FaceRecognition = ({ image, onRecognition }) => {
    const [response, setResponse] = useState("");

    const handleRecognition = async () => {
        if (!image) {
            alert("Please capture an image first.");
            return;
        }

        const formData = new FormData();
        formData.append("file", image);

        try {
            const res = await axios.post("http://localhost:8000/recognize-face/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const recognizedName = res.data.name || "Unknown";
            setResponse(recognizedName);
            onRecognition(recognizedName);
        } catch (error) {
            console.error("Error recognizing face:", error);
            setResponse("Error recognizing face.");
        }
    };

    return (
        <div>
            <button onClick={handleRecognition}>Recognize Face</button>
            {response && <p>Response: {response}</p>}
        </div>
    );
};
export default FaceRecognition;