# Band-Pass Filter Preprocessing Method
# This method applies a band-pass filter to signal data to isolate a frequency band
# Compatible with the Breath Analysis Platform.

import pandas as pd
import numpy as np
from scipy import signal

def process_data(df, params):
    """
    Apply a band-pass filter to numeric columns in the dataframe.

    This method uses a Butterworth band-pass filter to keep frequencies
    within a specified range, useful for isolating physiological signal bands.

    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe containing signal data to filter
    params : dict
        Filter parameters:
        - 'low_cutoff': float, lower cutoff frequency in Hz (default: 0.5)
        - 'high_cutoff': float, upper cutoff frequency in Hz (default: 10.0)
        - 'sampling_rate': float, sampling rate in Hz (default: 100.0)
        - 'filter_order': int, filter order (default: 4)
        - 'filter_type': str, filter type 'butter', 'cheby1', 'cheby2', 'ellip' (default: 'butter')
        - 'columns': list, specific columns to filter (default: all numeric columns)
        - 'add_suffix': bool, whether to add '_band_pass' suffix to new columns (default: True)

    Returns:
    --------
    pandas.DataFrame
        The dataframe with filtered signal columns
    """
    result = df.copy()
    low_cutoff = params.get('low_cutoff', 0.5)
    high_cutoff = params.get('high_cutoff', 10.0)
    sampling_rate = params.get('sampling_rate', 100.0)
    filter_order = params.get('filter_order', 4)
    filter_type = params.get('filter_type', 'butter')
    target_columns = params.get('columns', None)
    add_suffix = params.get('add_suffix', True)

    # Parameter validation
    if low_cutoff <= 0 or high_cutoff <= 0:
        raise ValueError("Cutoff frequencies must be positive")
    nyquist = sampling_rate / 2
    if low_cutoff >= nyquist or high_cutoff >= nyquist:
        raise ValueError("Cutoff frequencies must be less than Nyquist frequency (sampling_rate/2)")
    if low_cutoff >= high_cutoff:
        raise ValueError("Low cutoff must be less than high cutoff")
    if filter_order <= 0:
        raise ValueError("Filter order must be positive")

    # Determine numeric columns
    if target_columns is None:
        numeric_cols = result.select_dtypes(include=[np.number]).columns.tolist()
    else:
        numeric_cols = [col for col in target_columns if col in result.columns and pd.api.types.is_numeric_dtype(result[col])]

    if not numeric_cols:
        return result

    normalized = [low_cutoff/(sampling_rate/2), high_cutoff/(sampling_rate/2)]
    # Design filter
    if filter_type.lower() == 'butter':
        b, a = signal.butter(filter_order, normalized, btype='band', analog=False)
    elif filter_type.lower() == 'cheby1':
        rp = params.get('ripple', 1)
        b, a = signal.cheby1(filter_order, rp, normalized, btype='band', analog=False)
    elif filter_type.lower() == 'cheby2':
        rs = params.get('stopband_attenuation', 40)
        b, a = signal.cheby2(filter_order, rs, normalized, btype='band', analog=False)
    elif filter_type.lower() == 'ellip':
        rp = params.get('ripple', 1)
        rs = params.get('stopband_attenuation', 40)
        b, a = signal.ellip(filter_order, rp, rs, normalized, btype='band', analog=False)
    else:
        b, a = signal.butter(filter_order, normalized, btype='band', analog=False)

    for col in numeric_cols:
        data = result[col].values
        try:
            filtered = signal.filtfilt(b, a, data)
        except ValueError:
            continue
        new_name = f"{col}_band_pass" if add_suffix else col
        result[new_name] = filtered

    # Attach metadata
    info = {
        'low_cutoff_hz': low_cutoff,
        'high_cutoff_hz': high_cutoff,
        'sampling_rate_hz': sampling_rate,
        'filter_order': filter_order,
        'filter_type': filter_type,
        'filtered_columns': numeric_cols
    }
    if hasattr(result, 'attrs'):
        result.attrs['bandpass_filter_info'] = info

    return result
