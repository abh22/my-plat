from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import os
import importlib.util
import inspect
import sys
import ast
import io
import pandas as pd
from typing import List, Dict, Any, Callable, Optional
import json

# Directory for custom methods located inside Backend/custom_methods
CUSTOM_METHOD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "custom_methods"))

# Ensure the custom methods directory exists
os.makedirs(CUSTOM_METHOD_DIR, exist_ok=True)

# Create a router for method handling
from fastapi import APIRouter
router = APIRouter()

# Define what a valid method should look like
REQUIRED_FUNCTION = "process_data"
REQUIRED_PARAMS = ["df", "params"]

class MethodValidator:
    """Validates custom method Python files"""
    
    @staticmethod
    def validate_syntax(content: str) -> bool:
        """Check if the Python code has valid syntax"""
        try:
            ast.parse(content)
            return True
        except SyntaxError:
            return False
    
    @staticmethod
    def has_required_function(content: str) -> bool:
        """Check if the module has the required process_data function"""
        try:
            parsed = ast.parse(content)
            for node in ast.walk(parsed):
                if isinstance(node, ast.FunctionDef) and node.name == REQUIRED_FUNCTION:
                    # Check if the function has the required parameters
                    params = [param.arg for param in node.args.args]
                    return all(param in params for param in REQUIRED_PARAMS)
            return False
        except Exception:
            return False
    
    @staticmethod
    def check_for_unsafe_imports(content: str) -> List[str]:
        """Check for potentially unsafe imports"""
        unsafe_modules = [
            "os", "subprocess", "sys", "shutil", "importlib",
            "popen", "eval", "exec", "compile", "__import__"
        ]
        
        try:
            parsed = ast.parse(content)
            unsafe_found = []
            
            # Check import statements
            for node in ast.walk(parsed):
                if isinstance(node, ast.Import):
                    for name in node.names:
                        if any(unsafe in name.name.lower() for unsafe in unsafe_modules):
                            unsafe_found.append(name.name)
                
                elif isinstance(node, ast.ImportFrom):
                    if any(unsafe in node.module.lower() for unsafe in unsafe_modules):
                        unsafe_found.append(node.module)
                    
                # Check for potentially dangerous calls
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name) and node.func.id in ["eval", "exec"]:
                        unsafe_found.append(node.func.id)
                        
            return unsafe_found
        except Exception:
            return ["Could not parse code to check imports"]    @staticmethod
    def validate_method_file(content: bytes) -> Dict[str, Any]:
        """Validate a method file"""
        import logging
        
        try:
            content_str = content.decode('utf-8')
            logging.debug("File content decoded successfully")
            
            # Perform validation checks
            logging.debug("Checking Python syntax...")
            valid_syntax = MethodValidator.validate_syntax(content_str)
            if not valid_syntax:
                logging.error("Syntax validation failed")
                return {
                    "valid": False,
                    "error": "The uploaded file contains invalid Python syntax."
                }
            
            logging.debug("Checking for required function...")
            has_function = MethodValidator.has_required_function(content_str)
            if not has_function:
                logging.error(f"Missing required function: {REQUIRED_FUNCTION}")
                return {
                    "valid": False,
                    "error": f"The uploaded file must contain a '{REQUIRED_FUNCTION}' function with parameters {REQUIRED_PARAMS}."
                }
            
            logging.debug("Checking for unsafe imports...")
            unsafe_imports = MethodValidator.check_for_unsafe_imports(content_str)
            if unsafe_imports:
                logging.error(f"Detected unsafe imports: {unsafe_imports}")
                return {
                    "valid": False,
                    "error": f"The uploaded file contains potentially unsafe imports or functions: {', '.join(unsafe_imports)}"
                }
            
            # All checks passed
            logging.debug("All validation checks passed")
            return {
                "valid": True,
                "message": "Method file is valid."
            }
        except Exception as e:
            logging.exception(f"Unexpected error during validation: {str(e)}")
            return {
                "valid": False,
                "error": f"Validation error: {str(e)}"
            }

class MethodLoader:
    """Handles loading and executing custom methods"""
    
    @staticmethod
    def load_method(file_path: str) -> Optional[Callable]:
        """Load a method from a file path"""
        try:
            # Generate a unique module name
            module_name = f"custom_method_{os.path.basename(file_path).replace('.', '_')}"
            
            # Create module spec and load the module
            spec = importlib.util.spec_from_file_location(module_name, file_path)
            if spec is None:
                return None
                
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            
            # Get the process_data function
            if hasattr(module, REQUIRED_FUNCTION):
                return getattr(module, REQUIRED_FUNCTION)
            return None
        except Exception:
            return None

    @staticmethod
    def test_method(method_func: Callable, test_size: int = 10) -> Dict[str, Any]:
        """Test a method with a small DataFrame"""
        try:
            # Create a simple test DataFrame
            df = pd.DataFrame({
                'numeric': range(test_size),
                'category': [f'cat_{i % 3}' for i in range(test_size)],
                'binary': [i % 2 for i in range(test_size)]
            })
            
            # Test params
            params = {"test": True, "sample_param": "value"}
            
            # Run the method
            result = method_func(df, params)
            
            # Check if result is a DataFrame
            if not isinstance(result, pd.DataFrame):
                return {
                    "success": False, 
                    "error": f"Method must return a DataFrame, got {type(result).__name__}"
                }
                
            return {"success": True, "message": "Method tested successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}

@router.post("/upload-method/")
async def upload_method(
    method_file: UploadFile = File(...),
    method_name: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
):
    """Upload a custom preprocessing method"""
    import logging
    logging.basicConfig(level=logging.DEBUG, 
                        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                        handlers=[logging.StreamHandler()])
    
    # Log the request details
    logging.info(f"Received method upload request: {method_name}, {category}, file: {method_file.filename}")
    
    # Check if file is a Python file
    if not method_file.filename.endswith('.py'):
        error_msg = "Only Python (.py) files are allowed"
        logging.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    
    try:
        # Read file content
        content = await method_file.read()
        logging.debug(f"File content read successfully, size: {len(content)} bytes")
        
        # Validate the method file
        logging.debug("Starting method validation...")
        validation_result = MethodValidator.validate_method_file(content)
        logging.debug(f"Validation result: {validation_result}")
        
        if not validation_result["valid"]:
            logging.error(f"Validation failed: {validation_result['error']}")
            raise HTTPException(status_code=400, detail=validation_result["error"])
    except Exception as e:
        logging.exception(f"Error during method upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
    # Create a sanitized filename
    safe_filename = method_name.replace(" ", "_").lower() + ".py"
    file_path = os.path.join(CUSTOM_METHOD_DIR, safe_filename)
    
    # Check if a method with this name already exists
    if os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"A method named '{method_name}' already exists")
    
    # Save the file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Test the method
    method_func = MethodLoader.load_method(file_path)
    if method_func is None:
        # If loading fails, remove the file and return an error
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Failed to load the method")
    
    test_result = MethodLoader.test_method(method_func)
    if not test_result["success"]:
        # If testing fails, remove the file and return an error
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Method testing failed: {test_result['error']}")
      # Save method metadata to a metadata file
    method_info = {
        "name": method_name,
        "filename": safe_filename,
        "description": description,
        "category": category,
        "created": str(pd.Timestamp.now())
    }
    
    # Save metadata to a JSON file alongside the Python file
    metadata_path = file_path.replace('.py', '_metadata.json')
    with open(metadata_path, 'w') as f:
        import json
        json.dump(method_info, f, indent=2)
    
    # Return success response
    return JSONResponse(
        status_code=201,
        content={
            "message": "Method uploaded and validated successfully",
            "method_info": method_info
        }
    )

@router.get("/list-methods")
def list_methods():
    """List all registered custom methods"""
    methods = []
    try:
        for filename in os.listdir(CUSTOM_METHOD_DIR):
            if filename.endswith('_metadata.json'):
                meta_path = os.path.join(CUSTOM_METHOD_DIR, filename)
                try:
                    with open(meta_path, 'r') as f:
                        meta = json.load(f)
                    # Ensure required fields
                    methods.append({
                        # Use 'name' from metadata JSON
                        'name': meta.get('name'),
                        'filename': meta.get('filename'),
                        'description': meta.get('description', ''),
                        'category': meta.get('category', ''),
                    })
                except Exception:
                    continue
    except Exception:
        pass
    return {'methods': methods}

# Example of a simple method template that users could download as a starting point
@router.get("/method-template/")
async def get_method_template():
    """Get a template for creating custom methods"""
    template = '''# Custom Preprocessing Method Template
# This template shows how to create a custom preprocessing method
# for the Breath Analysis Platform.

import pandas as pd
import numpy as np

def process_data(df, params):
    """
    Process a dataframe according to custom logic.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe to process
    params : dict
        Additional parameters for customizing the processing
    
    Returns:
    --------
    pandas.DataFrame
        The processed dataframe
    """
    # Make a copy to avoid modifying the original
    result = df.copy()
    
    # Example: Add a new calculated column
    if 'sample_parameter' in params:
        scale_factor = params.get('scale_factor', 1.0)
        
        # Only apply to numeric columns
        numeric_cols = result.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            result[f"{col}_scaled"] = result[col] * scale_factor
    
    # Return the processed dataframe    return result
'''
    return JSONResponse(
        content={"template": template}
        )
