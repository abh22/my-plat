"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const radarColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F'];

export default function FeatureExtraction({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  // Derive available channels from preprocessing output or visualization if preprocessing was skipped
  const vizColumns = data.visualization?.dataSummary?.columns || [];
  // Replace rawRows initialization to include visualization data fallback
  const rawRows = data.preprocessing?.processedData || data.visualization?.dataSummary?.dataFrame || [];
  const availableChannels = rawRows.length
    ? Object.keys(rawRows[0])
    : vizColumns;
  // State for channel selection
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  // State for channel filter
  const [channelFilter, setChannelFilter] = useState("");
  // Compute filtered channels list
  const filteredChannels = useMemo(
    () => availableChannels.filter((ch: string) =>
      ch.toLowerCase().includes(channelFilter.toLowerCase())
    ),
    [availableChannels, channelFilter]
  );

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
  // New state for server-generated plot images and stats
  const [plots, setPlots] = useState<Record<string,string>>({});
  const [stats, setStats] = useState<Record<string,{mean: number; std: number}>>({});
  const [featureNameMapping, setFeatureNameMapping] = useState<any>(data.featureNameMapping || {});
  const [samplingRate, setSamplingRate] = useState("2500");  // Sampling rate for frequency methods (default 2500 Hz)
  const [windowSize, setWindowSize] = useState("256");  // Window length (samples) for sliding-window AR extraction
  const [windowStep, setWindowStep] = useState("128");  // Window step size (samples) for AR extraction
  // New state for custom methods
  const [customMethods, setCustomMethods] = useState<Array<{ name: string; filename: string; description: string; category: string }>>([]);
  // New state for AR feature plots
  const [arPlots, setArPlots] = useState<Record<string,string>>({});
  // Add state hooks for other custom method plots
  const [freqPlots, setFreqPlots] = useState<Record<string,string>>({});
  const [tdPlots, setTdPlots] = useState<Record<string,string>>({});
  const [entPlots, setEntPlots] = useState<Record<string,string>>({});
  const [wavPlots, setWavPlots] = useState<Record<string,string>>({});

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

  // Insert guard for missing preprocessing data
  const handleRun = async () => {
    setResultMessage(null);
    setMessageType(null);
    setIsLoading(true);
    // Determine source data: use preprocessed rows if available, else use original imported/visualized data
    const dataForExtraction = rawRows.length > 0
      ? rawRows
      : (data.visualization?.dataSummary?.dataFrame || data.data_import?.dataFrame || []);
    // Ensure there is data available for feature extraction
    if (dataForExtraction.length === 0) {
      setResultMessage("No data available for extraction. Please import or preprocess data first.");
      setMessageType("error");
      setIsLoading(false);
      return;
    }
  
    const config: any = {
      // methods may be simple filenames or 'filename:function'; backend should parse
      methods: selectedMethods,
      features: selectedFeatures,
      channels: selectedChannels,
      settings: {
        pcaComponents: Number.parseInt(pcaComponents),
        varianceThreshold: Number.parseFloat(varianceThreshold),
        polyDegree: Number.parseInt(polyDegree),
        targetColumn: targetColumn || undefined,
        sampling_rate: Number.parseFloat(samplingRate),  // pass sampling rate to backend
        windowSize: Number.parseInt(windowSize),  // windowing parameters for AR
        windowStep: Number.parseInt(windowStep),
      },
    };
  
    // Prepare multipart form data for extraction endpoint
    const formData = new FormData();
    formData.append("config", JSON.stringify(config));
    // Attach data as a JSON file for time-series extraction
    const fileBlob = new Blob([JSON.stringify(dataForExtraction)], { type: "application/json" });
    formData.append("file", fileBlob, "data.json");
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
      // Debug: log raw preview from backend
      console.log("Backend preview:", result.preview);

      if (result && result.preview) {
        // Save full processed data or fallback to normalized preview
        setProcessedData(result.processedData);
        setFeatureNameMapping(result.featureNameMapping || {});
        // Save plots and stats from backend
        setPlots(result.plots || {});
        setStats(result.stats || {});
        // Save AR feature plots if provided
        setArPlots(result.arPlots || {});
        // Normalize preview items into {feature,value}
        const normalized = (result.preview as any[]).map(item => {
          if (item && typeof item === 'object' && 'feature' in item && 'value' in item) {
            return { feature: item.feature, value: item.value };
          } else if (Array.isArray(item) && item.length >= 2) {
            return { feature: item[0], value: item[1] };
          } else if (item && typeof item === 'object') {
            const entries = Object.entries(item);
            if (entries.length === 1) {
              const [k,v] = entries[0];
              return { feature: k, value: v };
            }
          }
          return { feature: String(item), value: '' };
        });
        // Debug: log normalized preview array
        console.log("Normalized preview:", normalized);
        if (normalized.length > 0) {
          setExtractedFeatures(normalized);
          setResultMessage("Features extracted successfully");
          setMessageType("success");
        } else {
          setExtractedFeatures([]);
          setResultMessage("No features were extracted. Please check your selections.");
          setMessageType("error");
        }
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
  if (processedData && processedData.length > 0) {
    console.log("Passing full windowed AR features to evaluation:", processedData.length, "records");
    
    // Skip preview; use the complete processedData array of windowed feature records
    onComplete({
      extractedFeatures: processedData,
      featureExtraction: processedData,
      featureNameMap: featureNameMapping
    });
  } else {
    setResultMessage("Please run feature extraction before continuing.");
    setMessageType("error");
  }
};


  // Group extracted features by selected channels (exclude PCA group)
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, Array<{ name: string; value: any }>> = {};
    // Initialize groups for each selected channel
    selectedChannels.forEach((ch) => {
      groups[ch] = [];
    });
    extractedFeatures.forEach(({ feature, value }) => {
     // Skip multi-channel method features in per-channel grouping
     const lower = feature.toLowerCase();
     // Skip multi-channel method features (PCA, kernel PCA, SVD, ICA, t-SNE, Isomap)
     if (['pca','kernelpca','truncatedsvd','svd','ica','tsne','isomap'].some(m => lower.startsWith(m))) return;
      selectedChannels.forEach((ch) => {
        // Check mapping for composite methods
        const mapping = featureNameMapping[feature];
        if (Array.isArray(mapping) && mapping.includes(ch)) {
          groups[ch].push({ name: feature, value });
        } 
        // Channel-specific prefix
        else if (feature.startsWith(`${ch}_`)) {
          const name = feature.substring(ch.length + 1);
          groups[ch].push({ name, value });
        }
        // Catch features with channel embedded after a prefix (e.g., time_domain_ch1_mav)
        else if (feature.includes(`_${ch}_`)) {
          const parts = feature.split(`_${ch}_`);
          const name = parts[1];
          groups[ch].push({ name, value });
        }
        // Fallback: if feature contains channel substring anywhere
        else if (lower.includes(ch.toLowerCase())) {
          groups[ch].push({ name: feature, value });
        }
      });
    });
    return groups;
  }, [extractedFeatures, selectedChannels, featureNameMapping]);

  // Memoize dominant frequency preview entries
  const dominantPreview = useMemo(() => {
    return extractedFeatures
      .filter(item => item.feature.endsWith('_dominant_freq'))
      .map(item => {
        const [channel] = item.feature.split('_');
        return { channel, value: item.value };
      });
  }, [extractedFeatures]);

  // Memoize frequency-domain preview entries
  const freqPreview = useMemo(() => {
    const freqKeys = ['mean_power','total_power','mean_freq','median_freq','peak_freq'];
    const groups: Record<string, Array<{ name: string; value: number }>> = {};
    extractedFeatures.forEach(item => {
      const parts = item.feature.split('_');
      const channel = parts[0];
      const name = parts.slice(1).join('_');
      if (freqKeys.includes(name)) {
        if (!groups[channel]) groups[channel] = [];
        groups[channel].push({ name, value: Number(item.value) });
      }
    });
    return groups;
  }, [extractedFeatures]);

  // Memoize combined frequency-domain data for unified radar chart
  const combinedFreqData = useMemo(() => {
    const metrics = ['mean_power','total_power','mean_freq','median_freq','peak_freq'];
    return metrics.map(metric => {
      const entry: Record<string, any> = { metric };
      Object.entries(freqPreview).forEach(([ch, arr]) => {
        const m = arr.find(x => x.name === metric);
        entry[ch] = m ? m.value : 0;
      });
      return entry;
    });
  }, [freqPreview]);

  // Memoize time-domain preview entries
  const tdPreview = useMemo(() => {
    // Common time-domain feature keys
    const tdKeys = [
      'mav', 'rms', 'wl', 'zc', 'ssc', 'var', 'mean', 'std', 'min', 'max', 'ptp', 'skew', 'kurt'
    ];
    const groups: Record<string, Array<{ name: string; value: number }>> = {};
    extractedFeatures.forEach(item => {
      const parts = item.feature.split('_');
      const channel = parts[0];
      const name = parts.slice(1).join('_');
      if (tdKeys.includes(name)) {
        if (!groups[channel]) groups[channel] = [];
        groups[channel].push({ name, value: Number(item.value) });
      }
    });
    return groups;
  }, [extractedFeatures]);

  // Memoize combined time-domain data for unified radar chart
  const combinedTdData = useMemo(() => {
    const tdKeys = [
      'mav', 'rms', 'wl', 'zc', 'ssc', 'var', 'mean', 'std', 'min', 'max', 'ptp', 'skew', 'kurt'
    ];
    return tdKeys.map(feature => {
      const entry: Record<string, any> = { feature };
      Object.entries(tdPreview).forEach(([ch, arr]) => {
        const m = arr.find(x => x.name === feature);
        entry[ch] = m ? m.value : 0;
      });
      return entry;
    });
  }, [tdPreview]);

  // Memoize entropy preview entries
  const entropyPreview = useMemo(() => {
    return extractedFeatures
      .filter(item => item.feature.toLowerCase().includes('entropy'))
      .map(item => {
        const [channel] = item.feature.split('_');
        return { channel, value: item.value };
      });
  }, [extractedFeatures]);

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

  // Debug: log extractedFeatures for UI preview issues
  useEffect(() => {
    console.log("Extracted Features state:", extractedFeatures);
  }, [extractedFeatures]);

  return (
    <div className="space-y-6">
      {renderAlert()}
      {/* Validation: multi-channel methods require at least two channels */}
      {selectedMethods.some(m => ['pca','kernelPCA','truncatedSVD','fastICA','tsne','isomap'].includes(m)) && selectedChannels.length < 2 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Selection</AlertTitle>
          <AlertDescription>Selected dimensionality-reduction methods require at least two channels. Please select two or more channels.</AlertDescription>
        </Alert>
      )}
      {/* Two-column layout: channels on left, methods on right */}
      <div className="grid grid-cols-2 gap-4">
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
                filteredChannels.map((ch: string) => {
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
          </CardContent>
        </Card>
        
        {/* Built-in and Custom Methods Selection */}
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
                      {method.filename.toLowerCase().includes('ar_features') && selectedMethods.includes(method.filename) && (
                        <div className="mt-2 space-y-2 pl-6">
                          <div className="flex items-baseline space-x-2">
                            <Label htmlFor="windowSize" className="text-xs font-medium text-gray-700">Window Size:</Label>
                            <Input id="windowSize" type="number" value={windowSize} onChange={e => setWindowSize(e.target.value)} className="w-24" />
                          </div>
                          <div className="flex items-baseline space-x-2 pl-6">
                            <Label htmlFor="windowStep" className="text-xs font-medium text-gray-700">Step Size:</Label>
                            <Input id="windowStep" type="number" value={windowStep} onChange={e => setWindowStep(e.target.value)} className="w-24" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>  {/* end of grid-cols-2 cards */}
      {/* Unified Sampling Rate Input for Frequency Methods */}
      {selectedMethods.some(m => m.toLowerCase().includes("dominant") || m.toLowerCase().includes("frequency")) && (
        <div className="mt-4 flex items-center space-x-2">
          <Label htmlFor="samplingRate" className="text-sm font-medium text-gray-700">Sampling Rate (Hz):</Label>
          <Input
            id="samplingRate"
            type="number"
            step="any"
            value={samplingRate}
            onChange={(e) => setSamplingRate(e.target.value)}
            className="w-24"
          />
        </div>
      )}
      <div className="flex justify-end gap-3 mt-6">
        <Button
          onClick={handleRun}
          disabled={(selectedMethods.length === 0 || selectedChannels.length === 0 || (selectedChannels.length < 2 && selectedMethods.some(m => ['pca','kernelPCA','truncatedSVD','fastICA','tsne','isomap'].includes(m)))) || isLoading}
          className={`${!(selectedMethods.length === 0 || selectedChannels.length === 0 || (selectedChannels.length < 2 && selectedMethods.some(m => ['pca','kernelPCA','truncatedSVD','fastICA','tsne','isomap'].includes(m))) || isLoading) ? 'bg-amber-600 hover:bg-amber-700' : ''} min-w-[100px]`}
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

      {/* Dominant Frequency Preview */}
      {dominantPreview.length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Dominant Frequency by Channel</p>
          <div className="overflow-auto border rounded-lg bg-white shadow-sm p-2 mb-4">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-1 text-xs">Channel</TableHead>
                  <TableHead className="px-2 py-1 text-xs">Frequency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dominantPreview.map((d, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{d.channel}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{String(d.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Bar chart for dominant frequencies */}
          <svg width={300} height={120} className="mx-auto">
            {dominantPreview.map((d, i) => {
              const maxFreq = Math.max(...dominantPreview.map(x => x.value));
              const barCount = dominantPreview.length;
              const gap = 10;
              const barWidth = (300 - gap * (barCount - 1)) / barCount;
              const heightScale = maxFreq > 0 ? 80 / maxFreq : 0;
              const barHeight = d.value * heightScale;
              const x = i * (barWidth + gap);
              const y = 90 - barHeight;
              return (
                <g key={d.channel}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} fill="#4F46E5" />
                  <text x={x + barWidth/2} y={105} fontSize={10} textAnchor="middle" fill="#333">{d.channel}</text>
                  <text x={x + barWidth/2} y={y - 2} fontSize={8} textAnchor="middle" fill="#000">{d.value.toFixed(2)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Entropy Features Preview */}
      {entropyPreview.length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Entropy by Channel</p>
          {/* Table */}
          <div className="overflow-auto border rounded-lg bg-white shadow-sm p-2 mb-4">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-1 text-xs">Channel</TableHead>
                  <TableHead className="px-2 py-1 text-xs">Entropy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entropyPreview.map((d, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{d.channel}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{d.value.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Bar chart */}
          <svg width={300} height={160} className="mx-auto">
            {entropyPreview.map((d, i) => {
              const maxVal = Math.max(...entropyPreview.map(x => x.value));
              const barCount = entropyPreview.length;
              const gap = 10;
              const barWidth = (300 - gap * (barCount - 1)) / barCount;
              const scale = maxVal > 0 ? 80 / maxVal : 0;
              const barHeight = d.value * scale;
              const x = i * (barWidth + gap);
              const y = 90 - barHeight;
              return (
                <g key={d.channel}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} fill="#F59E0B" />
                  <text x={x + barWidth/2} y={105} fontSize={10} textAnchor="middle" fill="#333">{d.channel}</text>
                  <text x={x + barWidth/2} y={y - 2} fontSize={8} textAnchor="middle" fill="#000">{d.value.toFixed(2)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* All Extracted Features Preview */}
      {extractedFeatures.length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">All Extracted Features</p>
          <div className="overflow-auto border rounded-lg bg-white shadow-sm p-2">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-1 text-xs">Feature</TableHead>
                  <TableHead className="px-2 py-1 text-xs">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedFeatures.map((f, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{f.feature}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{String(f.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Extracted Features Preview as grouped accordions */}
      {extractedFeatures.length > 0 && selectedChannels.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="px-2 text-sm font-medium text-gray-700">Extracted Features by Channel</p>
          {Object.entries(groupedFeatures).filter(([_, feats]) => feats.length > 0).map(([channel, feats]) => (
            <details key={channel} open className="border rounded-lg bg-white shadow-sm">
              <summary className="px-4 py-2 bg-gray-100 cursor-pointer font-medium">{channel} ({feats.length})</summary>
              <div className="p-2 max-h-40 overflow-auto">
                <Table className="min-w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 py-1 text-xs">Feature</TableHead>
                      <TableHead className="px-2 py-1 text-xs">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feats.map((f, idx) => (
                      <TableRow key={idx} className="hover:bg-gray-50">
                        <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{f.name}</TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1 text-sm">{String(f.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Render sparkline plots and stats */}
      {Object.keys(plots).length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Component Sparklines & Stats</p>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(plots).map(([col, src]) => (
              <div key={col} className="space-y-1">
                <p className="text-xs font-medium text-gray-700">{col}</p>
                <img src={src} alt={`Sparkline of ${col}`} className="w-full h-16 object-contain" />
                {stats[col] && (
                  <p className="text-xs text-gray-600">mean: {stats[col].mean.toFixed(2)}, std: {stats[col].std.toFixed(2)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Render AR feature bar charts */}
      {Object.keys(arPlots).length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">AR Coefficients by Channel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(arPlots).map(([ch, src]) => (
              <div key={ch} className="space-y-1 bg-white p-2 rounded shadow-sm">
                <p className="text-xs font-medium text-gray-700">{ch}</p>
                <img src={src} alt={`AR coefficients for ${ch}`} className="w-full h-40 object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Render frequency-domain, time-domain, entropy, and wavelet plots if available */}
      {(Object.keys(freqPlots).length > 0 || Object.keys(tdPlots).length > 0 || Object.keys(entPlots).length > 0 || Object.keys(wavPlots).length > 0) && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Custom Method Plots</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Frequency-domain plots */}
            {Object.entries(freqPlots).map(([ch, src]) => (
              <div key={ch} className="space-y-1 bg-white p-2 rounded shadow-sm">
                <p className="text-xs font-medium text-gray-700">{ch} (Freq)</p>
                <img src={src} alt={`Frequency-domain plot for ${ch}`} className="w-full h-32 object-contain" />
              </div>
            ))}

            {/* Time-domain plots */}
            {Object.entries(tdPlots).map(([ch, src]) => (
              <div key={ch} className="space-y-1 bg-white p-2 rounded shadow-sm">
                <p className="text-xs font-medium text-gray-700">{ch} (Time)</p>
                <img src={src} alt={`Time-domain plot for ${ch}`} className="w-full h-32 object-contain" />
              </div>
            ))}

            {/* Entropy plots */}
            {Object.entries(entPlots).map(([ch, src]) => (
              <div key={ch} className="space-y-1 bg-white p-2 rounded shadow-sm">
                <p className="text-xs font-medium text-gray-700">{ch} (Entropy)</p>
                <img src={src} alt={`Entropy plot for ${ch}`} className="w-full h-32 object-contain" />
              </div>
            ))}

            {/* Wavelet plots */}
            {Object.entries(wavPlots).map(([ch, src]) => (
              <div key={ch} className="space-y-1 bg-white p-2 rounded shadow-sm">
                <p className="text-xs font-medium text-gray-700">{ch} (Wavelet)</p>
                <img src={src} alt={`Wavelet plot for ${ch}`} className="w-full h-32 object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frequency Radar Chart for frequency-domain features */}
      {Object.keys(freqPreview).length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Combined Frequency-Domain Radar</p>
          <div className="bg-white rounded-lg shadow-sm p-4 flex justify-center">
            <RadarChart outerRadius={120} width={600} height={500} data={combinedFreqData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis tick={false} axisLine={false} />
              {Object.keys(freqPreview).map((ch, idx) => (
                <Radar key={ch}
                  name={ch}
                  dataKey={ch}
                  stroke={radarColors[idx % radarColors.length]}
                  fill={radarColors[idx % radarColors.length]}
                  fillOpacity={0.5}
                  dot={false}
                />
              ))}
              <Legend verticalAlign="top" />
              <Tooltip />
            </RadarChart>
          </div>
        </div>
      )}

      {/* Time-domain Radar Chart for time-domain features */}
      {Object.keys(tdPreview).length > 0 && (
        <div className="mt-6">
          <p className="px-2 text-sm font-medium text-gray-700">Combined Time-Domain Radar</p>
          <div className="bg-white rounded-lg shadow-sm p-4 flex justify-center">
            <RadarChart outerRadius={120} width={600} height={500} data={combinedTdData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="feature" />
              <PolarRadiusAxis tick={false} axisLine={false} />
              {Object.keys(tdPreview).map((ch, idx) => (
                <Radar key={ch}
                  name={ch}
                  dataKey={ch}
                  stroke={radarColors[idx % radarColors.length]}
                  fill={radarColors[idx % radarColors.length]}
                  fillOpacity={0.5}
                  dot={false}
                />
              ))}
              <Legend verticalAlign="top" />
              <Tooltip />
            </RadarChart>
          </div>
        </div>
      )}
    </div>
  );
}