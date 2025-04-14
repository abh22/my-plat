"use client"

import { useState } from "react"
import { Upload, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DataImport({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [url, setUrl] = useState("")
  const [activeTab, setActiveTab] = useState("upload")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("Files selected:", e.target.files.length)
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = () => {
    const importData = {
      method: activeTab,
      files: files.map((f) => f.name),
      fileObjects: files, // storing file
      url: url,
    }
    console.log("Submitting import data:", importData)
    console.log("File objects included:", files.length)
    onComplete(importData)
  }

  return (
    <div className="space-y-6">
      {/* <p className="text-muted-foreground">
        Import your dataset by uploading files or providing a URL to your data source.
      </p>

      <Tabs defaultValue="upload" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="url">From URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4"> */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV, Excel, JSON (up to 10MB)</p>
                <div className="relative"><Input
                  id="file-upload"
                  type="file"
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                  onChange={handleFileChange}
                  multiple
                  accept=".csv,.xlsx,.json"
                />
               
                  <Button  variant="outline" className="gap-2">
                    <FileUp className="h-4 w-4" />
                    Select Files
                  </Button>
                  </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Selected files:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {files.map((file, index) => (
                      <li key={index} className="flex items-center">
                        <span>{file.name}</span>
                        <span className="ml-2 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        

        {/* <TabsContent value="url">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="url">Data Source URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/data.csv"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter the URL of your CSV, Excel, or JSON data source</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={(activeTab === "upload" && files.length === 0) || (activeTab === "url" && !url)}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

