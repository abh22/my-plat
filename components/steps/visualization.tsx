"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { BarChart3, LineChart, PieChart, Table2, FileWarning, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar, Line, Pie } from "react-chartjs-2"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Input } from "@/components/ui/input"

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend)

// Type definitions for our data
type DataRow = Record<string, string | number>
type DataSet = {
  columns: string[]
  data: DataRow[]
}

export default function DataVisualization({ data, onComplete }: { data: any; onComplete: (data: any) => void }) {
  const [selectedChart, setSelectedChart] = useState("table")
  const [xAxis, setXAxis] = useState("")
  const [yAxis, setYAxis] = useState("")
  const [columns, setColumns] = useState<string[]>([])
  const [processedData, setProcessedData] = useState<DataSet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [ydataReport, setYdataReport] = useState<string | null>(null);
  
  const [boxplotReport, setBoxplotReport] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  // State for channel search filter
  const [channelFilter, setChannelFilter] = useState<string>("");
  // Filtered list based on search input
  const filteredColumns = useMemo(
    () => columns.filter(col => col.toLowerCase().includes(channelFilter.toLowerCase())),
    [columns, channelFilter]
  );
  const [vizType, setVizType] = useState<"Timeseries"|"Spectrogram"|"PSD"|"Boxplot"|"Autocorrelation"|"Envelope"|"Poincare">("Timeseries");
  // Store base64 images per channel
  const [vizImages, setVizImages] = useState<Record<string, string>>({});
  const [vizError, setVizError] = useState<string | null>(null);
  // Loading state for visualizations
  const [isVizLoading, setIsVizLoading] = useState(false);

  // Access data from previous step
  const importData = data?.data_import || {}
//viz profiles
const uploadAndProfile = async () => {
  const file = importData?.fileObjects?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("http://localhost:8003/eda/combined", {
    method: "POST",
    body: formData,
  });

  if (res.ok) {
    const json = await res.json();
    setYdataReport(json.ydata);
    setBoxplotReport(json.boxplots);
  } else {
    console.error("Failed to generate combined report");
  }
};
  // Process the imported data when component mounts or importData changes
  useEffect(() => {
    if (!importData.files?.length && !importData.url) return

    setIsLoading(true)
    setError(null)

    const processImportedData = async () => {
      try {
        if (importData.files?.length > 0) {
          // Check if we have file objects
          const fileObjects = importData.fileObjects || []

          console.log("DataVisualization: Checking for file objects", {
            filesCount: importData.files.length,
            fileObjectsCount: fileObjects.length,
          })

          if (fileObjects.length === 0) {
            throw new Error("File objects not found. Make sure files are properly uploaded.")
          }

          // Log file details to help debug
          console.log("DataVisualization: First file details:", {
            name: fileObjects[0].name,
            size: fileObjects[0].size,
            type: fileObjects[0].type,
            lastModified: fileObjects[0].lastModified,
          })

          const file = fileObjects[0] // Process the first file for simplicity

          if (file.name.endsWith(".csv")) {
            await processCSV(file)
          } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
            await processExcel(file)
          } else if (file.name.endsWith(".json")) {
            await processJSON(file)
          } else {
            throw new Error("Unsupported file format. Please use CSV, Excel, or JSON files.")
          }
        } else if (importData.url) {
          // Process data from URL
          await processDataFromURL(importData.url)
        }
      } catch (err) {
        console.error("Error processing data:", err)
        setError(err instanceof Error ? err.message : "Failed to process data")
      } finally {
        setIsLoading(false)
      }
    }

    processImportedData()
  }, [importData])

  // Process CSV file
  const processCSV = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log("Processing CSV file:", file.name)

      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          console.log("CSV parsing complete:", results)

          // Use generic channel names ch1, ch2, ... regardless of original headers
          const rawData = results.data as DataRow[];
          const originalCols = results.meta.fields || [];
          const genericCols = originalCols.map((_, i) => `ch${i+1}`);
          // Re-key each row to generic channel names
          const data = rawData.map(row => {
            const values = originalCols.map(col => row[col]);
            return genericCols.reduce((acc, genCol, idx) => {
              acc[genCol] = values[idx];
              return acc;
            }, {} as DataRow);
          });
          setProcessedData({ columns: genericCols, data });
          setColumns(genericCols)

          // Set default axes if available
          if (genericCols.length >= 2) {
            // Find numeric columns for y-axis
            const numericColumns = genericCols.filter((col) => data.length > 0 && typeof data[0][col] === "number")

            if (numericColumns.length > 0) {
              setYAxis(numericColumns[0])

              // Find a non-numeric column for x-axis
              const nonNumericColumns = genericCols.filter((col) => !numericColumns.includes(col))
              if (nonNumericColumns.length > 0) {
                setXAxis(nonNumericColumns[0])
              } else {
                setXAxis(genericCols[0])
              }
            } else {
              setXAxis(genericCols[0])
              setYAxis(genericCols[1])
            }
          }

          resolve()
        },
        error: (error) => {
          console.error("CSV parsing error:", error)
          reject(new Error(`CSV parsing error: ${error}`))
        },
      })
    })
  }

  // Process Excel file
  const processExcel = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            reject(new Error("Failed to read Excel file"))
            return
          }

          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as DataRow[]

          if (jsonData.length === 0) {
            reject(new Error("Excel file is empty or has no valid data"))
            return
          }
          // Use generic channel names for Excel data
          const originalExcelCols = Object.keys(jsonData[0])
          const genericExcelCols = originalExcelCols.map((_, i) => `ch${i+1}`)
          const mappedExcelData = jsonData.map(row => {
            const values = originalExcelCols.map(col => (row as any)[col])
            return genericExcelCols.reduce((acc, genCol, idx) => {
              acc[genCol] = values[idx]
              return acc
            }, {} as DataRow)
          })
          setProcessedData({ columns: genericExcelCols, data: mappedExcelData })
          setColumns(genericExcelCols)

          // Set default axes
          if (genericExcelCols.length >= 2) {
            setXAxis(genericExcelCols[0])
            setYAxis(genericExcelCols[1])
          }

          resolve()
        } catch (err) {
          reject(new Error(`Excel processing error: ${err instanceof Error ? err.message : String(err)}`))
        }
      }

      reader.onerror = () => {
        reject(new Error("Failed to read Excel file"))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  // Process JSON file
  const processJSON = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const jsonData = JSON.parse(content) as DataRow[] | { data: DataRow[] }

          let data: DataRow[]

          // Handle and re-key JSON data to generic channels
          let rawJsonData: DataRow[]
          if (Array.isArray(jsonData)) rawJsonData = jsonData
          else if (jsonData.data && Array.isArray(jsonData.data)) rawJsonData = jsonData.data
          else { reject(new Error("Unrecognized JSON format")); return }
          const originalJsonCols = Object.keys(rawJsonData[0])
          const genericJsonCols = originalJsonCols.map((_, i) => `ch${i+1}`)
          const mappedJsonData = rawJsonData.map(row => {
            const values = originalJsonCols.map(col => (row as any)[col])
            return genericJsonCols.reduce((acc, genCol, idx) => { acc[genCol] = values[idx]; return acc }, {} as DataRow)
          })
          setProcessedData({ columns: genericJsonCols, data: mappedJsonData })
          setColumns(genericJsonCols)

          // Set default axes
          if (genericJsonCols.length >= 2) {
            setXAxis(genericJsonCols[0])
            setYAxis(genericJsonCols[1])
          }

          resolve()
        } catch (err) {
          reject(new Error(`JSON parsing error: ${err instanceof Error ? err.message : String(err)}`))
        }
      }

      reader.onerror = () => {
        reject(new Error("Failed to read JSON file"))
      }

      reader.readAsText(file)
    })
  }

  // Process data from URL
  const processDataFromURL = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type") || ""

      if (contentType.includes("application/json") || url.endsWith(".json")) {
        const jsonData = await response.json()

        let data: DataRow[]
        if (Array.isArray(jsonData)) {
          data = jsonData
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
          data = jsonData.data
        } else {
          throw new Error("JSON format not supported. Expected an array of objects or an object with a data array.")
        }

        if (data.length === 0) {
          throw new Error("JSON data is empty")
        }

        const columns = Object.keys(data[0])
        setProcessedData({ columns, data })
        setColumns(columns)

        // Set default axes
        if (columns.length >= 2) {
          setXAxis(columns[0])
          setYAxis(columns[1])
        }
      } else if (contentType.includes("text/csv") || url.endsWith(".csv")) {
        const text = await response.text()
        const results = Papa.parse(text, { header: true, dynamicTyping: true })

        const data = results.data as DataRow[]
        const columns = results.meta.fields || []

        setProcessedData({ columns, data })
        setColumns(columns)

        // Set default axes
        if (columns.length >= 2) {
          setXAxis(columns[0])
          setYAxis(columns[1])
        }
      } else {
        throw new Error("Unsupported file format. URL must point to a CSV or JSON file.")
      }
    } catch (err) {
      throw new Error(`Failed to fetch data from URL: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Prepare columns for react-table
  const columnHelper = useMemo(() => createColumnHelper<DataRow>(), [])

  const tableColumns = useMemo(() => {
    if (!processedData) return []

    return processedData.columns.map((col) =>
      columnHelper.accessor(col, {
        header: col,
        cell: (info) => info.getValue(),
      }),
    )
  }, [processedData, columnHelper])

  // Initialize react-table
  const table = useReactTable({
    data: processedData?.data || [],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })
  // Render table view
  const renderTable = () => {
    if (!processedData) return null

    return (
      <div className="w-full flex flex-col h-full">
        <div className="rounded-md border overflow-x-auto overflow-y-auto flex-1 max-h-[320px]">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              processedData.data.length,
            )}{" "}
            of {processedData.data.length} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Render bar chart
  const renderBarChart = () => {
    if (!processedData || !xAxis || !yAxis) return null;

    // Determine if the axes are numeric or categorical
    const isXAxisNumeric = processedData.data.every((row) => typeof row[xAxis] === "number");
    const isYAxisNumeric = processedData.data.every((row) => typeof row[yAxis] === "number");

    let chartData: { labels: string[]; values: number[] };

    if (isXAxisNumeric && isYAxisNumeric) {
      // Numeric vs Numeric
      chartData = {
        labels: processedData.data.map((row) => String(row[xAxis])),
        values: processedData.data.map((row) => Number(row[yAxis]) || 0),
      };
    } else if (!isXAxisNumeric && isYAxisNumeric) {
      // Categorical vs Numeric
      const groupedData: Record<string, number> = {};
      processedData.data.forEach((row) => {
        const category = String(row[xAxis]);
        const value = Number(row[yAxis]) || 0;

        if (groupedData[category]) {
          groupedData[category] += value;
        } else {
          groupedData[category] = value;
        }
      });

      chartData = {
        labels: Object.keys(groupedData),
        values: Object.values(groupedData),
      };
    } else if (isXAxisNumeric && !isYAxisNumeric) {
      // Numeric vs Categorical
      const groupedData: Record<string, number> = {};
      processedData.data.forEach((row) => {
        const category = String(row[yAxis]);
        const value = Number(row[xAxis]) || 0;

        if (groupedData[category]) {
          groupedData[category] += value;
        } else {
          groupedData[category] = value;
        }
      });

      chartData = {
        labels: Object.keys(groupedData),
        values: Object.values(groupedData),
      };
    } else {
      // Categorical vs Categorical
      const groupedData: Record<string, Record<string, number>> = {};
      processedData.data.forEach((row) => {
        const xCategory = String(row[xAxis]);
        const yCategory = String(row[yAxis]);

        if (!groupedData[xCategory]) {
          groupedData[xCategory] = {};
        }

        if (groupedData[xCategory][yCategory]) {
          groupedData[xCategory][yCategory] += 1; // Count occurrences
        } else {
          groupedData[xCategory][yCategory] = 1;
        }
      });

      const labels = Object.keys(groupedData);
      const values = labels.map((xCategory) =>
        Object.values(groupedData[xCategory]).reduce((sum, count) => sum + count, 0)
      );

      chartData = { labels, values };
    }

    // Debugging logs
    console.log("Bar Chart Labels:", chartData.labels);
    console.log("Bar Chart Values:", chartData.values);

    const data = {
      labels: chartData.labels,
      datasets: [
        {
          label: `${xAxis} vs ${yAxis}`,
          data: chartData.values,
          backgroundColor: "rgba(53, 162, 235, 0.5)",
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        title: {
          display: true,
          text: `${xAxis} vs ${yAxis}`,
        },
      },
    };

    return <Bar data={data} options={options} />;
  };

  // Render line chart
  const renderLineChart = () => {
    if (!processedData || !xAxis || !yAxis) return null

    // Extract data for the selected axes
    const labels = processedData.data.map((row) => String(row[xAxis]))
    const values = processedData.data.map((row) => Number(row[yAxis]) || 0)

    const chartData = {
      labels,
      datasets: [
        {
          label: yAxis,
          data: values,
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
          tension: 0.1,
        },
      ],
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        title: {
          display: true,
          text: `${xAxis} vs ${yAxis}`,
        },
      },
    }

    return <Line data={chartData} options={options} />
  }

  // Render pie chart
  const renderPieChart = () => {
    if (!processedData || !xAxis || !yAxis) return null

    // Group data by the selected category (x-axis)
    const groupedData: Record<string, number> = {}
    processedData.data.forEach((row) => {
      const category = String(row[xAxis])
      const value = Number(row[yAxis]) || 0

      if (groupedData[category]) {
        groupedData[category] += value
      } else {
        groupedData[category] = value
      }
    })

    // Convert to arrays for Chart.js
    const labels = Object.keys(groupedData)
    const values = Object.values(groupedData)

    // Generate colors
    const backgroundColors = labels.map((_, i) => `hsl(${210 + i * 30}, 70%, 60%)`)

    const chartData = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: "#ffffff",
        },
      ],
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right" as const,
        },
        title: {
          display: true,
          text: `${xAxis} Distribution`,
        },
      },
    }

    return <Pie data={chartData} options={options} />
  }

  // Function to get the appropriate library for each chart type
  const getLibraryForChartType = (chartType: string) => {
    switch (chartType) {
      case "table":
        return "@tanstack/react-table"
      case "bar":
      case "line":
      case "pie":
        return "chart.js react-chartjs-2"
      default:
        return "chart.js"
    }
  }

  // Fetch visualization image
  const fetchVisualization = async (type: string) => {
    setVizError(null);
    setVizImages({});
    setIsVizLoading(true);
    try {
      if (!processedData) throw new Error('No data to visualize');
      const payload = { data: processedData.data, channels: selectedChannels };
      const t = type.toLowerCase();
      const res = await fetch(`http://localhost:8003/viz?type=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.images) {
        setVizImages(json.images);
      } else {
        throw new Error(json.error || 'Visualization failed');
      }
    } catch (err: any) {
      setVizError(err.message || 'Error generating visualization');
    } finally {
      setIsVizLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    // Trigger selected visualization
    fetchVisualization(vizType);
    const visualizationData = {
      chartType: selectedChart,
      xAxis,
      yAxis,
      // Include reference to the imported data
      importedFiles: importData.files || [],
      importedUrl: importData.url || "",
      // Include processed data summary
      dataSummary: processedData
        ? {
            rowCount: processedData.data.length,
            columnCount: processedData.columns.length,
            columns: processedData.columns,
            dataFrame: processedData.data, // Pass the actual data to the next component
          }
        : null,
      // Include library information
      libraryUsed: getLibraryForChartType(selectedChart),
    }

    console.log("Submitting visualization data:", visualizationData)
    onComplete(visualizationData)
  };
  return (    <div className="space-y-6 w-full max-w-full">
      <div className="flex flex-col space-y-2">
        <p className="text-muted-foreground">
          Visualize your imported data using various visualization techniques to better understand your signals.
        </p>

        {importData.files && importData.files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-sm">Files:</span>
            {importData.files.map((file: string, index: number) => (
              <Badge key={index} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {file}
              </Badge>
            ))}
          </div>
        )}

        {importData.url && (
          <div className="mt-1">
            <span className="text-sm">URL: </span>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{importData.url}</Badge>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-300 bg-red-50 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="bg-red-100 p-1 rounded-full">
              <FileWarning className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertTitle className="text-red-800 font-semibold">Import Error</AlertTitle>
              <AlertDescription className="text-sm text-red-700">{error}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}<div className="grid gap-6 md:grid-cols-3 w-full">
        {/* Options and Preview Cards with hover shadow */}        <Card className="col-span-1 hover:shadow-sm transition-shadow duration-200">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">1</span>
              Visualization Options
            </h3>
            <div className="space-y-4 divide-y divide-gray-200 dark:divide-gray-700">
              {/* Channels section */}
              <div className="pt-0">
                <Label className="text-sm font-medium mb-2 block">Select Channels</Label>
                <div className="space-y-2 mt-3">
                  <div className="relative mb-3">
                    <Input
                      placeholder="Search channels..."
                      value={channelFilter}
                      onChange={e => setChannelFilter(e.target.value)}
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
                      className="border-amber-200 text-amber-600 hover:bg-amber-50"
                      onClick={() => setSelectedChannels(filteredColumns)}
                      disabled={!filteredColumns.length}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => setSelectedChannels([])}
                      disabled={!selectedChannels.length}
                    >
                      Clear All
                    </Button>
                  </div>

                  {!columns.length ? (
                    <p className="text-sm text-muted-foreground">Loading channels...</p>
                  ) : (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto border rounded-md p-2">
                      {filteredColumns.length > 0 ? (
                        filteredColumns.map(col => {
                          // Check if column looks like a channel (ch1, channel2, etc.)
                          const isLikelyChannel = /^(ch|channel)[_\s]?(\d+)$/i.test(col) ||
                                                  /sensor/i.test(col) || 
                                                  /signal/i.test(col);
                          
                          return (
                            <Label 
                              key={col} 
                              htmlFor={`channel-${col}`}
                              className={`flex items-center space-x-2 p-1.5 rounded-md ${
                                selectedChannels.includes(col) ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <Checkbox
                                id={`channel-${col}`}
                                checked={selectedChannels.includes(col)}
                                onCheckedChange={checked => {
                                  if (checked) setSelectedChannels([...selectedChannels, col])
                                  else setSelectedChannels(selectedChannels.filter(c => c !== col))
                                }}
                                className={isLikelyChannel ? "text-blue-600" : ""}
                              />
                              <div className="flex items-center">
                                <span className={`${isLikelyChannel ? "font-medium text-blue-600" : ""}`}>
                                  {col}
                                </span>
                                {isLikelyChannel && (
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">channel</span>
                                )}
                              </div>
                            </Label>
                          );
                        })
                      ) : (
                        <p className="text-sm text-center text-muted-foreground p-2">No channels match your search.</p>
                      )}
                    </div>
                  )}
                  
                  {selectedChannels.length > 0 && (
                    <div className="mt-3 text-sm text-gray-500">
                      Selected {selectedChannels.length} of {filteredColumns.length} channels
                    </div>
                  )}
                </div>
              </div>

              {/* Type & Generate section */}
              <div className="pt-4 space-y-3">
                <h3 className="text-base font-semibold mb-3 flex items-center">
                  <span className="bg-purple-100 text-purple-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">2</span>
                  Visualization Type
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Timeseries','Spectrogram','PSD','Boxplot','Autocorrelation','Envelope','Poincare'].map(t => (
                    <Button
                      key={t}
                      variant={vizType === t ? 'default' : 'outline'}
                      className={vizType === t 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-purple-200 text-purple-700 hover:bg-purple-50'}
                      onClick={() => setVizType(t as any)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
                <Button 
                  onClick={() => fetchVisualization(vizType)} 
                  disabled={selectedChannels.length === 0 || isVizLoading}
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                >
                  {isVizLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                      Generate Visualization
                    </div>
                  )}
                </Button>
                {vizError && (
                  <Alert variant="destructive" className="mt-2 border-red-300 bg-red-50">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <AlertDescription className="text-sm text-red-700">{vizError}</AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>        <Card className="col-span-2 hover:shadow-sm transition-shadow duration-200">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-4 flex items-center">
              <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-xs">3</span>
              Visualization Preview
            </h3>
            <div className="h-[450px] bg-muted/30 rounded-md overflow-auto w-full p-4 transition-opacity duration-300 border">
              {/* Preview: show loading, results, or prompt */}
              {isVizLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-3"></div>
                  <p className="text-sm text-blue-600 font-medium">Generating {vizType} visualization...</p>
                </div>
              ) : !processedData ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 mb-3">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <p className="text-sm text-muted-foreground">No data available for visualization</p>
                  <p className="text-xs text-muted-foreground mt-1">Please import data or select different options</p>
                </div>
              ) : Object.keys(vizImages).length > 0 ? (
                <div className="flex flex-col gap-4 w-full">
                  {Object.entries(vizImages).map(([ch, img]) => (
                    img ? (
                      <div key={ch} className="flex flex-col w-full">
                        <div className="bg-blue-50 px-3 py-1.5 border-b border-blue-100 rounded-t-md flex items-center">
                          <p className="text-sm font-medium text-blue-700">
                            {ch}
                          </p>
                          <span className="ml-auto text-xs text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-100">
                            {vizType}
                          </span>
                        </div>
                        <div className="border border-t-0 rounded-b-md p-2 bg-white">
                          <img 
                            src={`data:image/png;base64,${img}`} 
                            alt={`${vizType} for ${ch}`} 
                            className="w-full h-auto max-h-[350px] object-contain mx-auto" 
                          />
                        </div>
                      </div>
                    ) : (
                      <p key={ch} className="text-sm text-muted-foreground p-3 bg-gray-50 rounded-md border">
                        {ch} visualization not available
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 mb-3">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  <p className="text-sm text-muted-foreground mb-2">Select channels and visualization type</p>
                  <p className="text-xs text-muted-foreground">Then click "Generate Visualization" to create the plots</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>      <div className="flex justify-end gap-3 mt-6">
        <Button 
          onClick={uploadAndProfile} 
          disabled={isLoading}
          variant="outline"
          className="border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            Generate Profile Report
          </div>
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !processedData || (selectedChart !== "table" && (!xAxis || !yAxis))}
          className={`bg-blue-600 hover:bg-blue-700 min-w-[100px]`}
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
            Continue
          </div>
        </Button>
      </div>      <Card className="mt-4 hover:shadow-sm transition-shadow duration-200 border-blue-100">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-800 flex items-center border-b pb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            Data Profiling Report
          </h3>

          {(ydataReport || boxplotReport) ? (
            <div
              style={{
                width: "100%",
                maxHeight: "700px",
                overflowY: "auto",
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "0.375rem",
              }}
            >
              {/* Embed YData report */}
              {ydataReport && (
                <iframe
                  srcDoc={ydataReport}
                  title="YData Profiling Report"
                  sandbox="allow-scripts allow-same-origin"
                  style={{
                    width: "100%",
                    height: "600px",
                    border: "none",
                  }}
                />
              )}

              {/* Append boxplots right after YData report */}
              {boxplotReport && (
                <div
                  dangerouslySetInnerHTML={{ __html: boxplotReport }}
                  style={{
                    marginTop: "2rem",
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 mb-3">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
              <p className="text-sm text-muted-foreground mb-2">No profiling report generated yet</p>
              <p className="text-xs text-muted-foreground mb-4">Click "Generate Profile Report" to create a detailed analysis of your data</p>
              <Button 
                onClick={uploadAndProfile} 
                disabled={isLoading}
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                    <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                  </svg>
                  Generate Profile Report
                </div>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}