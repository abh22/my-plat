// app/import-data/page.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Upload, FileType, Database } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ImportDataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMethod, setImportMethod] = useState("file");
  const [dataSource, setDataSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setError("");
  };
  const router = useRouter();
  const handleImport = () => {
    setLoading(true);
    // Simulate import process
    setTimeout(() => {
      setLoading(false);
      if (importMethod === "file" && !selectedFile) {
        setError("Please select a file to import");
        return;
      }
      if (importMethod === "database" && !dataSource) {
        setError("Please select a data source");
        return;
      }
      // Redirect to dashboard after successful import
      router.push("/");
    }, 1500);
  };
  
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>
      <p className="text-gray-500 mb-8">
        Import your dataset for feature selection analysis. Support for CSV, Excel, and database connections.
      </p>
      
      <Tabs defaultValue="file" onValueChange={setImportMethod}>
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="file">File Upload</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">Sensor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="file">
          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>
                Upload CSV, Excel, or other structured data files for analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-4" />
                <p className="mb-2">Drag and drop your file here or click to browse</p>
                <p className="text-sm text-gray-500 mb-4">Supported formats: .csv, .xlsx, .json</p>
                <Input 
                  type="file" 
                  className="hidden" 
                  id="file-upload" 
                  accept=".csv,.xlsx,.json"
                  onChange={handleFileChange}
                />
                <Button asChild>
                  <label htmlFor="file-upload">Select File</label>
                </Button>
              </div>
              
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <FileType size={20} />
                  <span>{selectedFile.name}</span>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="preprocessing">Preprocessing Options</Label>
                <Select>
                  <SelectTrigger id="preprocessing">
                    <SelectValue placeholder="Select preprocessing options" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="standardize">Standardize numeric features</SelectItem>
                    <SelectItem value="normalize">Normalize data</SelectItem>
                    <SelectItem value="missing">Handle missing values</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || loading}
                className="w-full"
              >
                {loading ? "Importing..." : "Import Data"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle>Database Connection</CardTitle>
              <CardDescription>
                Connect directly to your database to import data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-type">Database Type</Label>
                <Select onValueChange={setDataSource}>
                  <SelectTrigger id="db-type">
                    <SelectValue placeholder="Select database type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="sqlserver">SQL Server</SelectItem>
                    <SelectItem value="bigquery">BigQuery</SelectItem>
                    <SelectItem value="snowflake">Snowflake</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="connection-string">Connection String</Label>
                <Input 
                  id="connection-string" 
                  placeholder="Enter connection string or credentials"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="query">SQL Query</Label>
                <textarea 
                  id="query" 
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="SELECT * FROM table WHERE..."
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleImport} 
                disabled={!dataSource || loading}
                className="w-full"
              >
                {loading ? "Connecting..." : "Connect & Import"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Integration</CardTitle>
              <CardDescription>
                Import data from external APIs or web services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">API Endpoint URL</Label>
                <Input 
                  id="api-url" 
                  placeholder="https://api.example.com/data"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-method">Request Method</Label>
                <Select>
                  <SelectTrigger id="api-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="get">GET</SelectItem>
                    <SelectItem value="post">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-headers">Headers (JSON)</Label>
                <Input 
                  id="api-headers" 
                  placeholder='{"Authorization": "Bearer token"}'
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-body">Request Body (JSON)</Label>
                <textarea 
                  id="api-body" 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder='{"query": "select * from table"}'
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleImport}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Fetching Data..." : "Fetch Data"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="mt-8 flex justify-end">
        <Button variant="outline" className="mr-2" onClick={() => router.push("/")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}