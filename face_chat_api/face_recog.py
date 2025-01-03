import os
import pickle
from PIL import Image
import numpy as np
from facenet_pytorch import InceptionResnetV1
from torchvision import transforms
from scipy.spatial.distance import cosine
import sys
import os
import torch
import lancedb
sys.path.append(os.path.abspath("paddle_detection"))
print(os.path.abspath("/Users/admin/source/face_chat/face_chat_api/paddle_detection"))
# Load model
model = InceptionResnetV1(pretrained='vggface2').eval()

# Image preprocessing
transform = transforms.Compose([
    transforms.Resize((160, 160)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

def extract_embedding(image_path_or_obj):
    """Extract face embedding from an image file."""
    if isinstance(image_path_or_obj, str):
        image = Image.open(image_path_or_obj).convert('RGB')
    else:
        image = Image.open(image_path_or_obj).convert('RGB')
    image = transform(image).unsqueeze(0)
    with torch.no_grad():
        embedding = model(image).numpy().flatten()
    return embedding

def generate_embeddings(data_path, output_path="embeddings.pkl"):
    """Generate and save embeddings for all personas."""
    embeddings = {}
    for person in os.listdir(data_path):
        person_path = os.path.join(data_path, person)
        if os.path.isdir(person_path):
            person_embeddings = []
            for img_file in os.listdir(person_path):
                img_path = os.path.join(person_path, img_file)
                person_embeddings.append(extract_embedding(img_path))
            embeddings[person] = np.mean(person_embeddings, axis=0)
    with open(output_path, 'wb') as f:
        pickle.dump(embeddings, f)

# def recognize_face(image, embeddings_path="embeddings.pkl"):
#     """Recognize the person in the given image."""
#     with open(embeddings_path, 'rb') as f:
#         embeddings = pickle.load(f)
#     test_embedding = extract_embedding(image)
#     best_match = None
#     lowest_distance = float('inf')
#     for person, stored_embedding in embeddings.items():
#         distance = cosine(test_embedding, stored_embedding)
#         if distance < lowest_distance:
#             lowest_distance = distance
#             best_match = person
#     return best_match if lowest_distance < 0.5 else "Unknown"

def recognize_face(captured_embedding, lancedb_path):
    """
    Recognize a face by searching LanceDB for the closest match.
    
    Args:
        captured_embedding (list): Embedding of the captured image.
        lancedb_path (str): Path to the LanceDB database.
    
    Returns:
        dict: The best match with label and similarity score.
    """
    # Connect to LanceDB
    db = lancedb.connect(lancedb_path)
    table = db.open_table("faces")

    # Perform vector search
    results = table.search(captured_embedding).n(1).execute()

    if len(results) > 0:
        best_match = results[0]
        similarity = np.dot(
            np.array(captured_embedding),
            np.array(best_match["embedding"])
        )
        return {"label": best_match["label"], "similarity": similarity}
    else:
        return {"label": "Unknown", "similarity": 0.0}