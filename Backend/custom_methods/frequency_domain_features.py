"""
Frequency-domain EMG feature extraction functions.
"""
import numpy as np


def extract_frequency_domain_features(segment: np.ndarray, fs: int = 2500) -> tuple:
    """
    Extract frequency-domain features from EMG segment.
    
    Args:
        segment: 1D EMG signal segment
        fs: Sampling frequency (Hz)
        
    Returns:
        tuple: (features_list, feature_names_list)
    """
    # FFT computation
    n_fft = 2 ** (len(segment) - 1).bit_length()
    y = np.fft.fft(segment, n_fft)
    y = y[: n_fft // 2 - 1]
    freqs = (fs / n_fft) * np.arange(0, n_fft // 2 - 1)
    power = np.real(y * np.conj(y) / n_fft)
    
    # Mean Power
    mean_power = np.mean(power)
    
    # Total Power
    total_power = np.sum(power)
    
    # Mean Frequency
    mean_freq = np.sum(freqs * power) / (np.sum(power) + 1e-8)
    
    # Median Frequency
    half_power = np.sum(power) / 2
    cumulative_power = np.cumsum(power)
    median_freq = freqs[np.where(cumulative_power >= half_power)[0][0]]
    
    # Peak Frequency
    peak_freq = freqs[np.argmax(power)]
    
    features = [mean_power, total_power, mean_freq, median_freq, peak_freq]
    
    feature_names = [
        "mean_power", "total_power", "mean_freq", "median_freq", "peak_freq"
    ]
    
    return features, feature_names
