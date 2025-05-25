from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for custom methods
CUSTOM_METHOD_DIR = "./custom_methods/"

@app.get("/get-method-params/{method_name}")
async def get_method_params(method_name: str):
    """Get parameters for a specific method"""
    
    # Ensure method name has .py extension
    if not method_name.endswith('.py'):
        method_name = f"{method_name}.py"
    
    metadata_path = os.path.join(CUSTOM_METHOD_DIR, method_name.replace('.py', '_metadata.json'))
    
    print(f"Looking for metadata file: {metadata_path}")
    
    if not os.path.exists(metadata_path):
        print(f"Metadata file not found: {metadata_path}")
        return {"parameters": []}
    
    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
            params = metadata.get("parameters", [])
            print(f"Loaded parameters for {method_name}: {params}")
            return {"parameters": params}
    except Exception as e:
        print(f"Error reading metadata for {method_name}: {str(e)}")
        return {"error": f"Failed to read metadata: {str(e)}"}
