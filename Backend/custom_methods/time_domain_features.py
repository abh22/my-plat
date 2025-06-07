"""
Time-domain EMG feature extraction functions.
"""
import numpy as np
import pandas as pd
from scipy.stats import skew, kurtosis


def extract_time_domain_features(segment: np.ndarray) -> tuple:
    """
    Extract time-domain features from EMG segment.
    
    Args:
        segment: 1D EMG signal segment
        
    Returns:
        tuple: (features_list, feature_names_list)
    """
    # Mean Absolute Value
    mav = np.mean(np.abs(segment))
    
    # Root Mean Square
    rms = np.sqrt(np.mean(segment**2))
    
    # Waveform Length
    wl = np.sum(np.abs(np.diff(segment)))
    
    # Zero Crossings
    zc = np.sum(
        (segment[:-1] * segment[1:] < 0)
        & (np.abs(segment[:-1] - segment[1:]) >= 0.01)
    )
    
    # Slope Sign Changes
    ssc = np.sum(
        ((segment[1:-1] - segment[:-2]) * (segment[1:-1] - segment[2:]) > 0)
        & (np.abs(segment[1:-1] - segment[:-2]) >= 0.01)
        & (np.abs(segment[1:-1] - segment[2:]) >= 0.01)
    )
    
    # Variance
    var = np.var(segment)
    
    # Standard Deviation
    stdev = np.std(segment)
    
    # Skewness
    skewness = skew(segment)
    
    # Kurtosis
    kurt = kurtosis(segment)
    
    # Integrated EMG
    iemg = np.sum(np.abs(segment))
    
    # Simple Square Integral
    ssi = np.sum(segment**2)
    
    # Maximum Absolute Value
    maxav = np.max(np.abs(segment))
    
    # Minimum Absolute Value
    minav = np.min(np.abs(segment))
    
    # Willison Amplitude
    wamp = np.sum(np.abs(np.diff(segment)) > 0.01)
    
    features = [
        mav, rms, wl, zc, ssc, var, stdev, skewness, kurt, 
        iemg, ssi, maxav, minav, wamp
    ]
    
    feature_names = [
        "mav", "rms", "wl", "zc", "ssc", "var", "stdev", "skew", "kurt",
        "iemg", "ssi", "maxav", "minav", "wamp"
    ]
    
    return features, feature_names


def process_data(df, params):
    """
    Process a dataframe to extract time-domain EMG features.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe containing EMG data
    params : dict
        Processing parameters:
        - 'emg_columns': list of column names containing EMG data
        - 'trial_length': int, samples per trial (default: 10000)
        - 'fs': int, sampling frequency (default: 2500)
        - 'channel_prefix': str, prefix for output columns (default: 'td')
    
    Returns:
    --------
    pandas.DataFrame
        DataFrame with time-domain features
    """
    # Extract parameters
    emg_columns = params.get('emg_columns', df.columns.tolist())
    trial_length = params.get('trial_length', 10000)
    channel_prefix = params.get('channel_prefix', 'td')
    
    # Convert DataFrame to numpy array
    emg_matrix = df[emg_columns].values
    n_samples, n_channels = emg_matrix.shape
    n_trials = n_samples // trial_length
    
    # Extract features for each trial
    all_features = []
    feature_names = []
    
    for trial_idx in range(n_trials):
        trial_features = []
        
        for ch_idx, col_name in enumerate(emg_columns):
            # Extract segment
            segment = emg_matrix[
                trial_idx * trial_length:(trial_idx + 1) * trial_length, ch_idx
            ]
            
            # Extract time-domain features
            features, names = extract_time_domain_features(segment)
            trial_features.extend(features)
            
            # Create feature names only once
            if trial_idx == 0:
                prefixed_names = [f"{channel_prefix}_{col_name}_{name}" for name in names]
                feature_names.extend(prefixed_names)
        
        all_features.append(trial_features)
    
    # Convert to DataFrame
    result_df = pd.DataFrame(all_features, columns=feature_names)
    result_df.index.name = 'trial'
    
    return result_df