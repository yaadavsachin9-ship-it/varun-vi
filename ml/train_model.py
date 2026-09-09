"""
Landslide & Flash Flood Susceptibility Classifier Training Script
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions
Trains an ensemble Random Forest classifier on geological & hydro-meteorological parameters.
"""

import os
import sys
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score

MODEL_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(MODEL_DIR, "..", "data", "historical_incidents.csv")
MODEL_SAVE_PATH = os.path.join(MODEL_DIR, "susceptibility_model.joblib")

FEATURE_COLS = [
    "elevation_m",
    "avg_slope_deg",
    "distance_to_stream_m",
    "drainage_capacity_index",
    "rainfall_1h_mm",
    "rainfall_24h_mm",
    "soil_moisture_pct",
    "pore_water_pressure_kpa",
    "vibration_index"
]

def train_and_export_model():
    if not os.path.exists(DATA_PATH):
        print(f"Data file not found at {DATA_PATH}. Generating first...")
        from data.historical_incidents import generate_full_historical_dataset
        df = generate_full_historical_dataset()
    else:
        df = pd.read_csv(DATA_PATH)

    print(f"Training dataset loaded: {len(df)} samples.")
    X = df[FEATURE_COLS]
    y = df["hazard_occurred"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_split=4,
        random_state=42,
        class_weight="balanced"
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print(f"\nModel Performance on Test Split:")
    print(f"Accuracy: {acc*100:.2f}% | ROC-AUC Score: {auc:.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    # Feature Importance analysis
    importances = pd.Series(clf.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print("Top Predictive Feature Importances:")
    for feat, imp in importances.items():
        print(f" - {feat:25s}: {imp:.4f}")

    # Save artifact
    joblib.dump({
        "model": clf,
        "feature_cols": FEATURE_COLS,
        "accuracy": acc,
        "roc_auc": auc,
        "version": "v1.0-rf-ensemble"
    }, MODEL_SAVE_PATH)
    print(f"\nModel successfully saved to: {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train_and_export_model()
