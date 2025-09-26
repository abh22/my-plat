"use client"

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  // Model parameter states
  const [kmeansClusters, setKmeansClusters] = useState<number>(3);
  const [dbscanEps, setDbscanEps] = useState<number>(0.5);
  const [dbscanMinSamples, setDbscanMinSamples] = useState<number>(5);
  const [hierarchicalClusters, setHierarchicalClusters] = useState<number>(3);
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
   const [explanation, setExplanation] = useState<string | null>(null);
   const [explaining, setExplaining] = useState<boolean>(false);
   const [explainError, setExplainError] = useState<string | null>(null);

  // Modal state for export preview
  const [showExportModal, setShowExportModal] = useState(false);
  
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
    setExplainError(null);
    setExplanation(null);
  
    try {
      // prepare payload
      const featureData = featureVectors;
      const supervisedModels = ["random_forest", "svm", "logistic_regression", "logistic"];
      const isCustomMethod = customMethods.some((m) => m.filename === model);
  
      const formData = new FormData();
      formData.append("model_type", model);
      if (supervisedModels.includes(model) && targetColumn) {
        formData.append("target", targetColumn);
      }
      formData.append(
        "features",
        new Blob([JSON.stringify({ features: featureData })], {
          type: "application/json",
        })
      );
      if (isCustomMethod) {
        formData.append("is_custom_method", "true");
      }
      // Add model parameters
      if (model === "kmeans") {
        formData.append("n_clusters", String(kmeansClusters));
      }
      if (model === "dbscan") {
        formData.append("eps", String(dbscanEps));
        formData.append("min_samples", String(dbscanMinSamples));
      }
      if (model === "hierarchical") {
        formData.append("n_clusters", String(hierarchicalClusters));
      }
  
      // classification request
      const response = await fetch("http://localhost:8004/classification", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
  
      if (result.error) {
        setError(`Error from server: ${result.error}`);
        return;
      }
  
      setClassificationResult(result);
      setSuccess("Clustering completed successfully!");
      // explanation request
      setExplaining(true);
      try {
        const resultForMistral = {
          mode: result.mode,
          model_type: model,
          
          // Common metrics for both supervised and unsupervised
          ...(result.metrics && { metrics: result.metrics }),
          
          // Unsupervised specific
          ...(result.mode === 'unsupervised' && {
            numClusters: result.numClusters,
            cluster_distribution: result.cluster_distribution,
            explainedVariance: result.explainedVariance
          }),
          
          // Supervised specific  
          ...(result.mode === 'supervised' && {
            target_column: targetColumn,
            feature_importances: result.feature_importances
          }),
          
          // Model-specific info
          ...(model === 'dbscan' && result.labels && {
            noise_points: result.labels.filter((l: number) => l === -1).length,
            total_points: result.labels.length
          })
        };
        const resp = await fetch("http://localhost:8010/mistral_chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results:resultForMistral }),
        });
      
        const json = await resp.json();
        setExplanation(json.answer || json.explanation || "");
      } catch (e: any) {
        console.error("Explain error:", e);
        setExplainError(e.message || "Failed to get explanation");
      } finally {
        setExplaining(false);
        
      }
      setActiveTab("results");
    } catch (e: any) {
      console.error("Classification error:", e);
      setError(e.message || "Failed to run classification");
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
        <TabsTrigger value="results" disabled={!classificationResult || explaining}>Results</TabsTrigger>
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
              {/* Model parameter fields */}
              {model === "kmeans" && (
                <div className="mt-4 space-y-1">
                  <Label htmlFor="kmeansClusters" className="block text-xs font-medium text-gray-700">Number of Clusters (k)</Label>
                  <Input
                    id="kmeansClusters"
                    type="number"
                    min={2}
                    max={20}
                    value={kmeansClusters}
                    onChange={e => setKmeansClusters(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              )}
              {model === "dbscan" && (
                <div className="mt-4 flex gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="dbscanEps" className="block text-xs font-medium text-gray-700">Epsilon (eps)</Label>
                    <Input
                      id="dbscanEps"
                      type="number"
                      step={0.01}
                      min={0.01}
                      max={10}
                      value={dbscanEps}
                      onChange={e => setDbscanEps(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dbscanMinSamples" className="block text-xs font-medium text-gray-700">Min Samples</Label>
                    <Input
                      id="dbscanMinSamples"
                      type="number"
                      min={1}
                      max={100}
                      value={dbscanMinSamples}
                      onChange={e => setDbscanMinSamples(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>
              )}
              {model === "hierarchical" && (
                <div className="mt-4 space-y-1">
                  <Label htmlFor="hierarchicalClusters" className="block text-xs font-medium text-gray-700">Number of Clusters</Label>
                  <Input
                    id="hierarchicalClusters"
                    type="number"
                    min={2}
                    max={20}
                    value={hierarchicalClusters}
                    onChange={e => setHierarchicalClusters(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              )}
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
    <>
    
      {/* UNSUPERVISED RESULTS */}
      {classificationResult.mode === 'unsupervised' && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Clustering Summary ({model.toUpperCase()})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="text-sm text-muted-foreground">Number of Clusters</div>
                <div className="text-xl font-bold">{classificationResult.numClusters}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                <div className="text-sm text-muted-foreground">Silhouette Score</div>
                <div className="text-xl font-bold">
                  {classificationResult.metrics.silhouette != null
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

          {/* DBSCAN-specific */}
          {model === "dbscan" && classificationResult.labels && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">DBSCAN Noise Points</h3>
              <p className="text-sm">
                {classificationResult.labels.filter((l: number) => l === -1).length} points labeled as noise.
              </p>
            </Card>
          )}

          {/* Hierarchical-specific */}
          {model === "hierarchical" && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Hierarchical Clustering</h3>
              <p className="text-sm">
                Used agglomerative clustering; you can adjust linkage in the backend for different effects.
              </p>
            </Card>
          )}

          {/* Common distribution & PCA */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Cluster Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={Object.entries(classificationResult.cluster_distribution).map(
                  ([name, count]) => ({ name, count })
                )}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          {classificationResult.pca_coords && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">PCA Scatter</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name="PC1" />
                  <YAxis dataKey="y" name="PC2" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter
                    data={classificationResult.pca_coords.map((c: number[], i: number) => ({
                      x: c[0],
                      y: c[1],
                      cluster: classificationResult.labels[i],
                    }))}
                  >
                    {classificationResult.labels.map((lbl: number, idx: number) => (
                      <Cell
                        key={idx}
                        fill={
                          ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a28dd0"][lbl] ||
                          "#8884d8"
                        }
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* SUPERVISED RESULTS */}
      {classificationResult.mode === 'supervised' && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">
              {model === 'random_forest'
                ? 'Random Forest Metrics'
                : model === 'svm'
                ? 'SVM Metrics'
                : 'Classification Metrics'}
            </h3>
            <div className="space-y-2">
              {classificationResult.metrics &&
                Object.entries(classificationResult.metrics).map(([name, val]) => (
                  <div key={name} className="flex justify-between">
                    <span className="text-sm text-muted-foreground capitalize">
                      {name.replace('_', ' ')}
                    </span>
                    <span className="font-bold">
                      {typeof val === 'number' ? val.toFixed(2) : String(val)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Random Forest importances */}
          {model === 'random_forest' && classificationResult.feature_importances && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Feature Importances</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={Object.entries(classificationResult.feature_importances).map(
                    ([feat, imp]) => ({ feat, imp })
                  )}
                  layout="vertical"
                >
                  <XAxis type="number" />
                  <YAxis dataKey="feat" type="category" width={150} />
                  <Tooltip formatter={(v: any) => v.toFixed(4)} />
                  <Bar dataKey="imp" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* SVM & Logistic coefficients */}
          {['svm', 'logistic_regression', 'logistic'].includes(model) &&
            classificationResult.feature_importances && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Model Coefficients</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(classificationResult.feature_importances).map(
                      ([feat, coef]) => ({ feat, coef })
                    )}
                    layout="vertical"
                  >
                    <XAxis type="number" />
                    <YAxis dataKey="feat" type="category" width={150} />
                    <Tooltip formatter={(v: any) => v.toFixed(4)} />
                    <Bar dataKey="coef" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            
        </>
      )}
      {/* Explanation from AI */}
      <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-md">
        <h3 className="font-semibold mb-2 text-yellow-800 flex items-center gap-2">
          <span role="img" aria-label="lightbulb">💡</span> Results insight
        </h3>
        {explaining && <p className="text-sm text-yellow-700 animate-pulse">Generating explanation…</p>}
        {explainError && <p className="text-sm text-red-600 font-semibold">{explainError}</p>}
        {explanation && (
          <div className="rounded-md bg-white/80 border border-yellow-100 p-3 mt-2 text-yellow-900 shadow-inner text-[15px] leading-relaxed whitespace-pre-line">
            {explanation}
          </div>
        )}
      </Card>

       {/* Run & Continue */}
  <div className="flex gap-4">
    <Button
      onClick={handleRunClassification}
      disabled={loading || selectedFeatures.length === 0}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Running…
        </>
      ) : (
        "Run"
      )}
    </Button>

    <Button
      onClick={() => setShowExportModal(true)}
      disabled={!classificationResult}
    >
      Export Results
    </Button>
      {/* Export Preview Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Results Preview</DialogTitle>
          </DialogHeader>
          <pre className="bg-gray-100 rounded p-2 max-h-64 overflow-auto text-xs border mb-4">
            {classificationResult ? JSON.stringify(classificationResult, null, 2) : "No results to export."}
          </pre>
          <DialogFooter className="flex gap-4 justify-end">
            <Button
              variant="default"
              onClick={() => {
                if (classificationResult) {
                  const blob = new Blob([
                    JSON.stringify(classificationResult, null, 2)
                  ], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "classification_results.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }
                setShowExportModal(false);
              }}
              disabled={!classificationResult}
            >
              Download
            </Button>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
    </>
  )}
</TabsContent>

      </Tabs>
    </div>)}