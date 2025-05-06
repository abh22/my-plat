import WorkflowStepper from "@/components/workflowstepper";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function NewAnalysis() {
  return (
    <SidebarProvider>
      <div className="flex  min-h-screen">
     
        <AppSidebar />
        <div className="flex-1 flex">
          <WorkflowStepper />
        </div>
      </div>
    </SidebarProvider>
  );
}
