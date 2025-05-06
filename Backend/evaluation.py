from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from fastapi.responses import JSONResponse
import json
import pandas as pd
import numpy as np
from sklearn.feature_selection import (
    SelectKBest, 
    chi2, 
    f_classif, 
    mutual_info_classif, 
    mutual_info_regression,
    f_regression,
    VarianceThreshold
)
from sklearn.inspection import permutation_importance
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

class EvaluationRequest(BaseModel):
    X: List[List[Any]]
    features: List[str]
    config: Dict[str, Any]
import numpy as np

def sanitize_data(data):
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(v) for v in data]
    elif isinstance(data, float) and (np.isnan(data) or np.isinf(data)):
        return 0.0  # Replace invalid values with 0
    return data
@app.post("/evaluation")
async def evaluate_features(request: EvaluationRequest):
    try:
        # Extract data and ensure it's numeric
        # Convert the data to numeric values, handling potential non-numeric values
        numeric_data = []
        for row in request.X:
            numeric_row = []
            for value in row:
                # Try to convert each value to a float
                try:
                    if isinstance(value, dict):
                        # If it's a dict, try to extract a numeric value
                        # This assumes there's a numeric value in the dict that we want to use
                        # Modify this logic based on your actual data structure
                        first_value = next(iter(value.values()), None)
                        numeric_row.append(float(first_value) if first_value is not None else 0.0)
                    else:
                        numeric_row.append(float(value) if value is not None else 0.0)
                except (ValueError, TypeError):
                    # If conversion fails, use 0.0 as a fallback
                    numeric_row.append(0.0)
            numeric_data.append(numeric_row)
        
        # Create DataFrame with numeric data
        X = pd.DataFrame(numeric_data, columns=request.features)
        
        # Log data shape and sample for debugging
        print(f"Data shape: {X.shape}")
        print(f"Sample data:\n{X.head()}")
        
        # Perform evaluation
        feature_importance = calculate_feature_importance(X, request.config.get("metric", "variance"), request.features)
        correlation_matrix = calculate_correlation_matrix(X)
        feature_statistics= calculate_feature_statistics(X)

        print("Feature Importance:", feature_importance)
        print("Correlation Matrix:", correlation_matrix)
        print("Feature Statistics:", feature_statistics)

        # Sanitize the response data
        response_data = {
            "feature_importance": feature_importance,
            "correlation_matrix": correlation_matrix,
            "feature_statistics": feature_statistics,
        }
        evaluationData = sanitize_data(response_data)
        print("Sanitized Response Data:", evaluationData)

        return JSONResponse(content= evaluationData) 
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

def calculate_feature_importance(X, metric, feature_names):
    """Calculate feature importance using the specified metric."""
    result = []
    
    try:
        if metric == "variance":
            # Variance-based feature importance
            variances = X.var().values
            importances = variances
            
        elif metric == "chi2":
            # Chi-squared test (classification only)
            if len(X.columns) > 1 and len(np.unique(X.iloc[:, -1])) < 20:  # For classification tasks
                y = X.iloc[:, -1]
                X_features = X.iloc[:, :-1]
                if X_features.shape[1] > 0:  # Ensure we have features to test
                    selector = SelectKBest(chi2, k='all')
                    selector.fit(X_features, y)
                    importances = selector.scores_
                else:
                    importances = np.zeros(len(feature_names))
            else:
                importances = np.zeros(len(feature_names))
                
        elif metric == "mutualInformation":
            # Mutual information
            if len(X.columns) > 1 and len(np.unique(X.iloc[:, -1])) < 20:  # For classification
                y = X.iloc[:, -1]
                X_features = X.iloc[:, :-1]
                if X_features.shape[1] > 0:
                    importances = mutual_info_classif(X_features, y)
                else:
                    importances = np.zeros(len(feature_names))
            elif len(X.columns) > 1:  # For regression
                y = X.iloc[:, -1]
                X_features = X.iloc[:, :-1]
                if X_features.shape[1] > 0:
                    importances = mutual_info_regression(X_features, y)
                else:
                    importances = np.zeros(len(feature_names))
            else:
                importances = np.zeros(len(feature_names))
                
        elif metric == "anova":
            # ANOVA F-value
            if len(X.columns) > 1 and len(np.unique(X.iloc[:, -1])) < 20:  # For classification
                y = X.iloc[:, -1]
                X_features = X.iloc[:, :-1]
                if X_features.shape[1] > 0:
                    selector = SelectKBest(f_classif, k='all')
                    selector.fit(X_features, y)
                    importances = selector.scores_
                else:
                    importances = np.zeros(len(feature_names))
            elif len(X.columns) > 1:  # For regression
                y = X.iloc[:, -1]
                X_features = X.iloc[:, :-1]
                if X_features.shape[1] > 0:
                    selector = SelectKBest(f_regression, k='all')
                    selector.fit(X_features, y)
                    importances = selector.scores_
                else:
                    importances = np.zeros(len(feature_names))
            else:
                importances = np.zeros(len(feature_names))
                
        elif metric == "pearson":
            # Pearson correlation with target
            if len(X.columns) > 1:
                target_col = X.columns[-1]
                importances = np.array([abs(X[col].corr(X[target_col])) for col in X.columns[:-1]])
                # Add a zero for the target column itself
                importances = np.append(importances, 0.0)
            else:
                importances = np.zeros(len(feature_names))
            
        else:
            # Default to variance if metric not recognized
            importances = X.var().values
        
        # Replace NaN values with 0
        importances = np.nan_to_num(importances)
        
        # Normalize importances to [0, 1] range for consistency
        if importances.sum() > 0:
            importances = importances / importances.max()
        
        # Create result list of feature importance
        for i, feature in enumerate(feature_names):
            if i < len(importances):
                result.append({
                    "feature": feature,
                    "importance": float(importances[i])
                })
            else:
                result.append({
                    "feature": feature,
                    "importance": 0.0
                })
        
        # Sort by importance descending
        result = sorted(result, key=lambda x: x["importance"], reverse=True)
        
    except Exception as e:
        # If calculation fails, return empty result with error message
        print(f"Error calculating feature importance: {str(e)}")
        # Create a default result with zero importance
        for feature in feature_names:
            result.append({
                "feature": feature,
                "importance": 0.0
            })
        
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
                    correlation_value = corr_matrix.loc[col1, col2]
                    # Replace NaN with 0
                    if pd.isna(correlation_value):
                        correlation_value = 0.0
                    
                    result.append({
                        "feature1": col1,
                        "feature2": col2,
                        "correlation": float(correlation_value)
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
        # Calculate basic statistics safely, handling potential errors
        stats_dict = {}
        
        # Count
        stats_dict["count"] = X.count().to_dict()
        
        # Mean
        mean_values = {}
        for col in X.columns:
            try:
                mean_values[col] = float(X[col].mean())
            except:
                mean_values[col] = 0.0
        stats_dict["mean"] = mean_values
        
        # Standard Deviation
        std_values = {}
        for col in X.columns:
            try:
                std_values[col] = float(X[col].std())
            except:
                std_values[col] = 0.0
        stats_dict["std"] = std_values
        
        # Min
        min_values = {}
        for col in X.columns:
            try:
                min_values[col] = float(X[col].min())
            except:
                min_values[col] = 0.0
        stats_dict["min"] = min_values
        
        # Max
        max_values = {}
        for col in X.columns:
            try:
                max_values[col] = float(X[col].max())
            except:
                max_values[col] = 0.0
        stats_dict["max"] = max_values
        
        # Skewness
        skew_values = {}
        for col in X.columns:
            try:
                skew_values[col] = float(X[col].skew())
            except:
                skew_values[col] = 0.0
        stats_dict["skewness"] = skew_values
        
        # Kurtosis
        kurt_values = {}
        for col in X.columns:
            try:
                kurt_values[col] = float(X[col].kurtosis())
            except:
                kurt_values[col] = 0.0
        stats_dict["kurtosis"] = kurt_values
        
        # Calculate value counts for categorical features
        categorical_stats = {}
        for col in X.columns:
            if X[col].nunique() < 20:  # Consider it categorical if fewer than 20 unique values
                try:
                    value_counts = X[col].value_counts().to_dict()
                    # Convert any non-serializable keys to strings
                    categorical_stats[col] = {str(k): v for k, v in value_counts.items()}
                except:
                    categorical_stats[col] = {}
        
        stats_dict["categorical"] = categorical_stats
        
        return stats_dict
        
    except Exception as e:
        print(f"Error calculating feature statistics: {str(e)}")
        return {
            "count": {},
            "mean": {},
            "std": {},
            "min": {},
            "max": {},
            "skewness": {},
            "kurtosis": {},
            "categorical": {}
        }