# Dominant Frequency Extraction
# This module extracts the dominant frequency for each numeric column.

import pandas as pd
import numpy as np

def process_data(df, params):
    """
    Extract dominant frequency for each numeric column.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe
    params : dict
        Should include 'sampling_rate' (e.g., in Hz)
    
    Returns:
    --------
    pandas.DataFrame
        A single-row dataframe with dominant frequencies
    """
    result = df.copy()
    sampling_rate = params.get('sampling_rate', 1.0)
    numeric_cols = result.select_dtypes(include=[np.number]).columns

    features = {}

    for col in numeric_cols:
        signal = result[col].dropna().values
        n = len(signal)
        fft_vals = np.fft.rfft(signal)
        fft_freqs = np.fft.rfftfreq(n, d=1/sampling_rate)
        magnitudes = np.abs(fft_vals)

        dominant_freq = fft_freqs[np.argmax(magnitudes)] if magnitudes.sum() > 0 else 0
        features[f"{col}_dominant_freq"] = dominant_freq

    return pd.DataFrame([features])
