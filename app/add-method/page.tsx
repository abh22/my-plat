"use client"

import React, { useState, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AlertCircle, CheckCircle, Download } from "lucide-react"

export default function AddMethodPage() {
  const [methodName, setMethodName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null)
  const [uploadedMethods, setUploadedMethods] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing methods when component mounts
  React.useEffect(() => {
    fetchMethods()
  }, [])
  const fetchMethods = async () => {
    try {
      const response = await fetch("http://localhost:8000/list-methods/")
      const data = await response.json()
      if (data.methods) {
        setUploadedMethods(data.methods)
      }
    } catch (error) {
      console.error("Error fetching methods:", error)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch("http://localhost:8000/method-template/")
      const data = await response.json()
      
      // Create a download link for the template
      const blob = new Blob([data.template], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "method_template.py"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading template:", error)
      setNotification({
        type: "error",
        message: "Failed to download template"
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      // Check if file is a Python file
      if (!selected.name.endsWith('.py')) {
        setNotification({ type: 'error', message: 'Only Python (.py) files are allowed' })
        return
      }
      setFile(selected)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!methodName.trim()) {
      setNotification({ type: 'error', message: 'Method name is required' })
      return
    }
    
    if (!description.trim()) {
      setNotification({ type: 'error', message: 'Description is required' })
      return
    }
    
    if (!category) {
      setNotification({ type: 'error', message: 'Please select a category' })
      return
    }
    
    if (!file) {
      setNotification({ type: 'error', message: 'Please select a Python file' })
      return
    }
    
    // Submit the form
    setIsSubmitting(true)
    
    try {
      const formData = new FormData()
       formData.append('method_file', file)
       formData.append("method_name", methodName)
       formData.append("description", description)
       formData.append("category", category)
       
       const response = await fetch("http://localhost:8000/upload-method/", {
         method: "POST",
         body: formData,
       })
       
       const data = await response.json()
       
       if (response.ok) {
         // Reset form
         setMethodName("")
         setDescription("")
         setCategory("")
         setFile(null)
         if (fileInputRef.current) {
           fileInputRef.current.value = ""
         }
         
         // Show success message
         setNotification({
           type: "success",
           message: "Method uploaded successfully"
         })
         
         // Refresh the methods list
         fetchMethods()
       } else {
         setNotification({
           type: "error",
           message: data.detail || "Failed to upload method"
         })
       }
     } catch (error) {
       console.error("Error uploading method:", error)
       setNotification({
         type: "error",
         message: "An error occurred while uploading the method"
       })
     } finally {
       setIsSubmitting(false)
     }
   }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <AppSidebar />
      <div className="flex flex-col">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold md:text-2xl">Add Method</h1>
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
          </div>

          {/* Notification */}
          {notification && (
            <div className={`p-4 rounded-md flex items-center gap-2 ${
              notification.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}>
              {notification.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <p>{notification.message}</p>
            </div>
          )}

          <div className="border shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Method Configuration</h2>
            <p className="text-gray-500 mb-6">
              Upload custom Python preprocessing methods to extend the platform's capabilities.
              Each method should contain a <code className="bg-gray-100 px-1 rounded">process_data(df, params)</code> function.
            </p>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="methodName" className="text-sm font-medium">Method Name</label>
                <input 
                  id="methodName"
                  type="text" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter method name"
                  value={methodName}
                  onChange={(e) => setMethodName(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="methodDescription" className="text-sm font-medium">Description</label>
                <textarea 
                  id="methodDescription"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter method description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="methodCategory" className="text-sm font-medium">Category</label>
                <select 
                  id="methodCategory"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select a category</option>
                  <option value="classification">Classification</option>
                  <option value="feature-extraction">Feature Extraction</option>
                  <option value="preprocessing">Preprocessing</option>
                  <option value="visualization">Visualization</option>
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium">Python File</label>
                <input
                  ref={fileInputRef}
                  id="methodFile"
                  type="file"
                  accept=".py"
                  onChange={handleFileChange}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload a Python file containing your custom method. The file must include a 
                  <code className="bg-gray-100 px-1 rounded ml-1">process_data(df, params)</code> function.
                </p>
              </div>
              
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Uploading..." : "Upload Method"}
                </button>
              </div>
            </form>
          </div>

          {/* Display existing methods */}
          <div className="border shadow-sm rounded-lg p-6 mt-4">
            <h2 className="text-xl font-semibold mb-4">Uploaded Methods</h2>
            
            {uploadedMethods.length === 0 ? (
              <p className="text-gray-500">No methods have been uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">File</th>
                      <th className="text-left p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedMethods.map((method, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                        <td className="p-2">{method.name}</td>
                        <td className="p-2 font-mono text-xs">{method.filename}</td>
                        <td className="p-2">{method.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
