from fastapi import FastAPI, File, UploadFile, Form, Body, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ydata_profiling import ProfileReport
from ydata_profiling.config import Settings
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import tempfile
import os
import logging
import traceback
import warnings
import numpy as np
import json
import shutil
from io import BytesIO
import base64
from scipy.signal import welch, hilbert
from pydantic import BaseModel
from typing import List, Optional, Union

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model for viz endpoints
class VizPayload(BaseModel):
    data: List  # list of dict rows
    channels: Optional[List[str]] = None
    # legacy single channel support
    channel: Optional[Union[str, List[str]]] = None
    # sampling rate (Hz) for time/frequency axes
    fs: Optional[float] = None

def generate_profile(df: pd.DataFrame) -> ProfileReport:
    config = Settings(
        title="Comprehensive Data Analysis",
        variables={
            "num": {"boxplot": True},
            "cat": {
                "frequency": True,
                "stats": {"top_value_count": 5},
                "pie": True,
                "wordcloud": False,  
                "words": False  
            },
            "text": {
                "wordcloud": False,  
                "word_counts": False,  
                "word_frequencies": False,  
                "length": True,  
                "characters": True  
            }
        },
        missing_diagrams={
            "bar": False,        # disable bar missing diagram or set True if desired
            "matrix": False,     # disable missing values matrix diagram
            "heatmap": False,    # disable missing values heatmap diagram
            "words": False,
            "wordcloud": False,
        },
        html={
            "navbar_show": False,
            "style": {"theme": None}
        },
        interactions={"continuous": False}  # Set as a dictionary instead of boolean
    )
    return ProfileReport(df, config=config)

@app.post("/eda/combined")
async def combined_eda(file: UploadFile = File(...)):
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.write(await file.read())
    temp_file.close()

    ydata_html_path = temp_file.name + "_ydata.html"

    try:
        df = pd.read_csv(temp_file.name)
        # Rename columns to generic channel names
        df.columns = [f"ch{i+1}" for i in range(df.shape[1])]

        if df.empty:
            return JSONResponse(content={"error": "Uploaded CSV is empty"}, status_code=400)

        # Initialize cleaned_html with a default value
        cleaned_html = "<p>YData report generation failed.</p>"

        # Generate YData Profiling report
        try:
            profile = generate_profile(df)
            profile.to_file(ydata_html_path)
            # Post-process the HTML to hide navbar and footer
            with open(ydata_html_path, "r", encoding="utf-8") as f:
                html = f.read()

            html = html.replace(
                "</head>",
                """
                <style>
                    .navbar, .footer, footer {
                        display: none !important;
                    }
                    body {
                        padding-top: 0 !important;
                    }
                    /* Remove all YData mentions */
                    *[class*="ydata"], *[id*="ydata"] {
                        display: none !important;
                    }
                    /* Hide any elements containing "YData" text */
                    .watermark, .small-info, .footer-text {
                        display: none !important;
                    }
                </style>
                </head>
                """
            )
            
            # Remove common YData text references
            html = html.replace("Powered by YData", "")
            html = html.replace("Brought to you by YData", "")
            html = html.replace("YData Profiling", "Data Profiling")

            with open(ydata_html_path, "w", encoding="utf-8") as f:
                f.write(html)
            with open(ydata_html_path, "r", encoding="utf-8") as f1:
                ydata_html = f1.read()
                cleaned_html = ydata_html.replace("Powered by YData", "")  # Remove watermark text
            # Return profiling HTML and an empty boxplots placeholder
            return JSONResponse(content={"ydata": cleaned_html}, status_code=200)
        except Exception as e:
            logging.error("YData Profiling failed:", exc_info=True)

       

    except Exception as e:
        logging.error("Combined EDA failed:", exc_info=True)
        return JSONResponse(content={"error": str(e)}, status_code=500)

    finally:
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)
        if os.path.exists(ydata_html_path):
            os.remove(ydata_html_path)

@app.post("/channels")
async def viz_channels(
    data: dict = Body(...)
):
    import pandas as pd
    df = pd.DataFrame(data)
    # Rename all columns to generic channel names
    df.columns = [f"ch{i+1}" for i in range(df.shape[1])]
    return {"channels": df.columns.tolist()}

@app.post("/Timeseries")
async def viz_timeseries(
    payload: VizPayload = Body(...)
):
    import pandas as pd
    from io import BytesIO
    import matplotlib.pyplot as plt
    import base64
    df = pd.DataFrame(payload.data)
    # resolve channels
    chs = payload.channels if payload.channels is not None else (
        [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
    )
    # sampling rate
    fs = payload.fs or 1.0
    images = {}
    for ch in chs:
        if ch not in df.columns:
            images[ch] = None
            continue
        data = df[ch].values
        t = np.arange(len(data)) / fs
        plt.figure(figsize=(8, 3))
        plt.plot(t, data)
        plt.title(f"Time Series - {ch}")
        plt.xlabel("Time (s)")
        plt.ylabel(f"{ch}")
        buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
        images[ch] = base64.b64encode(buf.read()).decode('utf-8')
    return {"images": images}

@app.post("/Spectrogram")
async def viz_spectrogram(
    payload: VizPayload = Body(...)
):
     import pandas as pd
     from io import BytesIO
     import matplotlib.pyplot as plt
     import base64
     df = pd.DataFrame(payload.data)
     # resolve channels and sampling rate
     chs = payload.channels if payload.channels is not None else (
         [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
     )
     fs = payload.fs or 1.0
     images = {}
     for ch in chs:
         if ch not in df.columns:
             images[ch] = None
             continue
         data = df[ch].dropna().values
         plt.figure(figsize=(8, 3))
         plt.specgram(data, NFFT=256, Fs=fs)
         plt.title(f"Spectrogram - {ch}")
         plt.xlabel("Time (s)")
         plt.ylabel("Frequency (Hz)")
         buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
         images[ch] = base64.b64encode(buf.read()).decode('utf-8')
     return {"images": images}

@app.post("/PSD")
async def viz_psd(
    payload: VizPayload = Body(...)
):
     import pandas as pd
     from io import BytesIO
     import matplotlib.pyplot as plt
     import base64
     df = pd.DataFrame(payload.data)
     # resolve channels and sampling rate
     chs = payload.channels if payload.channels is not None else (
         [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
     )
     fs = payload.fs or 1.0
     images = {}
     for ch in chs:
         if ch not in df.columns:
             images[ch] = None
             continue
         data = df[ch].dropna().values
         f, Pxx = welch(data, fs=fs)
         plt.figure(figsize=(8, 3))
         plt.semilogy(f, Pxx)
         plt.title(f"PSD - {ch}")
         plt.xlabel("Frequency (Hz)")
         plt.ylabel("Power Spectral Density")
         buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
         images[ch] = base64.b64encode(buf.read()).decode('utf-8')
     return {"images": images}

@app.post("/Boxplot")
async def viz_boxplot(
    payload: VizPayload = Body(...)
):
    import pandas as pd
    from io import BytesIO
    import matplotlib.pyplot as plt
    import seaborn as sns
    import base64
    df = pd.DataFrame(payload.data)
    # resolve channels list
    chs = payload.channels if payload.channels is not None else (
        [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
    )
    images = {}
    for ch in chs:
        if ch not in df.columns:
            images[ch] = None
            continue
        data = df[ch].dropna().values
        plt.figure(figsize=(6, 4))
        sns.boxplot(x=data)
        plt.title(f"Boxplot - {ch}")
        # Create buffer and save figure
        buf = BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        images[ch] = base64.b64encode(buf.read()).decode('utf-8')
    return {"images": images}

@app.post("/Autocorrelation")
async def viz_autocorrelation(
    payload: VizPayload = Body(...)
):
    import pandas as pd
    import numpy as np
    from io import BytesIO
    import matplotlib.pyplot as plt
    import base64
    df = pd.DataFrame(payload.data)
    # resolve channels
    chs = payload.channels if payload.channels is not None else (
        [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
    )
    images = {}
    for ch in chs:
        if ch not in df.columns:
            images[ch] = None
            continue
        data = df[ch].dropna().values
        # zero-mean
        data = data - np.mean(data)
        corr = np.correlate(data, data, mode='full')
        lags = np.arange(-len(data)+1, len(data))
        plt.figure(figsize=(8, 3))
        plt.plot(lags, corr)
        plt.title(f"Autocorrelation - {ch}")
        plt.xlabel("Lag")
        plt.ylabel("Correlation")
        buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
        images[ch] = base64.b64encode(buf.read()).decode('utf-8')
    return {"images": images}

@app.post("/Envelope")
async def viz_envelope(
    payload: VizPayload = Body(...)
):
    import pandas as pd
    import numpy as np
    from scipy.signal import hilbert
    from io import BytesIO
    import matplotlib.pyplot as plt
    import base64
    df = pd.DataFrame(payload.data)
    # resolve channels and sampling rate
    chs = payload.channels if payload.channels is not None else (
        [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
    )
    fs = payload.fs or 1.0
    images = {}
    for ch in chs:
        if ch not in df.columns:
            images[ch] = None
            continue
        signal = df[ch].dropna().values
        analytic = hilbert(signal)
        envelope = np.abs(analytic)
        t = np.arange(len(signal)) / fs
        plt.figure(figsize=(8, 3))
        plt.plot(t, signal, alpha=0.6, label='Signal')
        plt.plot(t, envelope, color='r', label='Envelope')
        plt.title(f"Envelope - {ch}")
        plt.xlabel("Time (s)")
        plt.legend()
        buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
        images[ch] = base64.b64encode(buf.read()).decode('utf-8')
    return {"images": images}

@app.post("/Poincare")
async def viz_poincare(
    payload: VizPayload = Body(...)
):
    import pandas as pd
    import numpy as np
    from io import BytesIO
    import matplotlib.pyplot as plt
    import base64
    df = pd.DataFrame(payload.data)
    # resolve channels
    chs = payload.channels if payload.channels is not None else (
        [payload.channel] if isinstance(payload.channel, str) else (payload.channel or [])
    )
    images = {}
    for ch in chs:
        if ch not in df.columns:
            images[ch] = None
            continue
        data = df[ch].dropna().values
        x = data[:-1]
        y = data[1:]
        plt.figure(figsize=(6, 6))
        plt.scatter(x, y, s=2)
        plt.title(f"Poincare Plot - {ch}")
        plt.xlabel(f"{ch}[n]")
        plt.ylabel(f"{ch}[n+1]")
        buf = BytesIO(); plt.tight_layout(); plt.savefig(buf, format='png'); plt.close(); buf.seek(0)
        images[ch] = base64.b64encode(buf.read()).decode('utf-8')
    return {"images": images}

# Unified viz dispatcher
@app.post("/viz")
async def viz_dispatch(
    type: str = Query(..., description="Visualization type, e.g. timeseries, spectrogram, psd, boxplot, autocorrelation, envelope, poincare"),
    payload: VizPayload = Body(...)
):
    t = type.lower()
    if t == "timeseries":
        return await viz_timeseries(payload)
    if t == "spectrogram":
        return await viz_spectrogram(payload)
    if t == "psd":
        return await viz_psd(payload)
    if t == "boxplot":
        return await viz_boxplot(payload)
    if t == "autocorrelation":
        return await viz_autocorrelation(payload)
    if t == "envelope":
        return await viz_envelope(payload)
    if t == "poincare":
        return await viz_poincare(payload)
    return JSONResponse({"error": f"Unsupported viz type '{type}'"}, status_code=400)