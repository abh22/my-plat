from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import pandas as pd
import numpy as np
from sklearn.feature_selection import VarianceThreshold
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from scipy.stats import entropy
from sklearn.feature_selection import SelectKBest, f_classif, f_regression, chi2
from sklearn.preprocessing import PolynomialFeatures
from sklearn.manifold import TSNE, Isomap
from sklearn.decomposition import KernelPCA, TruncatedSVD, FastICA
import traceback
import io

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EvaluationConfig(BaseModel):
    metric: str
    features: List[str]
    importanceThreshold: float
    targetColumn: Optional[str] = None

class ExtractionConfig(BaseModel):
    methods: List[str]
    features: List[str]
    settings: Dict[str, Any]

@app.post("/evaluation")
async def evaluate_features(
    file: UploadFile = File(...),
    config: str = Form(...)
):
    try:
        # Parse configuration
        config_data = json.loads(config)
        evaluation_config = EvaluationConfig(**config_data)
        
        # Read uploaded file (JSON format)
        contents = await file.read()
        data = json.loads(contents.decode("utf-8"))
        
        # Convert to DataFrame if it's not already
        if "data" in data:
            df = pd.DataFrame(data["data"])
        elif "processedData" in data:
            df = pd.DataFrame(data["processedData"]["data"])
        else:
            df = pd.DataFrame(data)
            
        # Extract features
        X = df[evaluation_config.features]
        
        # Calculate feature importance based on selected metric
        importance_results = calculate_feature_importance(
            X, 
            evaluation_config.metric,
            evaluation_config.features
        )
        
        # Calculate correlation matrix
        correlation_matrix = calculate_correlation_matrix(X)
        
        # Calculate feature statistics
        feature_stats = calculate_feature_statistics(X)
        
        # Prepare response
        response = {
            "success": True,
            "featureImportance": importance_results,
            "correlationMatrix": correlation_matrix,
            "featureStatistics": feature_stats,
            "evaluatedFeatures": evaluation_config.features,
            "importanceThreshold": evaluation_config.importanceThreshold
        }
        
        return response
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/extraction")
async def extraction(file: UploadFile = File(...), config: str = Form(...)):
    try:
        print("Starting feature extraction")
        print(f"Received file: {file.filename}")
        print(f"Received config: {config}")

        # Read the uploaded file into a DataFrame
        content = await file.read()
        try:
            df = pd.read_json(io.BytesIO(content))  # Use pd.read_json for JSON files
        except ValueError as e:
            print(f"Error reading JSON file: {e}")
            return {"error": "Invalid JSON file format"}
        print(f"Data shape: {df.shape}")

        # Parse the config JSON
        config = json.loads(config)
        methods = config.get("methods", [])
        features = config.get("features", [])
        settings = config.get("settings", {})

        # Get numeric columns for feature extraction
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        print(f"Numeric columns: {numeric_cols}")

        # Store the numeric data in a variable
        numeric_data = df[numeric_cols]
        print(f"Numeric data preview:\n{numeric_data.head()}")

        # Filter to include only selected features that are numeric
        if not features:
            print("No features specified. Defaulting to all numeric columns.")
            numeric_features = numeric_cols
        else:
            numeric_features = [col for col in features if col in numeric_cols]

        if not numeric_features:
            return {"error": "No numeric features selected for extraction"}

        print(f"Using {len(numeric_features)} numeric features for extraction")

        # Create a copy of the dataframe with only numeric features for extraction
        X = df[numeric_features].copy()

        # Handle missing values in numeric features (required for most algorithms)
        X = X.fillna(X.mean())

        # Apply selected methods
        for method in methods:
            print(f"Applying {method} method")

            if method == "pca":
                # Principal Component Analysis
                n_components = min(settings.get("pcaComponents", 2), len(numeric_features))
                print(f"PCA with {n_components} components")

                pca = PCA(n_components=n_components)
                pca_result = pca.fit_transform(X)

                # Replace the original features with PCA components
                pca_cols = [f"PC{i+1}" for i in range(n_components)]
                X = pd.DataFrame(pca_result, columns=pca_cols, index=X.index)

            elif method == "kernelPCA":
                # Kernel PCA
                kernel = settings.get("kernel", "rbf")  # Default kernel is RBF
                n_components = settings.get("pcaComponents", 2)
                print(f"Kernel PCA with {n_components} components and kernel={kernel}")

                kpca = KernelPCA(n_components=n_components, kernel=kernel)
                kpca_result = kpca.fit_transform(X)

                kpca_cols = [f"KPCA{i+1}" for i in range(n_components)]
                X = pd.DataFrame(kpca_result, columns=kpca_cols, index=X.index)

            elif method == "truncatedSVD":
                # Truncated SVD
                n_components = settings.get("pcaComponents", 2)
                print(f"Truncated SVD with {n_components} components")

                svd = TruncatedSVD(n_components=n_components)
                svd_result = svd.fit_transform(X)

                svd_cols = [f"SVD{i+1}" for i in range(n_components)]
                X = pd.DataFrame(svd_result, columns=svd_cols, index=X.index)

            elif method == "fastICA":
                # Independent Component Analysis
                n_components = settings.get("pcaComponents", 2)
                print(f"Fast ICA with {n_components} components")

                ica = FastICA(n_components=n_components)
                ica_result = ica.fit_transform(X)

                ica_cols = [f"ICA{i+1}" for i in range(n_components)]
                X = pd.DataFrame(ica_result, columns=ica_cols, index=X.index)

            elif method == "tsne":
                # t-SNE
                n_components = settings.get("pcaComponents", 2)
                print(f"t-SNE with {n_components} components")

                tsne = TSNE(n_components=n_components)
                tsne_result = tsne.fit_transform(X)

                tsne_cols = [f"tSNE{i+1}" for i in range(n_components)]
                X = pd.DataFrame(tsne_result, columns=tsne_cols)

            elif method == "isomap":
                # Isomap
                n_components = settings.get("pcaComponents", 2)
                n_neighbors = settings.get("n_neighbors", 5)
                print(f"Isomap with {n_components} components and {n_neighbors} neighbors")

                isomap = Isomap(n_components=n_components, n_neighbors=n_neighbors)
                isomap_result = isomap.fit_transform(X)

                isomap_cols = [f"Isomap{i+1}" for i in range(n_components)]
                X = pd.DataFrame(isomap_result, columns=isomap_cols, index=X.index)

        # Handle any remaining NaN values
        X = X.fillna(0)

        print(f"Feature extraction complete. Final shape: {X.shape}")

        return {
            "message": "Feature extraction completed successfully",
            "preview": X.head(10).to_dict(orient="records"),
            "processedData": X.to_dict(orient="records"),
        }

    except Exception as e:
        print(f"Error in feature extraction: {str(e)}")
        traceback.print_exc()
        return {"error": f"Error in feature extraction: {str(e)}"}

def calculate_feature_importance(X, metric, feature_names):
    """Calculate feature importance using the specified metric (without target)."""
    result = []
    
    try:
        if metric == "variance":
            # Variance-based feature importance
            variances = X.var().values
            # Normalize to [0,1]
            if variances.sum() > 0:
                importances = variances / variances.max()
            else:
                importances = variances
                
        elif metric == "pca":
            # PCA-based importance (loading factors)
            pca = PCA(n_components=min(X.shape[1], 5))
            pca.fit(X)
            # Use first principal component loadings as importance
            importances = np.abs(pca.components_[0])
            # Normalize
            importances = importances / importances.max() if importances.max() > 0 else importances
                
        elif metric == "correlation":
            # Correlation-based importance
            # For each feature, calculate average absolute correlation with other features
            corr_matrix = X.corr().abs()
            importances = []
            for col in corr_matrix.columns:
                # Average correlation excluding self-correlation (which is always 1)
                col_corrs = corr_matrix[col].drop(col).values
                importances.append(col_corrs.mean())
            importances = np.array(importances)
            # Normalize
            if importances.max() > 0:
                importances = importances / importances.max()
                
        elif metric == "clustering":
            # Clustering-based importance
            # For each feature, see how well it separates clusters
            importances = []
            for col in X.columns:
                # Create clusters based on this feature
                kmeans = KMeans(n_clusters=min(3, len(X[col].unique())))
                cluster_labels = kmeans.fit_predict(X[col].values.reshape(-1, 1))
                
                # Calculate silhouette score as proxy for importance
                try:
                    from sklearn.metrics import silhouette_score
                    if len(np.unique(cluster_labels)) > 1:
                        score = silhouette_score(X[col].values.reshape(-1, 1), cluster_labels)
                        importances.append(max(0, score))  # Only positive values
                    else:
                        importances.append(0)
                except:
                    # If silhouette fails, use simple variance
                    importances.append(X[col].var() / X[col].mean() if X[col].mean() != 0 else 0)
            
            importances = np.array(importances)
            # Normalize
            if importances.max() > 0:
                importances = importances / importances.max()
                
        elif metric == "entropy":
            # Information entropy-based importance
            importances = []
            for col in X.columns:
                # Bin continuous data for entropy calculation
                try:
                    bins = min(10, len(X[col].unique()))
                    hist, _ = np.histogram(X[col], bins=bins)
                    # Calculate entropy (low entropy = more concentrated = more important)
                    if hist.sum() > 0:
                        probs = hist / hist.sum()
                        ent = entropy(probs)
                        # Invert so lower entropy = higher importance
                        importances.append(1 / (1 + ent))
                    else:
                        importances.append(0)
                except:
                    importances.append(0)
            
            importances = np.array(importances)
            # Normalize
            if importances.max() > 0:
                importances = importances / importances.max()
                
        else:
            # Default to variance if metric not recognized
            variances = X.var().values
            importances = variances / variances.max() if variances.max() > 0 else variances
        
        # Create result list of feature importance
        for i, feature in enumerate(feature_names):
            result.append({
                "feature": feature,
                "importance": float(importances[i])
            })
        
        # Sort by importance descending
        result = sorted(result, key=lambda x: x["importance"], reverse=True)
        
    except Exception as e:
        # If calculation fails, return empty result with error message
        print(f"Error calculating feature importance: {str(e)}")
        result = []
        
    return result

def calculate_correlation_matrix(X):
    """Calculate correlation between features."""
    result = []
    
    try:
        # Calculate correlation matrix
        corr_matrix = X.corr()
        
        # Convert to list of correlations
        for i, col1 in enumerate(X.columns):
            for j, col2 in enumerate(X.columns):
                if i < j:  # Only include each pair once
                    result.append({
                        "feature1": col1,
                        "feature2": col2,
                        "correlation": float(corr_matrix.loc[col1, col2])
                    })
        
        # Sort by absolute correlation value (descending)
        result = sorted(result, key=lambda x: abs(x["correlation"]), reverse=True)
        
    except Exception as e:
        print(f"Error calculating correlation matrix: {str(e)}")
        result = []
        
    return result

def calculate_feature_statistics(X):
    """Calculate various statistics for each feature."""
    result = {}
    
    try:
        # Basic statistics
        result["count"] = X.count().to_dict()
        result["mean"] = X.mean().to_dict()
        result["std"] = X.std().to_dict()
        result["min"] = X.min().to_dict()
        result["max"] = X.max().to_dict()
        
        # Calculate skewness
        result["skewness"] = X.skew().to_dict()
        
        # Calculate kurtosis
        result["kurtosis"] = X.kurtosis().to_dict()
        
        # Calculate value counts for categorical features
        categorical_stats = {}
        for col in X.columns:
            if X[col].nunique() < 20:  # Consider it categorical if fewer than 20 unique values
                categorical_stats[col] = X[col].value_counts().to_dict()
        
        result["categorical"] = categorical_stats
        
        # Calculate coefficient of variation
        result["cv"] = (X.std() / X.mean()).fillna(0).to_dict()
        
        # Calculate quartiles
        result["q1"] = X.quantile(0.25).to_dict()
        result["median"] = X.median().to_dict()
        result["q3"] = X.quantile(0.75).to_dict()
        
        # Calculate interquartile range
        result["iqr"] = (X.quantile(0.75) - X.quantile(0.25)).to_dict()
        
    except Exception as e:
        print(f"Error calculating feature statistics: {str(e)}")
        result = {}
        
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)