# -*- coding: utf-8 -*-
import numpy as np
from .signal_interpolate import signal_interpolate

def signal_period(
    peaks,
    sampling_rate=1000,
    desired_length=None,
    interpolation_method="monotone_cubic",
):
    """
    Compute periods between peaks in a signal.

    Parameters
    ----------
    peaks : array-like or binary array
        Indices of peaks in samples or binary signal marking peaks with 1s.
    sampling_rate : int
        Sampling rate of the signal in Hz.
    desired_length : int or None
        Number of samples for the output period vector. If None, returns
        a vector of the same length as `peaks`, with the first element NaN.
    interpolation_method : str
        Interpolation method for filling periods between peaks.

    Returns
    -------
    np.ndarray
        Array of period values in seconds.
    """
    peaks = np.asarray(peaks)
    # If binary signal provided, convert to indices
    if peaks.dtype != int and set(np.unique(peaks)).issubset({0, 1}):
        peaks = np.where(peaks)[0]
    # Need at least two peaks to compute a period
    if len(peaks) < 2:
        if desired_length is None:
            return np.array([])
        return np.full(desired_length, np.nan)
    # Compute inter-peak intervals (in seconds)
    periods = np.diff(peaks) / sampling_rate
    positions = peaks[1:]
    if desired_length is None:
        # Prepend NaN to align with original peaks array length
        return np.concatenate([[np.nan], periods])
    # Interpolate period values over desired_length samples
    x_new = np.arange(desired_length)
    return signal_interpolate(positions, periods, x_new, method=interpolation_method)
