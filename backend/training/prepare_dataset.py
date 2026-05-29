import os
import requests
import zipfile
import shutil
from pathlib import Path

def download_trashnet_dataset():
    """
    Download the TrashNet dataset for waste classification
    TrashNet contains images of 6 classes: cardboard, glass, metal, paper, plastic, trash
    """
    print("Downloading TrashNet dataset...")

    # Create dataset directory
    dataset_dir = Path("training/dataset")
    dataset_dir.mkdir(exist_ok=True)

    # TrashNet dataset URL (hosted on various sources)
    # Note: You may need to download manually if the URL changes
    urls = [
        "https://github.com/garythung/trashnet/raw/master/data/dataset-resized.zip",
        # Alternative: "https://storage.googleapis.com/trashnet/dataset-resized.zip"
    ]

    zip_path = dataset_dir / "trashnet.zip"

    for url in urls:
        try:
            print(f"Trying to download from: {url}")
            response = requests.get(url, stream=True)
            response.raise_for_status()

            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            print("Download completed!")
            break

        except Exception as e:
            print(f"Failed to download from {url}: {e}")
            continue
    else:
        print("Could not download dataset. Please download manually from:")
        print("https://github.com/garythung/trashnet")
        return False

    # Extract the dataset
    print("Extracting dataset...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(dataset_dir)

    # Organize the data
    organize_trashnet_data(dataset_dir)

    return True

def organize_trashnet_data(dataset_dir):
    """Organize TrashNet data into YOLO format"""
    print("Organizing dataset into YOLO format...")

    # TrashNet classes mapping to our waste classes
    class_mapping = {
        'cardboard': 3,  # cardboard
        'glass': 5,      # glass_bottle
        'metal': 1,      # metal_can
        'paper': 2,      # paper
        'plastic': 0,    # plastic_bottle
        'trash': 4       # organic_waste
    }

    # Create directories
    for split in ['train', 'val', 'test']:
        (dataset_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

    # Process each class
    extracted_dir = dataset_dir / "dataset-resized"
    if not extracted_dir.exists():
        print("Extracted dataset not found. Please check the download.")
        return

    all_images = []
    for class_name in class_mapping.keys():
        class_dir = extracted_dir / class_name
        if class_dir.exists():
            images = list(class_dir.glob("*.jpg"))
            all_images.extend([(img, class_mapping[class_name]) for img in images])

    # Split data
    train_images, temp_images = train_test_split(all_images, test_size=0.3, random_state=42)
    val_images, test_images = train_test_split(temp_images, test_size=0.5, random_state=42)

    # Copy and create labels
    copy_images_to_yolo_format(train_images, 'train', dataset_dir)
    copy_images_to_yolo_format(val_images, 'val', dataset_dir)
    copy_images_to_yolo_format(test_images, 'test', dataset_dir)

    print("Dataset organization completed!")

def copy_images_to_yolo_format(image_list, split, dataset_dir):
    """Copy images and create YOLO format labels"""
    for img_path, class_id in image_list:
        # Copy image
        dest_img = dataset_dir / 'images' / split / img_path.name
        shutil.copy(img_path, dest_img)

        # Create label file (YOLO format: class_id center_x center_y width height)
        # For simplicity, we'll create a centered bounding box
        label_file = dataset_dir / 'labels' / split / img_path.stem
        with open(f"{label_file}.txt", 'w') as f:
            # class_id center_x center_y width height (normalized)
            f.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

def create_synthetic_waste_data():
    """Create synthetic waste data for demonstration when real dataset is not available"""
    print("Creating synthetic waste data for demonstration...")

    dataset_dir = Path("training/dataset")

    # Create some sample images with simple shapes representing waste
    waste_types = [
        ("plastic_bottle", 0),
        ("metal_can", 1),
        ("paper", 2),
        ("cardboard", 3),
        ("organic_waste", 4),
        ("glass_bottle", 5)
    ]

    for split in ['train', 'val', 'test']:
        img_dir = dataset_dir / 'images' / split
        label_dir = dataset_dir / 'labels' / split
        img_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)

        for waste_name, class_id in waste_types:
            # Create 10 images per class per split
            for i in range(10):
                img_name = f"{waste_name}_{split}_{i}.jpg"
                img_path = img_dir / img_name
                label_path = label_dir / f"{waste_name}_{split}_{i}.txt"

                # Create a simple colored rectangle image
                img = create_simple_waste_image(waste_name)
                cv2.imwrite(str(img_path), img)

                # Create YOLO format label
                with open(label_path, 'w') as f:
                    f.write(f"{class_id} 0.5 0.5 0.8 0.8\n")

    print("Synthetic dataset created!")

def create_simple_waste_image(waste_type):
    """Create a simple image representing different waste types"""
    import cv2
    import numpy as np

    img = np.zeros((224, 224, 3), dtype=np.uint8)

    if "plastic" in waste_type:
        # Blue rectangle for plastic
        cv2.rectangle(img, (50, 50), (174, 174), (255, 0, 0), -1)
    elif "metal" in waste_type:
        # Silver/gray rectangle for metal
        cv2.rectangle(img, (50, 50), (174, 174), (192, 192, 192), -1)
    elif "glass" in waste_type:
        # Light blue rectangle for glass
        cv2.rectangle(img, (50, 50), (174, 174), (173, 216, 230), -1)
    elif "paper" in waste_type:
        # White rectangle for paper
        cv2.rectangle(img, (50, 50), (174, 174), (255, 255, 255), -1)
    elif "cardboard" in waste_type:
        # Brown rectangle for cardboard
        cv2.rectangle(img, (50, 50), (174, 174), (139, 69, 19), -1)
    else:
        # Green rectangle for organic
        cv2.rectangle(img, (50, 50), (174, 174), (0, 255, 0), -1)

    return img

if __name__ == "__main__":
    print("Waste Dataset Preparation")
    print("=" * 30)

    # Try to download real dataset first
    if not download_trashnet_dataset():
        print("Using synthetic dataset instead...")
        create_synthetic_waste_data()

    print("\nDataset preparation completed!")
    print("You can now run: python training/train_model.py")