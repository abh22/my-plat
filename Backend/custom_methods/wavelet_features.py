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
    # Assemble full set of features: total energy, approximation energy, detail band energies, and entropy
    total_energy = Et
    approximation_energy = Ea
    detail_energies = Ed  # list of detail band energies
    features = [total_energy, approximation_energy] + detail_energies + [sh_entropy]
    feature_names = [
        "total_energy",
        "approximation_energy"
    ] + [f"detail_energy_level_{i+1}" for i in range(len(detail_energies))] + ["wavelet_entropy"]

    return features, feature_names
