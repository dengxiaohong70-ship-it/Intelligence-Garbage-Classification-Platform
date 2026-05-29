#!/usr/bin/env python3
"""
Waste Detection Model Training Script
Run this script to train an improved waste classification model
"""

import os
import sys
sys.path.append('.')

from training.train_model import train_waste_model, create_sample_waste_dataset, create_data_yaml
from training.prepare_dataset import download_trashnet_dataset, create_synthetic_waste_data

def main():
    print("🚀 Waste Detection Model Training Pipeline")
    print("=" * 50)

    # Change to training directory
    os.chdir('training')

    print("\n📥 Step 1: Preparing Dataset")
    try:
        # Try to download real dataset
        if download_trashnet_dataset():
            print("✅ Real dataset downloaded successfully!")
        else:
            print("⚠️  Real dataset not available, creating synthetic dataset...")
            create_synthetic_waste_data()
            print("✅ Synthetic dataset created!")
    except Exception as e:
        print(f"❌ Error preparing dataset: {e}")
        print("Creating synthetic dataset as fallback...")
        create_synthetic_waste_data()

    print("\n📋 Step 2: Creating Training Configuration")
    try:
        classes = create_sample_waste_dataset()
        create_data_yaml(classes)
        print("✅ Training configuration created!")
    except Exception as e:
        print(f"❌ Error creating configuration: {e}")
        return

    print("\n🤖 Step 3: Training Model")
    print("This may take several minutes to hours depending on your hardware...")
    try:
        results = train_waste_model()
        print("✅ Model training completed!")
        print(f"📁 Best model saved at: {results.save_dir}/weights/best.pt")

        # Copy best model to main model directory
        import shutil
        best_model_path = os.path.join(results.save_dir, 'weights', 'best.pt')
        main_model_dir = os.path.join('..', 'model')
        os.makedirs(main_model_dir, exist_ok=True)
        shutil.copy(best_model_path, os.path.join(main_model_dir, 'best.pt'))
        print("✅ Model copied to main application directory!")

    except Exception as e:
        print(f"❌ Error during training: {e}")
        print("💡 Make sure you have a GPU or sufficient RAM for training")
        return

    print("\n🎉 Training Pipeline Completed!")
    print("\n📝 Next Steps:")
    print("1. Restart the Flask application: python app.py")
    print("2. The app will now use your custom trained model")
    print("3. Test with waste images to see improved accuracy")

    print("\n📊 Expected Improvements:")
    print("- Better detection of waste-specific objects")
    print("- More accurate waste classification")
    print("- Reduced 'unknown' classifications")
    print("- Higher confidence scores for waste objects")

if __name__ == "__main__":
    main()