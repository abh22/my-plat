# Low-Pass Filter Preprocessing Method
# This method applies a low-pass filter to signal data to remove high-frequency noise
# Compatible with the Breath Analysis Platform.

import pandas as pd
import numpy as np
from scipy import signal

def process_data(df, params):
    """
    Apply a low-pass filter to numeric columns in the dataframe.
    
    This method uses a Butterworth low-pass filter to remove high-frequency
    components from signal data, which is useful for noise reduction in
    sensor readings, breath analysis signals, and other time-series data.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe containing signal data to filter
    params : dict
        Filter parameters:
        - 'cutoff_freq': float, cutoff frequency in Hz (default: 10.0)
        - 'sampling_rate': float, sampling rate in Hz (default: 100.0)
        - 'filter_order': int, filter order (default: 4)
        - 'filter_type': str, filter type 'butter', 'cheby1', 'cheby2', 'ellip' (default: 'butter')
        - 'columns': list, specific columns to filter (default: all numeric columns)
        - 'add_suffix': bool, whether to add '_filtered' suffix to new columns (default: True)
    
    Returns:
    --------
    pandas.DataFrame
        The dataframe with filtered signal columns
    """
    # Make a copy to avoid modifying the original
    result = df.copy()
    
    # Extract parameters with defaults
    cutoff_freq = params.get('cutoff_freq', 10.0)
    sampling_rate = params.get('sampling_rate', 100.0)
    filter_order = params.get('filter_order', 4)
    filter_type = params.get('filter_type', 'butter')
    target_columns = params.get('columns', None)
    add_suffix = params.get('add_suffix', True)
    
    # Validate parameters
    if cutoff_freq <= 0:
        raise ValueError("Cutoff frequency must be positive")
    if sampling_rate <= 0:
        raise ValueError("Sampling rate must be positive")
    if cutoff_freq >= sampling_rate / 2:
        raise ValueError("Cutoff frequency must be less than Nyquist frequency (sampling_rate/2)")
    if filter_order <= 0:
        raise ValueError("Filter order must be positive")
    
    # Determine which columns to process
    if target_columns is None:
        # Process all numeric columns
        numeric_cols = result.select_dtypes(include=[np.number]).columns.tolist()
    else:
        # Process specified columns, but verify they exist and are numeric
        numeric_cols = []
        for col in target_columns:
            if col in result.columns:
                if pd.api.types.is_numeric_dtype(result[col]):
                    numeric_cols.append(col)
                else:
                    print(f"Warning: Column '{col}' is not numeric and will be skipped")
            else:
                print(f"Warning: Column '{col}' not found in dataframe")
    
    if len(numeric_cols) == 0:
        print("Warning: No numeric columns found to filter")
        return result
    
    # Calculate normalized cutoff frequency (0 to 1, where 1 is Nyquist frequency)
    nyquist = sampling_rate / 2
    normalized_cutoff = cutoff_freq / nyquist
    
    try:
        # Design the filter based on filter type
        if filter_type.lower() == 'butter':
            b, a = signal.butter(filter_order, normalized_cutoff, btype='low', analog=False)
        elif filter_type.lower() == 'cheby1':
            # Chebyshev Type I filter (ripple in passband)
            rp = params.get('ripple', 1)  # passband ripple in dB
            b, a = signal.cheby1(filter_order, rp, normalized_cutoff, btype='low', analog=False)
        elif filter_type.lower() == 'cheby2':
            # Chebyshev Type II filter (ripple in stopband)
            rs = params.get('stopband_attenuation', 40)  # stopband attenuation in dB
            b, a = signal.cheby2(filter_order, rs, normalized_cutoff, btype='low', analog=False)
        elif filter_type.lower() == 'ellip':
            # Elliptic filter (ripple in both passband and stopband)
            rp = params.get('ripple', 1)  # passband ripple in dB
            rs = params.get('stopband_attenuation', 40)  # stopband attenuation in dB
            b, a = signal.ellip(filter_order, rp, rs, normalized_cutoff, btype='low', analog=False)
        else:
            print(f"Warning: Unknown filter type '{filter_type}', using Butterworth")
            b, a = signal.butter(filter_order, normalized_cutoff, btype='low', analog=False)
        
        # Apply filter to each numeric column
        for col in numeric_cols:
            # Get the signal data
            signal_data = result[col].values
            
            # Handle NaN values
            if np.any(np.isnan(signal_data)):
                # Create a mask for non-NaN values
                valid_mask = ~np.isnan(signal_data)
                if np.sum(valid_mask) < filter_order * 3:
                    print(f"Warning: Column '{col}' has too many NaN values for reliable filtering")
                    continue
                
                # Apply filter only to valid data
                valid_data = signal_data[valid_mask]
                filtered_valid = signal.filtfilt(b, a, valid_data)
                
                # Create filtered signal with NaN values preserved
                filtered_signal = np.full_like(signal_data, np.nan)
                filtered_signal[valid_mask] = filtered_valid
            else:
                # Apply filter to the entire signal
                if len(signal_data) < filter_order * 3:
                    print(f"Warning: Column '{col}' has insufficient data points for reliable filtering")
                    continue
                filtered_signal = signal.filtfilt(b, a, signal_data)
            
            # Store the filtered signal
            if add_suffix:
                new_col_name = f"{col}_filtered"
            else:
                new_col_name = col
            
            result[new_col_name] = filtered_signal
        
        # Add metadata about the filtering operation
        filter_info = {
            'cutoff_frequency_hz': cutoff_freq,
            'sampling_rate_hz': sampling_rate,
            'filter_order': filter_order,
            'filter_type': filter_type,
            'filtered_columns': numeric_cols
        }
        
        # Store filter info as an attribute (if the dataframe supports it)
        if hasattr(result, 'attrs'):
            result.attrs['lowpass_filter_info'] = filter_info
            
        print(f"Applied {filter_type} low-pass filter (fc={cutoff_freq}Hz, fs={sampling_rate}Hz, order={filter_order}) to {len(numeric_cols)} columns")
        
    except Exception as e:
        print(f"Error applying low-pass filter: {str(e)}")
        raise
    
    return result