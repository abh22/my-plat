# -*- coding: utf-8 -*-
"""
Static import of custom_methods submodules for reliable loading.
"""
__all__ = [
    "signal_filter",
    "signal_interpolate",
    "signal_resample",
    "signal_rate",
    "signal_period",
    "signal_formatpeaks",
    "rsp_findpeaks",
    "rsp_fixpeaks",
    "rsp_peaks",
]

from .signal_filter import signal_filter
from .signal_interpolate import signal_interpolate
from .signal_resample import signal_resample
from .signal_rate import signal_rate
from .signal_period import signal_period
from .signal_formatpeaks import signal_formatpeaks
from .rsp_findpeaks import rsp_findpeaks
from .rsp_fixpeaks import rsp_fixpeaks
from .rsp_peaks import rsp_peaks
