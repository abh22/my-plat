from fastapi import FastAPI, UploadFile, Form, File
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
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from typing import Union


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
    features: UploadFile = File(...),
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
        # Decide mode based on model_type: supervised if a supervised model is selected, else unsupervised clustering
        supervised_models = ['random_forest', 'svm', 'logistic_regression', 'logistic']
        if model_type in supervised_models:
            # Ensure target column is provided and exists in the data
            if not target_column or target_column not in df.columns:
                return {'error': f"Target column '{target_column}' not found in data"}
            # Supervised classification
            X = df[numeric_cols].copy()
            y = df[target_column]
            if target_column in X.columns:
                X = X.drop(columns=[target_column])
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.3, random_state=42,
                stratify=y if len(y.unique()) > 1 else None
            )
            if model_type == 'svm':
                model = SVC(kernel='rbf', probability=True, random_state=42)
            elif model_type in ['logistic_regression', 'logistic']:
                model = LogisticRegression(max_iter=1000, random_state=42)
            else:
                model = RandomForestClassifier(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            metrics = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred, average='weighted', zero_division=0),
                'recall': recall_score(y_test, y_pred, average='weighted', zero_division=0),
                'f1_score': f1_score(y_test, y_pred, average='weighted', zero_division=0)
            }
            feat_imp: Dict[str, Any] = {}
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
        num_clusters = 3
        model = KMeans(n_clusters=num_clusters, random_state=42)
        cluster_labels = model.fit_predict(X)
        # Compute 2D PCA coordinates for visualization
        scaler_vis = StandardScaler()
        X_scaled_vis = scaler_vis.fit_transform(X)
        pca_vis = PCA(n_components=2)
        coords = pca_vis.fit_transform(X_scaled_vis)
        pca_coords = coords.tolist()
        # Compute cluster distribution
        from collections import Counter
        # Count labels and convert numpy ints to native Python types for JSON serialization
        raw_counts = Counter(cluster_labels)
        cluster_distribution = { str(int(k)): int(v) for k, v in raw_counts.items() }
        df['cluster'] = cluster_labels
        # Compute clustering metrics
        silhouette = silhouette_score(X, cluster_labels) if num_clusters > 1 else None
        calinski = calinski_harabasz_score(X, cluster_labels) if num_clusters > 1 else None
        davies = davies_bouldin_score(X, cluster_labels) if num_clusters > 1 else None
        # Compute explained variance (1 - within_ss/total_ss) for KMeans if available
        explained_variance = None
        if hasattr(model, 'inertia_'):
            # Sum all squared deviations across all observations and features
            total_ss = ((X - X.mean()) ** 2).to_numpy().sum()
            within_ss = model.inertia_
            if total_ss > 0:
                explained_variance = float(1 - within_ss / total_ss)
        # For KMeans, we can provide cluster centers
        cluster_centers = {}
        if hasattr(model, 'cluster_centers_'):
            centers = model.cluster_centers_
            cluster_centers = {f'center_{i}': centers[i].tolist() for i in range(len(centers))}
        return {
            'mode': 'unsupervised',
            'model': model_type,
            'numClusters': num_clusters,
            'cluster_distribution': cluster_distribution,
            'metrics': {
                'silhouette': silhouette,
                'calinskiHarabasz': calinski,
                'daviesBouldin': davies
            },
            'explainedVariance': explained_variance,
            'cluster_centers': cluster_centers,
            'labels': [int(l) for l in cluster_labels],
            'pca_coords': pca_coords
        }
    except Exception as e:
        return {"error": str(e)}
