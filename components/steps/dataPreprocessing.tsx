import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export default function DataPreprocessing({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [selectedOperations, setSelectedOperations] = useState<string[]>([])
  const [missingValues, setMissingValues] = useState("mean")
  const [normalizationMethod, setNormalizationMethod] = useState("minmax")
  const [outlierThreshold, setOutlierThreshold] = useState("1.5")
  const [encodingMethods, setEncodingMethods] = useState<string[]>([]) // Changed to array
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const visualizationData = data.visualization || {}
  const dataSummary = visualizationData.dataSummary || {}
  const columns = dataSummary.columns || []
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])  
  const [processedData, setProcessedData] = useState<any>(null)
  const [featureNameMapping, setFeatureNameMapping] = useState<any>(null)
  const [encodingDetails, setEncodingDetails] = useState<any>(null)

  // Add custom methods state
  const [customMethods, setCustomMethods] = useState<CustomMethod[]>([])
  const [selectedCustomMethods, setSelectedCustomMethods] = useState<string[]>([])
  const [customMethodParams, setCustomMethodParams] = useState<Record<string, Record<string, any>>>({})

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
  useEffect(() => {
    if (columns && columns.length > 0) {
      // Set initially selected columns
      setSelectedColumns(columns)
      console.log("Initial columns from data:", columns)
    }
  }, [columns])
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
};


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

    // Create settings object
    const settings: Record<string, any> = {
      missingValues,
      normalizationMethod,
      outlierThreshold: Number.parseFloat(outlierThreshold),
      encodingMethod: encodingMethods.length === 1 ? encodingMethods[0] : encodingMethods, // Send as string if only one, array if multiple
    };    // Add custom methods if any are selected
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
    const formData = new FormData()
    formData.append("config", JSON.stringify(config))
    const fileObject = data.data_import?.fileObjects?.[0] || data.file
    if (!fileObject) {
      console.error("No file object found")
      setResultMessage("No file found to process")
      setMessageType("error")
      setIsLoading(false)
      return
    }
    
    formData.append("file", fileObject);
      
    // Add a new parameter to request available columns if needed
    formData.append("get_available_columns", "true")
      
    try {
      console.log("Sending config to API:", config);
      console.log("Selected operations:", selectedOperations);
      console.log("Selected columns:", selectedColumns.length);
      console.log("Selected encoding methods:", encodingMethods);
      
      const res = await fetch("http://localhost:8000/preprocess", {
        method: "POST",
        body: formData,
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.detail || `API responded with status: ${res.status}`;
        console.error("API error:", errorMessage);
        throw new Error(errorMessage);
      }
      
      const result = await res.json()
      console.log("API response:", result);

      if (result.preview) {
        console.log("Preview data:", result.preview)
        
        // Debug the actual data changes
        if (result.preview.length > 0) {
          console.log("First row keys:", Object.keys(result.preview[0]));
          
          // Check for encoding results
          if (selectedOperations.includes("encode")) {
            const oneHotColumns = Object.keys(result.preview[0]).filter(key => key.includes("_"));
            console.log("Detected one-hot encoded columns:", oneHotColumns.slice(0, 5));
          }
          
          // Check for normalization results
          if (selectedOperations.includes("normalize")) {
            const numericColumns = selectedColumns.filter(col => 
              typeof result.preview[0][col] === 'number');
            
            if (numericColumns.length > 0) {
              const sampleCol = numericColumns[0];
              console.log(`Sample normalized values for ${sampleCol}:`, 
                result.preview.slice(0, 3).map((row: { [x: string]: any }) => row[sampleCol]));
            }
          }
        }
      }

      if (result.message) {
        console.log("Message:", result.message)
        
        // Check if we need to update the selected columns based on what's available
        if (result.availableColumns && Array.isArray(result.availableColumns)) {
          const missingColumns = selectedColumns.filter(col => !result.availableColumns.includes(col));
          
          if (missingColumns.length > 0) {
            console.warn("Some selected columns were not found in the dataset:", missingColumns);
            // Update the selected columns to only include available ones
            const validColumns = selectedColumns.filter(col => result.availableColumns.includes(col));
            
            if (validColumns.length === 0) {
              // If none of the selected columns are valid, use all available columns instead
              setSelectedColumns(result.availableColumns);
              console.log("Using all available columns instead:", result.availableColumns);
              setResultMessage("Your selected columns weren't found in the dataset. Using all available columns instead.");
              setMessageType("error");
            } else {
              setSelectedColumns(validColumns);
              setResultMessage(`Processed data successfully with ${validColumns.length} valid columns. (${missingColumns.length} selected columns were not found in the dataset)`);
              setMessageType("success");
            }
          } else {
            setResultMessage(result.message);
            setMessageType("success");
          }
        } else {
          setResultMessage(result.message);
          setMessageType("success");
        }
        
        setProcessedData(result.processedData);
        setFeatureNameMapping(result.featureNameMapping);
        
        // Store encoding details if available
        if (result.encodingDetails) {
          setEncodingDetails(result.encodingDetails);
          console.log("Received encoding details:", result.encodingDetails);
        }
      }
    } catch (err) {
      console.error("Error in preprocessing", err)
      // Provide more informative error message based on the error
      let errorMessage = "An error occurred during preprocessing."
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Special handling for common column-related errors
        if (err.message.includes("columns") || err.message.includes("KeyError")) {
          errorMessage = "Error with column selection. There may be a mismatch between the columns you selected and what's in the dataset."
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
          
          <Tabs defaultValue="columns" className="w-full">
            <TabsList>
              <TabsTrigger value="columns">Encoded Columns</TabsTrigger>
              <TabsTrigger value="details">Encoding Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="columns">
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
            </TabsContent>
            
            <TabsContent value="details">
              {encodingDetails ? (
                <div className="max-h-[250px] overflow-y-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Values</th>
                        {encodingMethods.includes("label") && (
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Encoded Values
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.keys(encodingDetails).map(col => (
                        <tr key={col}>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{col}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {encodingDetails[col].method === "onehot" ? "One-Hot" : "Label"}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {encodingDetails[col].originalValues && encodingDetails[col].originalValues.length <= 3 ? (
                              encodingDetails[col].originalValues.join(", ")
                            ) : (
                              <>
                                {encodingDetails[col].originalValues && encodingDetails[col].originalValues.slice(0, 3).join(", ")}
                                <span className="text-gray-400"> ... {encodingDetails[col].originalValues && encodingDetails[col].originalValues.length - 3} more</span>
                              </>
                            )}
                          </td>
                          {encodingMethods.includes("label") && encodingDetails[col].mapping && (
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {Object.entries(encodingDetails[col].mapping).slice(0, 3).map(([key, value]) => (
                                <div key={key}>{key}: {String(value)}</div>
                              ))}
                              {Object.keys(encodingDetails[col].mapping).length > 3 && (
                                <span className="text-gray-400"> ... {Object.keys(encodingDetails[col].mapping).length - 3} more</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No detailed encoding information available.</p>
              )}
            </TabsContent>
          </Tabs>
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
  }

  // Render the appropriate alert based on message type
  const renderAlert = () => {
    if (!resultMessage) return null

    if (messageType === "success") {
      return (
        <div className="flex justify-center mb-6">
          <Alert variant="default" className="bg-green-50 border-green-200 max-w-fit inline-block flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{resultMessage}</AlertTitle>
          </Alert>
        </div>
      )
    } else if (messageType === "error") {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>
      )
    }
    return null  }

  const runDisabled = 
    !(selectedOperations.length > 0 || selectedCustomMethods.length > 0) ||
    selectedColumns.length === 0 ||
    isLoading ||
    (selectedOperations.includes("encode") && encodingMethods.length === 0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Clean and transform your data to prepare it for analysis and modeling.</p>

      {/* Display the styled alert message */}
      {renderAlert()}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Preprocessing Operations</h3>
            <div className="space-y-3">
              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("missing")}
                  onCheckedChange={() => handleOperationToggle("missing")}
                />
                <span>Handle Missing Values</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("normalize")}
                  onCheckedChange={() => handleOperationToggle("normalize")}
                />
                <span>Normalize Data - minmax</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("outliers")}
                  onCheckedChange={() => handleOperationToggle("outliers")}
                />
                <span>Remove Outliers</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("encode")}
                  onCheckedChange={() => handleOperationToggle("encode")}
                />
                <span>Encode Categorical Variables</span>
              </Label>
              
              {selectedOperations.includes("encode") && (
                <div className="ml-6 mt-2">
                  <p className="text-sm text-muted-foreground mb-2">Encoding Methods (select one or both):</p>
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Checkbox
                        checked={encodingMethods.includes("onehot")}
                        onCheckedChange={() => handleEncodingMethodToggle("onehot")}
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
                  <hr className="my-3" />
                  <h4 className="font-medium text-sm mb-2">Custom Preprocessing Methods</h4>                    {customMethods.map((method) => (                    <div key={method.filename} className="mb-4">                      <Label className="flex items-center space-x-2">                        <Checkbox
                          checked={selectedCustomMethods.includes(method.filename)}                          onCheckedChange={(checked) => {
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
                </>
              )}
              {customMethods.length === 0 && (
                <p className="text-xs text-gray-500 mt-3">No custom preprocessing methods available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Apply to Columns</h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {columns.map((column: string) => (
                <Label key={column} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => handleColumnToggle(column)}
                  />
                  <span>{column}</span>
                </Label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Encoding Preview Section */}
      {processedData && selectedOperations.includes("encode") && renderEncodingPreview()}      <div className="flex justify-end gap-2">
        <Button onClick={handleRun} disabled={runDisabled}>
          {isLoading ? "Processing..." : "Run"}
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          Continue
        </Button>
      </div>
    </div>
  )
}