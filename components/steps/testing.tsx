"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function Testing({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [testResults, setTestResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSplitRatio, setTestSplitRatio] = useState("0.2")
  
  // Get classification data from previous step
  const classificationData = data?.classification || {}
  const models = classificationData?.trainedModels || []
  
  useEffect(() => {
    // Set the first model as selected if available
    if (models && models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name || models[0].id || "")
    }
  }, [models, selectedModel])

  const handleTest = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Prepare test data
      const testData = {
        modelName: selectedModel,
        testSplitRatio: parseFloat(testSplitRatio),
        // Include any processed data from the preprocessing step
        processedData: data?.preprocessing?.processedData || [],
        // Include feature mapping if available
        featureNameMapping: data?.preprocessing?.featureNameMapping || {}
      }
      
      // Call the test endpoint
      const response = await fetch("http://localhost:8000/test-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      })
      
      if (!response.ok) {
        throw new Error(`Test failed: ${response.statusText}`)
      }
      
      const results = await response.json()
      setTestResults(results)
    } catch (err: any) {
      setError(err.message || "Testing failed")
      console.error("Error testing model:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    onComplete({
      testResults,
      selectedModel,
      testSplitRatio: parseFloat(testSplitRatio)
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground mb-4">
        Test your trained model with a portion of your data to evaluate performance.
      </p>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Test Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="model-select">Select Model</Label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a trained model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length > 0 ? (
                      models.map((model: any, index: number) => (
                        <SelectItem key={index} value={model.name || model.id || `model-${index}`}>
                          {model.name || model.id || `Model ${index + 1}`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No models available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="test-split">Test Split Ratio</Label>
                <Input
                  id="test-split"
                  type="number"
                  min="0.1"
                  max="0.5"
                  step="0.05"
                  value={testSplitRatio}
                  onChange={(e) => setTestSplitRatio(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The proportion of data to use for testing (e.g., 0.2 = 20%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {testResults && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-4">Test Results</h3>
              
              <div className="space-y-3">
                {testResults.accuracy && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Accuracy</Label>
                    <p className="text-lg font-medium">{(testResults.accuracy * 100).toFixed(2)}%</p>
                  </div>
                )}
                
                {testResults.precision && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Precision</Label>
                    <p className="text-lg font-medium">{(testResults.precision * 100).toFixed(2)}%</p>
                  </div>
                )}
                
                {testResults.recall && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Recall</Label>
                    <p className="text-lg font-medium">{(testResults.recall * 100).toFixed(2)}%</p>
                  </div>
                )}
                
                {testResults.f1 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">F1 Score</Label>
                    <p className="text-lg font-medium">{(testResults.f1 * 100).toFixed(2)}%</p>
                  </div>
                )}
              </div>
              
              {testResults.confusionMatrix && (
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground mb-2">Confusion Matrix</Label>
                  <div className="bg-muted p-2 rounded text-xs overflow-x-auto">
                    <pre>{JSON.stringify(testResults.confusionMatrix, null, 2)}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="flex justify-end space-x-4">
        <Button
          onClick={handleTest}
          disabled={!selectedModel || isLoading || models.length === 0}
        >
          {isLoading ? "Testing..." : "Run Test"}
        </Button>
        
        <Button
          variant="default"
          onClick={handleComplete}
          disabled={!testResults || isLoading}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}