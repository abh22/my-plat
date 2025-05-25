"use client";
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"


import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Plus,
  Download,
  RefreshCw,
  Search,
  Box,
  BarChart,
  Clock,
  ArrowUpRight,
  Database,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  FileText,
  Settings,
  BarChart2,
  Users,
  Briefcase,
} from "lucide-react";
// Missing data - add these const declarations
const recentRuns = [
  { title: "Sensor data feature selection", team: "Data Science", time: "2 hours ago", status: "Completed" },
  { title: "Time series analysis", team: "Research", time: "Yesterday", status: "In Progress" },
  { title: "Predictive maintenance", team: "Engineering", time: "2 days ago", status: "Failed" },
  // Add more items as needed
];

const topFeatures = [
  { name: "Temperature Variance", score: 92 },
  { name: "Pressure Delta", score: 87 },
  { name: "Vibration Frequency", score: 76 },
  { name: "Flow Rate", score: 68 },
  // Add more items as needed
];

const dataSources = [
  { name: "Sensor API", status: "Connected" },
  { name: "Process DB", status: "Connected" },
  { name: "Time Series DB", status: "Connected" },
  { name: "Factory Logs", status: "Connected" },
  // Add more items as needed
];

const teamWorkspaces = [
  {
    name: "Data Science Team",
    members: 8,
    projects: 12,
    stats: [
      { label: "Feature Selection Runs", value: "87/100", percentage: 87 },
      { label: "Model Accuracy", value: "92%", percentage: 92 },
      { label: "Time Savings", value: "68%", percentage: 68 },
    ],
  },
  {
    name: "Engineering Team",
    members: 12,
    projects: 15,
    stats: [
      { label: "Feature Selection Runs", value: "76/100", percentage: 76 },
      { label: "Model Accuracy", value: "84%", percentage: 84 },
      { label: "Time Savings", value: "72%", percentage: 72 },
    ],
  },
  // Add more items as needed
];

// Helper function for status colors
const getStatusColor = (status:String) => {
  switch (status) {
    case "Completed":
      return "text-green-500";
    case "In Progress":
      return "text-blue-500";
    case "Failed":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
};

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex-1">
        <div className="flex flex-col min-h-screen w-full">
          <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
          <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <span className="font-medium text-foreground">Feature Selection Automation</span>
          </div>
            
            <div className="flex items-center space-x-2">
              <Link href="/newAnalysis" passHref>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Analysis
              </Button></Link>
            </div>
          </header>

          <div className="flex-1 p-6 space-y-6">
            <nav className="flex items-center text-sm text-muted-foreground mb-6">
              <Link href="/dashboard" className="hover:text-foreground">
                Feature Selection
              </Link>
              <span className="mx-2">/</span>
              <span className="font-medium text-foreground">Dashboard</span>
            </nav>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-xs text-green-500 flex items-center mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +4 from last month
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completed Analyses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87</div>
                  <div className="text-xs text-green-500 flex items-center mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +23 this week
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Feature Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">68%</div>
                  <div className="text-xs text-green-500 flex items-center mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +5.2% improvement
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4.2s</div>
                  <div className="text-xs text-green-500 flex items-center mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    -0.8s from average
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Feature Selection Runs</CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="all">
                    <TabsList className="mb-4">
                      <TabsTrigger value="all">All Runs</TabsTrigger>
                      <TabsTrigger value="my">My Runs</TabsTrigger>
                      <TabsTrigger value="team">Team Runs</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="space-y-4">
                      {recentRuns.map((run, i) => (
                        <div key={i} className="flex items-center py-2 border-b last:border-0">
                          <div className="bg-muted p-2 rounded mr-4">
                            <Box className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{run.title}</div>
                            <div className="text-sm text-muted-foreground flex space-x-4">
                              <span>{run.team}</span>
                              <span>{run.time}</span>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${getStatusColor(run.status)}`}>
                            {run.status}
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="my">
                      <p className="text-sm text-muted-foreground">Your personal runs will appear here.</p>
                    </TabsContent>
                    <TabsContent value="team">
                      <p className="text-sm text-muted-foreground">Team runs will appear here.</p>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Features from your last project</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center bg-muted/50 rounded">
                    <BarChart2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Top Performing Features</h4>
                    <div className="space-y-2">
                      {topFeatures.map((feature, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{feature.name}</span>
                          <span className="font-medium">{feature.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dataSources.map((source, i) => (
                      <div
                        key={i}
                        className="border rounded p-4 text-center hover:bg-accent hover:border-accent transition-colors cursor-pointer"
                      >
                        <div className="bg-muted w-12 h-12 mx-auto rounded flex items-center justify-center mb-3">
                          <Database className="h-6 w-6" />
                        </div>
                        <h4 className="font-medium text-sm mb-1">{source.name}</h4>
                        <p className="text-xs text-green-500 flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {source.status}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="link" className="w-full mt-4">
                    Connect New Data Source
                  </Button>
                </CardContent>
              </Card>

              {teamWorkspaces.map((team, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <CardTitle>{team.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {team.members} members · {team.projects} projects
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {team.stats.map((stat, j) => (
                        <div key={j}>
                          <div className="flex items-center justify-between mb-1 text-sm">
                            <span className="text-muted-foreground">{stat.label}</span>
                            <span className="font-medium">{stat.value}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="link" className="w-full mt-4">
                      View Team Dashboard
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}