// app/new-analysis/page.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Info, Check, LineChart, CheckCircle, Upload, FileType, Database, X, ChevronLeft} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar" 
import Link from "next/link";
export default function NewAnalysisPage() {
  const router = useRouter();
  const [analysisName, setAnalysisName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const [targetVariable, setTargetVariable] = useState("");
  const [method, setMethod] = useState("auto");
  const [loading, setLoading] = useState(false);

  const OtherPageContent = dynamic(() => import("@/app/importData/page"), { ssr: false });
  
  // Import data modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMethod, setImportMethod] = useState("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataSource, setDataSource] = useState("");
  const [importError, setImportError] = useState("");
  const [importingData, setImportingData] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const datasets = [
    { id: "ds1", name: "Customer Churn Data", features: 25, rows: 10240 },
    { id: "ds2", name: "Sales Prediction", features: 18, rows: 5823 },
    { id: "ds3", name: "Medical Diagnosis", features: 42, rows: 8976 },
  ];
  
  const featureColumns = [
    "age", "income", "education", "occupation", "location", "customer_tenure", 
    "purchase_frequency", "last_purchase", "total_spent", "product_category"
  ];
  
  const handleStartAnalysis = () => {
    setLoading(true);
    // Simulate analysis startup
    setTimeout(() => {
      setLoading(false);
      router.push("/");
    }, 1500);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setImportError("");
  };
  
  const handleImportData = () => {
    setImportingData(true);
    // Simulate import process
    setTimeout(() => {
      setImportingData(false);
      
      if (importMethod === "file" && !selectedFile) {
        setImportError("Please select a file to import");
        return;
      }
      if (importMethod === "database" && !dataSource) {
        setImportError("Please select a data source");
        return;
      }
      
      // Simulate successful import
      const newDatasetId = `imported-${Date.now()}`;
      const newDatasetName = selectedFile ? selectedFile.name : 
                            dataSource ? `${dataSource} Dataset` : "API Dataset";
      
      setDatasetId(newDatasetId);
      setSelectedDatasetName(newDatasetName);
      setImportModalOpen(false);
      
      // Reset import form
      setSelectedFile(null);
      setDataSource("");
      setImportError("");
    }, 1500);
  };
  
  return (
     <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-col min-h-screen">
              <header className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <span className="font-medium text-foreground">New Feature Selection</span>
              </div>
              <div className="flex items-center space-x-2">
                <Link href="/dashboard" passHref><Button variant="outline" size="sm">
                <ChevronLeft />
                              Back
                    </Button></Link>
                     </div>
              </header>
              
            <div className="container mx-auto py-10">
      
      <p className="text-gray-500 mb-8">
        Configure a new analysis to identify the most relevant features for your model.
      </p>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="analysis-name">Analysis Name</Label>
                <Input 
                  id="analysis-name" 
                  placeholder="E.g., Customer Churn Feature Selection"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dataset">Dataset</Label>
                <div className="flex gap-2">
                  <Select 
                    value={datasetId} 
                    onValueChange={(value) => {
                      setDatasetId(value);
                      const dataset = datasets.find(d => d.id === value);
                      if (dataset) {
                        setSelectedDatasetName(dataset.name);
                      }
                    }}
                  >
                    <SelectTrigger id="dataset" className="flex-1">
                      <SelectValue placeholder="Choose a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map(dataset => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.features} features, {dataset.rows.toLocaleString()} rows)
                        </SelectItem>
                      ))}
                      
                      {selectedDatasetName && !datasets.some(d => d.name === selectedDatasetName) && (
                        <SelectItem value={datasetId}>
                          {selectedDatasetName}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                      <Button>Import New Data</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl h-auto max-h-[85vh]">
                      <DialogHeader>
                        <DialogTitle>Import Data for Analysis</DialogTitle>
                        <DialogDescription>
                          Import your dataset for feature selection analysis
                        </DialogDescription>
                      </DialogHeader>
                      
                      {isOpen && <OtherPageContent />}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target">Target Variable</Label>
                <Select onValueChange={setTargetVariable}>
                  <SelectTrigger id="target">
                    <SelectValue placeholder="Select target variable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="churn">churn (boolean)</SelectItem>
                    <SelectItem value="customer_lifetime_value">customer_lifetime_value (numeric)</SelectItem>
                    <SelectItem value="category">category (categorical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Feature Selection Method</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Different methods optimize for different goals. Automatic will choose the best method based on your data characteristics.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <Tabs defaultValue="auto" onValueChange={setMethod} className="w-full">
                  <TabsList className="grid grid-cols-4">
                    <TabsTrigger value="auto">Automatic</TabsTrigger>
                    <TabsTrigger value="filter">Filter Methods</TabsTrigger>
                    <TabsTrigger value="wrapper">Wrapper Methods</TabsTrigger>
                    <TabsTrigger value="embedded">Embedded Methods</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="auto" className="pt-4">
                    <div className="p-4 bg-gray-50 rounded-md">
                      <h4 className="font-medium mb-2 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Automatic Selection
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Our algorithm will automatically select the best feature selection technique based on your data characteristics and target variable.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="auto-performance" defaultChecked />
                          <Label htmlFor="auto-performance">Optimize for model performance</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="auto-interpretability" />
                          <Label htmlFor="auto-interpretability">Prioritize interpretability</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="auto-balance" />
                          <Label htmlFor="auto-balance">Balance performance and feature count</Label>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Other TabsContent components remain the same */}
                  <TabsContent value="filter" className="pt-4">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Filter methods evaluate features independently of the model.
                      </p>
                      <RadioGroup defaultValue="correlation">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="correlation" id="correlation" />
                          <Label htmlFor="correlation">Correlation Analysis</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="chi-square" id="chi-square" />
                          <Label htmlFor="chi-square">Chi-Square Test</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mutual-info" id="mutual-info" />
                          <Label htmlFor="mutual-info">Mutual Information</Label>
                        </div>
                      </RadioGroup>
                      
                      <div className="space-y-2">
                        <Label>Feature Selection Threshold</Label>
                        <div className="flex items-center gap-4">
                          <Slider defaultValue={[0.25]} max={1} step={0.01} className="flex-1" />
                          <span className="w-12 text-right">0.25</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="wrapper" className="pt-4">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Wrapper methods use a model to evaluate feature subsets.
                      </p>
                      <RadioGroup defaultValue="forward">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="forward" id="forward" />
                          <Label htmlFor="forward">Forward Selection</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="backward" id="backward" />
                          <Label htmlFor="backward">Backward Elimination</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="recursive" id="recursive" />
                          <Label htmlFor="recursive">Recursive Feature Elimination</Label>
                        </div>
                      </RadioGroup>
                      
                      <div className="space-y-2">
                        <Label>Base Model</Label>
                        <Select defaultValue="random-forest">
                          <SelectTrigger>
                            <SelectValue placeholder="Select base model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="random-forest">Random Forest</SelectItem>
                            <SelectItem value="logistic">Logistic Regression</SelectItem>
                            <SelectItem value="xgboost">XGBoost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="embedded" className="pt-4">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Embedded methods perform feature selection during model training.
                      </p>
                      <RadioGroup defaultValue="lasso">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lasso" id="lasso" />
                          <Label htmlFor="lasso">Lasso Regression</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ridge" id="ridge" />
                          <Label htmlFor="ridge">Ridge Regression</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="elastic-net" id="elastic-net" />
                          <Label htmlFor="elastic-net">Elastic Net</Label>
                        </div>
                      </RadioGroup>
                      
                      <div className="space-y-2">
                        <Label>Regularization Strength</Label>
                        <div className="flex items-center gap-4">
                          <Slider defaultValue={[0.1]} min={0.01} max={1} step={0.01} className="flex-1" />
                          <span className="w-12 text-right">0.1</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
          
          {/* Advanced Settings card remains the same */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="validation">
                <TabsList className="w-full">
                  <TabsTrigger value="validation" className="flex-1">Validation</TabsTrigger>
                  <TabsTrigger value="preprocessing" className="flex-1">Preprocessing</TabsTrigger>
                  <TabsTrigger value="computation" className="flex-1">Computation</TabsTrigger>
                </TabsList>
                
                <TabsContent value="validation" className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Cross-Validation Strategy</Label>
                    <Select defaultValue="k-fold">
                      <SelectTrigger>
                        <SelectValue placeholder="Select validation strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="k-fold">K-Fold (k=5)</SelectItem>
                        <SelectItem value="stratified">Stratified K-Fold</SelectItem>
                        <SelectItem value="time-series">Time Series Split</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Evaluation Metric</Label>
                    <Select defaultValue="accuracy">
                      <SelectTrigger>
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accuracy">Accuracy</SelectItem>
                        <SelectItem value="f1">F1 Score</SelectItem>
                        <SelectItem value="auc">AUC-ROC</SelectItem>
                        <SelectItem value="rmse">RMSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                
                <TabsContent value="preprocessing" className="pt-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="handle-missing" defaultChecked />
                    <Label htmlFor="handle-missing">Automatically handle missing values</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="normalize" defaultChecked />
                    <Label htmlFor="normalize">Normalize numerical features</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="encode" defaultChecked />
                    <Label htmlFor="encode">Encode categorical features</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="outliers" />
                    <Label htmlFor="outliers">Remove outliers</Label>
                  </div>
                </TabsContent>
                
                <TabsContent value="computation" className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Computation Resources</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue placeholder="Select resource allocation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (1 core)</SelectItem>
                        <SelectItem value="medium">Medium (2 cores)</SelectItem>
                        <SelectItem value="high">High (4 cores)</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Time Limit</Label>
                    <Select defaultValue="unlimited">
                      <SelectTrigger>
                        <SelectValue placeholder="Select time limit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30min">30 minutes</SelectItem>
                        <SelectItem value="1hr">1 hour</SelectItem>
                        <SelectItem value="6hr">6 hours</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-gray-600">{analysisName || "Not specified"}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Dataset</p>
                <p className="text-sm text-gray-600">
                  {selectedDatasetName || (datasetId ? datasets.find(d => d.id === datasetId)?.name : "Not selected")}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Target Variable</p>
                <p className="text-sm text-gray-600">{targetVariable || "Not selected"}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Selection Method</p>
                <p className="text-sm text-gray-600 capitalize">{method}</p>
              </div>
              
              <div className="pt-4">
                <h4 className="text-sm font-medium mb-2">Estimated Results</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>Feature Reduction</span>
                    <span className="font-medium">40-60%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Performance Impact</span>
                    <span className="font-medium text-green-600">+2-5%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Estimated Duration</span>
                    <span className="font-medium">15-20 min</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                disabled={!analysisName || !datasetId || !targetVariable || loading}
                onClick={handleStartAnalysis}
              >
                {loading ? "Starting Analysis..." : "Start Analysis"}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start">
                  <Check className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                  <span>Automatic method is recommended for most use cases</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                  <span>Filter methods are faster but may be less accurate</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                  <span>Wrapper methods are more thorough but computationally intensive</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                  <span>Embedded methods offer good balance between speed and accuracy</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end">
        <Button variant="outline" className="mr-2" onClick={() => router.push("/")}>
          Cancel
        </Button>
      </div>
    </div>
    </div>
    </SidebarInset>
    </SidebarProvider>
         
         
  );
}