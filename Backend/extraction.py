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
import os

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractionConfig(BaseModel):
    methods: List[str]
    features: List[str]
    settings: Dict[str, Any]


@app.post("/extraction")
async def extraction(file: UploadFile = File(...), config: str = Form(...)):
    try:
        print("Starting feature extraction")
        print(f"Received file: {file.filename}")
        print(f"Received config: {config}")

        # Read the uploaded file into a DataFrame
        content = await file.read()
        
        # Initialize variables
        df = None
        featureNameMapping = {}
        
        # Try different ways to load the file data
        try:
            # First try to parse as JSON
            try:
                # Parse the JSON content
                data = json.loads(content.decode("utf-8"))
                # If direct array provided, load it
                if isinstance(data, list):
                    df = pd.DataFrame(data)
                    print("Loaded DataFrame from JSON array payload")
                else:
                    # Extract DataFrame payload; support both 'processedData' and 'data' keys
                    if "processedData" in data:
                        payload = data["processedData"]
                    elif "data" in data:
                        payload = data["data"]
                    else:
                        payload = None
                    if isinstance(payload, list):
                        df = pd.DataFrame(payload)
                        print("Loaded DataFrame from payload list")
                    elif isinstance(payload, dict):
                        df = pd.json_normalize(payload)
                        print("Loaded DataFrame from payload dict using json_normalize")
                # Get feature name mapping if available
                featureNameMapping = data.get("featureNameMapping", {})
                
            except (json.JSONDecodeError, UnicodeDecodeError):
                print("Content is not valid JSON, trying CSV format...")
                # If not valid JSON, try reading as CSV
                try:
                    df = pd.read_csv(io.BytesIO(content))
                    print(f"Loaded CSV data with {len(df)} rows and {len(df.columns)} columns")
                except Exception as csv_error:
                    # Try with different separator if comma doesn't work
                    try:
                        df = pd.read_csv(io.BytesIO(content), sep=';')
                        print(f"Loaded CSV data (with semicolon separator) with {len(df)} rows and {len(df.columns)} columns")
                    except Exception as e:
                        raise ValueError(f"Failed to parse as CSV: {str(e)}")
            
            # If we still don't have a DataFrame, there's a problem
            if df is None:
                raise ValueError("Could not extract data from the provided file")
                
        except Exception as e:
            print(f"Error reading file: {e}")
            return {"error": f"Invalid file format: {str(e)}"}
            
        print(f"Data shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()[:10]}...")
        # print(f"Feature Name Mapping: {featureNameMapping}")

        # Parse the config JSON
        config = json.loads(config)
        methods = config.get("methods", [])
        features = config.get("features", [])
        settings = config.get("settings", {})

        # Get numeric columns for feature extraction
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        # print(f"Numeric columns: {numeric_cols}")

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
                pca_cols = [f"PCA_Component_{i+1}" for i in range(n_components)]
                X = pd.DataFrame(pca_result, columns=pca_cols, index=X.index)

                # Update the feature name mapping
                for col in pca_cols:
                    featureNameMapping[col] = numeric_features  # Map PCA components to original features

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
        print(f"Updated Feature Name Mapping: {featureNameMapping}")

        return {
            "message": "Feature extraction completed successfully",
            "preview": X.head(10).to_dict(orient="records"),
            "processedData": X.to_dict(orient="records"),
            "featureNameMapping": featureNameMapping,
        }

    except Exception as e:
        print(f"Error in feature extraction: {str(e)}")
        traceback.print_exc()
        return {"error": f"Error in feature extraction: {str(e)}"}