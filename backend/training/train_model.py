import os
import cv2
import numpy as np
from ultralytics import YOLO
import yaml
from sklearn.model_selection import train_test_split
import shutil

def create_sample_waste_dataset():
    """
    Create a sample waste dataset for demonstration
    In a real scenario, you would use actual waste images
    """
    print("Creating sample waste dataset...")

    # Create directories
    base_dir = "training/dataset"
    images_dir = os.path.join(base_dir, "images")
    labels_dir = os.path.join(base_dir, "labels")

    for split in ["train", "val", "test"]:
        os.makedirs(os.path.join(images_dir, split), exist_ok=True)
        os.makedirs(os.path.join(labels_dir, split), exist_ok=True)

    # For demonstration, we'll create synthetic data
    # In real scenario, replace with actual waste images

    # Waste categories and their COCO equivalents
    waste_classes = {
        0: "plastic_bottle",
        1: "metal_can",
        2: "paper",
        3: "cardboard",
        4: "organic_waste",
        5: "glass_bottle"
    }

    print(f"Dataset structure created with classes: {waste_classes}")
    return waste_classes

def create_data_yaml(classes):
    """Create YAML configuration for YOLOv8 training"""
    data_yaml = {
        'path': './dataset',
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'names': classes,
        'nc': len(classes)
    }

    with open('training/data.yaml', 'w') as f:
        yaml.dump(data_yaml, f, default_flow_style=False)

    print("Created data.yaml configuration")

def train_waste_model():
    """Train YOLOv8 model on waste dataset"""

    print("Starting YOLOv8 training for waste classification...")

    # Load pretrained model
    model = YOLO('yolov8n.pt')

    # Training configuration
    training_args = {
        'data': 'data.yaml',
        'epochs': 50,
        'batch': 16,
        'imgsz': 640,
        'save': True,
        'save_period': 10,
        'cache': False,
        'device': 0,  # Use GPU if available, else CPU
        'workers': 4,
        'project': 'waste_detection',
        'name': 'waste_model_v1',
        'exist_ok': True,
        'pretrained': True,
        'optimizer': 'Adam',
        'lr0': 0.001,
        'lrf': 0.01,
        'momentum': 0.937,
        'weight_decay': 0.0005,
        'warmup_epochs': 3.0,
        'warmup_momentum': 0.8,
        'warmup_bias_lr': 0.1,
        'box': 7.5,
        'cls': 0.5,
        'dfl': 1.5,
        'fl_gamma': 0.0,
        'label_smoothing': 0.0,
        'nbs': 64,
        'overlap_mask': True,
        'mask_ratio': 4,
        'dropout': 0.0,
        'val': True,
        'plots': True
    }

    # Train the model
    results = model.train(**training_args)

    print("Training completed!")
    print(f"Best model saved at: {results.save_dir}/weights/best.pt")

    return results

def evaluate_model(model_path):
    """Evaluate trained model performance"""
    print(f"Evaluating model: {model_path}")

    model = YOLO(model_path)

    # Run validation
    metrics = model.val()

    print("Evaluation Results:")
    print(f"mAP@0.5: {metrics.box.map50:.4f}")
    print(f"mAP@0.5:0.95: {metrics.box.map:.4f}")
    print(f"Precision: {metrics.box.mp:.4f}")
    print(f"Recall: {metrics.box.mr:.4f}")

    return metrics

def create_enhanced_classification_model():
    """
    Create an enhanced waste classification system
    This combines object detection with rule-based classification
    """
    print("Creating enhanced waste classification model...")

    # Define comprehensive waste classification rules
    waste_rules = {
        'wet_waste': {
            'organic': ['banana', 'apple', 'orange', 'broccoli', 'carrot', 'food waste',
                       'vegetable', 'fruit', 'sandwich', 'hot dog', 'pizza', 'donut',
                       'cake', 'meat', 'chicken', 'fish', 'bread', 'rice', 'pasta'],
            'biodegradable': ['paper_towel', 'tissue', 'napkin', 'cardboard_food']
        },
        'dry_waste': {
            'plastic': ['plastic_bottle', 'plastic_bag', 'plastic_container', 'plastic_cup',
                       'plastic_toy', 'plastic_utensil'],
            'metal': ['metal_can', 'aluminum_foil', 'metal_container', 'tin_can'],
            'glass': ['glass_bottle', 'glass_jar', 'glass_cup'],
            'paper': ['newspaper', 'magazine', 'office_paper', 'book', 'cardboard'],
            'electronics': ['cell_phone', 'battery', 'cable', 'charger']
        },
        'hazardous': ['battery', 'chemical_container', 'medicine', 'paint_can'],
        'unknown': []  # Will be populated during classification
    }

    return waste_rules

if __name__ == "__main__":
    print("Waste Detection Model Training Pipeline")
    print("=" * 50)

    # Step 1: Create dataset structure
    classes = create_sample_waste_dataset()

    # Step 2: Create data configuration
    create_data_yaml(classes)

    # Step 3: Create enhanced classification rules
    waste_rules = create_enhanced_classification_model()

    print("\nNext steps:")
    print("1. Add actual waste images to training/dataset/images/")
    print("2. Create corresponding label files in training/dataset/labels/")
    print("3. Run: python training/train_model.py")
    print("4. Update app.py to use the trained model")

    # Uncomment to run training (requires actual dataset)
    # train_waste_model()