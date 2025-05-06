import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";

export default function FeatureEvaluation({ data, onComplete }: { data: any; onComplete: () => void }) {
  const [evaluationData, setEvaluationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("Feature Evaluation Data (full):", data.feature_extraction); // Log the full structure

  // Convert feature_extraction to an array of arrays if it's an object
  var featureExtractionArray = Array.isArray(data.feature_extraction)
    ? data.feature_extraction
    : Object.values(data.feature_extraction).filter((row) => Array.isArray(row));

  console.log("Converted Feature Extraction Array:", featureExtractionArray); // Debug log
// Take a smaller subset of the data for testing
const subsetSize = 100; // Number of rows and columns to include
featureExtractionArray = featureExtractionArray
  .slice(0, subsetSize) // Take the first `subsetSize` rows
  .map((row) => row.slice(0, subsetSize)); // Take the first `subsetSize` columns
  // Dynamically generate placeholder feature names based on the number of columns
  const featureNames = featureExtractionArray.length > 0
    ? Array.from({ length: featureExtractionArray[0].length }, (_, i) => `feature_${i + 1}`)
    : [];

  console.log("Generated Placeholder Feature Names:", featureNames); // Debug log

  // Filter out rows with inconsistent dimensions
  const expectedLength = featureExtractionArray[0]?.length || 0;
  const validFeatureExtractionArray = featureExtractionArray.filter((
    (row: any[]) => row.length === expectedLength)
  );

  console.log("Valid Feature Extraction Array:", validFeatureExtractionArray);

  useEffect(() => {
    const fetchEvaluationData = async () => {
      try {
        // Validate the feature extraction data
        if (!validFeatureExtractionArray || validFeatureExtractionArray.length === 0) {
          console.error("No valid feature data available after filtering:", validFeatureExtractionArray);
          setError("No valid feature data available. Please ensure the feature extraction step is completed.");
          setIsLoading(false);
          return;
        }
        
        // Set a default config if none is provided
        const config = data.config || { metric: "variance" };

        // Prepare the transformed data for evaluation
        const transformedData = {
          X: validFeatureExtractionArray, // Use filtered numerical data
          features: featureNames, // Placeholder feature names
          config: config,
        };

        console.log("Transformed Data Sent to API:", JSON.stringify(transformedData, null, 2)); // Debug log

        setIsLoading(true);
        const response = await fetch("http://localhost:8002/evaluation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(transformedData),
        });

        if (!response.ok) {
          const errorResponse = await response.json();
          console.error("API Error Response:", errorResponse);
          throw new Error(errorResponse.error || `Error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("API Response:", result);
        setEvaluationData(result);
      } catch (err: any) {
        console.error("Error fetching evaluation data:", err);
        setError(err.message || "An error occurred while fetching evaluation data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluationData();
  }, [data]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-40">
      <p className="text-muted-foreground">Loading evaluation data...</p>
    </div>;
  }

  if (error) {
    return <div className="p-4 border border-red-300 bg-red-50 rounded-md">
      <p className="text-red-500">Error: {error}</p>
      <Button 
        variant="outline" 
        className="mt-2"
        onClick={onComplete}
      >
        Skip Evaluation and Continue
      </Button>
    </div>;
  }
  console.log("Feature Importance Data:", evaluationData.feature_importance);
  if (!evaluationData) {
    return <p>No feature importance data available.</p>;
}
  console.log("Evaluation Data from API:", evaluationData);
  const { feature_importance: featureImportance, correlation_matrix: correlationMatrix, feature_statistics: featureStatistics } = evaluationData;

  // Transform correlation data for visualization
  const correlationData = correlationMatrix?.map((item: any) => ({
    name: `${item.feature1}-${item.feature2}`,
    correlation: parseFloat((item.correlation * 100).toFixed(1))
  })) || [];

  // Sort feature importance for visualization
  const importanceData = featureImportance?.map((item: any) => ({
    name: item.feature,
    importance: isNaN(item.importance) ? 0 : parseFloat((item.importance * 100).toFixed(1)),
})) || [];

    // Get statistical metrics and features
    const statisticalMetrics = featureStatistics ? Object.keys(featureStatistics) : [];
    const statisticalFeatures = featureStatistics && statisticalMetrics.length > 0 
      ? Object.keys(featureStatistics[statisticalMetrics[0]] || {})
      : [];
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Feature Evaluation</h2>
      <p className="text-muted-foreground">
        Analyze the extracted features to understand their relationships and statistical properties.
      </p>

      <Tabs defaultValue="importance">
        <TabsList className="grid grid-cols-3 gap-2">
          <TabsTrigger value="importance">Feature Importance</TabsTrigger>
          <TabsTrigger value="correlation">Correlation Analysis</TabsTrigger>
          <TabsTrigger value="statistics">Feature Statistics</TabsTrigger>
        </TabsList>

        {/* Feature Importance Tab */}
        <TabsContent value="importance" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-lg font-medium mb-4">Feature Importance</h3>
              {importanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={importanceData.slice(0, 10)} // Show top 10 features
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Importance']} />
                    <Legend />
                    <Bar dataKey="importance" fill="#8884d8" name="Importance (%)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground">No feature importance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation Matrix Tab */}
        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-lg font-medium mb-4">Top Feature Correlations</h3>
              {correlationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={correlationData.slice(0, 10)} // Show top 10 correlations
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[-100, 100]} />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Correlation']} />
                    <Legend />
                    <Bar dataKey="correlation" name="Correlation (%)">
                      {correlationData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.correlation >= 0 ? "#82ca9d" : "#ff7373"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground">No correlation data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <h3 className="text-lg font-medium mb-4">Correlation Table</h3>
              {correlationMatrix && correlationMatrix.length > 0 ? (
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature 1</TableHead>
                        <TableHead>Feature 2</TableHead>
                        <TableHead>Correlation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {correlationMatrix.map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{item.feature1}</TableCell>
                          <TableCell>{item.feature2}</TableCell>
                          <TableCell className={
                            Math.abs(item.correlation) > 0.7 ? 'font-bold text-blue-600' : 
                            Math.abs(item.correlation) > 0.5 ? 'text-blue-500' : ''
                          }>
                            {(item.correlation * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No correlation data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-lg font-medium mb-4">Feature Statistics</h3>
              {featureStatistics && statisticalFeatures.length > 0 ? (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        {statisticalMetrics.filter(metric => metric !== 'categorical').map((metric) => (
                        <TableHead key={metric}>{metric.charAt(0).toUpperCase() + metric.slice(1)}</TableHead>
                      ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {statisticalFeatures.map((feature: string) => (
                      <TableRow key={feature}>
                        <TableCell className="font-medium">{feature}</TableCell>
                        {statisticalMetrics.filter(metric => metric !== 'categorical').map((metric) => (
                          <TableCell key={`${feature}-${metric}`}>
                            {featureStatistics[metric] && featureStatistics[metric][feature] !== undefined 
                              ? typeof featureStatistics[metric][feature] === 'number' 
                                ? featureStatistics[metric][feature].toFixed(2)
                                : featureStatistics[metric][feature]
                              : 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No statistical data available</p>
              )}
            </CardContent>
          </Card>

          {featureStatistics?.categorical && Object.keys(featureStatistics.categorical).length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-lg font-medium mb-4">Categorical Features Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(featureStatistics.categorical).map(([feature, values]: [string, any]) => (
                    <Card key={feature} className="p-4">
                      <h4 className="font-medium mb-2">{feature}</h4>
                      <div className="max-h-60 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Value</TableHead>
                              <TableHead>Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(values).map(([value, count]: [string, any]) => (
                              <TableRow key={value}>
                                <TableCell>{value}</TableCell>
                                <TableCell>{count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" onClick={() => console.log("Filter button clicked")}>
          Filter Features
        </Button>
        <Button onClick={onComplete}>Continue</Button>
      </div>
    </div>
  );
}