from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any, Optional
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score, accuracy_score, precision_score, recall_score, f1_score
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression


app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/classification")
async def classify_features(
    model_type: str = Form(...),
    features: UploadFile = Form(...),
    target: str = Form(None)
):
    try:
        # Parse data
        try:
            content = await features.read()
            feature_data_json = json.loads(content.decode("utf-8"))
            
            # Parse target column name
            target_column = target
            
            # Parse model type
            model_type = model_type.lower()
            print(f"Classification requested with model: {model_type}, target: {target_column}")
        except json.JSONDecodeError:
            return {"error": "Invalid JSON in feature data"}
        
        # Extract data from the JSON structure
        if isinstance(feature_data_json, dict):
            # Handle possible data structures
            if "features" in feature_data_json:
                feature_data = feature_data_json["features"]
            elif "selectedFeatures" in feature_data_json:
                feature_data = feature_data_json["selectedFeatures"]
            elif "originalData" in feature_data_json:
                feature_data = feature_data_json["originalData"]
            else:
                return {"error": "Could not find feature data in the provided payload"}
        else:
            feature_data = feature_data_json
              # Convert to DataFrame
        try:
            df = pd.DataFrame(feature_data)
            print(f"Data loaded with columns: {df.columns.tolist()}")
        except Exception as e:
            return {"error": f"Failed to create DataFrame: {str(e)}"}
            
        if df.empty:
            return {"error": "DataFrame is empty after conversion"}
        
        # Select numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        # Decide mode: supervised if target provided and exists, else unsupervised clustering
        if target_column and target_column in df.columns:
            # Supervised classification
            X = df[numeric_cols].copy()
            y = df[target_column]
            # Drop target from features if present
            if target_column in X.columns:
                X = X.drop(columns=[target_column])
            # Scale
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.3, random_state=42, stratify=y if len(y.unique())>1 else None
            )
            # Select model based on model_type
            if model_type == 'svm':
                model = SVC(kernel='rbf', probability=True, random_state=42)
            elif model_type in ['logistic_regression', 'logistic']:
                model = LogisticRegression(max_iter=1000, random_state=42)
            else:
                # Default to Random Forest
                model = RandomForestClassifier(n_estimators=100, random_state=42)
            # Fit supervised model
            model.fit(X_train, y_train)
            # Predict and evaluate
            y_pred = model.predict(X_test)
            # Compute metrics
            metrics = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred, average='weighted', zero_division=0),
                'recall': recall_score(y_test, y_pred, average='weighted', zero_division=0),
                'f1_score': f1_score(y_test, y_pred, average='weighted', zero_division=0)
            }
            # Feature importance or coefficients
            feat_imp: Dict[str, float] = {}
            if hasattr(model, 'feature_importances_'):
                imps = model.feature_importances_
                feat_imp = {col: float(imps[i]) for i, col in enumerate(X.columns)}
            elif hasattr(model, 'coef_'):
                coefs = np.abs(model.coef_).mean(axis=0)
                feat_imp = {col: float(coefs[i]) for i, col in enumerate(X.columns)}
            return {
                'mode': 'supervised',
                'model': model_type,
                'metrics': metrics,
                'feature_importances': feat_imp
            }
        # Unsupervised clustering path
        X = df[numeric_cols]
        print(f"Using {len(numeric_cols)} numeric feature columns for clustering")
        # Default to KMeans clustering
        model = KMeans(n_clusters=3, random_state=42)
        cluster_labels = model.fit_predict(X)
        df['cluster'] = cluster_labels
        # Compute clustering metrics
        metrics = {
            'silhouette_score': silhouette_score(X, cluster_labels),
            'calinski_harabasz_score': calinski_harabasz_score(X, cluster_labels),
            'davies_bouldin_score': davies_bouldin_score(X, cluster_labels)
        }
        # For KMeans, we can provide cluster centers
        cluster_centers = {}
        if hasattr(model, 'cluster_centers_'):
            centers = model.cluster_centers_
            cluster_centers = {f'center_{i}': centers[i].tolist() for i in range(len(centers))}
        return {
            'mode': 'unsupervised',
            'model': 'kmeans',  # Indicate default model used
            'metrics': metrics,
            'cluster_centers': cluster_centers
        }
    except Exception as e:
        return {"error": str(e)}
