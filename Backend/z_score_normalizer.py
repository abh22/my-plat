# Basic Z-Score Normalization Method
# This method normalizes numeric columns using z-score (standard scaling)

import pandas as pd
import numpy as np

def process_data(df, params):
    """
    Performs z-score normalization on numeric columns.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe to process
    params : dict
        Optional parameters:
        - columns: list of specific columns to normalize (default: all numeric)
        - suffix: string to append to normalized column names (default: '_norm')
        - inplace: whether to replace original columns or create new ones (default: False)
    
    Returns:
    --------
    pandas.DataFrame
        The processed dataframe with normalized columns
    """
    # Make a copy to avoid modifying the original
    result = df.copy()
    
    # Get parameters with defaults
    columns = params.get('columns', None)
    suffix = params.get('suffix', '_norm')
    inplace = params.get('inplace', False)
    
    # If no columns specified, use all numeric columns
    if columns is None:
        columns = result.select_dtypes(include=[np.number]).columns.tolist()
    else:
        # Filter to only include columns that exist and are numeric
        numeric_cols = result.select_dtypes(include=[np.number]).columns.tolist()
        columns = [col for col in columns if col in numeric_cols]
    
    # Normalize each column
    for col in columns:
        # Calculate mean and std
        mean_val = result[col].mean()
        std_val = result[col].std()
        
        if std_val > 0:  # Avoid division by zero
            # Create normalized values
            normalized = (result[col] - mean_val) / std_val
            
            # Either replace original or create new column
            if inplace:
                result[col] = normalized
            else:
                result[f"{col}{suffix}"] = normalized
    
    # Return the processed dataframe
    return result
