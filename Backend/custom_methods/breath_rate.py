import pandas as pd
import numpy as np

from .signal_filter import signal_filter
from .signal_interpolate import signal_interpolate
from .signal_resample import signal_resample
from .signal_rate import signal_rate
from .rsp_peaks import rsp_peaks


def process_data(df, params):
    """
    Process a dataframe to calculate respiration rate.

    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe containing the cleaned respiration signal.
    params : dict
        Parameters for rsp_rate:
            - 'signal_column' : str, name of the column with the cleaned respiration signal.
            - 'troughs' : optional, array-like or None.
            - 'sampling_rate' : int
            - 'window' : int
            - 'hop_size' : int
            - 'method' : str
            - 'peak_method' : str
            - 'interpolation_method' : str

    Returns:
    --------
    pandas.DataFrame
        The dataframe with an added column 'rsp_rate'.
    """

    # Extract parameters with defaults
    signal_column = params.get('signal_column')
    troughs = params.get('troughs', None)
    sampling_rate = params.get('sampling_rate', 1000)
    window = params.get('window', 10)
    hop_size = params.get('hop_size', 1)
    method = params.get('method', 'trough')
    peak_method = params.get('peak_method', 'khodadad2018')
    interpolation_method = params.get('interpolation_method', 'monotone_cubic')

    # Determine respiration signal column; fallback to first column if not provided or invalid
    if not signal_column or signal_column not in df.columns:
        signal_column = df.columns[0]
    # Get the respiration signal
    rsp_cleaned = df[signal_column].values

    # Calculate respiration rate
    rate = breath_rate(
        rsp_cleaned,
        troughs=troughs,
        sampling_rate=sampling_rate,
        window=window,
        hop_size=hop_size,
        method=method,
        peak_method=peak_method,
        interpolation_method=interpolation_method,
    )

    # Return original dataframe with the rate as a new column
    df_result = df.copy()
    df_result['breath_rate'] = rate

    return df_result


def breath_rate(
    rsp_cleaned,
    troughs=None,
    sampling_rate=1000,
    window=10,
    hop_size=1,
    method="trough",
    peak_method="khodadad2018",
    interpolation_method="monotone_cubic",
):
    if method.lower() in ["period", "peak", "peaks", "trough", "troughs", "signal_rate"]:
        if troughs is None:
            _, troughs = rsp_peaks(rsp_cleaned, sampling_rate=sampling_rate, method=peak_method)
        if isinstance(troughs, (pd.DataFrame, dict)):
            troughs = troughs["RSP_Troughs"]
        rate = signal_rate(
            troughs,
            sampling_rate=sampling_rate,
            desired_length=len(rsp_cleaned),
            interpolation_method=interpolation_method,
        )

    elif method.lower() in ["cross-correlation", "xcorr"]:
        rate = _rsp_rate_xcorr(
            rsp_cleaned,
            sampling_rate=sampling_rate,
            window=window,
            hop_size=hop_size,
            interpolation_method=interpolation_method,
        )

    else:
        raise ValueError(
            "NeuroKit error: rsp_rate(): 'method' should be one of 'trough', or 'cross-correlation'."
        )

    return rate


def _rsp_rate_xcorr(
    rsp_cleaned,
    sampling_rate=1000,
    window=10,
    hop_size=1,
    interpolation_method="monotone_cubic",
):
    N = len(rsp_cleaned)
    desired_sampling_rate = 10
    rsp = signal_resample(
        rsp_cleaned,
        sampling_rate=sampling_rate,
        desired_sampling_rate=desired_sampling_rate,
    )

    window_length = int(desired_sampling_rate * window)
    rsp_rate = []

    for start in np.arange(0, N, hop_size):
        window_segment = rsp[start : start + window_length]
        if len(window_segment) < window_length:
            break
        diff = np.ediff1d(window_segment)
        norm_diff = diff / np.max(diff)
        xcorr = []
        t = np.linspace(0, window, len(diff))

        for frequency in np.arange(5 / 60, 30.25 / 60, 0.25 / 60):
            sin_wave = np.sin(2 * np.pi * frequency * t)
            _xcorr = np.corrcoef(norm_diff, sin_wave)[0, 1]
            xcorr.append(_xcorr)

        max_frequency_idx = np.argmax(xcorr)
        max_frequency = np.arange(5 / 60, 30.25 / 60, 0.25 / 60)[max_frequency_idx]
        rsp_rate.append(max_frequency)

    x = np.arange(len(rsp_rate))
    y = rsp_rate
    rsp_rate = signal_interpolate(
        x, y, x_new=len(rsp_cleaned), method=interpolation_method
    )
    rsp_rate = signal_filter(rsp_rate, highcut=0.1, order=4, sampling_rate=sampling_rate)
    rsp_rate = np.multiply(rsp_rate, 60)

    return np.array(rsp_rate)
