"use client"

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
} from "recharts";

// Define interface for custom methods
interface CustomMethod {
  name: string;
  filename: string;
  description: string;
  category: string;
}

export default function Classification({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  // Selected feature names from evaluation and extracted feature vectors from extraction
  const selectedFeatures = data?.feature_evaluation?.selectedFeatures || [];
  const featureVectors =
    data?.feature_extraction?.extractedFeatures ||
    data?.feature_extraction?.featureExtraction ||
    [];
  // Original raw data for supervised target selection
  const originalData: any[] = data?.feature_evaluation?.originalData || [];
  const targetOptions = originalData.length ? Object.keys(originalData[0]) : [];

  const [model, setModel] = useState("kmeans");
  // Columns refer to feature names for clustering
  const featureColumns = featureVectors.length ? Object.keys(featureVectors[0]) : [];
  // Default target column for supervised classification
  const [targetColumn, setTargetColumn] = useState<string>(targetOptions[0] || "");
  const [activeTab, setActiveTab] = useState("models");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [classificationResult, setClassificationResult] = useState<any>(null);
  // Add custom methods state
  const [customMethods, setCustomMethods] = useState<CustomMethod[]>([]);
  const [selectedCustomMethods, setSelectedCustomMethods] = useState<string[]>([]);

  // Fetch custom classification methods once
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        const response = await fetch("http://localhost:8000/list-methods/");
        const json = await response.json();
        if (json.methods) {
          const classificationMethods = json.methods.filter(
            (m: CustomMethod) => m.category === "classification"
          );
          setCustomMethods(classificationMethods);
        }
      } catch (error) {
        console.error("Error fetching custom methods:", error);
      }
    };
    fetchCustomMethods();
  }, []);
    
  const handleRunClassification = async () => {
    if (selectedFeatures.length === 0) {
      setError("No features selected for clustering. Please go back to Feature Evaluation.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const featureData = featureVectors;
      // Determine if using a supervised model and prepare the payload accordingly
      const supervisedModels = ["random_forest", "svm", "logistic_regression", "logistic"];
      const isSupervisedModel = supervisedModels.includes(model);
      // Always send extracted features for classification
      const payload = { features: featureData };
      const isCustomMethod = customMethods.some(method => method.filename === model);
      const formData = new FormData();
      formData.append("model_type", model);
      // Include target for supervised models
      if (['random_forest','svm','logistic_regression','logistic'].includes(model) && targetColumn) {
        formData.append("target", targetColumn);
      }
      formData.append("features", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (isCustomMethod) formData.append("is_custom_method", "true");
      
      // Send request to the backend
      const response = await fetch("http://localhost:8004/classification", {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      console.log("Clustering result:", result);
      
      if (result.error) {
        setError(`Error from server: ${result.error}`);
      } else {
        setClassificationResult(result);
        setSuccess("Clustering completed successfully!");
        // Switch to results tab
        setActiveTab("results");
      }
    } catch (error: any) {
      console.error("Classification error:", error);
      setError(`Error: ${error.message || "An unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = () => {
    const clusteringData = { model, selectedFeatures, results: classificationResult };
    onComplete(clusteringData);
  }

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">   
      <h2 className="text-2xl font-bold">Clustering Analysis</h2>
      <p className="text-muted-foreground">
      Analyze data patterns using unsupervised clustering algorithms.
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

      {/* Feature information */}
      <Card className="p-4">
      <h3 className="font-semibold mb-3">Selected Features</h3>
      <p className="text-sm text-muted-foreground mb-2">
        You have selected {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''} for classification:
      </p>
      <div className="max-h-40 overflow-y-auto border p-2 rounded-md mb-2">
        <ul className="list-disc pl-5 space-y-1 text-sm">
        {selectedFeatures.map((feature: string, index: number) => (
          <li key={index}>{feature}</li>
        ))}
        </ul>
      </div>
      </Card>

      {/* Tabs for model selection, parameters and results */}
      <Tabs defaultValue="models" value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-2 mb-4">
        <TabsTrigger value="models">Algorithm Selection</TabsTrigger>
        <TabsTrigger value="results" disabled={!classificationResult}>Results</TabsTrigger>
      </TabsList>

      <TabsContent value="models" className="space-y-4">
        <Card className="p-4">
        <CardContent className="pt-6 px-0">
          <RadioGroup value={model} onValueChange={setModel}>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="kmeans" id="radio_kmeans" />
            <Label htmlFor="radio_kmeans" className="font-medium">K-Means Clustering</Label>
            </div>
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="dbscan" id="radio_dbscan" />
            <Label htmlFor="radio_dbscan" className="font-medium">DBSCAN (Density-Based Clustering)</Label>
            </div>
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="hierarchical" id="radio_hierarchical" />
            <Label htmlFor="radio_hierarchical" className="font-medium">Hierarchical Clustering</Label>
            </div>
            {/* Supervised Options */}
            <div className="mt-4 text-sm font-semibold">Supervised Classification</div>
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="random_forest" id="radio_rf" />
            <Label htmlFor="radio_rf" className="font-medium">Random Forest</Label>
            </div>
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="svm" id="radio_svm" />
            <Label htmlFor="radio_svm" className="font-medium">Support Vector Machine</Label>
            </div>
            <div className="flex items-center space-x-2">
            <RadioGroupItem value="logistic_regression" id="radio_logistic" />
            <Label htmlFor="radio_logistic" className="font-medium">Logistic Regression</Label>
            </div>
            {/* Target selection for supervised */}
            {['random_forest','svm','logistic_regression','logistic'].includes(model) && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Select Target Column</Label>
              <Select value={targetColumn} onValueChange={setTargetColumn}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Choose target" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map(col => (
                <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
              </Select>
            </div>
            )}
            {/* Custom Methods Section */}
            {customMethods.length > 0 && (
            <>
              <div className="my-4 border-t pt-4">
              <h4 className="font-semibold mb-3">Custom Classification Methods</h4>
              {customMethods.map((method) => (
                <div key={method.filename} className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value={method.filename} id={`radio_${method.filename}`} />
                <div>
                  <Label htmlFor={`radio_${method.filename}`} className="font-medium">{method.name}</Label>
                  {method.description && (
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                  )}
                </div>
                </div>
              ))}
              </div>
            </>
            )}
          </div>
          </RadioGroup>
        </CardContent>
        </Card>
        <div className="flex gap-4">
          <Button
            onClick={handleRunClassification}
            disabled={loading || selectedFeatures.length === 0}
          >
            {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
            ) : (
            "Run"
            )}
          </Button>
        </div>
      </TabsContent>

      {/* <TabsContent value="parameters" className="space-y-4">
        <Card className="p-4">
        <CardContent className="pt-6 space-y-4">
          <div className="grid w-full items-center gap-3">
          <Label htmlFor="targetColumn">Target Column (Class Label)</Label>
          <Select
            value={targetColumn}
            onValueChange={(value) => setTargetColumn(value)}
          >
            <SelectTrigger id="targetColumn" className="w-full">
            <SelectValue placeholder="Select target column" />
            </SelectTrigger>
            <SelectContent>
            {availableColumns.map((column) => (
              <SelectItem key={column} value={column}>
              {column}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the column that contains the class labels you want to predict
          </p>
          </div>
        </CardContent>
        </Card>
      </TabsContent> */}

      <TabsContent value="results" className="space-y-4">
        {classificationResult && (
        <div className="space-y-6">
          {classificationResult.mode === 'unsupervised' ? (
          <>  {/* Unsupervised clustering results */}
            <Card className="p-4">
            <h3 className="font-semibold mb-3">Clustering Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-sm text-muted-foreground">Number of Clusters</div>
              <div className="text-xl font-bold">{classificationResult.numClusters}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <div className="text-sm text-muted-foreground">Silhouette Score</div>
              <div className="text-xl font-bold">
                {classificationResult.metrics?.silhouette != null
                ? classificationResult.metrics.silhouette.toFixed(2)
                : "N/A"}
              </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <div className="text-sm text-muted-foreground">Explained Variance</div>
              <div className="text-xl font-bold">
                {classificationResult.explainedVariance != null
                ? `${(classificationResult.explainedVariance * 100).toFixed(2)}%`
                : "N/A"}
              </div>
              </div>
            </div>
            </Card>
            {classificationResult.cluster_distribution && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Cluster Distribution</h3>
              <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={Object.entries(classificationResult.cluster_distribution)
                  .map(([name, count]) => ({ name, count }))}
                >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </Card>
            )}
            {/* PCA scatterplot for cluster visualization */}
            {classificationResult.pca_coords && classificationResult.labels && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Cluster Scatter (PCA)</h3>
              <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name="PC1" />
                  <YAxis dataKey="y" name="PC2" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    name="Clusters"
                    data={classificationResult.pca_coords.map((coord: number[], i: number) => ({ x: coord[0], y: coord[1], cluster: classificationResult.labels[i] }))}
                  >
                    {classificationResult.labels.map((lbl: number, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a28dd0'][lbl] || '#8884d8'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              </div>
            </Card>
            )}
          </>
          ) : (
          <> {/* Supervised classification results */}
            <Card className="p-4">
            <h3 className="font-semibold mb-3">Classification Results</h3>
            <div className="space-y-2">
              {classificationResult.metrics && Object.entries(classificationResult.metrics).map(([name, val]) => (
              <div key={name} className="flex justify-between">
                <span className="text-sm text-muted-foreground capitalize">{name.replace('_', ' ')}</span>
                <span className="font-bold">{typeof val === 'number' ? val.toFixed(2) : String(val)}</span>
              </div>
              ))}
            </div>
            </Card>
            {classificationResult.feature_importances && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Feature Importances</h3>
              <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(classificationResult.feature_importances)
                .map(([feat, imp]) => ({ feat, imp }))}
                layout="vertical"
              >
                <XAxis type="number" />
                <YAxis dataKey="feat" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="imp" fill="#82ca9d" />
              </BarChart>
              </ResponsiveContainer>
            </Card>
            )}
          </>
          )}
        </div>
        )}

        {/* Run and Submit Buttons */}
        <div className="flex gap-4">
        <Button
          onClick={handleRunClassification}
          disabled={loading || selectedFeatures.length === 0}
        >
          {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running...
          </>
          ) : (
          "Run"
          )}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!classificationResult}
          variant="secondary"
        >
          Submit Results
        </Button>
        </div>
      </TabsContent>
      </Tabs>
    </div>)}
