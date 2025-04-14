import WorkflowStepper from "@/components/workflowstepper";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function NewAnalysis() {
  return (
    <SidebarProvider>
      <div className="flex  min-h-screen">
     
        <AppSidebar />
        <div className="w-full flex justify-center">
          <WorkflowStepper />
        </div>
      </div>
    </SidebarProvider>
  );
}
