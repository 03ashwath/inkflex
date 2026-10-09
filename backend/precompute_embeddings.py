import os
import joblib
from sentence_transformers import SentenceTransformer
from PIL import Image

def compute_embeddings():
    print("Loading CLIP model...")
    # Use a small and fast CLIP model
    model = SentenceTransformer('clip-ViT-B-32')
    
    dataset_dir = os.path.join(os.path.dirname(__file__), 'app', 'dataset')
    if not os.path.exists(dataset_dir):
        print(f"Dataset dir not found: {dataset_dir}")
        return
        
    all_images = [f for f in os.listdir(dataset_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
    print(f"Found {len(all_images)} images.")
    
    image_paths = [os.path.join(dataset_dir, f) for f in all_images]
    images = []
    valid_paths = []
    
    for p in image_paths:
        try:
            # Must convert to RGB in case some are RGBA/Grayscale
            img = Image.open(p).convert('RGB')
            images.append(img)
            valid_paths.append(p)
        except Exception as e:
            print(f"Error loading {p}: {e}")
            
    print("Computing embeddings... This will take a moment.")
    embeddings = model.encode(images, batch_size=16, show_progress_bar=True)
    
    output_data = {
        'files': [os.path.basename(p) for p in valid_paths],
        'embeddings': embeddings
    }
    
    output_path = os.path.join(dataset_dir, 'embeddings.joblib')
    joblib.dump(output_data, output_path)
    print(f"Saved embeddings to {output_path}")

if __name__ == "__main__":
    compute_embeddings()
