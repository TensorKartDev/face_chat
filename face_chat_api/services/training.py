import os
import json
import torch
from facenet_pytorch import InceptionResnetV1
import lancedb
from PIL import Image
from torchvision import transforms
import pyarrow as pa
# Configuration
PERSONA_FILE = "../personas.json"
LANCEDB_PATH = "../lance_faces"
schema = pa.schema([
    ("label", pa.string()),                # Label as a string
    ("embedding", pa.list_(pa.float32(), 512)),  # 512-dimensional embedding as a list of floats
    ("image_path", pa.string())           # Image path as a string
])

if torch.backends.mps.is_available():
    device = torch.device("mps")  # Use Metal Performance Shaders for Apple Silicon
    print("Using Metal (MPS) backend for Apple Silicon.")
elif torch.cuda.is_available():
    device = torch.device("cuda")  # Use CUDA for NVIDIA GPUs
    print("Using CUDA backend.")
else:
    device = torch.device("cpu")  # Default to CPU
    print("Using CPU backend.")

# Initialize the model
model = InceptionResnetV1(pretrained="vggface2").eval().to(device)

# Preprocessing pipeline
preprocess = transforms.Compose([
    transforms.Resize((160, 160)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

def load_persona_data(persona_file):
    """
    Load persona data from a JSON file and extract image paths and corresponding labels.
    
    Args:
        persona_file (str): Path to the persona JSON file.
        
    Returns:
        tuple: A list of image paths and a list of corresponding labels.
    """
    try:
        # Load persona data from JSON file
        with open(persona_file, "r") as file:
            persona_data = json.load(file)
    except FileNotFoundError:
        print(f"Error: Persona file '{persona_file}' not found.")
        return [], []
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON file. {e}")
        return [], []

    # Initialize lists for image paths and labels
    image_paths = []
    labels = []

    # Parse persona data
    for persona in persona_data.get("personas", []):
        name = persona.get("name")
        images_folder = persona.get("images_folder")
        images_folder = f"../{images_folder}"
        print(images_folder,os.getcwd())
        
        if not images_folder:
            print(f"Warning: No 'images_folder' specified for persona '{name}'. Skipping...")
            continue

        # Verify folder exists
        if not os.path.exists(images_folder):
            print(f"Warning: Images folder '{images_folder}' for persona '{name}' does not exist. Skipping...")
            continue

        # Process images in folder
        try:
            for image_name in os.listdir(images_folder):
                image_path = os.path.join(images_folder, image_name)
                if image_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    image_paths.append(image_path)
                    labels.append(name)
        except Exception as e:
            print(f"Error: Unable to process images in '{images_folder}' for persona '{name}'. {e}")

    return image_paths, labels

def generate_embeddings(image_paths, labels):
    """
    Generate embeddings for each image using InceptionResnetV1.
    """
    data = []

    for image_path, label in zip(image_paths, labels):
        try:
            print(f"Processing image: {image_path}")
            image = Image.open(image_path).convert("RGB")
            img_tensor = preprocess(image).unsqueeze(0).to(device)

            # Generate embedding
            with torch.no_grad():
                embedding = model(img_tensor).squeeze().cpu().numpy()

            data.append({
                "label": label,
                "embedding": embedding.tolist(),
                "image_path": image_path
            })
        except Exception as e:
            print(f"Error processing {image_path}: {e}")

    return data

def store_in_lancedb(data, lancedb_path):
    """
    Store embeddings in LanceDB.
    """
    db = lancedb.connect(lancedb_path)

    if "faces" in db.table_names():
        print("Deleting existing table...")
        db.drop_table("faces")

    table = db.create_table("faces", schema=schema)
    print("Storing embeddings in LanceDB...")
    table.add(data)
    print(f"Data stored in LanceDB at {lancedb_path}")

if __name__ == "__main__":
    # Load data from persona.json
    print("Loading persona data...")
    image_paths, labels = load_persona_data(PERSONA_FILE)

    if not image_paths:
        print("No images found. Please check the persona.json file and image folder paths.")
        exit()

    # Generate embeddings
    print("Generating embeddings...")
    data = generate_embeddings(image_paths, labels)

    if not data:
        print("No embeddings generated. Ensure your images contain clear faces.")
        exit()

    # Store in LanceDB
    store_in_lancedb(data, LANCEDB_PATH)
    print("Setup completed.")