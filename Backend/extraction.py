from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server-side plotting
import matplotlib.pyplot as plt
import io
import base64
from sklearn.feature_selection import VarianceThreshold
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from scipy.stats import entropy
from sklearn.feature_selection import SelectKBest, f_classif, f_regression, chi2
from sklearn.preprocessing import PolynomialFeatures
from sklearn.manifold import TSNE, Isomap
from sklearn.decomposition import KernelPCA, TruncatedSVD, FastICA
import traceback
import os
import importlib.util

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
                    featureNameMapping = {}
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
                    featureNameMapping = data.get("featureNameMapping", {}) if isinstance(data, dict) else {}
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
            raise HTTPException(status_code=400, detail=f"Invalid file format: {str(e)}")
            
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
        # Save original features for mapping composite features
        original_features = numeric_features.copy()

        # Create a copy of the dataframe with only numeric features for extraction
        X = df[numeric_features].copy()

        # Handle missing values in numeric features (required for most algorithms)
        X = X.fillna(X.mean())

        # Create preview_list to hold feature preview entries
        preview_list = []
        # Loop through selected methods
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
                # Map each PCA component to its corresponding original feature by index
                for idx, col in enumerate(pca_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(pca_result, columns=pca_cols, index=X.index)
                # add preview entries for PCA components for all rows
                for row in pca_result:
                    for i, col in enumerate(pca_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

            elif method == "kernelPCA":
                # Kernel PCA
                kernel = settings.get("kernel", "rbf")  # Default kernel is RBF
                n_components = settings.get("pcaComponents", 2)
                print(f"Kernel PCA with {n_components} components and kernel={kernel}")

                kpca = KernelPCA(n_components=n_components, kernel=kernel)
                try:
                    kpca_result = kpca.fit_transform(X)
                except Exception as e:
                    print(f"Kernel PCA skipped due to error: {e}")
                    continue

                kpca_cols = [f"KPCA{i+1}" for i in range(n_components)]
                # Map each Kernel PCA component to its corresponding original feature by index
                for idx, col in enumerate(kpca_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(kpca_result, columns=kpca_cols, index=X.index)
                # add preview entries for Kernel PCA components across all rows
                for row in kpca_result:
                    for i, col in enumerate(kpca_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

            elif method == "truncatedSVD":
                # Truncated SVD
                n_components = settings.get("pcaComponents", 2)
                print(f"Truncated SVD with {n_components} components")

                svd = TruncatedSVD(n_components=n_components)
                svd_result = svd.fit_transform(X)

                svd_cols = [f"SVD{i+1}" for i in range(n_components)]
                # Map each SVD component to its corresponding original feature by index
                for idx, col in enumerate(svd_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(svd_result, columns=svd_cols, index=X.index)
                # add preview entries for Truncated SVD components across all rows
                for row in svd_result:
                    for i, col in enumerate(svd_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

            elif method == "fastICA":
                # Independent Component Analysis
                n_components = settings.get("pcaComponents", 2)
                print(f"Fast ICA with {n_components} components")

                ica = FastICA(n_components=n_components)
                ica_result = ica.fit_transform(X)

                ica_cols = [f"ICA{i+1}" for i in range(n_components)]
                # Map each ICA component to its corresponding original feature by index
                for idx, col in enumerate(ica_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(ica_result, columns=ica_cols, index=X.index)
                # add preview entries for FastICA components across all rows
                for row in ica_result:
                    for i, col in enumerate(ica_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

            elif method == "tsne":
                # t-SNE
                n_components = settings.get("pcaComponents", 2)
                print(f"t-SNE with {n_components} components")

                # Determine safe perplexity for small datasets
                n_samples = X.shape[0]
                default_perp = settings.get("perplexity", 30)
                perp = min(default_perp, max(1, n_samples - 1))
                print(f"t-SNE with perplexity={perp} on {n_samples} samples")
                tsne = TSNE(n_components=n_components, perplexity=perp)
                try:
                    tsne_result = tsne.fit_transform(X)
                except Exception as e:
                    print(f"t-SNE skipped due to error: {e}")
                    continue

                tsne_cols = [f"tSNE{i+1}" for i in range(n_components)]
                # Map each t-SNE component to its corresponding original feature by index
                for idx, col in enumerate(tsne_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(tsne_result, columns=tsne_cols)
                # add preview entries for t-SNE components across all rows
                for row in tsne_result:
                    for i, col in enumerate(tsne_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

            elif method == "isomap":
                # Isomap
                n_components = settings.get("pcaComponents", 2)
                n_neighbors = settings.get("n_neighbors", 5)
                print(f"Isomap with {n_components} components and {n_neighbors} neighbors")

                isomap = Isomap(n_components=n_components, n_neighbors=n_neighbors)
                isomap_result = isomap.fit_transform(X)

                isomap_cols = [f"Isomap{i+1}" for i in range(n_components)]
                # Map each Isomap component to its corresponding original feature by index
                for idx, col in enumerate(isomap_cols):
                    if idx < len(original_features):
                        featureNameMapping[col] = [original_features[idx]]
                X = pd.DataFrame(isomap_result, columns=isomap_cols, index=X.index)
                # add preview entries for Isomap components across all rows
                for row in isomap_result:
                    for i, col in enumerate(isomap_cols):
                        preview_list.append({"feature": col, "value": float(row[i])})

        # Handle any remaining NaN values
        X = X.fillna(0)
        # Initialize containers for custom methods
        ar_results = {}
        freq_results = {}
        td_results = {}
        ent_results = {}
        wav_results = {}
        processed_ar_records = []  # Initialize here for later use
        processed_td_records = []  # Initialize for time-domain multi-trial records

        # If AR features requested, run custom AR extractor and return feature/value pairs
        if any('ar_features' in m.lower() for m in methods):
            # Dynamically load ar_features module
            spec = importlib.util.spec_from_file_location(
                "ar_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "ar_features.py")
            )
            ar_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(ar_mod)
            extract_ar_features = ar_mod.extract_ar_features

            # Determine which channels to process for AR features
            ar_targets = config.get('channels', []) or []
            ar_targets = [col for col in ar_targets if col in numeric_features]
            # If none, skip AR extraction
            if not ar_targets:
                print("No AR channels selected, skipping AR extraction")
            else:
                lags = settings.get('lags', 6)
                for col in ar_targets:
                    series = df[col].fillna(df[col].mean()).values
                    # Sliding-window parameters
                    window_size = settings.get('windowSize', 256)
                    window_step = settings.get('windowStep', window_size // 2)
                    windowed_feats: List[List[float]] = []
                    # Slide over the time series
                    for start in range(0, len(series) - window_size + 1, window_step):
                        window = series[start : start + window_size]
                        feats, names = extract_ar_features(window, lags)
                        windowed_feats.append(feats)
                    # Store windowed features for this channel
                    ar_results[col] = (names, windowed_feats)
            # Add AR feature entries to preview_list (first window features already added above)

        # After AR extraction, create composite records per window combining all channels
        if ar_results:
            # Determine number of windows (assumes same count across channels)
            window_counts = [len(w_feats) for (_, w_feats) in ar_results.values()]
            num_windows = min(window_counts) if window_counts else 0
            processed_ar_records: List[Dict[str, Any]] = []
            for w in range(num_windows):
                record: Dict[str, Any] = {}
                for ch, (names, windowed_feats) in ar_results.items():
                    feats = windowed_feats[w]
                    for i, name in enumerate(names):
                        record[f"{ch}_{name}"] = feats[i]
                processed_ar_records.append(record)
            
            # Build preview_list entries using first window only for AR features
            ar_preview_list = []
            if processed_ar_records:
                first = processed_ar_records[0]
                for feature_key, feature_val in first.items():
                    ar_preview_list.append({"feature": feature_key, "value": float(feature_val)})
                # Add AR preview to the main preview list
                preview_list.extend(ar_preview_list)

        print(f"Feature extraction complete. Final shape: {X.shape}")
        print(f"Updated Feature Name Mapping: {featureNameMapping}")

        # Prepare combined preview/processed lists for custom methods
        processed_list = []

        # Handle Dominant Frequency extraction if requested
        # Handle Dominant Frequency extraction if requested
        if any('dominant' in m.lower() for m in methods):
            print("--- Dominant Frequency branch entered ---")
             # Determine which channels to process for Dominant Frequency
            dom_targets = config.get('channels', []) or numeric_features
            print(f"Dominant frequency channel targets: {dom_targets}")
             # Filter only numeric features
            dom_targets = [col for col in dom_targets if col in numeric_features]
            print(f"Filtered dom_targets: {dom_targets}")
            print(f"Dominant frequency targets: {dom_targets}")
            # Dynamically load dominant_frequency custom method
            spec_dom = importlib.util.spec_from_file_location(
                "dominant_frequency",
                os.path.join(os.path.dirname(__file__), "custom_methods", "dominant_frequency.py")
            )
            df_mod = importlib.util.module_from_spec(spec_dom)
            spec_dom.loader.exec_module(df_mod)
            process_dom = getattr(df_mod, 'process_data', None)
            if not process_dom:
                return {"error": "Dominant frequency method not found"}
            # Compute dominant frequencies for targeted channels
            # Detrend each channel (remove DC offset) before research process_data
            df_input = df[dom_targets].copy()
            # Removed detrending: pass raw channel data directly
            dom_df = process_dom(df_input, settings)
            print(f"Dominant frequency raw df: {dom_df}")
             # Build preview list
            preview_dom = []
            for feat, val in dom_df.to_dict(orient='records')[0].items():
                print(f"DF feature {feat} raw value {val} (type: {type(val)})")
                # More robust value conversion
                try:
                    if val is None or (isinstance(val, float) and np.isnan(val)):
                        safe_val = 0.0
                        print(f"  -> Converted None/NaN to 0.0")
                    else:
                        safe_val = float(val)
                        print(f"  -> Converted to float: {safe_val}")
                except (ValueError, TypeError) as e:
                    print(f"  -> Error converting {val}: {e}, defaulting to 0.0")
                    safe_val = 0.0
                preview_dom.append({"feature": feat, "value": safe_val})
            print(f"DF preview_dom: {preview_dom}")
             # Accumulate DF previews instead of returning early
            preview_list.extend(preview_dom)

        # If AR features requested, run custom AR extractor and return feature/value pairs
        if any('ar_features' in m.lower() for m in methods):
            # Dynamically load ar_features module
            spec = importlib.util.spec_from_file_location(
                "ar_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "ar_features.py")
            )
            ar_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(ar_mod)
            extract_ar_features = ar_mod.extract_ar_features

            # Determine which channels to process for AR features
            ar_targets = config.get('channels', []) or []
            ar_targets = [col for col in ar_targets if col in numeric_features]
            # If none, skip AR extraction
            if not ar_targets:
                print("No AR channels selected, skipping AR extraction")
            else:
                lags = settings.get('lags', 6)
                for col in ar_targets:
                     series = df[col].fillna(df[col].mean()).values
                     # Sliding-window parameters
                     window_size = settings.get('windowSize', 256)
                     window_step = settings.get('windowStep', window_size // 2)
                     windowed_feats: List[List[float]] = []
                     # Slide over the time series
                     for start in range(0, len(series) - window_size + 1, window_step):
                         window = series[start : start + window_size]
                         feats, names = extract_ar_features(window, lags)
                         windowed_feats.append(feats)
                     # Store windowed features for this channel
                     ar_results[col] = (names, windowed_feats)
            # continue to final aggregation

        # Preview frequency-domain features if requested
        if any('frequency_domain' in m.lower() for m in methods):
            spec_freq = importlib.util.spec_from_file_location(
                "frequency_domain_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "frequency_domain_features.py")
            )
            freq_mod = importlib.util.module_from_spec(spec_freq)
            spec_freq.loader.exec_module(freq_mod)
            extract_freq = getattr(freq_mod, 'extract_frequency_domain_features', None)
            if extract_freq:
                freq_targets = config.get('channels', []) or numeric_features
                freq_targets = [col for col in freq_targets if col in numeric_features]
                fs = settings.get('sampling_rate', 2500)
                for col in freq_targets:
                    segment = df[col].fillna(df[col].mean()).values
                    feats, names = extract_freq(segment, fs)
                    clean_feats = [float(f) if not pd.isna(f) else 0.0 for f in feats]
                    freq_results[col] = (names, clean_feats)
                    for name, val in zip(names, clean_feats):
                        feature_name = f"{col}_{name}"
                        preview_list.append({"feature": feature_name, "value": val})

        # Preview time-domain features if requested
        if any('time_domain' in m.lower() for m in methods):
            spec_td = importlib.util.spec_from_file_location(
                "time_domain_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "time_domain_features.py")
            )
            td_mod = importlib.util.module_from_spec(spec_td)
            spec_td.loader.exec_module(td_mod)
            process_td = getattr(td_mod, 'process_data', None)
            if process_td:
                td_targets = config.get('channels', []) or numeric_features
                td_targets = [col for col in td_targets if col in numeric_features]
                df_input = df[td_targets].copy()
                
                # Add emg_columns parameter for time-domain processing
                td_settings = settings.copy()
                td_settings['emg_columns'] = td_targets
                print(f"Time-domain settings: {td_settings}")
                
                td_df = process_td(df_input, td_settings)
                
                print(f"Time-domain method returned DataFrame with shape: {td_df.shape}")
                print(f"TD columns: {list(td_df.columns)}")
                print(f"TD trials (rows): {len(td_df)}")
                
                # Instead of using only first trial, use all trials to create multiple records
                if len(td_df) > 1:
                    # Multiple trials: convert each trial to a feature record
                    td_records = []
                    for trial_idx in range(len(td_df)):
                        trial_record = {}
                        for feat, val in td_df.iloc[trial_idx].to_dict().items():
                            print(f"TD trial {trial_idx} feature {feat} raw value {val} (type: {type(val)})")
                            try:
                                if val is None or (isinstance(val, float) and np.isnan(val)):
                                    safe_val = 0.0
                                    print(f"  -> TD: Converted None/NaN to 0.0")
                                else:
                                    safe_val = float(val)
                                    print(f"  -> TD: Converted to float: {safe_val}")
                            except (ValueError, TypeError) as e:
                                print(f"  -> TD: Error converting {val}: {e}, defaulting to 0.0")
                                safe_val = 0.0
                            trial_record[feat] = safe_val
                        td_records.append(trial_record)
                    
                    # Store the multi-trial records for later use in processedData
                    processed_td_records = td_records
                    print(f"Created {len(td_records)} time-domain trial records")
                    
                    # For preview, just show features from first trial
                    first_trial = td_records[0] if td_records else {}
                    for feat, val in first_trial.items():
                        preview_list.append({"feature": feat, "value": val})
                else:
                    # Single trial: use the original logic
                    for feat, val in td_df.to_dict(orient='records')[0].items():
                        print(f"TD feature {feat} raw value {val} (type: {type(val)})")
                        try:
                            if val is None or (isinstance(val, float) and np.isnan(val)):
                                safe_val = 0.0
                                print(f"  -> TD: Converted None/NaN to 0.0")
                            else:
                                safe_val = float(val)
                                print(f"  -> TD: Converted to float: {safe_val}")
                        except (ValueError, TypeError) as e:
                            print(f"  -> TD: Error converting {val}: {e}, defaulting to 0.0")
                            safe_val = 0.0
                        preview_list.append({"feature": feat, "value": safe_val})
                    processed_td_records = []  # No multi-trial records
                # In the time-domain branch, capture results per channel for plotting
                for col in td_targets:
                    # Extract features for this channel from first trial
                    first_row = td_df.iloc[0].to_dict()
                    channel_feats = {k: v for k, v in first_row.items() if f'_{col}_' in k}
                    names = [k.split(f'_{col}_')[-1] for k in channel_feats.keys()]
                    values = []
                    for v in channel_feats.values():
                        print(f"    TD channel value {v} (type: {type(v)})")
                        try:
                            if v is None or (isinstance(v, float) and np.isnan(v)):
                                converted_val = 0.0
                                print(f"      -> Channel: Converted None/NaN to 0.0")
                            else:
                                converted_val = float(v)
                                print(f"      -> Channel: Converted to float: {converted_val}")
                        except (ValueError, TypeError) as e:
                            print(f"      -> Channel: Error converting {v}: {e}, defaulting to 0.0")
                            converted_val = 0.0
                        values.append(converted_val)
                    td_results[col] = (names, values)
                    for name, val in zip(names, values):
                        preview_list.append({"feature": f"{col}_{name}", "value": val})

        # Preview entropy features if requested
        if any('entropy_features' in m.lower() for m in methods):
            spec_ent = importlib.util.spec_from_file_location(
                "entropy_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "entropy_features.py")
            )
            ent_mod = importlib.util.module_from_spec(spec_ent)
            spec_ent.loader.exec_module(ent_mod)
            extract_ent = getattr(ent_mod, 'extract_entropy_features', None)
            if extract_ent:
                ent_targets = config.get('channels', []) or numeric_features
                ent_targets = [col for col in ent_targets if col in numeric_features]
                for col in ent_targets:
                    segment = df[col].fillna(df[col].mean()).values
                    feats, names = extract_ent(segment)
                    # More robust value conversion for entropy features
                    clean_feats = []
                    for f in feats:
                        print(f"Entropy raw feature value {f} (type: {type(f)})")
                        try:
                            if f is None or (isinstance(f, float) and np.isnan(f)):
                                converted_val = 0.0
                                print(f"  -> Entropy: Converted None/NaN to 0.0")
                            else:
                                converted_val = float(f)
                                print(f"  -> Entropy: Converted to float: {converted_val}")
                        except (ValueError, TypeError) as e:
                            print(f"  -> Entropy: Error converting {f}: {e}, defaulting to 0.0")
                            converted_val = 0.0
                        clean_feats.append(converted_val)
                    for name, val in zip(names, clean_feats):
                        feature_name = f"{col}_{name}"
                        preview_list.append({"feature": feature_name, "value": val})
                    # After appending entropy preview, store ent_results for plotting
                    ent_results[col] = (names, clean_feats)

        # Preview wavelet features if requested
        if any('wavelet' in m.lower() for m in methods):
            spec_wav = importlib.util.spec_from_file_location(
                "wavelet_features",
                os.path.join(os.path.dirname(__file__), "custom_methods", "wavelet_features.py")
            )
            wav_mod = importlib.util.module_from_spec(spec_wav)
            spec_wav.loader.exec_module(wav_mod)
            extract_wav = getattr(wav_mod, 'extract_wavelet_features', None)
            if extract_wav:
                wav_targets = config.get('channels', []) or numeric_features
                wav_targets = [col for col in wav_targets if col in numeric_features]
                wavelet = settings.get('wavelet', 'db4')
                level = settings.get('level', 4)
                for col in wav_targets:
                    segment = df[col].fillna(df[col].mean()).values
                    feats, names = extract_wav(segment, wavelet, level)
                    # More robust value conversion for wavelet features
                    clean_feats = []
                    for f in feats:
                        print(f"Wavelet raw feature value {f} (type: {type(f)})")
                        try:
                            if f is None or (isinstance(f, float) and np.isnan(f)):
                                converted_val = 0.0
                                print(f"  -> Wavelet: Converted None/NaN to 0.0")
                            else:
                                converted_val = float(f)
                                print(f"  -> Wavelet: Converted to float: {converted_val}")
                        except (ValueError, TypeError) as e:
                            print(f"  -> Wavelet: Error converting {f}: {e}, defaulting to 0.0")
                            converted_val = 0.0
                        clean_feats.append(converted_val)
                    for name, val in zip(names, clean_feats):
                        feature_name = f"{col}_{name}"
                        preview_list.append({"feature": feature_name, "value": val})

        # DEBUG: log combined preview_list (first 5 entries only)
        if len(preview_list) > 5:
            print(f"DEBUG combined preview_list (first 5 of {len(preview_list)} entries): {preview_list[:5]}")
        else:
            print(f"DEBUG combined preview_list: {preview_list}")

        # DEBUG: log what methods were actually used and preview list content
        print(f"Methods received: {methods}")
        print(f"Preview list length: {len(preview_list)}")
        if preview_list:
            print(f"Sample preview items: {preview_list[:3]}")
        
        # General approach: construct processedData based on what was actually produced
        if ar_results:
            # AR methods: use windowed feature records
            response_processed = processed_ar_records
            print("Using AR windowed feature records as processedData")
        elif processed_td_records:
            # Time-domain methods with multiple trials: use trial records
            response_processed = processed_td_records
            print(f"Using time-domain trial records as processedData ({len(processed_td_records)} trials)")
        elif any(method in ['pca', 'kernelPCA', 'truncatedSVD', 'fastICA', 'tsne', 'isomap'] for method in methods):
            # Built-in dimensionality reduction methods: use transformed data
            response_processed = X.to_dict(orient='records')
            print(f"Using transformed data from built-in methods as processedData")
            print(f"Transformed DataFrame shape: {X.shape}")
            print(f"processedData contains {len(response_processed)} feature records")
            print(f"Feature columns: {list(X.columns)}")
        elif preview_list and len(preview_list) > 0:
            # If we have a preview list with feature data, construct feature records
            # This is the general case for any custom feature extraction method
            
            # Check if preview items look like extracted features
            feature_count = 0
            for item in preview_list:
                if (isinstance(item, dict) and 
                    'feature' in item and 
                    'value' in item and
                    isinstance(item['feature'], str) and
                    item['value'] is not None):
                    feature_count += 1
            
            if feature_count > 0:
                # DEBUG: Show sample preview items to check values before building feature record
                print(f"DEBUG: Building feature record from {feature_count} preview items")
                for i, item in enumerate(preview_list[:5]):  # Show first 5
                    print(f"  Preview item {i}: {item}")
                
                # Build feature record(s) from preview list
                feature_record = {}
                for item in preview_list:
                    if isinstance(item, dict) and 'feature' in item and 'value' in item:
                        feature_record[item['feature']] = item['value']
                
                if feature_record:
                    response_processed = [feature_record]
                    print(f"Constructed feature record from {feature_count} extracted features")
                    print(f"Feature record keys: {list(feature_record.keys())[:10]}...")  # Show first 10 keys
                    # DEBUG: Show actual values to check if they're being zeroed
                    sample_values = {k: v for i, (k, v) in enumerate(feature_record.items()) if i < 5}
                    print(f"Sample feature values: {sample_values}")
                else:
                    # Fallback to original data if feature construction failed
                    response_processed = X.to_dict(orient='records')
                    print("Fallback: using original data as no valid features could be constructed")
            else:
                # Preview list doesn't contain valid extracted features, use original data
                response_processed = X.to_dict(orient='records')
                print("Preview list doesn't contain valid extracted features, using original data")
        else:
            # Default: use original data (no methods applied or no preview data)
            response_processed = X.to_dict(orient='records')
            print("Using original data as processedData (no feature extraction applied or no preview data)")

        print(f"Final response_processed type: {type(response_processed)}")
        print(f"Final response_processed length: {len(response_processed) if isinstance(response_processed, list) else 'N/A'}")
        if isinstance(response_processed, list) and len(response_processed) > 0:
            sample_keys = list(response_processed[0].keys())
            print(f"Sample response_processed record keys ({len(sample_keys)} total): {sample_keys[:10]}...")
        
        
        
        # Construct the base response payload
        if preview_list:
            # Show all AR feature entries when AR method is used, otherwise show first five items
            use_full_preview = any('ar_features' in m.lower() for m in methods)
            response = {
                "message": "Feature extraction completed successfully",
                "preview": preview_list if use_full_preview else preview_list[:5],
                "processedData": response_processed,
                "featureNameMapping": featureNameMapping,
            }

            # Only generate sparklines for built-in extraction methods
            built_in = {"pca","kernelPCA","truncatedSVD","fastICA","tsne","isomap"}
            if any(m in built_in for m in methods):
                plots = {}
                stats = {}
                comp_cols = list(X.columns)[:2]
                for col in comp_cols:
                    series = X[col].values[:10000]
                    stats[col] = {"mean": float(np.mean(series)), "std": float(np.std(series))}
                    fig, ax = plt.subplots(figsize=(4,1))
                    ax.plot(series, linewidth=1, color='blue')
                    ax.axis('off')
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
                    plots[col] = f"data:image/png;base64,{img_b64}"
                    plt.close(fig)
                response["plots"] = plots
                response["stats"] = stats
            # Custom AR feature bar chart
            if ar_results:
                ar_plots = {}
                for ch, (names, windowed_feats) in ar_results.items():
                    # Use first window's AR coefficients for plotting
                    feats = windowed_feats[0] if windowed_feats else [0.0] * len(names)
                    fig, ax = plt.subplots(figsize=(len(names) * 0.5, 2))
                    ax.bar(names, feats, color='green')
                    ax.set_title(f"AR Coefficients: {ch}", fontsize=8)
                    ax.tick_params(axis='x', rotation=45, labelsize=6)
                    plt.tight_layout()
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    ar_plots[ch] = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
                    plt.close(fig)
                response['arPlots'] = ar_plots
            # Generate bar charts for custom method features if present
            if freq_results:
                freq_plots = {}
                for ch, (names, feats) in freq_results.items():
                    fig, ax = plt.subplots(figsize=(len(names)*0.5, 2))
                    ax.bar(names, feats, color='purple')
                    ax.set_title(f"Freq Features: {ch}", fontsize=8)
                    ax.tick_params(axis='x', rotation=45, labelsize=6)
                    plt.tight_layout()
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    freq_plots[ch] = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
                    plt.close(fig)
                response['freqPlots'] = freq_plots
            if td_results:
                td_plots = {}
                for ch, (names, feats) in td_results.items():
                    fig, ax = plt.subplots(figsize=(len(names)*0.5, 2))
                    ax.bar(names, feats, color='teal')
                    ax.set_title(f"Time-Domain Features: {ch}", fontsize=8)
                    ax.tick_params(axis='x', rotation=45, labelsize=6)
                    plt.tight_layout()
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    td_plots[ch] = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
                    plt.close(fig)
                response['tdPlots'] = td_plots
            if ent_results:
                ent_plots = {}
                for ch, (names, feats) in ent_results.items():
                    fig, ax = plt.subplots(figsize=(len(names)*0.5, 2))
                    ax.bar(names, feats, color='orange')
                    ax.set_title(f"Entropy Features: {ch}", fontsize=8)
                    ax.tick_params(axis='x', rotation=45, labelsize=6)
                    plt.tight_layout()
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    ent_plots[ch] = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
                    plt.close(fig)
                response['entPlots'] = ent_plots
            if wav_results:
                wav_plots = {}
                for ch, (names, feats) in wav_results.items():
                    fig, ax = plt.subplots(figsize=(len(names)*0.5, 2))
                    ax.bar(names, feats, color='brown')
                    ax.set_title(f"Wavelet Features: {ch}", fontsize=8)
                    ax.tick_params(axis='x', rotation=45, labelsize=6)
                    plt.tight_layout()
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
                    buf.seek(0)
                    wav_plots[ch] = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
                    plt.close(fig)
                response['wavPlots'] = wav_plots
            return response

        # Default return: no custom features selected
        return {
            "message": "Feature extraction completed successfully",
            "preview": [],  # No AR features to preview
            "processedData": X.to_dict(orient="records"),
            "featureNameMapping": featureNameMapping,
        }

    except Exception as e:
        print(f"Error in feature extraction: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error in feature extraction: {str(e)}")