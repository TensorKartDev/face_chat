import React from "react";
import ReactMarkdown from "react-markdown";

const Transcript = ({ transcriptions, listening }) => {
    return (
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
                            <strong>{t.username}:</strong> <ReactMarkdown>{t.text}</ReactMarkdown>
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
    );
};

export default Transcript;