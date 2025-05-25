# 📦 Output:

#     Feature Matrix Shape: (50, 189)
#     → 50 trials × (27 features × 7 channels)

#     Feature Names: Automatically generated as ch1_mav, ch1_rms, ..., ch7_wavelet_entropy


# 🔧 Usage Example:

# features_matrix, feature_names = extract_all_features_full(emg_matrix)
# print("Shape:", features_matrix.shape)
# print("First 5 feature names:", feature_names[:5])

import numpy as np
from typing import Tuple
from scipy.stats import skew, kurtosis, entropy
from statsmodels.tsa.ar_model import AutoReg
import pywt


def extract_all_features_full(
    emg_matrix: np.ndarray, fs: int = 2500, trial_length: int = 10000
) -> Tuple[np.ndarray, list]:
    n_samples, n_channels = emg_matrix.shape
    n_trials = n_samples // trial_length

    feature_names = []
    all_features = []

    for trial_idx in range(n_trials):
        trial_features = []

        for ch_idx in range(n_channels):
            segment = emg_matrix[
                trial_idx * trial_length : (trial_idx + 1) * trial_length, ch_idx
            ]

            # Time-domain features
            mav = np.mean(np.abs(segment))
            rms = np.sqrt(np.mean(segment**2))
            wl = np.sum(np.abs(np.diff(segment)))
            zc = np.sum(
                (segment[:-1] * segment[1:] < 0)
                & (np.abs(segment[:-1] - segment[1:]) >= 0.01)
            )
            ssc = np.sum(
                ((segment[1:-1] - segment[:-2]) * (segment[1:-1] - segment[2:]) > 0)
                & (np.abs(segment[1:-1] - segment[:-2]) >= 0.01)
                & (np.abs(segment[1:-1] - segment[2:]) >= 0.01)
            )
            var = np.var(segment)
            stdev = np.std(segment)
            skewness = skew(segment)
            kurt = kurtosis(segment)
            iemg = np.sum(np.abs(segment))
            ssi = np.sum(segment**2)
            raw_entropy = entropy(np.abs(segment) + 1e-10)
            maxav = np.max(np.abs(segment))
            minav = np.min(np.abs(segment))
            wamp = np.sum(np.abs(np.diff(segment)) > 0.01)

            # AR6 coefficients
            try:
                ar_model = AutoReg(segment, lags=6, old_names=False)
                ar_fit = ar_model.fit()
                ar_coeffs = ar_fit.params[1:]
            except:
                ar_coeffs = np.zeros(6)

            # Frequency-domain features
            n_fft = 2 ** (len(segment) - 1).bit_length()
            y = np.fft.fft(segment, n_fft)
            y = y[: n_fft // 2 - 1]
            freqs = (fs / n_fft) * np.arange(0, n_fft // 2 - 1)
            power = np.real(y * np.conj(y) / n_fft)
            mean_power = np.mean(power)
            total_power = np.sum(power)
            mean_freq = np.sum(freqs * power) / (np.sum(power) + 1e-8)
            half_power = np.sum(power) / 2
            cumulative_power = np.cumsum(power)
            median_freq = freqs[np.where(cumulative_power >= half_power)[0][0]]
            peak_freq = freqs[np.argmax(power)]

            # Time-frequency feature (wavelet entropy)
            coeffs = pywt.wavedecn(segment, wavelet="db4", level=4)
            arr, _ = pywt.coeffs_to_array(coeffs)
            Et = np.sum(arr**2)
            Ea = np.sum(coeffs[0] ** 2)
            Ed = [
                np.sum(np.asarray(list(coeffs[k].values())) ** 2)
                for k in range(1, len(coeffs))
            ]
            E = np.array([Ea] + Ed) / Et
            sh_entropy = -np.sum(E * np.log2(E + 1e-8))

            # Combine all features
            features = (
                [
                    mav,
                    rms,
                    wl,
                    zc,
                    ssc,
                    var,
                    stdev,
                    skewness,
                    kurt,
                    iemg,
                    ssi,
                    raw_entropy,
                    maxav,
                    minav,
                    wamp,
                ]
                + list(ar_coeffs)
                + [
                    mean_power,
                    total_power,
                    mean_freq,
                    median_freq,
                    peak_freq,
                    sh_entropy,
                ]
            )
            trial_features.extend(features)

            if trial_idx == 0:
                # Only collect feature names once
                fnames = (
                    [
                        "mav",
                        "rms",
                        "wl",
                        "zc",
                        "ssc",
                        "var",
                        "stdev",
                        "skew",
                        "kurt",
                        "iemg",
                        "ssi",
                        "raw_entropy",
                        "maxav",
                        "minav",
                        "wamp",
                    ]
                    + [f"ar{i + 1}" for i in range(6)]
                    + [
                        "mean_power",
                        "total_power",
                        "mean_freq",
                        "median_freq",
                        "peak_freq",
                        "wavelet_entropy",
                    ]
                )
                feature_names.extend([f"ch{ch_idx + 1}_{name}" for name in fnames])

        all_features.append(trial_features)

    return np.array(all_features), feature_names
