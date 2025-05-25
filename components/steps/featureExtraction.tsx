"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function FeatureExtraction({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
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
  const [activeTab, setActiveTab] = useState("automatic");
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

  const handleRun = async () => {
    setResultMessage(null);
    setMessageType(null);
    setIsLoading(true);
  
    const config: any = {
      // methods may be simple filenames or 'filename:function'; backend should parse
      methods: selectedMethods,
      features: selectedFeatures,
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

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Extract and transform features to improve model performance and reduce dimensionality.
      </p>

      {/* Display alert unconditionally - don't use renderAlert() in a function that might not get called */}
      {resultMessage && messageType === "success" && (
        <div className="flex justify-center mb-6">
          <Alert
            variant="default" 
            className="bg-green-50 border-green-200 max-w-fit inline-block flex items-center space-x-2"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{resultMessage}</AlertTitle>
          </Alert>
        </div>
      )}
      
      {resultMessage && messageType === "error" && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="automatic" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="automatic">Automatic Feature Extraction</TabsTrigger>
          <TabsTrigger value="manual">Manual Selection</TabsTrigger>
        </TabsList>

        <TabsContent value="automatic" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-4">Built-in Extraction Methods</h3>
              <div className="space-y-3">
                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("pca")}
                    onCheckedChange={() => handleMethodToggle("pca")}
                  />
                  <span>Principal Component Analysis (PCA)</span>
                </Label>

                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("kernelPCA")}
                    onCheckedChange={() => handleMethodToggle("kernelPCA")}
                  />
                  <span>Kernel PCA</span>
                </Label>

                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("truncatedSVD")}
                    onCheckedChange={() => handleMethodToggle("truncatedSVD")}
                  />
                  <span>Truncated SVD</span>
                </Label>

                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("fastICA")}
                    onCheckedChange={() => handleMethodToggle("fastICA")}
                  />
                  <span>Fast ICA</span>
                </Label>

                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("tsne")}
                    onCheckedChange={() => handleMethodToggle("tsne")}
                  />
                  <span>t-SNE</span>
                </Label>

                <Label className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes("isomap")}
                    onCheckedChange={() => handleMethodToggle("isomap")}
                  />
                  <span>Isomap</span>
                </Label>
              </div>

              {/* Custom Methods Section */}
              {customMethods.length > 0 && (
                <>
                  <h3 className="text-sm font-medium mb-4 mt-6">Custom Extraction Methods</h3>
                  <div className="space-y-3">
                    {customMethods.map((method) => (
                      <Label key={method.filename} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedMethods.includes(method.filename)}
                          onCheckedChange={() => handleMethodToggle(method.filename)}
                        />
                        <span>{method.name}</span>
                      </Label>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-4">Select Features</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {columns.map((column: string) => (
                  <Label key={column} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedFeatures.includes(column)}
                      onCheckedChange={() => handleFeatureToggle(column)}
                    />
                    <span>{column}</span>
                  </Label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button
          onClick={handleRun}
          disabled={
            (activeTab === "automatic" && selectedMethods.length === 0) ||
            (activeTab === "manual" && selectedFeatures.length === 0) ||
            isLoading
          }
        >
          {isLoading ? "Processing..." : "Run"}
        </Button>
        <Button onClick={handleSubmit} disabled={!processedData || isLoading}>
          Continue
        </Button>
      </div>
    </div>
  );
}