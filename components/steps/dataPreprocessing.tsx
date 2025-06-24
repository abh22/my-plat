import React, { useState, useEffect, useMemo } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import CustomMethodParams from "@/components/custom-method-params"


// Define interface for custom methods
interface CustomMethod {
  name: string;
  filename: string;
  description: string;
  category: string;
}

// Add type declaration for window._dataChunks
declare global {
  interface Window {
    _dataChunks?: any[][];
  }
}

export default function DataPreprocessing({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [selectedOperations, setSelectedOperations] = useState<string[]>([])
  const [missingValues, setMissingValues] = useState("mean")
  const [normalizationMethod, setNormalizationMethod] = useState("minmax")
  const [outlierThreshold, setOutlierThreshold] = useState("1.5")
  const [encodingMethods, setEncodingMethods] = useState<string[]>([]) // Changed to array
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [visualizationData, setVisualizationData] = useState<any>(null)
  const dataSummary = visualizationData?.dataSummary || {}
  const [columns, setColumns] = useState<string[]>(dataSummary.columns || []);

  // State and filter for column selection
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [columnFilter, setColumnFilter] = useState("")
  const filteredColumns = useMemo(
    () => columns.filter((col: string) => col.toLowerCase().includes(columnFilter.toLowerCase())),
    [columns, columnFilter]
  )

  const [processedData, setProcessedData] = useState<any>(null)
  const [featureNameMapping, setFeatureNameMapping] = useState<any>(null)
  const [encodingDetails, setEncodingDetails] = useState<any>(null)

  // Raw data rows for 'Before' plot
  const [rawRows, setRawRows] = useState<any[]>([])
  // Parsing state
  const [isParsing, setIsParsing] = useState(true)
  // Time-series preview state
  // const [previewData, setPreviewData] = useState<any[]>({});

  // Time series comparison images
  const [beforeSeriesImages, setBeforeSeriesImages] = useState<Record<string, string>>({});
  const [afterSeriesImages, setAfterSeriesImages] = useState<Record<string, string>>({});

  // Add custom methods state
  const [customMethods, setCustomMethods] = useState<CustomMethod[]>([])
  const [selectedCustomMethods, setSelectedCustomMethods] = useState<string[]>([])
  const [customMethodParams, setCustomMethodParams] = useState<Record<string, Record<string, any>>>({})

  useEffect(() => {
    // Always use data from visualization (already parsed)
    const prev = data.visualization?.dataSummary?.dataFrame || [];
    if (prev.length > 0) {
      setRawRows(prev);
      setIsParsing(false);
      const cols = data.visualization?.dataSummary?.columns || [];
      if (cols.length > 0 && selectedColumns.length === 0) {
        setColumns(cols);
        setSelectedColumns(cols);
      }
    }
  }, [data.visualization]);

  // Raw imported or processed rows for 'Before' plot
  const beforeRows: any[] = rawRows

  // Fetch custom methods from the backend
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        console.log("Fetching custom methods from backend...");
        const response = await fetch("http://localhost:8000/list-methods/");
        if (!response.ok) {
          console.error("Failed to fetch custom methods:", response.statusText);
          return;
        }
        
        const data = await response.json();
        if (data.methods) {
          // Filter methods by category (preprocessing)
          const preprocessingMethods = data.methods.filter(
            (method: CustomMethod) => method.category === "preprocessing" || method.category === ""
          );
          setCustomMethods(preprocessingMethods);
          console.log("Fetched custom preprocessing methods:", preprocessingMethods);
        } else {
          console.log("No methods found in response:", data);
        }
      } catch (error) {
        console.error("Error fetching custom methods:", error);
      }
    };

    fetchCustomMethods();
  }, []);

  // Add effect to synchronize custom methods with operations
  useEffect(() => {
    setSelectedOperations(prev => {
      const hasCustom = prev.includes("custom");
      const wantsCustom = selectedCustomMethods.length > 0;

      if (hasCustom === wantsCustom) return prev; // No change
      if (wantsCustom) return [...prev, "custom"];
      return prev.filter(op => op !== "custom");
    });
  }, [selectedCustomMethods]);

  const handleOperationToggle = (operation: string) => {
    if (operation === "custom") return; // Prevent manual toggle

    const isCustomMethod = customMethods.some(method => method.filename === operation);
    if (isCustomMethod) {
      setSelectedCustomMethods(prev => 
        prev.includes(operation) ? prev.filter(m => m !== operation) : [...prev, operation]
      );
    } else {
      setSelectedOperations(prev => 
        prev.includes(operation) ? prev.filter(op => op !== operation) : [...prev, operation]
      );
    }
  }


  const handleColumnToggle = (column: string) => {
    setSelectedColumns((prev) => (prev.includes(column) ? prev.filter((col) => col !== column) : [...prev, column]))
  }

  // New function to handle encoding method selection
  const handleEncodingMethodToggle = (method: string) => {
    setEncodingMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  }
  const handleRun = async () => {
    // Clear previous message when running again
    setResultMessage(null)
    setMessageType(null)
    setIsLoading(true)
    // Clear previous series images
    setBeforeSeriesImages({})
    setAfterSeriesImages({})
    
    // Prioritize data passed from previous component over raw rows
    const visualizationDataFrame = data.visualization?.dataSummary?.dataFrame || [];
    const beforeRowsData = visualizationDataFrame.length > 0
      ? visualizationDataFrame
      : rawRows;
    
    console.log("Raw data available:", beforeRowsData.length > 0);
    console.log("Selected columns:", selectedColumns);
    
    if (beforeRowsData.length > 0 && selectedColumns.length > 0) {
      try {
        // Check the actual structure of the data
        console.log("Data structure - first row:", beforeRowsData[0]);
        console.log("Data object keys:", Object.keys(beforeRowsData[0]));
        
        // Convert all keys to lowercase for case-insensitive matching
        const lowercaseKeys = beforeRowsData.length > 0 ? 
          Object.keys(beforeRowsData[0]).map(k => k.toLowerCase()) : [];
        console.log("Available keys (lowercase):", lowercaseKeys);
          // Try to match selected columns with available columns (case-insensitive)
        const validColumns = selectedColumns.filter(col => {
          const colLower = col.toLowerCase();
          // Check if column exists directly or in lowercase form
          const exists = beforeRowsData.length > 0 && 
            (col in beforeRowsData[0] || lowercaseKeys.includes(colLower));
          
          if (!exists) {
            console.log(`Column "${col}" not found in data (checked lowercase: "${colLower}")`);
          }
          return exists;
        });
        
        // Map the valid column names to their actual case in the data
        const mappedColumns = validColumns.map(col => {
          const colLower = col.toLowerCase();
          if (beforeRowsData.length > 0 && col in beforeRowsData[0]) {
            console.log(`Column "${col}" found as exact match`);
            return col; // Exact match
          }
          // Find the actual key with matching lowercase
          const actualKey = Object.keys(beforeRowsData[0]).find(
            k => k.toLowerCase() === colLower
          );
          if (actualKey) {
            console.log(`Column "${col}" mapped to "${actualKey}" (case difference)`);
          }
          return actualKey || col;
        });
        
        console.log("Valid columns after case-insensitive matching:", mappedColumns);
          if (mappedColumns.length === 0) {
          console.warn("No valid columns found in the data for 'Before' plot");
          // Try with all available columns as a fallback
          if (beforeRowsData.length > 0) {
            const allColumns = Object.keys(beforeRowsData[0]);
            console.log("Trying with all available columns:", allColumns);
            
            // Instead of using all columns, let's still limit to selected columns if possible
            // Find any matching columns (partial match)
            const partialMatchColumns = selectedColumns.flatMap(selectedCol => {
              const matches = allColumns.filter(col => 
                col.toLowerCase().includes(selectedCol.toLowerCase()) || 
                selectedCol.toLowerCase().includes(col.toLowerCase())
              );
              return matches.length > 0 ? matches : [];
            });
            
            // Use partial matches if found, otherwise fall back to all columns but limit to first few
            const columnsToUse = partialMatchColumns.length > 0 ? 
              partialMatchColumns : 
              allColumns.slice(0, Math.min(5, allColumns.length)); // Limit to max 5 columns
            
            console.log("Using columns for 'Before' plot:", columnsToUse);
              const filteredRows = filterRowsByColumns(beforeRowsData, columnsToUse);
            const beforeImgs = await fetchTimeseries(filteredRows, selectedColumns);
            console.log("Before images response:", beforeImgs);
            setBeforeSeriesImages(beforeImgs?.images || {});
          }
        } else {          console.log("Using mapped columns for 'Before' plot:", mappedColumns);          const filteredRows = filterRowsByColumns(beforeRowsData, mappedColumns);
          console.log("Filtered rows sample:", filteredRows.slice(0, 2));
          
          // Add any selected columns that might be missing due to case or naming differences
          selectedColumns.forEach(selectedCol => {
            if (!mappedColumns.includes(selectedCol)) {
              // Look for potential matches in available columns (case insensitive)
              const potentialMatch = Object.keys(beforeRowsData[0]).find(
                key => key.toLowerCase() === selectedCol.toLowerCase() || 
                       key.toLowerCase().includes(selectedCol.toLowerCase()) ||
                       selectedCol.toLowerCase().includes(key.toLowerCase())
              );
              
              if (potentialMatch) {
                mappedColumns.push(potentialMatch);
                console.log(`Found match for "${selectedCol}": "${potentialMatch}"`);
                // Update filtered rows with the matched data
                filteredRows.forEach((row, i) => {
                  row[selectedCol] = beforeRowsData[i][potentialMatch]; // Use selectedCol as the key, not potentialMatch
                });
              }
            }
          });
          
          console.log("Final mapped columns for 'Before' plot:", mappedColumns);
          const beforeImgs = await fetchTimeseries(filteredRows, selectedColumns);
          console.log("Before images response:", beforeImgs);
          console.log("Before images keys:", Object.keys(beforeImgs?.images || {}));
          setBeforeSeriesImages(beforeImgs?.images || {});
        }      } catch (error) {
        console.error("Error fetching before timeseries", error);
      }
    }
      // Handle any missing channels generically
    if (beforeRowsData.length > 0 && selectedColumns.length > 0 && Object.keys(beforeSeriesImages).length === 0) {
      console.log("No 'Before' plots found for selected channels, attempting to create generic plots");
      
      try {        // Create a simple representation with the first available numerical column for each selected channel
        const genericData = beforeRowsData.map((row: any) => {
          const newRow: Record<string, number> = {};
          const numericColumns = Object.entries(row)
            .filter(([_, value]) => typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value))))
            .map(([key]) => key);
          
          // Map numeric columns to selected channels if possible
          selectedColumns.forEach((channel, index) => {
            if (index < numericColumns.length) {
              newRow[channel] = typeof row[numericColumns[index]] === 'number' ? 
                row[numericColumns[index]] : 
                Number(row[numericColumns[index]]);
            }
          });
          
          return newRow;
        });
        
        if (Object.keys(genericData[0]).length > 0) {
          console.log("Created generic data for plots:", genericData.slice(0, 2));
          const genericImgs = await fetchTimeseries(genericData, selectedColumns);
          if (genericImgs && genericImgs.images && Object.keys(genericImgs.images).length > 0) {
            console.log("Generated generic 'Before' plots:", Object.keys(genericImgs.images));
            setBeforeSeriesImages(genericImgs.images);
          }
        }
      } catch (fallbackError) {
        console.error("Error creating generic plots:", fallbackError);
      }
    }
    
      // Create settings object
    const settings: Record<string, any> = {
      missingValues,
      normalizationMethod,
      outlierThreshold: Number.parseFloat(outlierThreshold),
      encodingMethod: encodingMethods.length === 1 ? encodingMethods[0] : encodingMethods, // Send as string if only one, array if multiple
    };// Add custom methods if any are selected
    if (selectedCustomMethods.length > 0) {
      settings.customMethods = selectedCustomMethods;
      
      // Include method parameters if available
      for (const methodName of selectedCustomMethods) {
        if (customMethodParams[methodName]) {
          settings[`${methodName}_params`] = customMethodParams[methodName];
        }
      }
      
      console.log("Sending custom methods:", selectedCustomMethods);
      console.log("With parameters:", customMethodParams);
    }
      const config = {
      operations: selectedOperations,
      columns: selectedColumns,
      settings: settings,
    }
    // Send JSON payload instead of FormData to avoid multipart size limits
    const payload = {
      config,
      data_from_visualization: visualizationDataFrame,
      get_available_columns: true,
    };
    try {
      console.log("Sending JSON payload to API:", payload);
      const res = await fetch("http://localhost:8000/preprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.detail || `API responded with status: ${res.status}`;
        console.error("API error:", errorMessage);
        throw new Error(errorMessage);
      }      const result = await res.json()
      console.log("API response:", result);

      // Update processed data
      if (result.processedData) {
        setProcessedData(result.processedData);
        setFeatureNameMapping(result.featureNameMapping || {});
        console.log(`Processed data: ${result.processedData.length} rows`);
      } else {
        console.warn("No processed data returned from API");
        throw new Error("No processed data returned from API");
      }

      // Determine final columns to plot (handle mismatches)
      let finalCols = selectedColumns;
      if (result.availableColumns && Array.isArray(result.availableColumns)) {
        const missing = selectedColumns.filter(c => !result.availableColumns.includes(c));
        if (missing.length > 0) {
          const valid = selectedColumns.filter(c => result.availableColumns.includes(c));
          finalCols = valid.length > 0 ? valid : result.availableColumns;
          setSelectedColumns(finalCols);
          setResultMessage(valid.length > 0
            ? `Processed with ${valid.length} valid columns (${missing.length} dropped).`
            : `No selected columns found; using all ${finalCols.length} available.`);
          setMessageType(missing.length > 0 ? "error" : "success");
        }
      }      // Fetch after timeseries only with finalCols
      if (result.processedData && finalCols.length) {
        console.log("Processing 'After' plot with columns:", finalCols);
        
        // Make sure we only use columns that actually exist in the processed data
        const validAfterCols = finalCols.filter(col => 
          result.processedData.length > 0 && col in result.processedData[0]
        );
        
        console.log("Valid columns for 'After' plot:", validAfterCols);
        
        if (validAfterCols.length === 0) {
          console.warn("No valid columns found for 'After' plot");
          setResultMessage("Preprocessing completed, but couldn't generate 'After' plots. Column mismatch detected.");
          setMessageType("error");
        } else {          const filteredRows = filterRowsByColumns(result.processedData, validAfterCols);
          const afterImgs = await fetchTimeseries(filteredRows, validAfterCols);
          console.log("After images response:", afterImgs);
          setAfterSeriesImages(afterImgs?.images || {});
          
          // Indicate successful preprocessing and plotting
          setResultMessage(result.message || "Preprocessing and plotting completed successfully.");
          setMessageType("success");
        }
      }    } catch (err) {
      console.error("Error in preprocessing", err)
      // Provide more informative error message based on the error
      let errorMessage = "An error occurred during preprocessing."
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Special handling for common column-related errors
        if (err.message.includes("columns") || err.message.includes("KeyError")) {
          errorMessage = "Error with column selection. There may be a mismatch between the columns you selected and what's in the dataset."
        } 
      } else if (typeof err === 'object' && err !== null) {
        // Convert object error to string to avoid [object Object] display
        try {
          errorMessage = JSON.stringify(err, null, 2);
        } catch (e) {
          errorMessage = "Complex error object. Check console for details.";
        }
      }
      setResultMessage(errorMessage)
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }
  // Function to display the encoding preview
  const renderEncodingPreview = () => {
    if (!processedData || !featureNameMapping) return null;
    
    // Get encoding information from feature name mapping
    const encodedColumns = Object.keys(featureNameMapping).filter(col => {
      // Check if this column has been transformed in some way
      return featureNameMapping[col].length > 1 || featureNameMapping[col][0] !== col;
    });
    
    if (encodedColumns.length === 0) return null;
    
    return (
      <Card className="mt-4">
        <CardContent className="pt-4">
          <h3 className="text-sm font-medium mb-3">Encoding Preview</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Methods used: <span className="font-medium">
              {encodingMethods.length === 0 
                ? "None selected" 
                : encodingMethods.map(method => 
                    method === "onehot" ? "One-Hot Encoding" : "Label Encoding"
                  ).join(", ")
              }
            </span>
          </p>
          
          <div className="max-h-[250px] overflow-y-auto border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Column</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformed To</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {encodedColumns.map(col => (
                  <tr key={col}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{col}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {featureNameMapping[col].length <= 3 ? (
                        featureNameMapping[col].join(", ")
                      ) : (
                        <>
                          {featureNameMapping[col].slice(0, 3).join(", ")}
                          <span className="text-gray-400"> ... {featureNameMapping[col].length - 3} more</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </CardContent>
          </Card>
     
    );
  };

  const handleSubmit = () => {
    if (processedData) {
      // Pass the processed data to the onComplete callback
      onComplete({ processedData, featureNameMapping })
      console.log("fetures_names:", processedData.featureNameMapping)
    } else {
      console.error("No processed data available to proceed.")
      setResultMessage("Please run preprocessing before continuing.")
      setMessageType("error")
    }
  }  // Render the appropriate alert based on message type
  const renderAlert = () => {
    if (!resultMessage) return null

    if (messageType === "success") {
      return (
        <div className="flex justify-center mb-6">
          <Alert variant="default" className="bg-green-50 border-green-200 max-w-3xl w-full flex items-start space-x-3 shadow-sm">
            <div className="bg-green-100 p-1 rounded-full">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <AlertTitle className="text-green-800 font-semibold mb-2 flex items-center">
                <span className="mr-2">{resultMessage}</span>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Success</span>
              </AlertTitle>
              
              {selectedOperations.length > 0 && (
                <AlertDescription className="text-green-700 text-sm mb-2">
                  <span className="font-medium">Applied operations: </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedOperations.map(op => {
                      let label = "";
                      let details = "";
                      
                      switch(op) {
                        case "missing": 
                          label = "Missing Values"; 
                          details = `(Method: ${missingValues})`;
                          break;
                        case "normalize": 
                          label = "Normalization"; 
                          details = `(Method: ${normalizationMethod})`;
                          break;
                        case "outliers": 
                          label = "Outlier Removal"; 
                          details = `(Threshold: ${outlierThreshold})`;
                          break;
                        case "encode": 
                          label = "Encoding"; 
                          details = `(${encodingMethods.join(', ')})`;
                          break;
                        case "custom": return null; // Already shown separately
                        default: label = op;
                      }
                      
                      return label ? (
                        <span key={op} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          {label} {details && <span className="ml-1 text-green-600 text-xs">{details}</span>}
                        </span>
                      ) : null;
                    }).filter(Boolean)}
                  </div>
                </AlertDescription>
              )}
              
              {selectedCustomMethods.length > 0 && (
                <AlertDescription className="text-green-700 text-sm">
                  <span className="font-medium">Applied custom methods: </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedCustomMethods.map(method => {
                      const methodInfo = customMethods.find(m => m.filename === method);
                      const methodName = methodInfo ? methodInfo.name : method;
                      return (
                        <span key={method} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                          {methodName}
                        </span>
                      );
                    })}
                  </div>
                </AlertDescription>
              )}
              
              <div className="mt-2 text-xs text-green-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Data is ready for the next step
              </div>
            </div>
          </Alert>
        </div>
      )
    } else if (messageType === "error") {
      return (
        <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="bg-red-100 p-1 rounded-full">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertTitle className="text-red-800 font-semibold mb-2 flex items-center">
                <span className="mr-2">Processing Error</span>
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Failed</span>
              </AlertTitle>
              <AlertDescription className="text-sm text-red-700 mb-2">{resultMessage}</AlertDescription>

              {selectedColumns.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium text-red-700 mb-1">Selected columns:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedColumns.map(col => (
                      <span key={col} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-red-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Try selecting different preprocessing options or check your data format
              </div>
            </div>
          </div>
        </Alert>
      )
    }
    return null
  }
  const runDisabled =
    !(selectedOperations.length > 0 || selectedCustomMethods.length > 0) ||
    selectedColumns.length === 0 ||
    isLoading ||
    isParsing;
 return (
    <div className="space-y-6">
      {/* Parsing indicator */}
      {isParsing && <p className="text-sm text-gray-500">Parsing file...</p>}
      <p className="text-muted-foreground">Clean and transform your data to prepare it for analysis and modeling.</p>

      {/* Display the styled alert message */}
      {renderAlert()}

      {/* Two-column layout: columns selection on left, operations on right */}
      <div className="grid grid-cols-2 gap-4">
        {/* Apply to Columns */}
        <Card className="hover:shadow-sm transition-shadow duration-200">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">1</span>
              Apply to Columns
            </h3>
            {/* Column search and bulk controls */}
            <div className="relative mb-3">
              <Input
                placeholder="Search columns..."
                value={columnFilter}
                onChange={e => setColumnFilter(e.target.value)}
                className="pl-8"
              />
              <div className="absolute left-2.5 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
            </div>
            
            <div className="flex space-x-2 mb-4">
              <Button 
                size="sm" 
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
                onClick={() => setSelectedColumns(filteredColumns)}
              >
                Select All
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={() => setSelectedColumns([])}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-md p-2">
              {filteredColumns.length === 0 ? (
                <p className="text-sm text-gray-500 p-2 text-center">No columns match your search criteria</p>
              ) : (
                filteredColumns.map((column: string) => {
                  // Check if column looks like a channel (ch1, channel2, etc.)
                  const isLikelyChannel = /^(ch|channel)[_\s]?(\d+)$/i.test(column) ||
                                          /sensor/i.test(column) || 
                                          /signal/i.test(column);
                  
                  return (
                    <Label 
                      key={column} 
                      className={`flex items-center space-x-2 p-1.5 rounded-md ${
                        selectedColumns.includes(column) ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedColumns.includes(column)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedColumns(prev => prev.includes(column) ? prev : [...prev, column]);
                          } else {
                            setSelectedColumns(prev => prev.filter(c => c !== column));
                          }
                        }}
                        className={isLikelyChannel ? "text-blue-600" : ""}
                      />
                      <div className="flex items-center">
                        <span className={`${isLikelyChannel ? "font-medium text-blue-600" : ""}`}>
                          {column}
                        </span>
                        {isLikelyChannel && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">channel</span>
                        )}
                      </div>
                    </Label>
                  );
                })
              )}
            </div>
            
            {selectedColumns.length > 0 && (
              <div className="mt-3 text-sm text-gray-500">
                Selected {selectedColumns.length} of {filteredColumns.length} columns
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preprocessing Operations & Custom Methods */}
        <Card className="hover:shadow-sm transition-shadow duration-200">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">2</span>
              Preprocessing Operations
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="border rounded-md p-3 hover:bg-gray-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedOperations.includes("missing")}
                      onCheckedChange={() => handleOperationToggle("missing")}
                      className="text-purple-600"
                    />
                    <span className="font-medium text-gray-800">Handle Missing Values</span>
                  </Label>
                  
                  {selectedOperations.includes("missing") && (
                    <div className="pl-6 mt-2">
                      <Select value={missingValues} onValueChange={setMissingValues}>
                        <SelectTrigger className="w-full bg-white border-gray-200">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mean">Mean</SelectItem>
                          <SelectItem value="median">Median</SelectItem>
                          <SelectItem value="mode">Mode</SelectItem>
                          <SelectItem value="zero">Replace with Zero</SelectItem>
                          <SelectItem value="drop">Drop Rows</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">How to handle missing data points</p>
                    </div>
                  )}
                </div>

                <div className="border rounded-md p-3 hover:bg-gray-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedOperations.includes("normalize")}
                      onCheckedChange={() => handleOperationToggle("normalize")}
                      className="text-purple-600"
                    />
                    <span className="font-medium text-gray-800">Normalize Data</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Scale data using min-max normalization</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-gray-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedOperations.includes("outliers")}
                      onCheckedChange={() => handleOperationToggle("outliers")}
                      className="text-purple-600"
                    />
                    <span className="font-medium text-gray-800">Remove Outliers</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Identify and remove data points that deviate significantly</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-gray-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedOperations.includes("encode")}
                      onCheckedChange={() => handleOperationToggle("encode")}
                      className="text-purple-600"
                    />
                    <span className="font-medium text-gray-800">Encode Categorical Variables</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Convert categorical data to numerical format</p>
                </div>

                {selectedOperations.includes("encode") && (
                  <div className="col-span-full pl-6 mt-2">
                    <p className="text-sm text-gray-500 mb-2">Encoding Methods (select one or both):</p>
                    <div className="space-y-2">
                      <Label className="flex items-center space-x-2">
                        <Checkbox
                          checked={encodingMethods.includes("onehot")}
                          onCheckedChange={() => handleEncodingMethodToggle("onehot")}
                          className="text-purple-600"
                        />
                        <div>
                          <span className="font-medium">One-Hot Encoding Only</span>
                          <p className="text-xs text-muted-foreground">Apply one-hot encoding to all categorical columns.</p>
                        </div>
                      </Label>
                      <Label className="flex items-center space-x-2">
                        <Checkbox
                          checked={encodingMethods.includes("label")}
                          onCheckedChange={() => handleEncodingMethodToggle("label")}
                          className="text-purple-600"
                        />
                        <div>
                          <span className="font-medium">Label Encoding Only</span>
                          <p className="text-xs text-muted-foreground">Apply label encoding to all categorical columns.</p>
                        </div>
                      </Label>
                      
                      {encodingMethods.length === 2 && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-start space-x-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                              <span className="text-white text-xs font-bold">i</span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-blue-800">Intelligent Auto-Selection</p>
                              <p className="text-xs text-blue-600">
                                The system will automatically choose the optimal encoding method for each column based on:
                              </p>
                              <ul className="text-xs text-blue-600 mt-1 ml-2 space-y-0.5">
                                <li>• <strong>One-hot:</strong> Low cardinality (&lt;5 unique values)</li>
                                <li>• <strong>Label:</strong> High cardinality (&gt;20 unique values) or ordinal data</li>
                                <li>• <strong>Medium cardinality:</strong> Analyzed for ordinal patterns</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {encodingMethods.length === 0 && (
                      <p className="text-xs text-orange-600 mt-2">Please select at least one encoding method.</p>
                    )}
                  </div>
                )}

                {/* Custom Methods Section */}
                {customMethods.length > 0 && (
                  <>
                    <div className="col-span-full">
                      <hr className="my-3" />
                      <h4 className="font-medium text-sm mb-2">Custom Preprocessing Methods</h4>
                      {customMethods.map((method) => (
                        <div key={method.filename} className="mb-4">
                          <Label className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedCustomMethods.includes(method.filename)}
                              onCheckedChange={(checked) => {
                                setSelectedCustomMethods(prev => {
                                  const newState = checked
                                    ? prev.includes(method.filename) ? prev : [...prev, method.filename]
                                    : prev.filter(m => m !== method.filename);
                                  
                                  // Initialize parameters for newly selected methods
                                  if (checked && !prev.includes(method.filename)) {
                                    console.log(`Initializing parameters for ${method.filename}`);
                                  }
                                  
                                  return newState;
                                });
                              }}
                            />
                            <div>
                              <span className="font-medium">{method.name}</span>
                              {method.description && (
                                <p className="text-xs text-muted-foreground">{method.description}</p>
                              )}
                            </div>
                          </Label>
                          {/* Show parameters UI when this method is selected */}
                          {selectedCustomMethods.includes(method.filename) && (
                            <CustomMethodParams
                              methodName={method.name}
                              filename={method.filename}
                              onParamsChange={(params) => {
                                setCustomMethodParams(prev => ({
                                  ...prev,
                                  [method.filename]: params,
                                }));
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {customMethods.length === 0 && (
                  <div className="col-span-full">
                    <p className="text-xs text-gray-500 mt-3">No custom preprocessing methods available</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Encoding Preview Section */}
      {processedData && selectedOperations.includes("encode") && renderEncodingPreview()}

      {/* Time Series Comparison: show only after preprocessing has run */}
      {(Object.keys(beforeSeriesImages).length > 0 || Object.keys(afterSeriesImages).length > 0) && (
        <div className="mt-4 space-y-6">
          {selectedColumns.map((ch) => (
            <div key={ch} className="grid grid-cols-2 gap-4">
              {/* Before plot */}
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-100 px-3 py-1.5 border-b flex items-center">
                  <p className="text-sm font-medium text-gray-700">{ch} (Original)</p>
                </div>
                <div className="p-2">
                  {beforeSeriesImages[ch] && (
                    <img
                      src={`data:image/png;base64,${beforeSeriesImages[ch]}`}
                      alt={`Before ${ch}`}
                      className="w-full h-auto"
                    />
                  )}
                </div>
              </div>
              {/* After plot */}
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-100 px-3 py-1.5 border-b flex items-center">
                  <p className="text-sm font-medium text-green-700">{ch} (Processed)</p>
                </div>
                <div className="p-2">
                  {afterSeriesImages[ch] && (
                    <img
                      src={`data:image/png;base64,${afterSeriesImages[ch]}`}
                      alt={`After ${ch}`}
                      className="w-full h-auto"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Continue button row */}
      <div className="flex justify-end gap-3 mt-6">
        <Button 
          onClick={handleRun} 
          disabled={runDisabled}
          className={`${!runDisabled ? 'bg-purple-600 hover:bg-purple-700' : ''} min-w-[100px]`}
        >
          {isLoading ? (
             <div className="flex items-center">
               <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Processing...
             </div>
           ) : (
             <div className="flex items-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                 <polygon points="5 3 19 12 5 21 5 3"></polygon>
               </svg>
               Run Preprocessing
             </div>
           )}
         </Button>
         <Button 
           onClick={handleSubmit} 
           disabled={isLoading || !processedData}
           className={`${processedData ? 'bg-blue-600 hover:bg-blue-700' : ''} min-w-[100px]`}
         >
           <div className="flex items-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
               <line x1="5" y1="12" x2="19" y2="12"></line>
               <polyline points="12 5 19 12 12 19"></polyline>
             </svg>
             Continue
           </div>
         </Button>
       </div>
    </div>
  )
}

// Helper to filter rows to only selected columns
const filterRowsByColumns = (rows: any[], cols: string[]) => {
  if (!rows || rows.length === 0) return [];
  if (!cols || cols.length === 0) return rows;
  
  console.log(`Filtering rows to include only these columns: ${cols.join(', ')}`);
  
  return rows.map(row => {
    const obj: any = {};
    cols.forEach(col => { 
      if (row && typeof row === 'object' && col in row) {
        obj[col] = row[col];
      }
    });
    return obj;
  });
};

/**
 * Fetches time series plots for the given data rows
 * @param rows The data rows to plot
 * @param selectedChannels Optional array of channel names to filter the plots by.
 *                          If provided, only plots for these channels will be generated.
 * @param selectedChannels Optional array of channel names to filter the plots by.
 *                          If provided, only plots for these channels will be generated.
 * @returns Object containing base64 images for each channel
 */
async function fetchTimeseries(rows: any[], selectedChannels?: string[]) {
  if (rows.length === 0) {
    console.warn("No rows provided to fetchTimeseries");
    return { images: {} };
  }

  try {
    // Get only the columns that are present in the data
    const availableChannels = rows.length > 0 ? Object.keys(rows[0]) : [];
    if (availableChannels.length === 0) {
      console.warn("No channels found in the rows");
      return { images: {} };
    }
    
    // Ensure data is numerical for the API (convert strings to numbers)
    const processedRows = rows.map(row => {
      const processedRow: any = {};
      Object.entries(row).forEach(([key, value]) => {
        // Convert string numeric values to actual numbers
        if (typeof value === 'string' && !isNaN(Number(value))) {
          processedRow[key] = Number(value);
        } else {
          processedRow[key] = value;
        }
      });
      return processedRow;
    });      // Filter channels based on user selection if provided
    let channelsToUse = availableChannels;
    if (selectedChannels && selectedChannels.length > 0) {
      console.log("Selected channels from user input:", selectedChannels);
      console.log("Available channels in data:", availableChannels);
      
      // First try exact matches (case-insensitive)
      let exactMatches = availableChannels.filter(channel => 
        selectedChannels.some(selected => 
          channel.toLowerCase() === selected.toLowerCase()
        )
      );
      
      // If no exact matches, try more precise pattern matching for channel numbers
      if (exactMatches.length === 0) {
        console.log("No exact channel matches found, trying pattern matching for channel numbers");
        
        // Extract channel numbers from selected channels (e.g., "ch1" -> "1")
        const selectedChannelNumbers = selectedChannels
          .map(ch => {
            const match = ch.match(/ch(\d+)/i);
            return match ? match[1] : null;
          })
          .filter(Boolean);
        
        console.log("Extracted channel numbers:", selectedChannelNumbers);
        
        if (selectedChannelNumbers.length > 0) {
          // Match available channels by their numeric part
          const numberMatches = availableChannels.filter(channel => {
            const channelMatch = channel.match(/ch(\d+)/i);
            if (!channelMatch) return false;
            
            return selectedChannelNumbers.includes(channelMatch[1]);
          });
          
          if (numberMatches.length > 0) {
            console.log("Found channel number matches:", numberMatches);
            channelsToUse = numberMatches;
          } else {
            // Fall back to partial matches if no number matches found
            console.log("No number matches found, trying partial matches");
            let partialMatches = availableChannels.filter(channel => 
              selectedChannels.some(selected => 
                channel.toLowerCase().includes(selected.toLowerCase()) || 
                selected.toLowerCase().includes(channel.toLowerCase())
              )
            );
            if (partialMatches.length > 0) {
              console.log("Found partial channel matches:", partialMatches);
              channelsToUse = partialMatches;
            } else {
              console.warn("No channel matches found, falling back to available channels");
              channelsToUse = availableChannels.slice(0, Math.min(5, availableChannels.length));
            }
          }
        } else {
          // If no channel numbers found, try partial matches
          console.log("No channel numbers extracted, trying partial matches");
          let partialMatches = availableChannels.filter(channel => 
            selectedChannels.some(selected => 
              channel.toLowerCase().includes(selected.toLowerCase()) ||
              selected.toLowerCase().includes(channel.toLowerCase())
            )
          );
          
          if (partialMatches.length > 0) {
            console.log("Found partial channel matches:", partialMatches);
            channelsToUse = partialMatches;
          } else {
            console.warn("No channel matches found, falling back to available channels");
            channelsToUse = availableChannels.slice(0, Math.min(5, availableChannels.length));
          }
        }
      } else {
        console.log("Found exact channel matches:", exactMatches);
        channelsToUse = exactMatches;
      }
    }    // Create a channel mapping for proper display names
    const channelMapping: Record<string, string> = {};
    if (selectedChannels && selectedChannels.length > 0) {
      channelsToUse.forEach(channel => {
        // First try to match by exact number if it's a channel with a numeric identifier
        const channelMatch = channel.match(/ch(\d+)/i);
        if (channelMatch) {
          const channelNum = channelMatch[1];
          // Look for a selected channel with the same number
          const matchByNumber = selectedChannels.find(selected => {
            const selectedMatch = selected.match(/ch(\d+)/i);
            return selectedMatch?.[1] === channelNum;
          });
          
          if (matchByNumber) {
            channelMapping[channel] = matchByNumber;
            console.log(`Mapped channel ${channel} to ${matchByNumber} by number match`);
            return;
          }
        }
        
        // If no number match, fall back to other matching strategies
        const matchingSelected = selectedChannels.find(selected => 
          channel.toLowerCase() === selected.toLowerCase() ||
          channel.toLowerCase().includes(selected.toLowerCase()) ||
          selected.toLowerCase().includes(channel.toLowerCase())
        );
        
        if (matchingSelected) {
          channelMapping[channel] = matchingSelected;
          console.log(`Mapped channel ${channel} to ${matchingSelected} by string match`);
        }
      });
    }
    
    console.log(`Fetching timeseries for ${channelsToUse.length}/${availableChannels.length} channels, ${rows.length} rows`);
    console.log("Selected channels for plot:", channelsToUse);
    console.log("Sample row after processing:", processedRows[0]);
    
       
    // Only include the filtered channels in the payload
    const payload = { 
      data: processedRows, 
      channels: channelsToUse, // Only use filtered channels
      channelMapping: channelMapping // Add channel mapping for proper display
    };
    
    const res = await fetch("http://localhost:8003/Timeseries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
      if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error(`HTTP error! status: ${res.status}, message: ${errorText}`);
      throw new Error(`HTTP error! status: ${res.status}`);
    }
      const result = await res.json();
    console.log("Timeseries API response received with images for channels:", Object.keys(result.images || {}));
    
    // Verify that the returned images match the expected channels
    if (result.images && Object.keys(result.images).length > 0) {
      const returnedChannels = Object.keys(result.images);
      const expectedChannels = channelsToUse;
      
      // Filter the images to only include the selected channels
      if (selectedChannels && selectedChannels.length > 0) {
        const filteredImages: Record<string, string> = {};          // Try to match returned channels with selected channels
        returnedChannels.forEach(returnedCh => {
          // Extract channel numbers for more precise matching
          const returnedMatch = returnedCh.match(/ch(\d+)/i);
          const returnedNum = returnedMatch ? returnedMatch[1] : null;
          
          // Find the matching selected channel (if any)
          const matchingSelected = selectedChannels.find(selectedCh => {
            // Try to match by channel number first (more precise)
            if (returnedNum) {
              const selectedMatch = selectedCh.match(/ch(\d+)/i);
              if (selectedMatch?.[1] === returnedNum) {
                return true;
              }
            }
            
            // Fall back to string matching
            return returnedCh.toLowerCase() === selectedCh.toLowerCase() ||
                   returnedCh.toLowerCase().includes(selectedCh.toLowerCase()) ||
                   selectedCh.toLowerCase().includes(returnedCh.toLowerCase());
          });
          
          if (matchingSelected) {
            // Use the returnedCh as the key but we'll display the selected channel name in the UI
            filteredImages[returnedCh] = result.images[returnedCh];
            console.log(`Matched returned channel ${returnedCh} with selected channel ${matchingSelected}`);
          }
        });          // Handle missing selected channels more generically
        selectedChannels?.forEach(selectedCh => {
          // Check if this selected channel is already matched
          const alreadyMatched = Object.keys(filteredImages).some(key => {
            // Check by number if it's a channel with numeric identifier
            const keyMatch = key.match(/ch(\d+)/i);
            const selectedMatch = selectedCh.match(/ch(\d+)/i);
            
            if (keyMatch && selectedMatch && keyMatch[1] === selectedMatch[1]) {
              return true;
            }
            
            // Otherwise check by string matching
            return key.toLowerCase() === selectedCh.toLowerCase() || 
                   key.toLowerCase().includes(selectedCh.toLowerCase()) ||
                   selectedCh.toLowerCase().includes(key.toLowerCase());
          });
          
          if (!alreadyMatched) {
            console.log(`Finding alternative match for selected channel: ${selectedCh}`);
            
            // Extract the channel number if possible
            const selectedMatch = selectedCh.match(/ch(\d+)/i);
            const selectedNum = selectedMatch ? selectedMatch[1] : null;
            
            // First try to find a match by channel number
            if (selectedNum) {
              const numberMatch = returnedChannels.find(ch => {
                const chMatch = ch.match(/ch(\d+)/i);
                return chMatch && chMatch[1] === selectedNum;
              });
              
              if (numberMatch && numberMatch in result.images) {
                console.log(`Using "${numberMatch}" as a number match for "${selectedCh}"`);
                filteredImages[selectedCh] = result.images[numberMatch];
                return;
              }
            }
            
            // If no number match, try other matching strategies
            const potentialMatch = returnedChannels.find(ch => 
              ch.toLowerCase().includes(selectedCh.toLowerCase().slice(0, 2)) || // Match first part of name
              selectedCh.toLowerCase().includes(ch.toLowerCase().slice(0, 2)) || // Match first part 
              // Look for numeric part matches (if channel includes numbers)
              (selectedCh.match(/\d+/) && ch.includes(selectedCh.match(/\d+/)?.[0] || ''))
            );
            
            if (potentialMatch && potentialMatch in result.images) {
              console.log(`Using "${potentialMatch}" as a partial match for "${selectedCh}"`);
              filteredImages[selectedCh] = result.images[potentialMatch];
            }
          }
        });
            // If we have filtered images, use them instead
        if (Object.keys(filteredImages).length > 0) {
          console.log("Filtered images to only include selected channels:", Object.keys(filteredImages));
            // Rename keys to use selected channel names if available
          if (Object.keys(channelMapping).length > 0) {
            const remappedImages: Record<string, string> = {};
            Object.keys(filteredImages).forEach(key => {
              const mappedKey = channelMapping[key] || key;
              remappedImages[mappedKey] = filteredImages[key];
            });
            
            console.log("Remapped images to use selected channel names:", Object.keys(remappedImages));
            return { images: remappedImages };
          }
          
          return { images: filteredImages };
        }
      }
    }
    
    // Fallback: return all images if no filtering was possible
    return { images: result.images };
  } catch (error) {
    console.error("Error in fetchTimeseries:", error);
    return { images: {} };
  }
}