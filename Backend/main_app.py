from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import json

# Import the routers
import method_handler
import preprocess

# Create the main FastAPI app
app = FastAPI(title="Breath Analysis Platform API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(method_handler.router)

# Define custom method directory
CUSTOM_METHOD_DIR = "./custom_methods/"

# Create the directory for custom methods if it doesn't exist
import os
os.makedirs(method_handler.CUSTOM_METHOD_DIR, exist_ok=True)

# Routes from preprocess.py
# Note: We're not importing the app from preprocess.py as that would create a new FastAPI instance
# Instead, we're copying the routes here
@app.post("/preprocess")
async def preprocess_endpoint(file=preprocess.File(...), config=preprocess.Form(...)):
    return await preprocess.preprocess(file, config)

# Add startup event to initialize
@app.on_event("startup")
async def startup_event():
    print(f"API server started. Custom methods directory: {method_handler.CUSTOM_METHOD_DIR}")
    # Count existing methods
    if os.path.exists(method_handler.CUSTOM_METHOD_DIR):
        method_files = [f for f in os.listdir(method_handler.CUSTOM_METHOD_DIR) if f.endswith('.py')]
        print(f"Found {len(method_files)} existing custom methods")
