"""
Wavelet-based EMG feature extraction functions.
"""
import numpy as np
import pywt


def extract_wavelet_features(segment: np.ndarray, wavelet: str = "db4", level: int = 4) -> tuple:
    """
    Extract wavelet entropy from EMG segment.
    
    Args:
        segment: 1D EMG signal segment
        wavelet: Wavelet type (default: "db4")
        level: Decomposition level
        
    Returns:
        tuple: (features_list, feature_names_list)
    """
    # Wavelet decomposition
    coeffs = pywt.wavedecn(segment, wavelet=wavelet, level=level)
    arr, _ = pywt.coeffs_to_array(coeffs)
    
    # Energy calculations
    Et = np.sum(arr**2)  # Total energy
    Ea = np.sum(coeffs[0] ** 2)  # Approximation energy
    
    # Detail energies
    Ed = [
        np.sum(np.asarray(list(coeffs[k].values())) ** 2)
        for k in range(1, len(coeffs))
    ]
    
    # Relative energies
    E = np.array([Ea] + Ed) / Et
    
    # Shannon entropy
    sh_entropy = -np.sum(E * np.log2(E + 1e-8))
    
    features = [sh_entropy]
    feature_names = ["wavelet_entropy"]
    
    return features, feature_names
