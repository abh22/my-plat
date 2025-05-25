from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any, Optional
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import matplotlib.pyplot as plt
from io import BytesIO
import base64


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
        
        # Select only numeric columns for features
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        X = df[numeric_cols]
        print(f"Using {len(numeric_cols)} numeric feature columns for clustering")
        
        if X.shape[1] == 0:
            return {"error": "No numeric features available for clustering"}
        
        # Scale the data
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Apply dimensionality reduction for visualization
        # PCA for 2D visualization
        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X_scaled)
        
        # Store PCA explained variance
        pca_explained_variance = pca.explained_variance_ratio_.sum()
        
        # Apply t-SNE for alternative visualization if dataset is not too large
        if X.shape[0] <= 5000:  # t-SNE can be slow for large datasets
            tsne = TSNE(n_components=2, random_state=42)
            X_tsne = tsne.fit_transform(X_scaled)
        else:
            X_tsne = None
        
        # Select and apply clustering algorithm
        model_type = model_type.lower()
        clusters = None
        n_clusters = min(10, X.shape[0] // 5) if X.shape[0] > 10 else 2  # Default number of clusters
        
        if model_type == 'kmeans':
            # Find optimal number of clusters using silhouette score
            silhouette_scores = []
            k_range = range(2, min(11, X.shape[0] // 5) if X.shape[0] > 10 else 3)
            for k in k_range:
                kmeans = KMeans(n_clusters=k, random_state=42)
                kmeans.fit(X_scaled)
                try:
                    silhouette_scores.append(silhouette_score(X_scaled, kmeans.labels_))
                except:
                    silhouette_scores.append(0)  # In case of single-element clusters
            
            # Find best k
            if silhouette_scores:
                best_k = k_range[silhouette_scores.index(max(silhouette_scores))]
            else:
                best_k = 3  # Default if silhouette scoring fails
                
            # Apply KMeans with optimal k
            model = KMeans(n_clusters=best_k, random_state=42)
            clusters = model.fit_predict(X_scaled)
            n_clusters = best_k
            print(f"Using KMeans clustering with {best_k} clusters")
            
            # Get cluster centers
            centers = model.cluster_centers_
            
            # Get feature importances from cluster centers
            feature_importance = {}
            for i, col in enumerate(numeric_cols):
                # Calculate variance of this feature across cluster centers
                importance = np.var([center[i] for center in centers])
                feature_importance[col] = float(importance)
                
            # Normalize feature importances
            if feature_importance:
                max_importance = max(feature_importance.values())
                if max_importance > 0:
                    for col in feature_importance:
                        feature_importance[col] /= max_importance
                        
        elif model_type == 'dbscan':
            # Use DBSCAN for density-based clustering
            model = DBSCAN(eps=0.5, min_samples=5)
            clusters = model.fit_predict(X_scaled)
            n_clusters = len(set(clusters)) - (1 if -1 in clusters else 0)  # Count unique clusters excluding noise
            print(f"Using DBSCAN clustering found {n_clusters} clusters")
            
            # For DBSCAN, we can't easily get feature importances from the model
            # Use variance of features per cluster as a proxy
            feature_importance = {}
            for i, col in enumerate(numeric_cols):
                cluster_variances = []
                for cluster_id in set(clusters):
                    if cluster_id != -1:  # Exclude noise points
                        cluster_points = X_scaled[clusters == cluster_id]
                        if len(cluster_points) > 1:
                            cluster_variances.append(np.var(cluster_points[:, i]))
                
                # Average variance across clusters
                if cluster_variances:
                    feature_importance[col] = float(np.mean(cluster_variances))
                else:
                    feature_importance[col] = 0.0
                    
            # Normalize feature importances
            if feature_importance:
                max_importance = max(feature_importance.values())
                if max_importance > 0:
                    for col in feature_importance:
                        feature_importance[col] /= max_importance
            
        elif model_type == 'hierarchical':
            # Use Agglomerative Clustering
            model = AgglomerativeClustering(n_clusters=n_clusters)
            clusters = model.fit_predict(X_scaled)
            print(f"Using Hierarchical clustering with {n_clusters} clusters")
            
            # For hierarchical clustering, we can use variance within clusters
            feature_importance = {}
            for i, col in enumerate(numeric_cols):
                feature_variances = []
                for cluster_id in range(n_clusters):
                    cluster_points = X_scaled[clusters == cluster_id, i]
                    if len(cluster_points) > 1:
                        feature_variances.append(np.var(cluster_points))
                
                # Use mean variance as importance
                if feature_variances:
                    feature_importance[col] = float(np.mean(feature_variances))
                else:
                    feature_importance[col] = 0.0
                    
            # Normalize feature importances
            if feature_importance:
                max_importance = max(feature_importance.values())
                if max_importance > 0:
                    for col in feature_importance:
                        feature_importance[col] /= max_importance
        else:
            # Default to KMeans
            model = KMeans(n_clusters=n_clusters, random_state=42)
            clusters = model.fit_predict(X_scaled)
            print(f"Unknown model type '{model_type}', defaulting to KMeans with {n_clusters} clusters")
            
            # Same feature importance calculation as KMeans above
            centers = model.cluster_centers_
            feature_importance = {}
            for i, col in enumerate(numeric_cols):
                importance = np.var([center[i] for center in centers])
                feature_importance[col] = float(importance)
                
            # Normalize
            if feature_importance:
                max_importance = max(feature_importance.values())
                if max_importance > 0:
                    for col in feature_importance:
                        feature_importance[col] /= max_importance        # Generate visualization plots
        plots = {}
        
        # Create a scatter plot of the PCA results
        if X_pca is not None and clusters is not None:
            plt.figure(figsize=(10, 8))
            plt.scatter(X_pca[:, 0], X_pca[:, 1], c=clusters, cmap='viridis', alpha=0.7)
            plt.title(f'PCA Visualization of Clusters ({model_type.capitalize()})')
            plt.xlabel('Principal Component 1')
            plt.ylabel('Principal Component 2')
            if model_type == 'kmeans':
                # Plot centroids
                pca_centers = pca.transform(centers * scaler.scale_ + scaler.mean_)
                plt.scatter(pca_centers[:, 0], pca_centers[:, 1], s=200, marker='X', c='red', label='Centroids')
            plt.colorbar(label='Cluster')
            plt.tight_layout()
            
            # Convert plot to base64 image
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100)
            plt.close()
            buf.seek(0)
            pca_plot_base64 = base64.b64encode(buf.read()).decode('utf-8')
            plots["pca"] = pca_plot_base64
        
        # Create a scatter plot of the t-SNE results
        if X_tsne is not None and clusters is not None:
            plt.figure(figsize=(10, 8))
            plt.scatter(X_tsne[:, 0], X_tsne[:, 1], c=clusters, cmap='viridis', alpha=0.7)
            plt.title(f't-SNE Visualization of Clusters ({model_type.capitalize()})')
            plt.xlabel('t-SNE Component 1')
            plt.ylabel('t-SNE Component 2')
            plt.colorbar(label='Cluster')
            plt.tight_layout()
            
            # Convert plot to base64 image
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100)
            plt.close()
            buf.seek(0)
            tsne_plot_base64 = base64.b64encode(buf.read()).decode('utf-8')
            plots["tsne"] = tsne_plot_base64

        # Calculate clustering metrics
        metrics = {}
        if clusters is not None and n_clusters > 1:
            try:
                silhouette = silhouette_score(X_scaled, clusters)
                metrics["silhouette"] = float(silhouette)
            except:
                metrics["silhouette"] = None
                
            try:
                calinski = calinski_harabasz_score(X_scaled, clusters)
                metrics["calinski_harabasz"] = float(calinski)
            except:
                metrics["calinski_harabasz"] = None
                
            try:
                davies = davies_bouldin_score(X_scaled, clusters)
                metrics["davies_bouldin"] = float(davies)
            except:
                metrics["davies_bouldin"] = None
                
            # Count points per cluster
            if -1 in clusters:  # If DBSCAN with noise points
                cluster_distribution = {
                    str(i): int(np.sum(clusters == i)) for i in set(clusters) if i != -1
                }
                cluster_distribution["noise"] = int(np.sum(clusters == -1))
            else:
                cluster_distribution = {
                    str(i): int(np.sum(clusters == i)) for i in range(n_clusters)
                }
                
            metrics["cluster_distribution"] = cluster_distribution
        
        # Prepare result
        result = {
            "metrics": metrics,
            "featureImportance": feature_importance,
            "modelType": model_type,
            "plots": plots,
            "numClusters": n_clusters,
            "numSamples": X.shape[0],
            "numFeatures": X.shape[1],
            "explainedVariance": float(pca_explained_variance) if pca_explained_variance is not None else None
        }
        
        print(f"Unsupervised clustering completed successfully with {n_clusters} clusters")
        return result

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": f"Unexpected error in clustering: {str(e)}"}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)