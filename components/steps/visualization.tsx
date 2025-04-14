"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { BarChart3, LineChart, PieChart, Table2, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

  // Access data from previous step
  const importData = data?.data_import || {}

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

          const data = results.data as DataRow[]
          const columns = results.meta.fields || []

          setProcessedData({ columns, data })
          setColumns(columns)

          // Set default axes if available
          if (columns.length >= 2) {
            // Find numeric columns for y-axis
            const numericColumns = columns.filter((col) => data.length > 0 && typeof data[0][col] === "number")

            if (numericColumns.length > 0) {
              setYAxis(numericColumns[0])

              // Find a non-numeric column for x-axis
              const nonNumericColumns = columns.filter((col) => !numericColumns.includes(col))
              if (nonNumericColumns.length > 0) {
                setXAxis(nonNumericColumns[0])
              } else {
                setXAxis(columns[0])
              }
            } else {
              setXAxis(columns[0])
              setYAxis(columns[1])
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

          const columns = Object.keys(jsonData[0])
          setProcessedData({ columns, data: jsonData })
          setColumns(columns)

          // Set default axes
          if (columns.length >= 2) {
            setXAxis(columns[0])
            setYAxis(columns[1])
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

          // Handle different JSON formats
          if (Array.isArray(jsonData)) {
            data = jsonData
          } else if (jsonData.data && Array.isArray(jsonData.data)) {
            data = jsonData.data
          } else {
            reject(new Error("JSON format not supported. Expected an array of objects or an object with a data array."))
            return
          }

          if (data.length === 0) {
            reject(new Error("JSON file contains no data"))
            return
          }

          const columns = Object.keys(data[0])
          setProcessedData({ columns, data })
          setColumns(columns)

          // Set default axes
          if (columns.length >= 2) {
            setXAxis(columns[0])
            setYAxis(columns[1])
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
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
          backgroundColor: "rgba(53, 162, 235, 0.5)",
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

    return <Bar data={chartData} options={options} />
  }

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

  // Handle form submission
  const handleSubmit = () => {
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
          }
        : null,
      // Include library information
      libraryUsed: getLibraryForChartType(selectedChart),
    }

    console.log("Submitting visualization data:", visualizationData)
    onComplete(visualizationData)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h3 className="text-base font-medium">Data Visualization</h3>
        <p className="text-sm text-muted-foreground">
          Visualize your imported data using popular visualization libraries.
        </p>

        {importData.files && importData.files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-sm">Files:</span>
            {importData.files.map((file: string, index: number) => (
              <Badge key={index} variant="outline">
                {file}
              </Badge>
            ))}
          </div>
        )}

        {importData.url && (
          <div className="mt-1">
            <span className="text-sm">URL: </span>
            <Badge variant="outline">{importData.url}</Badge>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Visualization Type</h3>
            <Tabs defaultValue="table" value={selectedChart} onValueChange={setSelectedChart}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="table" className="flex flex-col items-center py-4">
                  <Table2 className="h-5 w-5 mb-1" />
                  <span className="text-xs">Table</span>
                </TabsTrigger>
                <TabsTrigger value="bar" className="flex flex-col items-center py-4">
                  <BarChart3 className="h-5 w-5 mb-1" />
                  <span className="text-xs">Bar</span>
                </TabsTrigger>
                <TabsTrigger value="line" className="flex flex-col items-center py-4">
                  <LineChart className="h-5 w-5 mb-1" />
                  <span className="text-xs">Line</span>
                </TabsTrigger>
                <TabsTrigger value="pie" className="flex flex-col items-center py-4">
                  <PieChart className="h-5 w-5 mb-1" />
                  <span className="text-xs">Pie</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {processedData && (
              <div className="mt-6 space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="x-axis">{selectedChart === "pie" ? "Category" : "X-Axis"}</Label>
                  <Select value={xAxis} onValueChange={setXAxis}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="y-axis">{selectedChart === "pie" ? "Value" : "Y-Axis"}</Label>
                  <Select value={yAxis} onValueChange={setYAxis}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {processedData && (
              <div className="mt-6 p-3 bg-muted/40 rounded-md">
                <h4 className="text-sm font-medium">Data Summary</h4>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                  <li>Rows: {processedData.data.length}</li>
                  <li>Columns: {processedData.columns.length}</li>
                  <li>
                    Column types:{" "}
                    {processedData.columns
                      .slice(0, 3)
                      .map((col) => {
                        const sampleValue = processedData.data[0]?.[col]
                        return `${col} (${typeof sampleValue})`
                      })
                      .join(", ")}
                    {processedData.columns.length > 3 ? "..." : ""}
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-4">Visualization Preview</h3>
            <div className="h-[300px] bg-muted/30 rounded-md overflow-hidden flex items-center justify-center">
              {isLoading ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Processing data...</p>
                </div>
              ) : !processedData ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">No data available</p>
                </div>
              ) : (
                <Tabs value={selectedChart} className="w-full h-full">
                  <TabsContent value="table" className="h-full p-4">
                    {renderTable()}
                  </TabsContent>
                  <TabsContent value="bar" className="h-full p-4">
                    {renderBarChart()}
                  </TabsContent>
                  <TabsContent value="line" className="h-full p-4">
                    {renderLineChart()}
                  </TabsContent>
                  <TabsContent value="pie" className="h-full p-4">
                    {renderPieChart()}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={
  isLoading || 
  !processedData || 
  (selectedChart !== "table" && (!xAxis || !yAxis))
}>
          Continue
        </Button>
      </div>
    </div>
  )
}
