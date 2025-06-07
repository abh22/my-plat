"""
Autoregressive (AR) model feature extraction functions.
"""
import numpy as np
from statsmodels.tsa.ar_model import AutoReg


def extract_ar_features(segment: np.ndarray, lags: int = 6) -> tuple:
    """
    Extract AR model coefficients from EMG segment.
    
    Args:
        segment: 1D EMG signal segment
        lags: Number of AR model lags
        
    Returns:
        tuple: (features_list, feature_names_list)
    """
    try:
        ar_model = AutoReg(segment, lags=lags, old_names=False)
        ar_fit = ar_model.fit()
        ar_coeffs = ar_fit.params[1:]  # Exclude intercept
    except:
        ar_coeffs = np.zeros(lags)
    
    features = list(ar_coeffs)
    feature_names = [f"ar{i + 1}" for i in range(lags)]
    
    return features, feature_names
