"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

export default function FeatureExtraction({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  // Derive available channels from preprocessing output
  const rawRows = data.preprocessing?.processedData || data.processedData || [];
  const availableChannels = rawRows.length ? Object.keys(rawRows[0]) : [];
  // State for channel selection
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  // State for channel filter
  const [channelFilter, setChannelFilter] = useState("");
  // Compute filtered channels list
  const filteredChannels = useMemo(
    () => availableChannels.filter((ch) =>
      ch.toLowerCase().includes(channelFilter.toLowerCase())
    ),
    [availableChannels, channelFilter]
  );
  useEffect(() => {
    if (availableChannels.length) setSelectedChannels(availableChannels);
  }, [availableChannels]);

  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [pcaComponents, setPcaComponents] = useState("2");
  const [varianceThreshold, setVarianceThreshold] = useState("0.95");
  const [polyDegree, setPolyDegree] = useState("2");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [extractedFeatures, setExtractedFeatures] = useState<any[]>([]);
  const [featureNameMapping, setFeatureNameMapping] = useState<any>(data.featureNameMapping || {});
  // New state for custom methods
  const [customMethods, setCustomMethods] = useState<Array<{ name: string; filename: string; description: string; category: string }>>([]);

  // Fetch custom methods from the backend
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        console.log("Fetching custom feature extraction methods...");
        const response = await fetch("http://localhost:8000/list-methods");
        console.log('list-methods fetched status:', response.status);
        if (!response.ok) {
          console.error("Failed to fetch custom methods:", response.statusText);
          return;
        }
        const data = await response.json();
        console.log('Custom methods:', data.methods);
        if (data.methods) {
          // Filter methods by category (feature extraction)
          const extractionMethods = data.methods.filter(
            (method: any) => method.category === "feature-extraction" || 
                            method.category === "extraction" ||
                            method.category === ""
          );
          setCustomMethods(extractionMethods);
          console.log("Fetched custom extraction methods:", extractionMethods);
        } else {
          console.log("No methods found in response:", data);
        }
      } catch (error) {
        console.error("Error fetching custom methods:", error);
      }
    };

    fetchCustomMethods();
  }, []);

  // Access featureNameMapping from the previous component
  const targetColumnOptions = Object.keys(featureNameMapping);

  useEffect(() => {
    if (targetColumnOptions.length > 0) {
      setTargetColumn(targetColumnOptions[0]); // Set the first option as default
    }
  }, [targetColumnOptions]);

  // Use preprocessed data directly from the previous step
  const columns = data?.columns || []; // Assuming `data` contains preprocessed columns
  const numericColumns = data?.numericColumns || columns;

  useEffect(() => {
    if (numericColumns && numericColumns.length > 0) {
      setSelectedFeatures(numericColumns); // Default to selecting all numeric features
    }
  }, [numericColumns]);

  // Debug log to check data structure
  useEffect(() => {
    console.log("Current data:", data);
  }, [data]);

  const handleMethodToggle = (method: string) => {
    setSelectedMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  // Add channel toggle handler
  const handleChannelToggle = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleRun = async () => {
    setResultMessage(null);
    setMessageType(null);
    setIsLoading(true);
  
    const config: any = {
      // methods may be simple filenames or 'filename:function'; backend should parse
      methods: selectedMethods,
      features: selectedFeatures,
      channels: selectedChannels, // Include selected channels in the config
      settings: {
        pcaComponents: Number.parseInt(pcaComponents),
        varianceThreshold: Number.parseFloat(varianceThreshold),
        polyDegree: Number.parseInt(polyDegree),
        targetColumn: targetColumn || undefined,
      },
    };
  
    const formData = new FormData();
    formData.append("config", JSON.stringify(config));
  
    // Get the appropriate data object to send
    let dataToSend = data;
    if (data && data.preprocessing) {
      dataToSend = data.preprocessing;
    }
  
    const fileObject = new Blob([JSON.stringify(dataToSend)], { type: "application/json" });
  
    if (fileObject) {
      formData.append("file", fileObject);
    } else {
      setResultMessage("No processed data available to send.");
      setMessageType("error");
      console.log("Result Message Set:", "No processed data available to send.");
      setIsLoading(false);
      return;
    }
  
    try {
      console.log("Starting feature extraction API request with config:", config);
      const res = await fetch("http://localhost:8001/extraction", {
        method: "POST",
        body: formData,
      });
  
      console.log("API response received", res.status);
  
      if (!res.ok) {
        const errorResponse = await res.text();
        try {
          const parsedError = JSON.parse(errorResponse);
          throw new Error(parsedError.error || `Server responded with status: ${res.status}`);
        } catch (parseError) {
          throw new Error(`Server responded with status: ${res.status}. Response: ${errorResponse}`);
        }
      }
  
      const result = await res.json();
      console.log("API Response:", result);
  
      if (result && result.processedData) {
        setProcessedData(result.processedData);
        setFeatureNameMapping(result.featureNameMapping || {});
        console.log("Processed Data Set:", result.processedData);
        console.log("Feature Name Mapping Set:", result.featureNameMapping || {});
  
        setResultMessage("Feature extraction completed successfully.");
        console.log("Result Message Set:", "Feature extraction completed successfully");
  
        setMessageType("success");
        console.log("Message Type Set:", "success");
      } else {
        throw new Error("Received incomplete data from server");
      }
    } catch (err: any) {
      console.error("Error in feature extraction:", err);
      setResultMessage(`An error occurred: ${err.message}`);
      setMessageType("error");
      console.log("Result Message Set:", `An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (processedData) {
      console.log("Passing Processed Data to Workflow Stepper:", processedData);
      onComplete({featureExtraction: processedData, featureNameMapping });
    } else {
      setResultMessage("Please run feature extraction before continuing.");
      setMessageType("error");
    }
  };

  // Render the appropriate alert based on message type
  const renderAlert = () => {
    if (!resultMessage) return null;

    if (messageType === "success") {
      return (
        <div className="flex justify-center mb-6">
          <Alert
            variant="default"
            className="bg-green-50 border-green-200 max-w-fit inline-block flex items-center space-x-2"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{resultMessage}</AlertTitle>
          </Alert>
        </div>
      );
    } else if (messageType === "error") {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (    <div className="space-y-6">
      <p className="text-muted-foreground">
        Extract and transform features to improve model performance and reduce dimensionality.
      </p>

      {/* Display the styled alert message */}
      {resultMessage && messageType === "success" && (
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
              
              {selectedMethods.length > 0 && (
                <AlertDescription className="text-green-700 text-sm mb-2">
                  <span className="font-medium">Applied methods: </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedMethods.map(method => {
                      // Find display name for custom methods
                      const customMethod = customMethods.find(m => m.filename === method);
                      const displayName = customMethod ? customMethod.name : method;
                      
                      return (
                        <span key={method} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          {displayName}
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
                Features extracted successfully and ready for the next step
              </div>
            </div>
          </Alert>
        </div>
      )}
      
      {resultMessage && messageType === "error" && (
        <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="bg-red-100 p-1 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertTitle className="text-red-800 font-semibold mb-2 flex items-center">
                <span className="mr-2">Processing Error</span>
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Failed</span>
              </AlertTitle>
              <AlertDescription className="text-sm text-red-700">{resultMessage}</AlertDescription>
              
              <div className="mt-3 text-xs text-red-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Please check your data and selected methods
              </div>
            </div>
          </div>
        </Alert>
      )}      {/* Two-column layout: channels on left, methods on right */}      <div className="grid grid-cols-2 gap-4">
        {/* Channels Selection (similar to Apply to Columns) */}
        <Card className="hover:shadow-sm transition-shadow duration-200 border-l-4 border-l-blue-400">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">1</span>
              Select Channels
            </h3>
            {/* Channel search and bulk controls */}
            <div className="relative mb-3">
              <Input
                placeholder="Search channels..."
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
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
                onClick={() => setSelectedChannels(filteredChannels)}
              >
                Select All
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={() => setSelectedChannels([])}
              >
                Clear All
              </Button>
            </div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto border rounded-md p-2">
              {filteredChannels.length === 0 ? (
                <p className="text-sm text-gray-500 p-2 text-center">No channels match your search criteria</p>
              ) : (
                filteredChannels.map((ch) => {
                  // Check if column looks like a channel (ch1, channel2, etc.)
                  const isLikelyChannel = /^(ch|channel)[_\s]?(\d+)$/i.test(ch) ||
                                        /sensor/i.test(ch) || 
                                        /signal/i.test(ch);
                  
                  return (
                    <Label 
                      key={ch} 
                      className={`flex items-center space-x-2 p-1.5 rounded-md ${
                        selectedChannels.includes(ch) ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedChannels.includes(ch)}
                        onCheckedChange={() => handleChannelToggle(ch)}
                        className={isLikelyChannel ? "text-blue-600" : ""}
                      />
                      <div className="flex items-center">
                        <span className={`${isLikelyChannel ? "font-medium text-blue-600" : ""}`}>
                          {ch}
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
            {selectedChannels.length > 0 && (
              <div className="mt-3 text-sm text-gray-500">
                Selected {selectedChannels.length} of {filteredChannels.length} channels
              </div>
            )}
          </CardContent>        </Card>        {/* Built-in and Custom Methods Selection */}
        <Card className="hover:shadow-sm transition-shadow duration-200 border-l-4 border-l-amber-400">
          <CardContent className="pt-6">            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">2</span>
              Extraction Methods
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Built-in Methods */}
                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("pca")}
                      onCheckedChange={() => handleMethodToggle("pca")}
                      className="text-amber-600"
                    />                    <span className="font-medium text-gray-800">Principal Component Analysis</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Reduces dimensionality while preserving variance</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("kernelPCA")}
                      onCheckedChange={() => handleMethodToggle("kernelPCA")}
                      className="text-amber-600"
                    />
                    <span className="font-medium text-gray-800">Kernel PCA</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Non-linear dimensionality reduction</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("truncatedSVD")}
                      onCheckedChange={() => handleMethodToggle("truncatedSVD")}
                      className="text-amber-600"
                    />                    <span className="font-medium text-gray-800">Truncated SVD</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Works well with sparse data matrices</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("fastICA")}
                      onCheckedChange={() => handleMethodToggle("fastICA")}
                      className="text-amber-600"
                    />
                    <span className="font-medium text-gray-800">Fast ICA</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Separates multivariate signals into independent components</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("tsne")}
                      onCheckedChange={() => handleMethodToggle("tsne")}
                      className="text-amber-600"
                    />                    <span className="font-medium text-gray-800">t-SNE</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Visualizes high-dimensional data in 2D/3D space</p>
                </div>

                <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes("isomap")}
                      onCheckedChange={() => handleMethodToggle("isomap")}
                      className="text-amber-600"
                    />
                    <span className="font-medium text-gray-800">Isomap</span>
                  </Label>
                  <p className="text-xs text-gray-500 pl-6">Non-linear dimensionality reduction using geodesic distances</p>
                </div>
              </div>
            </div>
            
            {customMethods.length > 0 && (
              <>
                <h3 className="text-base font-semibold mb-4 mt-6 flex items-center">
                  <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">3</span>
                  Custom Extraction Methods
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {customMethods.map((method) => (
                    <div key={method.filename} className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                      <Label className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          checked={selectedMethods.includes(method.filename)}
                          onCheckedChange={() => handleMethodToggle(method.filename)}
                          className="text-amber-600"
                        />
                        <span className="font-medium text-gray-800">{method.name}</span>
                      </Label>
                      {method.description && (
                        <p className="text-xs text-gray-500 pl-6">{method.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>      <div className="flex justify-end gap-3 mt-6">
        <Button
          onClick={handleRun}
          disabled={(selectedMethods.length === 0 || selectedChannels.length === 0) || isLoading}
          className={`${!((selectedMethods.length === 0 || selectedChannels.length === 0) || isLoading) ? 'bg-amber-600 hover:bg-amber-700' : ''} min-w-[100px]`}
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
              Extract Features
            </div>
          )}
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!processedData || isLoading}
          className={`${processedData && !isLoading ? 'bg-blue-600 hover:bg-blue-700' : ''} min-w-[100px]`}
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
  );
}