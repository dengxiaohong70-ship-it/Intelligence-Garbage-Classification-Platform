import cv2
import numpy as np
import os
from ultralytics import YOLO

class EnhancedWasteClassifier:
    """
    Enhanced waste classification system with improved accuracy
    Combines object detection with rule-based and ML-based classification
    """

    def __init__(self, model_path=None):
        """Initialize the classifier with custom model if available"""
        if model_path and os.path.exists(model_path):
            self.model = YOLO(model_path)
            print(f"Loaded custom model: {model_path}")
        else:
            self.model = YOLO('yolov8n.pt')
            print("Using pretrained YOLOv8n model")

        # Enhanced waste classification rules
        self.waste_categories = {
            'wet_waste': {
                'high_confidence': [
                    'banana', 'apple', 'orange', 'broccoli', 'carrot', 'food waste',
                    'vegetable', 'fruit', 'sandwich', 'hot dog', 'pizza', 'donut',
                    'cake', 'meat', 'chicken', 'fish', 'bread', 'rice', 'pasta',
                    'milk', 'cheese', 'egg', 'butter'
                ],
                'medium_confidence': [
                    'bowl', 'plate', 'dining table'  # Often associated with food
                ]
            },
            'dry_waste': {
                'plastic': [
                    'bottle', 'cup', 'plastic_bottle', 'plastic_bag', 'plastic_container',
                    'plastic_cup', 'plastic_toy', 'plastic_utensil', 'bowl'
                ],
                'metal': [
                    'metal_can', 'aluminum_foil', 'metal_container', 'tin_can',
                    'fork', 'knife', 'spoon'
                ],
                'glass': [
                    'wine glass', 'glass_bottle', 'glass_jar', 'glass_cup'
                ],
                'paper': [
                    'book', 'paper', 'newspaper', 'magazine', 'cardboard',
                    'cardboard_food', 'office_paper'
                ],
                'electronics': [
                    'cell phone', 'remote', 'keyboard', 'mouse', 'laptop',
                    'microwave', 'toaster', 'refrigerator'
                ]
            },
            'hazardous': [
                'battery', 'chemical_container', 'medicine', 'paint_can'
            ]
        }

        # Custom trained model classes (if using custom model)
        self.custom_classes = {
            0: "plastic_bottle",
            1: "metal_can",
            2: "paper",
            3: "cardboard",
            4: "organic_waste",
            5: "glass_bottle",
            6: "plastic_bag",
            7: "aluminum_foil",
            8: "newspaper",
            9: "food_waste"
        }

    def classify_waste_enhanced(self, class_name, confidence):
        """
        Enhanced classification with confidence-based rules
        """
        class_lower = class_name.lower()

        # Check hazardous waste first (highest priority)
        for item in self.waste_categories['hazardous']:
            if item.lower() in class_lower:
                return 'hazardous'

        # Direct mapping for common COCO classes that are clearly waste
        coco_waste_mapping = {
            # Wet waste
            'banana': 'wet',
            'apple': 'wet',
            'orange': 'wet',
            'broccoli': 'wet',
            'carrot': 'wet',
            'sandwich': 'wet',
            'hot dog': 'wet',
            'pizza': 'wet',
            'donut': 'wet',
            'cake': 'wet',

            # Dry waste
            'bottle': 'dry',  # This is the key one - bottle should be dry
            'wine glass': 'dry',
            'cup': 'dry',
            'bowl': 'dry',
            'book': 'dry',
            'cell phone': 'dry',
            'remote': 'dry',
            'keyboard': 'dry',
            'mouse': 'dry',
            'microwave': 'dry',
            'toaster': 'dry',
            'sink': 'dry',
            'refrigerator': 'dry',
            'scissors': 'dry',
            'teddy bear': 'dry',
            'hair drier': 'dry',
            'toothbrush': 'dry'
        }

        # Check direct COCO mapping first
        if class_name in coco_waste_mapping:
            return coco_waste_mapping[class_name]

        # Check wet waste with more flexible matching
        wet_keywords = ['banana', 'apple', 'orange', 'fruit', 'food', 'vegetable', 'organic']
        if any(keyword in class_lower for keyword in wet_keywords):
            return 'wet' if confidence > 0.4 else 'unknown'

        # Check dry waste categories with flexible matching
        for category, items in self.waste_categories['dry_waste'].items():
            for item in items:
                if item.lower() in class_lower or class_lower in item.lower():
                    return 'dry' if confidence > 0.4 else 'unknown'

        # More flexible wet waste matching
        for item in self.waste_categories['wet_waste']['high_confidence']:
            if item.lower() in class_lower or class_lower in item.lower():
                return 'wet' if confidence > 0.4 else 'unknown'

        # If confidence is very high, try to classify based on common sense
        if confidence > 0.6:
            # Common household items that are typically waste
            household_items = ['bottle', 'cup', 'bowl', 'book', 'cell phone', 'remote', 'mouse', 'keyboard', 'laptop', 'tv', 'chair', 'couch', 'bed']
            if any(item in class_lower for item in household_items):
                return 'dry'

        # If not found in rules, check if it's a custom class
        if hasattr(self.model, 'names') and class_name in self.custom_classes.values():
            # Map custom classes to waste categories
            custom_mapping = {
                'plastic_bottle': 'dry',
                'metal_can': 'dry',
                'paper': 'dry',
                'cardboard': 'dry',
                'organic_waste': 'wet',
                'glass_bottle': 'dry',
                'plastic_bag': 'dry',
                'aluminum_foil': 'dry',
                'newspaper': 'dry',
                'food_waste': 'wet'
            }
            return custom_mapping.get(class_name, 'unknown')

        return 'unknown'

    def detect_and_classify(self, image_path):
        """
        Detect from disk path（含 Ultralytics + cv2.imread；在 Windows 含中文路径下会失效）。
        统一先 np.fromfile + imdecode 再交给 ndarray 推理链。
        """
        try:
            data = np.fromfile(str(image_path), dtype=np.uint8)
            if data.size == 0:
                return []
            img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        except OSError:
            return []
        if img is None:
            return []
        return self.detect_and_classify_from_frame(img)

    def detect_and_classify_from_frame(self, frame):
        """
        Detect objects and classify waste from video frame
        """
        # Run detection
        results = self.model(frame)

        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = box.conf[0].cpu().numpy()
                cls = int(box.cls[0].cpu().numpy())

                # Get class name
                if hasattr(self.model, 'names') and cls in self.model.names:
                    class_name = self.model.names[cls]
                elif cls in self.custom_classes:
                    class_name = self.custom_classes[cls]
                else:
                    class_name = f"class_{cls}"

                # Enhanced classification
                category = self.classify_waste_enhanced(class_name, conf)

                detections.append({
                    'class_name': class_name,
                    'category': category,
                    'confidence': conf,
                    'bbox': [x1, y1, x2, y2]
                })

        return detections

    def get_overall_classification(self, detections):
        """
        Determine overall waste classification with improved logic
        """
        if not detections:
            return "No waste detected in the image"

        # Filter out very low confidence detections (lower threshold)
        high_conf_detections = [d for d in detections if d['confidence'] > 0.2]
        if not high_conf_detections:
            return "Unable to classify waste type - low confidence detections"

        # Include 'unknown' categories but give them lower priority
        categories = [d['category'] for d in high_conf_detections]

        # If we have some known categories, prioritize them
        known_categories = [cat for cat in categories if cat != 'unknown']
        if known_categories:
            categories = known_categories

        if not categories:
            return "Unable to classify waste type - unknown objects detected"

        # Count categories
        wet_count = categories.count('wet')
        dry_count = categories.count('dry')
        hazardous_count = categories.count('hazardous')

        # Determine overall classification
        if hazardous_count > 0:
            return "Hazardous Waste Detected - Handle with care!"
        elif wet_count > 0 and dry_count == 0:
            return "Wet Waste (Organic)"
        elif dry_count > 0 and wet_count == 0:
            return "Dry Waste (Recyclable)"
        elif wet_count > dry_count:
            return "Mixed Waste (Mostly Wet)"
        elif dry_count > wet_count:
            return "Mixed Waste (Mostly Dry)"
        else:
            return "Mixed Waste (Wet and Dry)"

    def draw_detections(self, image, detections):
        """
        Draw bounding boxes and labels on image
        """
        if image is None:
            return None
        if not detections:
            return image
            
        img = image.copy()

        for detection in detections:
            if 'bbox' not in detection:
                continue
                
            bbox = detection['bbox']
            x1, y1, x2, y2 = map(int, bbox)
            conf = detection.get('confidence', 0)
            class_name = detection.get('class_name', 'unknown')
            category = detection.get('category', 'unknown')

            # Choose color based on category
            if category == 'wet':
                color = (0, 255, 0)  # Green
            elif category == 'dry':
                color = (255, 0, 0)  # Blue
            elif category == 'hazardous':
                color = (0, 0, 255)  # Red
            else:
                color = (128, 128, 128)  # Gray

            # Draw bounding box
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

            # Create label
            label = f"{class_name} ({category}): {conf:.2f}"

            # Draw label background
            (label_width, label_height), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(img, (x1, y1 - label_height - baseline),
                         (x1 + label_width, y1), color, -1)

            # Draw label text
            cv2.putText(img, label, (x1, y1 - baseline),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        return img