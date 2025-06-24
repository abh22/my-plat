from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/evaluation")
async def evaluate_features(
    methods: str = Form(...),
    features: UploadFile = Form(...),
    weights: str = Form(None)
):
    try:
        # Parse methods
        try:
            method_list = json.loads(methods)
            print(f"Methods requested: {method_list}")
        except json.JSONDecodeError:
            return {"error": "Invalid JSON in methods parameter"}
        # Parse optional weights JSON mapping method->weight
        method_weights: Dict[str, float] = {m: 1.0 for m in method_list}
        total_weight = float(len(method_list))
        if weights:
            try:
                weight_map = json.loads(weights)
                for m, w in weight_map.items():
                    if m in method_weights:
                        method_weights[m] = float(w)
                total_weight = sum(method_weights.values()) or total_weight
            except json.JSONDecodeError:
                return {"error": "Invalid JSON in weights parameter"}

        # Parse feature data
        try:
            content = await features.read()
            feature_data_json = json.loads(content.decode("utf-8"))
            print(f"Raw feature data type: {type(feature_data_json)}")
            if isinstance(feature_data_json, dict):
                print(f"Keys in feature data: {feature_data_json.keys()}")
        except json.JSONDecodeError:
            return {"error": "Invalid JSON in feature data"}
        
        # Handle various possible data structures
        if isinstance(feature_data_json, dict):
            # Case 1: {features: [...]}
            if "features" in feature_data_json:
                feature_data = feature_data_json["features"]
                print("Extracted features from 'features' key")
            # Case 2: {feature_extraction: {featureExtraction: [...]}} 
            elif "feature_extraction" in feature_data_json:
                if isinstance(feature_data_json["feature_extraction"], dict) and "featureExtraction" in feature_data_json["feature_extraction"]:
                    feature_data = feature_data_json["feature_extraction"]["featureExtraction"]
                    print("Extracted features from 'feature_extraction.featureExtraction'")
                else:
                    feature_data = feature_data_json["feature_extraction"]
                    print("Extracted features from 'feature_extraction'")
            else:
                # Use the whole object if no known keys are found
                feature_data = feature_data_json
                print("Using entire data object as features")
        else:
            feature_data = feature_data_json
            print("Feature data is not a dict, using as-is")
            
        # Validate feature data
        if not isinstance(feature_data, list):
            print(f"Feature data is not a list: {type(feature_data)}")
            return {"error": "Feature data must be a list of records"}
            
        if len(feature_data) == 0:
            return {"error": "Feature data is empty"}
            
        # Print a sample of feature data for debugging
        print(f"Sample feature data (first record): {feature_data[0]}")
        
        # Convert to DataFrame
        try:
            df = pd.DataFrame(feature_data)
            print(f"DataFrame columns: {df.columns.tolist()}")
            print(f"DataFrame shape (rows, cols): {df.shape}")
        except Exception as e:
            return {"error": f"Failed to create DataFrame: {str(e)}"}
            
        # Check if DataFrame has data
        if df.empty:
            return {"error": "DataFrame is empty after conversion"}
            
        # ID removal logic removed, keep columns as-is
        print(f"DataFrame columns: {df.columns.tolist()}")
        
        # Identify numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        print(f"Numeric columns: {numeric_cols}")
        
        if not numeric_cols:
            return {"error": "No numeric columns found for evaluation"}
        # Initialize scores container
        scores: List[Dict[str, Any]] = []
        # Collect and normalize per-method scores to prevent scale dominance
        
        # Evaluate features using selected methods
        if "variance" in method_list:
            print("Calculating variance (population, ddof=0) ...")
            var = df[numeric_cols].var(ddof=0)
            # Normalize variance scores to a 0-1 range
            var_min, var_max = var.min(), var.max()
            var_range = var_max - var_min
            if var_range > 0:
                var_normalized = (var - var_min) / var_range
            else:
                var_normalized = var * 0  # All zero if no range
            
            for name, score in var_normalized.items():
                if pd.notnull(score):
                    scores.append({"name": name, "score": float(score)})
                    
        if "correlation" in method_list:
            print("Calculating correlation...")
            # For unsupervised correlation, calculate the mean absolute correlation of each feature with all others
            corr = df[numeric_cols].corr().abs()
            # Compute mean corr per feature
            corr_vals = {}
            for col in corr.columns:
                mean_corr = corr[col].drop(col).mean() if len(corr.columns) > 1 else 0
                corr_vals[col] = mean_corr if pd.notnull(mean_corr) else 0
            corr_series = pd.Series(corr_vals)
            # Min-max normalize to [0,1]
            cmin, cmax = corr_series.min(), corr_series.max()
            crange = cmax - cmin
            if crange > 0:
                corr_norm = (corr_series - cmin) / crange
            else:
                corr_norm = corr_series * 0
            for name, score in corr_norm.items():
                scores.append({"name": name, "score": float(score)})
                    
        if "kurtosis" in method_list:
            print("Calculating kurtosis...")
            # Kurtosis measures peakedness of distribution (absolute values)
            kurt_vals = df[numeric_cols].kurtosis().abs().fillna(0)
            # Min-max normalize
            kmin, kmax = kurt_vals.min(), kurt_vals.max()
            krange = kmax - kmin
            if krange > 0:
                kurt_norm = (kurt_vals - kmin) / krange
            else:
                kurt_norm = kurt_vals * 0
            for name, score in kurt_norm.items():
                scores.append({"name": name, "score": float(score)})
                    
        if "skewness" in method_list:
            print("Calculating skewness...")
            # Skewness measures asymmetry of distribution (absolute values)
            skew_vals = df[numeric_cols].skew().abs().fillna(0)
            # Min-max normalize
            smin, smax = skew_vals.min(), skew_vals.max()
            srange = smax - smin
            if srange > 0:
                skew_norm = (skew_vals - smin) / srange
            else:
                skew_norm = skew_vals * 0
            for name, score in skew_norm.items():
                scores.append({"name": name, "score": float(score)})
        
        # Check if we collected any scores
        if not scores:
            return {"error": "No feature scores were calculated"}
            
        # Create DataFrame of weighted scores, group by feature name, and compute weighted average
        df_scores = pd.DataFrame(scores)
        grouped = df_scores.groupby("name")["score"].sum().reset_index()
        # Divide by total weight to get weighted mean
        if total_weight > 0:
            grouped["score"] = grouped["score"] / total_weight
        ranked = grouped
        # Sort in descending order (higher score = more important)
        ranked = ranked.sort_values("score", ascending=False)
        
        print(f"Returning {len(ranked)} ranked features")
        return {"rankedFeatures": ranked.to_dict(orient="records")}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": f"Unexpected error: {str(e)}"}

def detect_id_columns(df):
    """
    Detect columns that are likely ID columns and should be excluded from feature evaluation.
    First checks for uniqueness (primary indicator of an ID column), then only if that fails,
    looks for ID-like patterns in column names.
    
    Args:
        df: Pandas DataFrame containing features
        
    Returns:
        list: Column names identified as potential ID columns
    """
    id_columns = []
      # Check each column for ID-like characteristics
    for col in df.columns:
        # FIRST PRIORITY: Check uniqueness (primary indicator of an ID column)
        # Use multiple uniqueness measures for more robust detection

        # 1. Uniqueness ratio in a sample (faster for large datasets)
        if len(df) > 0:  # Avoid division by zero
            # Use different sample sizes based on dataset size for better coverage
            if len(df) <= 100:
                # For small datasets, check the entire dataset
                sample_size = len(df)
                sample_df = df
            elif len(df) <= 1000:
                # For medium datasets, check 25% of the data
                sample_size = max(100, int(len(df) * 0.25))
                sample_df = df.sample(n=sample_size, random_state=42)
            else:
                # For large datasets, sample 250 rows randomly
                sample_size = 250
                sample_df = df.sample(n=sample_size, random_state=42)
            
            # Calculate uniqueness metrics
            uniqueness_ratio = sample_df[col].nunique() / len(sample_df)
            
            # 2. Check for monotonic increase/decrease (another ID characteristic)
            is_monotonic = False
            if sample_df[col].dtype.kind in 'bifc':  # Check if numeric
                # Try to detect if values are strictly increasing/decreasing
                try:
                    is_monotonic = sample_df[col].is_monotonic_increasing or sample_df[col].is_monotonic_decreasing
                except:
                    pass
            
            # 3. Check for high distinctness across the full dataset
            # (Especially useful for columns that might be UUIDs or hash values)
            full_uniqueness = df[col].nunique() / len(df)
            
            # Make decision: Include strong indicators of ID columns
            # High uniqueness in sample OR monotonic behavior OR very high distinctness overall
            if uniqueness_ratio > 0.95 or is_monotonic or full_uniqueness > 0.90:
                print(f"Column {col} excluded: uniqueness_ratio={uniqueness_ratio:.2f}, is_monotonic={is_monotonic}, full_uniqueness={full_uniqueness:.2f}")
                id_columns.append(col)
                continue
          # SECOND PRIORITY: Check for sequential or patterned values
        if len(df) > 10:  # Need some minimum number of rows to check patterns
            try:
                # Check if the column contains mostly numeric values that follow a pattern
                if df[col].dtype.kind in 'bifc' or (  # If numeric column
                    isinstance(df[col].iloc[0], str) and  # Or string column that might be numeric
                    all(str(v).isdigit() for v in df[col].dropna().head(10))):
                    
                    # Sample values to check for patterns
                    sample_values = pd.to_numeric(df[col].dropna().head(20), errors='coerce')
                    if not sample_values.isna().all():  # If conversion worked
                        # Sort values to check for sequences
                        sorted_vals = sample_values.sort_values().reset_index(drop=True)
                        diffs = sorted_vals.diff().dropna()
                        
                        # Check if differences are constant (sequence) or very similar (pattern)
                        if len(diffs) > 2:
                            # If all differences are the same (perfect sequence)
                            if len(diffs.unique()) == 1:
                                print(f"Column {col} excluded: contains perfect sequence with step {diffs.iloc[0]}")
                                id_columns.append(col)
                                continue
                            
                            # If differences have low variance (almost a sequence)
                            if diffs.std() / diffs.mean() < 0.1 and diffs.nunique() < len(diffs) * 0.3:
                                print(f"Column {col} excluded: contains near-sequence values")
                                id_columns.append(col)
                                continue
            except:
                pass  # Skip if pattern detection fails

        # THIRD PRIORITY: Similarity to already-identified ID columns
        for existing_id in id_columns:
            # Skip self-comparison
            if col == existing_id:
                continue
                
            # Check if this column name is similar to a detected ID column
            # For example: "patient_id" and "patient_code" or "id_1" and "id_2"
            import re
            # Replace digits with placeholders for matching patterns like id_1, id_2
            base_col = re.sub(r'\d+', 'X', col.lower())
            base_id = re.sub(r'\d+', 'X', existing_id.lower())
            
            # Check for similarity in column names
            from difflib import SequenceMatcher
            similarity = SequenceMatcher(None, base_col, base_id).ratio()
            
            # If columns have similar names and similar statistical properties
            if similarity > 0.7:
                # Check if they have similar distributions or ranges
                try:
                    col_uniqueness = df[col].nunique() / len(df)
                    id_uniqueness = df[existing_id].nunique() / len(df)
                    
                    # If uniqueness ratios are close, likely related columns
                    if abs(col_uniqueness - id_uniqueness) < 0.1:
                        print(f"Column {col} excluded: similar to existing ID column {existing_id} (name similarity: {similarity:.2f})")
                        id_columns.append(col)
                        continue
                except:
                    pass
        
        # LAST PRIORITY (fallback): Check for ID-like name patterns
        col_lower = str(col).lower()
        id_patterns = ['id', 'uuid', 'key', 'code', 'index', 'record', 'serial', 'number', 'identifier']
        
        # Only use name-based detection as a fallback
        if any(pattern in col_lower for pattern in id_patterns):
            print(f"Column {col} excluded based on name pattern")
            id_columns.append(col)
    
    print(f"Detected {len(id_columns)} ID columns to exclude: {id_columns}")
    return id_columns
