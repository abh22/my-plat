from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import json
app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (use specific origins in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

@app.post("/preprocess")
async def preprocess(file:UploadFile = File(...),config: str= Form(...)):
    global df
    #read file
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))
    #read config
    config = json.loads(config)
    operations = config['operations']
    settings = config['settings']

    #preprocess
    print("col:", df.columns)
    # Get column types
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    # Step 1: Handle missing values (before encoding)
    if "missing" in operations:
        strategy = settings.get("missingValues", "mean")
        
       
        
        if strategy == "mean":
            # Apply mean to numeric, mode to categorical
            df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
            for col in cat_cols:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
                    
        elif strategy == "median":
            # Apply median to numeric, mode to categorical
            df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
            for col in cat_cols:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
                    
        elif strategy == "mode":
            # Apply mode to all columns
            for col in df.columns:
                if len(df[col].dropna()) > 0:
                    df[col] = df[col].fillna(df[col].mode().iloc[0])
                    
        elif strategy == "remove":
            # Remove rows with any missing values
            df = df.dropna()
        print("handled missing values successfully")     
    # Step 2: Encode categorical variables
    if "encode" in operations:
        method = settings.get("encodingMethod", "onehot")
        # Identify categorical columns
        # cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        if method == "onehot":
            df = pd.get_dummies(df, columns=cat_cols, sparse=True)
        elif method == "label":
            from sklearn.preprocessing import LabelEncoder
            le = LabelEncoder()
            for col in cat_cols:
                df[col] = le.fit_transform(df[col].astype(str))
        elif method == "target":
            target_col = settings.get("targetColumn")
            if target_col and target_col in df.columns:
                for col in cat_cols:
                    means = df.groupby(col)[target_col].mean()
                    df[col] = df[col].map(means)
            else:
                raise ValueError("Target encoding requires a valid 'targetColumn' in settings.")
        print("encoded categorical variables successfully")
    # Step 3: Normalize numeric features (after encoding)
    if "normalize" in operations:
        method = settings.get("normalization", "minmax")
        # Re-identify numeric columns after encoding
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        
        if method == "minmax":
            df[numeric_cols] = (df[numeric_cols] - df[numeric_cols].min()) / (df[numeric_cols].max() - df[numeric_cols].min())
        elif method == "zscore":
            df[numeric_cols] = (df[numeric_cols] - df[numeric_cols].mean()) / df[numeric_cols].std()
        elif method == "robust":
            df[numeric_cols] = (df[numeric_cols] - df[numeric_cols].median()) / (df[numeric_cols].quantile(0.75) - df[numeric_cols].quantile(0.25))
        print("normalized numeric features successfully")
    # Step 4: Handle outliers (after all transformations)
    if "outliers" in operations:
        one_hot_cols = [col for col in numeric_cols if df[col].nunique() <= 2 and df[col].isin([0, 1]).all()]
        outlier_cols = [col for col in numeric_cols if col not in one_hot_cols]
        
        threshold = settings.get("outlierThreshold", 1.5) 
        Q1 = df[outlier_cols].quantile(0.25)
        Q3 = df[outlier_cols].quantile(0.75)
        IQR = Q3 - Q1
        mask = ~((df[outlier_cols] < (Q1 - threshold * IQR)) | (df[outlier_cols] > (Q3 + threshold * IQR))).any(axis=1)
        df = df[mask]
        print("handled outliers successfully")
    # Before returning the response, handle NaN values in the DataFrame
    # df = df.fillna(0)  # Replace NaN with None, which is JSON-compliant

    return {
        "message": "Data received and processed",
        "preview": df.head(10).to_dict(orient="records"),
        "processed_data": df.to_dict(orient="records")
    }