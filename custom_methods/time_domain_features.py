"""
Time-domain EMG feature extraction functions.
"""
import numpy as np
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
