
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
   export default function SelectedFeatures() {    
     const [selectedFile, setSelectedFile] = useState<File | null>(null);
     const [importMethod, setImportMethod] = useState("file");
     
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState("");
     
     
     const router = useRouter();
     const handleExtract = () => {
       setLoading(true);
       // Simulate import process
       setTimeout(() => {
         setLoading(false);
         
         // Redirect to dashboard after successful import
         router.push("/");
       }, 1500);
     };
     
     return (
       <div className="container mx-auto py-10">
         <h1 className="text-3xl font-bold mb-6">Selected features</h1>
         <p className="text-gray-500 mb-8">
           Preview of the most important features selected for analysis:
         </p>
         
        
           
          
             <Card>
               <CardHeader>
                 <CardTitle>Features extraction</CardTitle>
                 <CardDescription>
                   Want to proceed with features extraction? 
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 
          
                 <Button 
                   onClick={handleExtract}
                   disabled={loading}
                   className="w-full"
                 >
                   {loading ? "Extracting..." : "Extract features"}
                 </Button></CardContent></Card></div>
              

            
   );
}