"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DataPreprocessing({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [selectedOperations, setSelectedOperations] = useState<string[]>([])
  const [missingValues, setMissingValues] = useState("mean")
  const [normalizationMethod, setNormalizationMethod] = useState("minmax")
  const [outlierThreshold, setOutlierThreshold] = useState("1.5")
  const [encodingMethod, setEncodingMethod] = useState("onehot")
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const visualizationData = data.visualization || {}
  const dataSummary = visualizationData.dataSummary || {}
  const columns = dataSummary.columns || []
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [processedData, setProcessedData] = useState<any>(null)

  useEffect(() => {
    if (columns && columns.length > 0) {
      setSelectedColumns(columns)
    }
  }, [columns])

  const handleOperationToggle = (operation: string) => {
    setSelectedOperations((prev) =>
      prev.includes(operation) ? prev.filter((op) => op !== operation) : [...prev, operation],
    )
  }

  const handleColumnToggle = (column: string) => {
    setSelectedColumns((prev) => (prev.includes(column) ? prev.filter((col) => col !== column) : [...prev, column]))
  }

  const handleRun = async () => {
    // Clear previous message when running again
    setResultMessage(null)
    setMessageType(null)
    setIsLoading(true)
    
    const config = {
      operations: selectedOperations,
      columns: selectedColumns,
      settings: {
        missingValues,
        normalizationMethod,
        outlierThreshold: Number.parseFloat(outlierThreshold),
        encodingMethod,
      },
    }
    const formData = new FormData()
    formData.append("config", JSON.stringify(config))
    const fileObject = data.data_import?.fileObjects?.[0] || data.file
    if (!fileObject) {
    console.error("No file object found");
    setResultMessage("No file found to process");
    setMessageType("error");
    setIsLoading(false);
    return;
  }
  
  formData.append("file", fileObject);
    
    try {
      const res = await fetch("http://localhost:8000/preprocess", {
        method: "POST",
        body: formData,
      })
      const result = await res.json()
      
      if (result.preview) {
        console.log("Preview data:", result.preview)
      }
      if (result.message) {
        console.log("Message:", result.message)
        setResultMessage(result.message)
        setMessageType("success")
        setProcessedData(result.processedData)
        
    
      }
    } catch (err) {
      console.error("Error in preprocessing", err)
      setResultMessage("An error occurred during preprocessing.")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = () => {
    if (processedData) {
      // Pass the processed data to the onComplete callback
      onComplete(processedData);
      console.log("fetures_names:", processedData.featureNameMapping)
      
    } else {
      console.error("No processed data available to proceed.");
      setResultMessage("Please run preprocessing before continuing.");
      setMessageType("error");
    }
  };

  // Render the appropriate alert based on message type
  const renderAlert = () => {
    if (!resultMessage) return null
    
    if (messageType === "success") {
      return (
        <div className="flex justify-center mb-6">
          <Alert variant="default" className="bg-green-50 border-green-200 max-w-fit inline-block flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{resultMessage}</AlertTitle>
        
          </Alert>
        </div>
      )
    } else if (messageType === "error") {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{resultMessage}</AlertDescription>
        </Alert>
      )
    }
    return null
  }
 
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Clean and transform your data to prepare it for analysis and modeling.</p>

      {/* Display the styled alert message */}
      {renderAlert()}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Preprocessing Operations</h3>
            <div className="space-y-3">
              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("missing")}
                  onCheckedChange={() => handleOperationToggle("missing")}
                />
                <span>Handle Missing Values</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("normalize")}
                  onCheckedChange={() => handleOperationToggle("normalize")}
                />
                <span>Normalize Data</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("outliers")}
                  onCheckedChange={() => handleOperationToggle("outliers")}
                />
                <span>Remove Outliers</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedOperations.includes("encode")}
                  onCheckedChange={() => handleOperationToggle("encode")}
                />
                <span>Encode Categorical Variables</span>
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Apply to Columns</h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {columns.map((column: string) => (
                <Label key={column} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => handleColumnToggle(column)}
                  />
                  <span>{column}</span>
                </Label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button 
          onClick={handleRun} 
          disabled={selectedOperations.length === 0 || selectedColumns.length === 0 || isLoading}
        >
          {isLoading ? "Processing..." : "Run"}
        </Button>
        <Button onClick={handleSubmit} disabled={
          isLoading 
        }>
          Continue
        </Button>
      </div>
    </div>
  )
}