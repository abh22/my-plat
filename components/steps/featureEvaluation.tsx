import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, CheckCircle, Filter, XCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface EvaluationProps {
  data: {
    feature_extraction?: {
      featureExtraction?: any[];
      featureNameMap?: Record<string, string[]>;
    };
    [key: string]: any;
  };
  onComplete?: (data: any) => void;
}

// Interface for custom methods
interface CustomMethod {
  name: string;
  filename: string;
  description: string;
  category: string;
}

const FeatureEvaluation = ({ data, onComplete }: EvaluationProps) => {
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["variance"]);
  const [rankedFeatures, setRankedFeatures] = useState<{ name: string; score: number }[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0); // Threshold for automatic selection
  const [selectAll, setSelectAll] = useState<boolean>(true);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [autoDetectedIdColumns, setAutoDetectedIdColumns] = useState<string[]>([]);
  const [showExcludedColumnsWarning, setShowExcludedColumnsWarning] = useState(false);
  // Add custom methods state
  const [customMethods, setCustomMethods] = useState<CustomMethod[]>([]);

  // Fetch custom methods from the backend
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        const response = await fetch("http://localhost:8000/list-methods/");
        const data = await response.json();
        if (data.methods) {
          // Filter methods by category (evaluation)
          const evaluationMethods = data.methods.filter(
            (method: CustomMethod) => method.category === "evaluation"
          );
          setCustomMethods(evaluationMethods);
          console.log("Fetched custom evaluation methods:", evaluationMethods);
        }
      } catch (error) {
        console.error("Error fetching custom methods:", error);
      }
    };

    fetchCustomMethods();
  }, []);

  const toggleMethod = (method: string) => {
    setSelectedMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  // Toggle selection of a feature
  const toggleFeatureSelection = (featureName: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureName) 
        ? prev.filter(f => f !== featureName)
        : [...prev, featureName]
    );
  };

  // Handle "Select All" checkbox toggle
  const toggleSelectAll = (checked: boolean) => {
    setSelectAll(checked);

    // When selecting all, include all features that aren't explicitly excluded
    if (checked) {
      const allFeatures = rankedFeatures
        .map(f => f.name)
        .filter(name => !excludedColumns.includes(name));
      setSelectedFeatures(allFeatures);
    } else {
      setSelectedFeatures([]); // Deselect all
    }
  };

  // Auto-select features based on threshold
  const handleThresholdChange = (value: number) => {
    setThreshold(value);
    // Select features with scores above the threshold
    if (rankedFeatures.length > 0) {
      const maxScore = Math.max(...rankedFeatures.map(f => f.score));
      const thresholdValue = maxScore * (value / 100);
      const selectedByThreshold = rankedFeatures
        .filter(f => f.score >= thresholdValue)
        .map(f => f.name);
      
      setSelectedFeatures(selectedByThreshold);
      setSelectAll(selectedByThreshold.length === rankedFeatures.length);
    }
  };

  // When ranked features change, update selected features if selectAll is true
  useEffect(() => {
    if (rankedFeatures.length > 0 && selectAll) {
      setSelectedFeatures(rankedFeatures.map(f => f.name));
    }
  }, [rankedFeatures]);  const handleSubmit = () => {
    if (onComplete) {
      // Pass selected features in a structure that can be consumed by the workflow
      // and the classification component
      onComplete({
        selectedFeatures: selectedFeatures,
        rankedFeatures: rankedFeatures,
        evaluationMethods: selectedMethods,        // Pass through original data for the next steps
        originalData: data?.preprocessing?.processedData || data?.visualization?.dataSummary?.dataFrame || [],
        extractedFeatures: data?.feature_extraction?.featureExtraction || data?.featureExtraction || []
      });
    }
  };const handleRun = async () => {
    console.log("Data:", data); // Log the entire data object for debugging

    // Check for different possible data structures
    let featureData = [];
    let originalData = [];
    
    // Get extracted features
    if (data?.feature_extraction?.featureExtraction) {
      // Structure: data.feature_extraction.featureExtraction
      featureData = data.feature_extraction.featureExtraction;
    } else if (data?.featureExtraction) {
      // Structure: data.featureExtraction (directly from feature extraction step)
      featureData = data.featureExtraction;
    } 
      // Get original features from preprocessing or visualization step
    if (data?.preprocessing?.processedData) {
      originalData = data.preprocessing.processedData;
    } else if (data?.visualization?.dataSummary?.dataFrame) {
      originalData = data.visualization.dataSummary.dataFrame;
    }
    
    // Combine both feature sets if available
    const combinedFeatures = [...featureData, ...originalData].filter(Boolean);
    
    if (combinedFeatures.length === 0) {
      setError("No feature data available. Please complete the Data Preprocessing or Feature Extraction step first.");
      return;
    }

    if (selectedMethods.length === 0) {
      setError("Please select at least one evaluation method.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);    try {
      // Create a payload using the appropriate data structure
      const payload = {
        features: combinedFeatures
      };

      const formData = new FormData();
      formData.append("methods", JSON.stringify(selectedMethods));
      formData.append("features", new Blob([JSON.stringify(payload)], { type: "application/json" }));

      console.log("Sending evaluation request with methods:", selectedMethods);

      const response = await fetch("http://localhost:8002/evaluation", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Evaluation result:", result);

      if (result.error) {
        setError(`Error from server: ${result.error}`);
      } else if (result.rankedFeatures && result.rankedFeatures.length > 0) {
        setRankedFeatures(result.rankedFeatures);
        setSuccess("Feature evaluation completed successfully.");
          // No need to call onComplete here - we'll do it via the "Continue" button
      } else {
        setError("No feature scores were returned from the server.");
      }
    } catch (error: any) {
      setError(`Error: ${error.message || "Unknown error occurred"}`);
      console.error("Evaluation error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to detect potential ID columns
  const detectIdLikeColumns = (features: any[]): string[] => {
    if (!features || features.length === 0) return [];
    
    const potentialIdColumns: string[] = [];
    const columnNames = Object.keys(features[0] || {});
    
    // Check for columns with names that suggest they are IDs
    const idNamePatterns = [
      /\bid\b/i,           // "id" as a word
      /\bcode\b/i,         // "code" as a word
      /\bkey\b/i,          // "key" as a word
      /\bindex\b/i,        // "index" as a word
      /\buuid\b/i,         // "uuid" as a word
      /\bnumber\b/i,       // "number" as a word
      /^id_/i,             // starts with "id_"
      /_id$/i,             // ends with "_id"
      /\bidentifier\b/i,   // "identifier" as a word
      /\brecord\b/i,       // "record" as a word
    ];

    // For each column, check if it's likely an ID column
    for (const column of columnNames) {
      // Check if column name matches any ID patterns
      const isIdByName = idNamePatterns.some(pattern => pattern.test(column));
      
      if (isIdByName) {
        potentialIdColumns.push(column);
        continue;
      }
      
      // Check for columns with unique values (sample first few rows)
      const sampleSize = Math.min(features.length, 100);
      const values = new Set();
      let allUnique = true;
      
      for (let i = 0; i < sampleSize; i++) {
        const value = features[i][column];
        if (values.has(value)) {
          allUnique = false;
          break;
        }
        values.add(value);
      }
      
      // If all values are unique and numeric or strings that look like IDs
      if (allUnique && values.size > 10) {
        const valuesArray = Array.from(values);
        // Check if values follow a sequential pattern
        let isSequential = true;
        for (let i = 1; i < Math.min(valuesArray.length, 10); i++) {
          if (Number(valuesArray[i]) !== Number(valuesArray[i - 1]) + 1) {
            isSequential = false;
            break;
          }
        }
        
        if (isSequential) {
          potentialIdColumns.push(column);
        }
      }
    }
    
    return potentialIdColumns;
  };

  const toggleExcludeColumn = (columnName: string) => {
    setExcludedColumns(prev => 
      prev.includes(columnName) 
        ? prev.filter(c => c !== columnName) 
        : [...prev, columnName]
    );
  };

  // Effect to auto-detect ID-like columns when feature data changes
  useEffect(() => {
    if (rankedFeatures.length > 0) {
      const detectedIdColumns = detectIdLikeColumns(rankedFeatures);
      setAutoDetectedIdColumns(detectedIdColumns);
      
      // Automatically exclude detected ID columns
      const newExcludedColumns = detectedIdColumns.filter(c => !excludedColumns.includes(c));
      setExcludedColumns(prev => [...prev, ...newExcludedColumns]);
    }
  }, [rankedFeatures]);

  return (    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Feature Evaluation</h2>
        <p className="text-muted-foreground mt-1">
          Evaluate the importance of features using statistical and machine learning methods to identify the most relevant ones for your analysis.
        </p>
      </div>

      {/* Success and Error Messages */}
      {error && (
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
              <AlertDescription className="text-sm text-red-700">{error}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {success && (
        <Alert variant="default" className="bg-green-50 border-green-200 max-w-5xl w-full flex items-start space-x-3 shadow-sm mb-6">
          <div className="bg-green-100 p-1 rounded-full">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <AlertTitle className="text-green-800 font-semibold mb-2 flex items-center">
              <span className="mr-2">{success}</span>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Success</span>
            </AlertTitle>
            
            {selectedMethods.length > 0 && (
              <AlertDescription className="text-green-700 text-sm mb-2">
                <span className="font-medium">Evaluation methods used: </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedMethods.map(method => (
                    <span key={method} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      {method}
                    </span>
                  ))}
                </div>
              </AlertDescription>
            )}
            
            <div className="mt-2 text-xs text-green-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {selectedFeatures.length} features selected for analysis
            </div>
          </div>
        </Alert>
      )}      {/* Method selection card */}      <Card className="p-6 hover:shadow-sm transition-shadow duration-200 border-l-4 border-l-amber-400">
        <h3 className="text-base font-semibold mb-4 flex items-center">
          <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">1</span>
          Select Evaluation Methods
        </h3>
        <div className="text-sm text-gray-500 mb-4">
          Choose one or more methods to evaluate feature importance. Each method uses different criteria to rank features.
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">          <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
            <Label className="flex items-center space-x-2 mb-2">
              <Checkbox 
                checked={selectedMethods.includes("variance")}
                onCheckedChange={() => toggleMethod("variance")}
                className="text-amber-600"
              />
              <span className="font-medium text-gray-800">Variance</span>
            </Label>
            <p className="text-xs text-gray-500 pl-6">Features with higher variance may contain more information</p>
          </div>
            <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
            <Label className="flex items-center space-x-2 mb-2">
              <Checkbox
                checked={selectedMethods.includes("correlation")}
                onCheckedChange={() => toggleMethod("correlation")}
                className="text-amber-600"
              />
              <span className="font-medium text-gray-800">Correlation</span>
            </Label>
            <p className="text-xs text-gray-500 pl-6">Features highly correlated with others may be more important</p>
          </div>
            <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
            <Label className="flex items-center space-x-2 mb-2">
              <Checkbox
                checked={selectedMethods.includes("kurtosis")}
                onCheckedChange={() => toggleMethod("kurtosis")}
                className="text-amber-600"
              />
              <span className="font-medium text-gray-800">Kurtosis</span>
            </Label>
            <p className="text-xs text-gray-500 pl-6">Measures peakedness of feature distributions</p>
          </div>
            <div className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
            <Label className="flex items-center space-x-2 mb-2">
              <Checkbox
                checked={selectedMethods.includes("skewness")}
                onCheckedChange={() => toggleMethod("skewness")}
                className="text-amber-600"
              />
              <span className="font-medium text-gray-800">Skewness</span>
            </Label>
            <p className="text-xs text-gray-500 pl-6">Measures asymmetry of feature distributions</p>
          </div>
        </div>

        {/* Custom Methods Section */}
        {customMethods.length > 0 && (
          <>            <h3 className="text-base font-semibold mb-4 mt-6 flex items-center">
              <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">2</span>
              Custom Evaluation Methods
            </h3>
            <div className="text-sm text-gray-500 mb-4">
              These methods have been uploaded to the platform and can be used for specialized feature evaluation.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {customMethods.map((method) => (                <div key={method.filename} className="border rounded-md p-3 hover:bg-amber-50 transition-colors duration-150">
                  <Label className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      checked={selectedMethods.includes(method.filename)}
                      onCheckedChange={() => toggleMethod(method.filename)}
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
      </Card>      {/* Run button */}
      <div className="flex justify-end gap-3 mt-8 bg-gray-50 p-4 rounded-md border">
        <div className="flex-1">
          <div className="text-sm text-gray-700 font-medium">
            Selected Methods: 
            <span className="font-normal ml-1">
              {selectedMethods.length > 0 
                ? selectedMethods.join(', ') 
                : 'None selected'}
            </span>
          </div>
          
          {rankedFeatures.length > 0 && (
            <div className="text-sm text-gray-700 font-medium mt-1">
              Selected Features: 
              <span className="font-normal ml-1">
                {selectedFeatures.length} of {rankedFeatures.length} ({(selectedFeatures.length / rankedFeatures.length * 100).toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
          <Button
          onClick={handleRun}
          disabled={loading || selectedMethods.length === 0}
          className={`${!(loading || selectedMethods.length === 0) ? 'bg-amber-600 hover:bg-amber-700' : ''} min-w-[130px]`}
        >
          {loading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Evaluating...
            </div>
          ) : (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Run Evaluation
            </div>
          )}
        </Button>
        
        {rankedFeatures.length > 0 && (
          <Button 
            onClick={handleSubmit}
            disabled={selectedFeatures.length === 0}
            className={`${selectedFeatures.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : ''} min-w-[160px]`}
          >
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
              Continue with {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''}
            </div>
          </Button>
        )}
      </div>      {/* Display results */}
      {rankedFeatures.length > 0 && (
        <>
          {/* Feature Selection Tools */}          <Card className="p-6 hover:shadow-sm transition-shadow duration-200 border-l-4 border-l-amber-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center">
                <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">3</span>
                Select Features to Use
              </h3>
              <div className="flex items-center space-x-2">
                <Label htmlFor="selectAll" className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll} 
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                    className="text-amber-600"
                  />
                  <span className="font-medium">Select All</span>
                </Label>
              </div>
            </div>
            
            {/* Search box for features */}
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <Input
                type="text"
                placeholder="Search features by name..."
                className="pl-10 w-full"
                onChange={(e) => {
                  const searchTerm = e.target.value.toLowerCase();
                  setRankedFeatures(prev => {
                    // Save original order if not saved
                    const original = rankedFeatures.length > 0 ? rankedFeatures : prev;
                    // Filter and sort based on search
                    if (searchTerm) {
                      return [...original].filter(f => 
                        f.name.toLowerCase().includes(searchTerm)
                      );
                    }
                    return original;
                  });
                }}
              />
            </div>
              <div className="mb-4 p-4 bg-amber-50 rounded-md border border-amber-100">
              <div className="flex items-center space-x-2 mb-2">
                <Filter className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">Auto-select by importance threshold: <span className="font-bold">{threshold}%</span></span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={threshold} 
                onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-amber-600 mt-1">
                <span>Include all features</span>
                <span>Only most important features</span>
              </div>
            </div>
            
            <div className="mb-3 text-sm flex items-center justify-between">              <div className="text-gray-600">
                <span className="font-medium text-amber-700">{selectedFeatures.length}</span> of <span className="font-medium">{rankedFeatures.length}</span> features selected
              </div>
              
              {/* Feature stats badges */}
              <div className="flex gap-2">                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Top 5 score: {rankedFeatures.slice(0, 5).reduce((sum, f) => sum + f.score, 0).toFixed(2)}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Selected score: {selectedFeatures.length > 0 
                    ? rankedFeatures
                        .filter(f => selectedFeatures.includes(f.name))
                        .reduce((sum, f) => sum + f.score, 0).toFixed(2)
                    : "0.00"
                  }
                </span>
              </div>
            </div>
            
            {excludedColumns.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 mb-1">Potential ID columns excluded:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {excludedColumns.map(col => (
                        <span key={col} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 border border-amber-200">
                          {col}
                          <button 
                            onClick={() => toggleExcludeColumn(col)} 
                            className="ml-1 text-amber-600 hover:text-amber-800"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-amber-700 text-xs mt-2">
                      These columns appear to be identifiers and were automatically excluded. Click the × to include them if needed.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="max-h-60 overflow-y-auto border rounded-md shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-sm text-gray-700 w-16">Select</th>
                    <th className="text-left py-2 px-3 font-medium text-sm text-gray-700">Feature</th>
                    <th className="text-right py-2 px-3 font-medium text-sm text-gray-700 w-32">Score</th>
                    <th className="text-center py-2 px-3 font-medium text-sm text-gray-700 w-24">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rankedFeatures.map((feature, index) => {
                    const isExcluded = excludedColumns.includes(feature.name);
                    const isSelected = selectedFeatures.includes(feature.name);
                    
                    return (
                      <tr 
                        key={index}                        className={
                          isExcluded ? 'bg-amber-50 hover:bg-amber-100' :
                          isSelected ? 'bg-amber-50 hover:bg-amber-100' : 
                          index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                        }
                      >
                        <td className="py-2 px-3">
                          <Checkbox 
                            checked={isSelected}
                            disabled={isExcluded}
                            onCheckedChange={() => toggleFeatureSelection(feature.name)}
                            className={isSelected ? "text-amber-600" : ""}
                          />
                        </td>
                        <td className="py-2 px-3 font-medium flex items-center">
                          {feature.name}
                          {isExcluded && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                              ID column
                            </span>
                          )}
                          {index < 3 && !isExcluded && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5">top {index+1}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          <span className={
                            index < 5 ? "text-blue-700 font-semibold" : 
                            index < 10 ? "text-blue-600" : "text-gray-600"
                          }>
                            {feature.score.toFixed(4)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-amber-600 h-2 rounded-full" 
                              style={{ 
                                width: `${(feature.score / rankedFeatures[0].score) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bar chart */}
          <Card className="p-6 mt-4 hover:shadow-sm transition-shadow duration-200 border-l-4 border-l-amber-400">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">4</span>
              Feature Importance Visualization
            </h3>
            
            <div className="mb-4 flex justify-between items-center">
              <div className="flex items-center gap-4">                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-amber-600"></div>
                  <span className="text-xs text-gray-600">Selected Features</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-amber-300"></div>
                  <span className="text-xs text-gray-600">Unselected Features</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                Showing top {Math.min(10, rankedFeatures.length)} of {rankedFeatures.length} features
              </div>
            </div>
            
            <div className="h-[300px] w-full border rounded-md p-4 bg-white shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankedFeatures.slice(0, 10)}  /* Show top 10 features */
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    stroke="#6b7280" 
                    fontSize={12} 
                    tickFormatter={(value) => value.toFixed(2)} 
                    domain={[0, 'dataMax']} 
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    width={120}
                    stroke="#6b7280"
                    tickFormatter={(value) => {
                      const isSelected = selectedFeatures.includes(value);
                      return isSelected ? `✓ ${value}` : value;
                    }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(4)}`, 'Importance Score']}
                    labelFormatter={(value) => `Feature: ${value}`}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      padding: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                  />                  <Bar 
                    dataKey="score" 
                    fill="#d97706" 
                    opacity={0.8} 
                    shape={(props: any) => {
                      const { x, y, width, height, name } = props;
                      const isSelected = selectedFeatures.includes(name);
                      const isExcluded = excludedColumns.includes(name);
                      
                      return (                        <rect 
                          x={x} 
                          y={y} 
                          width={width} 
                          height={height} 
                          fill={isExcluded ? '#fbbf24' : isSelected ? '#d97706' : '#fdba74'} 
                          rx={4} 
                          ry={4}
                          opacity={isExcluded ? 0.6 : 1}
                          stroke={isSelected ? '#92400e' : 'none'}
                          strokeWidth={isSelected ? 1 : 0}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 text-xs text-gray-500 bg-amber-50 p-3 rounded-md border border-amber-100">
              <p className="font-medium text-amber-700 mb-1">About this visualization:</p>
              <p>
                The bar chart above shows the importance scores for each feature as determined by the selected evaluation methods. 
                Longer bars indicate features that are likely more important for your analysis or modeling tasks.
              </p>
              <p className="mt-2">You can hover over bars to see exact importance scores and click the feature names to toggle selection.</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default FeatureEvaluation;
