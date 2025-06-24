import pandas as pd
import numpy as np
from scipy.signal import detrend

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

        # Skip if signal has fewer than 2 points
        if len(signal) < 2:
            features[f"{col}_dominant_freq"] = 0
            continue

        # Detrend using scipy.signal to remove DC component
        signal = detrend(signal, type='constant')

        n = len(signal)
        fft_vals = np.fft.rfft(signal)
        fft_freqs = np.fft.rfftfreq(n, d=1 / sampling_rate)
        magnitudes = np.abs(fft_vals)

        # Ignore the zero-frequency (DC) component by setting its magnitude to zero
        if len(magnitudes) > 1:
            magnitudes[0] = 0

        # Get dominant frequency (highest magnitude in spectrum)
        dominant_freq = fft_freqs[np.argmax(magnitudes)] if magnitudes.sum() > 0 else 0
        features[f"{col}_dominant_freq"] = dominant_freq

    return pd.DataFrame([features])
