import React, { useState } from "react";
import axios from "axios";

const Chat = ({ recognizedName }) => {
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState("");

    const handleChat = async () => {
        if (!query.trim()) {
            alert("Please enter a message.");
            return;
        }

        try {
            const res = await axios.post("http://localhost:8000/chat/", {
                query,
            });
            setResponse(res.data.response || "No response received.");
        } catch (error) {
            console.error("Error during chat:", error);
            setResponse("Error connecting to the chat system.");
        }
    };

    return (
        <div>
            <h3>Chat with the system</h3>
            <p>Recognized User: {recognizedName}</p>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask something..."
                style={{ width: "70%", marginRight: "10px" }}
            />
            <button onClick={handleChat}>Send</button>
            {response && <p>Response: {response}</p>}
        </div>
    );
};

export default Chat;