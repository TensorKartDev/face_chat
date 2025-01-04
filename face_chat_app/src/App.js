import React from "react";
import Camera from "./components/Camera";

function App() {
    return (
        <div style={{ textAlign: "center", padding: "20px" }}>
            <h1>Face Recognition App</h1>
            <div style={{ marginBottom: "20px" }}>
                <Camera />
            </div>
        </div>
    );
}

export default App;