from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
import json
import os
import importlib.util
import inspect
import sys
from typing import List, Dict, Any, Callable

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (use specific origins in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

CUSTOM_METHOD_DIR = "./custom_methods/"  # Directory for custom methods

@app.post("/preprocess")
async def preprocess(file: UploadFile = File(...), config: str = Form(...), get_available_columns: str = Form(default="")):
    global df
    
    # Read file
    content = await file.read()
    # Try both comma and semicolon as separators
    try:
        # First try with default comma separator
        df = pd.read_csv(io.BytesIO(content))
        
        # Check if we have a single column with semicolons in the name
        first_col = df.columns[0] if len(df.columns) > 0 else ""
        if len(df.columns) == 1 and ";" in first_col:
            # Reread with semicolon separator
            df = pd.read_csv(io.BytesIO(content), sep=";")
            print(f"Detected semicolon-separated CSV. Columns: {df.columns.tolist()}")
    except Exception as e:
        # If comma fails, try semicolon
        print(f"Error with default CSV reading: {e}. Trying semicolon separator.")
        df = pd.read_csv(io.BytesIO(content), sep=";")
        print(f"Read with semicolon separator. Columns: {df.columns.tolist()}")
    
    # Read config
    config = json.loads(config)
    operations = config['operations']
    settings = config['settings']
    selected_columns = config.get('columns', [])
    
    # Return available columns if requested
    available_columns = df.columns.tolist()
    
    print(f"Selected operations: {operations}")
    print(f"Selected columns: {selected_columns[:10]}...")
    print(f"Settings: {settings}")

    # Initialize feature name mapping
    feature_name_mapping = {col: [col] for col in df.columns}  # Start with original names
    
    # Filter to only selected columns if specified
    if selected_columns:
        # Check which columns actually exist in the dataframe
        existing_columns = [col for col in selected_columns if col in df.columns]
        missing_columns = [col for col in selected_columns if col not in df.columns]
        
        if missing_columns:
            print(f"WARNING: The following columns were requested but not found: {missing_columns}")
            print(f"Available columns in the dataset: {available_columns}")
        
        if not existing_columns:
            # No columns matched - provide helpful error message
            raise HTTPException(
                status_code=400,
                detail=f"None of the selected columns exist in the dataset. Available columns: {available_columns[:10]}..."
            )
        # Filter to only the columns that actually exist
        df = df[existing_columns]
        print(f"Filtered to {len(existing_columns)} columns out of {len(selected_columns)} requested columns")

    # Get column types
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    
    print(f"Found {len(numeric_cols)} numeric columns and {len(cat_cols)} categorical columns")
    print(f"Numeric columns (first 5): {numeric_cols[:5]}")
    print(f"Categorical columns (first 5): {cat_cols[:5]}")

    # Step 1: Handle missing values (before encoding)
    if "missing" in operations:
        strategy = settings.get("missingValues", "mean")
        if strategy == "mean":
            df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
            for col in cat_cols:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
        elif strategy == "median":
            df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
            for col in cat_cols:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
        elif strategy == "mode":
            for col in df.columns:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
        elif strategy == "remove":
            df = df.dropna()
        print("Handled missing values successfully")

    # Step 2: Encode categorical variables
    if "encode" in operations:
        print(f"Encoding categorical variables with {len(cat_cols)} columns: {cat_cols}")
        
        # Handle encoding methods - can be string or list
        encoding_method = settings.get("encodingMethod", "onehot")
        print(f"Encoding method received: {encoding_method} (type: {type(encoding_method)})")
        
        # Normalize encoding methods to a list
        if isinstance(encoding_method, str):
            encoding_methods = [encoding_method]
        elif isinstance(encoding_method, list):
            encoding_methods = encoding_method
        else:
            encoding_methods = ["onehot"]  # Default fallback
            
        print(f"Normalized encoding methods: {encoding_methods}")
        
        # Initialize dictionary to store encoding details
        encoding_details = {}
        
        # Create copies of the DataFrame for different encoding methods
        df_original = df.copy()  # Keep original for one-hot encoding
        df_label = None
        
        # Apply Label Encoding if selected
        if "label" in encoding_methods:
            from sklearn.preprocessing import LabelEncoder
            
            print(f"Applying label encoding to {len(cat_cols)} categorical columns")
            
            # Create a copy for label encoding
            df_label = df_original.copy()
            
            # Store label encoders and mappings for reference
            label_encoders = {}
            
            for col in cat_cols:
                try:
                    print(f"Label encoding column: {col}")
                    
                    # Create and fit the label encoder
                    le = LabelEncoder()
                    original_values = df_label[col].astype(str).dropna().unique().tolist()
                    
                    # Apply label encoding
                    df_label[col] = le.fit_transform(df_label[col].astype(str))
                    
                    # Store the encoder for this column
                    label_encoders[col] = le
                    
                    # Store mapping from original values to encoded values
                    encoded_values = le.transform(original_values).tolist()
                    value_mapping = dict(zip(original_values, encoded_values))
                    
                    print(f"Column {col} encoding mapping: {value_mapping}")
                    print(f"Unique values after encoding: {sorted(df_label[col].unique())}")
                    
                    # Store detailed encoding information
                    encoding_details[col] = {
                        "method": "label",
                        "originalValues": original_values,
                        "encodedValues": encoded_values,
                        "mapping": value_mapping
                    }
                    
                except Exception as e:
                    print(f"Error label encoding column {col}: {e}")
            
            print(f"Label encoding complete. Encoded {len(label_encoders)} columns")
        
        # Apply One-Hot Encoding if selected
        df_onehot = None
        if "onehot" in encoding_methods:
            print(f"Applying one-hot encoding to {len(cat_cols)} categorical columns")
            
            # Before encoding
            print(f"DataFrame shape before one-hot encoding: {df_original.shape}")
            print(f"Sample before encoding: \n{df_original.head(2)}")
            
            # Apply one-hot encoding
            try:
                df_onehot = pd.get_dummies(df_original, columns=cat_cols, sparse=False)
                print(f"DataFrame shape after one-hot encoding: {df_onehot.shape}")
                print(f"Columns after encoding: {df_onehot.columns[:10]}...")
                print(f"Sample after encoding: \n{df_onehot.head(2)}")
                
                # Store encoding details for one-hot
                for col in cat_cols:
                    if col in df_original.columns:
                        unique_values = df_original[col].unique()
                        new_cols = [f"{col}_{val}" for val in unique_values]
                        
                        # Store detailed mapping for this column
                        if col not in encoding_details:
                            encoding_details[col] = {}
                        
                        # If we already have label encoding details, merge them
                        if "method" in encoding_details.get(col, {}):
                            # Create a combined entry
                            encoding_details[f"{col}_onehot"] = {
                                "method": "onehot",
                                "originalValues": unique_values.tolist(),
                                "newColumns": new_cols,
                            }
                        else:
                            encoding_details[col] = {
                                "method": "onehot",
                                "originalValues": unique_values.tolist(),
                                "newColumns": new_cols,
                            }
                
            except Exception as e:
                print(f"Error during one-hot encoding: {e}")
        
        # Intelligent encoding method selection
        def choose_encoding_method(column_data, column_name):
            """
            Automatically choose the best encoding method for a categorical column
            based on various heuristics and best practices.
            """
            unique_count = column_data.nunique()
            total_count = len(column_data)
            unique_values = column_data.unique()
            
            # Heuristic 1: Cardinality-based decision
            if unique_count <= 5:
                # Low cardinality: prefer one-hot encoding
                decision = "onehot"
                reason = f"Low cardinality ({unique_count} unique values)"
            elif unique_count > 20:
                # High cardinality: prefer label encoding
                decision = "label"
                reason = f"High cardinality ({unique_count} unique values)"
            else:
                # Medium cardinality: use additional heuristics
                
                # Heuristic 2: Check for ordinal patterns
                ordinal_patterns = [
                    # Size patterns
                    ['small', 'medium', 'large'],
                    ['s', 'm', 'l', 'xl'],
                    ['xs', 's', 'm', 'l', 'xl'],
                    # Rating patterns
                    ['bad', 'ok', 'good'],
                    ['poor', 'fair', 'good', 'excellent'],
                    ['low', 'medium', 'high'],
                    # Grade patterns
                    ['f', 'd', 'c', 'b', 'a'],
                    ['1', '2', '3', '4', '5'],
                    # Frequency patterns
                    ['never', 'rarely', 'sometimes', 'often', 'always'],
                ]
                
                # Check if values match ordinal patterns
                values_lower = [str(v).lower() for v in unique_values if pd.notna(v)]
                is_ordinal = False
                
                for pattern in ordinal_patterns:
                    if all(val in pattern for val in values_lower) or \
                       all(val in values_lower for val in pattern):
                        is_ordinal = True
                        break
                
                # Check for numeric-like strings
                try:
                    numeric_values = [float(str(v)) for v in unique_values if pd.notna(v)]
                    if len(numeric_values) == len([v for v in unique_values if pd.notna(v)]):
                        is_ordinal = True
                except:
                    pass
                
                if is_ordinal:
                    decision = "label"
                    reason = f"Detected ordinal relationship (cardinality: {unique_count})"
                else:
                    # Heuristic 3: Sparse ratio consideration
                    sparse_ratio = unique_count / total_count
                    if sparse_ratio > 0.1:  # More than 10% unique
                        decision = "label"
                        reason = f"High sparsity ratio ({sparse_ratio:.2f}, cardinality: {unique_count})"
                    else:
                        decision = "onehot"
                        reason = f"Medium cardinality with low sparsity ({unique_count} unique values)"
            
            print(f"Column '{column_name}': {decision} encoding chosen - {reason}")
            return decision
        
        # Apply intelligent encoding based on selected methods
        if len(encoding_methods) == 1:
            # Only one encoding method selected - apply to all columns
            if "label" in encoding_methods:
                df = df_label
                # Update feature name mapping for label encoding
                for col in cat_cols:
                    feature_name_mapping[col] = [f"{col}_label_encoded"]
            elif "onehot" in encoding_methods:
                df = df_onehot
                # Update feature name mapping for one-hot encoding
                for col in cat_cols:
                    if col in df_original.columns:
                        unique_values = df_original[col].unique()
                        new_cols = [f"{col}_{val}" for val in unique_values]
                        feature_name_mapping[col] = new_cols
        
        elif len(encoding_methods) == 2:
            # Both methods selected - intelligently choose per column
            print("Intelligently selecting optimal encoding method for each column...")
            
            # Analyze each categorical column and decide encoding method
            column_encoding_decisions = {}
            for col in cat_cols:
                decision = choose_encoding_method(df_original[col], col)
                column_encoding_decisions[col] = decision
            
            print(f"Encoding decisions: {column_encoding_decisions}")
            
            # Start with numeric columns
            numeric_cols_to_keep = df_original.select_dtypes(include=["number"]).columns.tolist()
            combined_data = {}
            for col in numeric_cols_to_keep:
                combined_data[col] = df_original[col]
            
            # Apply chosen encoding for each categorical column
            onehot_cols = [col for col, method in column_encoding_decisions.items() if method == "onehot"]
            label_cols = [col for col, method in column_encoding_decisions.items() if method == "label"]
            
            # Apply one-hot encoding to selected columns
            if onehot_cols:
                print(f"Applying one-hot encoding to: {onehot_cols}")
                df_temp_onehot = pd.get_dummies(df_original[onehot_cols], sparse=False)
                for col in df_temp_onehot.columns:
                    combined_data[col] = df_temp_onehot[col]
                
                # Store encoding details for one-hot columns
                for col in onehot_cols:
                    unique_values = df_original[col].unique()
                    new_cols = [f"{col}_{val}" for val in unique_values]
                    
                    encoding_details[col] = {
                        "method": "onehot",
                        "originalValues": unique_values.tolist(),
                        "newColumns": new_cols,
                    }
            
            # Apply label encoding to selected columns
            if label_cols:
                print(f"Applying label encoding to: {label_cols}")
                from sklearn.preprocessing import LabelEncoder
                for col in label_cols:
                    le = LabelEncoder()
                    combined_data[col] = le.fit_transform(df_original[col].astype(str))
                    
                    # Store encoding details
                    original_values = df_original[col].astype(str).dropna().unique().tolist()
                    encoded_values = le.transform(original_values).tolist()
                    value_mapping = dict(zip(original_values, encoded_values))
                    
                    encoding_details[col] = {
                        "method": "label",
                        "originalValues": original_values,
                        "encodedValues": encoded_values,
                        "mapping": value_mapping
                    }
            
            # Create the combined DataFrame
            df = pd.DataFrame(combined_data)
            print(f"Combined DataFrame with intelligent encoding. Shape: {df.shape}")
            
            # Update feature name mapping based on actual encoding decisions
            for col in cat_cols:
                if column_encoding_decisions[col] == "onehot":
                    unique_values = df_original[col].unique()
                    feature_name_mapping[col] = [f"{col}_{val}" for val in unique_values]
                else:  # label encoding
                    feature_name_mapping[col] = [col]
        
        print("Encoded categorical variables successfully")

    # Step 3: Normalize numeric features (after encoding)
    if "normalize" in operations:
        method = settings.get("normalizationMethod", "minmax")
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()  # Re-identify numeric columns
        
        print(f"Normalizing {len(numeric_cols)} numeric columns with method: {method}")
        print(f"First 5 numeric columns: {numeric_cols[:5]}")
        
        # Print sample data before normalization
        if numeric_cols:
            print(f"Sample data BEFORE normalization:")
            print(df[numeric_cols[:3]].head(2))
        
        try:
            if method == "minmax":
                for col in numeric_cols:
                    min_val = df[col].min()
                    max_val = df[col].max()
                    if max_val > min_val:  # Avoid division by zero
                        df[col] = (df[col] - min_val) / (max_val - min_val)
                    else:
                        print(f"Warning: Cannot normalize column {col} - min and max are equal: {min_val}")
                        
            elif method == "zscore":
                for col in numeric_cols:
                    mean_val = df[col].mean()
                    std_val = df[col].std()
                    if std_val > 0:  # Avoid division by zero
                        df[col] = (df[col] - mean_val) / std_val
                    else:
                        print(f"Warning: Cannot normalize column {col} - standard deviation is zero")
                        
            elif method == "robust":
                for col in numeric_cols:
                    median_val = df[col].median()
                    q1 = df[col].quantile(0.25)
                    q3 = df[col].quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:  # Avoid division by zero
                        df[col] = (df[col] - median_val) / iqr
                    else:
                        print(f"Warning: Cannot normalize column {col} - IQR is zero")
            
            # Print sample data after normalization
            if numeric_cols:
                print(f"Sample data AFTER normalization:")
                print(df[numeric_cols[:3]].head(2))
                
        except Exception as e:
            print(f"Error during normalization: {e}")
            
        print("Normalized numeric features successfully")

    # Step 4: Handle outliers (after all transformations)
    if "outliers" in operations:
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()  # Re-identify numeric columns
        one_hot_cols = [col for col in numeric_cols if df[col].nunique() <= 2 and df[col].isin([0, 1]).all()]
        outlier_cols = [col for col in numeric_cols if col not in one_hot_cols]
        threshold = settings.get("outlierThreshold", 1.5)
        Q1 = df[outlier_cols].quantile(0.25)
        Q3 = df[outlier_cols].quantile(0.75)
        IQR = Q3 - Q1
        mask = ~((df[outlier_cols] < (Q1 - threshold * IQR)) | (df[outlier_cols] > (Q3 + threshold * IQR))).any(axis=1)
        df = df[mask]
        print("Handled outliers successfully")

    # Step 5: Apply custom preprocessing methods if specified
    if "custom" in operations:
        custom_methods = settings.get("customMethods", [])
        if custom_methods:
            print(f"Applying {len(custom_methods)} custom preprocessing methods")
            
            # Import the method loader from method_handler
            from method_handler import MethodLoader
            
            for method_name in custom_methods:                  
                try:
                    # Load the method
                    method_file = os.path.join(CUSTOM_METHOD_DIR, f"{method_name}")
                    if not method_file.endswith('.py'):
                        method_file += '.py'
                    
                    method_func = MethodLoader.load_method(method_file)
                    if method_func:
                        # Check if we have specific parameters for this method
                        method_params = settings.get(f"{method_name}_params", {})
                        print(f"Applying custom method: {method_name} with params: {method_params}")
                        df = method_func(df, method_params)
                    else:
                        print(f"Failed to load custom method: {method_name}")
                except Exception as e:
                    print(f"Error applying custom method {method_name}: {str(e)}")
            
            print("Applied custom preprocessing methods")

    # Before returning the response, handle NaN values in the DataFrame
    df = df.fillna(0)  # Replace NaN with 0, which is JSON-compliant

    # Prepare the response
    print("Feature Name Mapping:", feature_name_mapping)
    
    # Include encoding details if encodings were performed
    response_data = {
        "message": "Data received and processed",
        "preview": df.head(10).to_dict(orient="records"),
        "processedData": df.to_dict(orient="records"),
        "featureNameMapping": feature_name_mapping,  # Include the feature name mapping
        "availableColumns": available_columns  # Include the actual available columns
    }
    
    # Add encoding details if encoding was performed
    if "encode" in operations and 'encoding_details' in locals():
        response_data["encodingDetails"] = encoding_details
        print("Included encoding details in response")
    
    return response_data