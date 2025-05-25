import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, Filter } from "lucide-react";
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
      featureNameMapping?: Record<string, string[]>;
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

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold">Feature Evaluation</h2>
      <p className="text-muted-foreground">
        Evaluate the importance of features using unsupervised methods.
      </p>

      {/* Success and Error Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">{success}</AlertTitle>
        </Alert>
      )}

      {/* Method selection card */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Select Evaluation Methods</h3>
        <div className="space-y-2">
          <Label className="flex items-center space-x-2">
            <Checkbox 
              checked={selectedMethods.includes("variance")}
              onCheckedChange={() => toggleMethod("variance")}
            />
            <span>Variance (features with higher variance may contain more information)</span>
          </Label>
          <Label className="flex items-center space-x-2">
            <Checkbox
              checked={selectedMethods.includes("correlation")}
              onCheckedChange={() => toggleMethod("correlation")}
            />
            <span>Correlation (features highly correlated with others may be more important)</span>
          </Label>
          <Label className="flex items-center space-x-2">
            <Checkbox
              checked={selectedMethods.includes("kurtosis")}
              onCheckedChange={() => toggleMethod("kurtosis")}
            />
            <span>Kurtosis (measures peakedness of feature distributions)</span>
          </Label>
          <Label className="flex items-center space-x-2">
            <Checkbox
              checked={selectedMethods.includes("skewness")}
              onCheckedChange={() => toggleMethod("skewness")}
            />
            <span>Skewness (measures asymmetry of feature distributions)</span>
          </Label>

          {/* Custom Methods Section */}
          {customMethods.length > 0 && (
            <>
              <hr className="my-3" />
              <h4 className="font-medium text-sm mb-2">Custom Evaluation Methods</h4>
              {customMethods.map((method) => (
                <Label key={method.filename} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedMethods.includes(method.filename)}
                    onCheckedChange={() => toggleMethod(method.filename)}
                  />
                  <div>
                    <span>{method.name}</span>
                    {method.description && (
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    )}
                  </div>
                </Label>
              ))}
            </>
          )}
        </div>
      </Card>      {/* Run button */}
      <div className="flex justify-end space-x-2">
        <Button
          onClick={handleRun}
          disabled={loading || selectedMethods.length === 0}
          className="flex items-center gap-2"
        >
          {loading && <Loader2 className="animate-spin w-4 h-4" />}
          {loading ? "Evaluating..." : "Run Evaluation"}
        </Button>
        {rankedFeatures.length > 0 && (
          <Button 
            onClick={handleSubmit}
            disabled={selectedFeatures.length === 0}
            className="flex items-center gap-2"
          >
            Continue with {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''}
          </Button>
        )}
      </div>{/* Display results */}
      {rankedFeatures.length > 0 && (
        <>
          {/* Feature Selection Tools */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Features to Use</h3>
              <div className="flex items-center space-x-2">
                <Label htmlFor="selectAll" className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll} 
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)} 
                  />
                  <span>Select All</span>
                </Label>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Filter className="h-4 w-4" />
                <span>Auto-select by importance threshold: {threshold}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={threshold} 
                onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Include all</span>
                <span>Only most important</span>
              </div>
            </div>
            
            <div className="mb-2 text-sm text-muted-foreground">
              {selectedFeatures.length} of {rankedFeatures.length} features selected
            </div>
            
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-sm">Select</th>
                    <th className="text-left py-2 px-3 font-medium text-sm">Feature</th>
                    <th className="text-right py-2 px-3 font-medium text-sm">Importance Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedFeatures.map((feature, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                      <td className="py-2 px-3">
                        <Checkbox 
                          checked={selectedFeatures.includes(feature.name)}
                          onCheckedChange={() => toggleFeatureSelection(feature.name)}
                        />
                      </td>
                      <td className="py-2 px-3">{feature.name}</td>
                      <td className="py-2 px-3 text-right font-mono">{feature.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bar chart */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Feature Scores Chart</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankedFeatures.slice(0, 10)}  /* Show top 10 features */
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => {
                      const isSelected = selectedFeatures.includes(value);
                      return isSelected ? `✓ ${value}` : value;
                    }}
                  />
                  <Tooltip />                  <Bar 
                    dataKey="score" 
                    fill="#4f46e5" 
                    opacity={0.8} 
                    shape={(props: any) => {
                      const { x, y, width, height, name } = props;
                      const isSelected = selectedFeatures.includes(name);
                      return (
                        <rect 
                          x={x} 
                          y={y} 
                          width={width} 
                          height={height} 
                          fill={isSelected ? '#4f46e5' : '#a5b4fc'} 
                          rx={4} 
                          ry={4}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default FeatureEvaluation;
