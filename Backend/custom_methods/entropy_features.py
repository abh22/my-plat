"""
Entropy-based EMG feature extraction functions.
"""
import numpy as np
from scipy.stats import entropy


def extract_entropy_features(segment: np.ndarray) -> tuple:
    """
    Extract entropy features from EMG segment.
    
    Args:
        segment: 1D EMG signal segment
        
    Returns:
        tuple: (features_list, feature_names_list)
    """
    # Raw entropy (Shannon entropy of absolute values)
    raw_entropy = entropy(np.abs(segment) + 1e-10)
    
    features = [raw_entropy]
    feature_names = ["raw_entropy"]
    
    return features, feature_names


def sample_entropy(segment: np.ndarray, m: int = 2, r: float = None) -> float:
    """
    Calculate Sample Entropy of a signal.
    
    Args:
        segment: 1D EMG signal segment
        m: Pattern length
        r: Tolerance for matching (default: 0.2 * std)
        
    Returns:
        float: Sample entropy value
    """
    if r is None:
        r = 0.2 * np.std(segment)
    
    N = len(segment)
    
    def _maxdist(xi, xj, m):
        return max([abs(ua - va) for ua, va in zip(xi, xj)])
    
    def _phi(m):
        patterns = np.array([segment[i:i + m] for i in range(N - m + 1)])
        C = np.zeros(N - m + 1)
        
        for i in range(N - m + 1):
            template = patterns[i]
            for j in range(N - m + 1):
                if _maxdist(template, patterns[j], m) <= r:
                    C[i] += 1
        
        phi = np.mean(np.log(C / (N - m + 1)))
        return phi
    
    return _phi(m) - _phi(m + 1)


def approximate_entropy(segment: np.ndarray, m: int = 2, r: float = None) -> float:
    """
    Calculate Approximate Entropy of a signal.
    
    Args:
        segment: 1D EMG signal segment
        m: Pattern length
        r: Tolerance for matching (default: 0.2 * std)
        
    Returns:
        float: Approximate entropy value
    """
    if r is None:
        r = 0.2 * np.std(segment)
    
    N = len(segment)
    
    def _maxdist(xi, xj, m):
        return max([abs(ua - va) for ua, va in zip(xi, xj)])
    
    def _phi(m):
        patterns = np.array([segment[i:i + m] for i in range(N - m + 1)])
        C = np.zeros(N - m + 1)
        
        for i in range(N - m + 1):
            template = patterns[i]
            for j in range(N - m + 1):
                if _maxdist(template, patterns[j], m) <= r:
                    C[i] += 1
        
        phi = np.mean(np.log(C / (N - m + 1)))
        return phi
    
    return _phi(m) - _phi(m + 1)
