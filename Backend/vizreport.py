from fastapi import FastAPI, File, UploadFile
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

def generate_boxplot_html(df: pd.DataFrame) -> str:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return "<p>No numeric columns available for boxplot visualization.</p>"

    html_output = '<h3>Boxplots for Outlier Detection</h3>'
    for col in numeric_cols:
        plt.figure(figsize=(6, 4))
        sns.boxplot(x=df[col].dropna())
        plt.title(f'Boxplot for {col}')
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        plt.close()
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        html_output += f'<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;"></div>'

    return html_output

@app.post("/eda/combined")
async def combined_eda(file: UploadFile = File(...)):
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.write(await file.read())
    temp_file.close()

    ydata_html_path = temp_file.name + "_ydata.html"

    try:
        df = pd.read_csv(temp_file.name)

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
        except Exception as e:
            logging.error("YData Profiling failed:", exc_info=True)

        # Generate boxplots
        try:
            boxplot_html = generate_boxplot_html(df)
        except Exception as e:
            logging.error("Boxplot generation failed:", exc_info=True)
            boxplot_html = "<p>Boxplot generation failed.</p>"

        return JSONResponse(content={
            "ydata": cleaned_html,
            "boxplots": boxplot_html,
        })

    except Exception as e:
        logging.error("Combined EDA failed:", exc_info=True)
        return JSONResponse(content={"error": str(e)}, status_code=500)

    finally:
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)
        if os.path.exists(ydata_html_path):
            os.remove(ydata_html_path)