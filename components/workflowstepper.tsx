"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import DataImport from "./steps/dataImport"
import DataVisualization from "./steps/visualization"
import DataPreprocessing from "./steps/dataPreprocessing"
import FeatureExtraction from "./steps/featureExtraction"
import FeatureEvaluation from "./steps/featureEvaluation"
import Classification from "./steps/classification"
import Testing from "./steps/testing"

// Define the step components with proper typing
const steps = [
  { id: 0, name: "Data Import", component: DataImport },
  { id: 1, name: "Visualization", component: DataVisualization },
  { id: 2, name: "Preprocessing", component: DataPreprocessing },
  { id: 3, name: "Feature Extraction", component: FeatureExtraction },
  { id: 4, name: "Feature Evaluation", component: FeatureEvaluation },
  { id: 5, name: "Classification", component: Classification },
  { id: 6, name: "Testing", component: Testing },
]

export default function WorkflowStepper() {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [workflowData, setWorkflowData] = useState<any>({})

  // Use a ref to store file objects since they can't be serialized in state
  const fileObjectsRef = useRef<File[]>([])

  // Update the handleNext function to make data flow clearer
  const handleNext = (stepData: any) => {
    console.log("Step completed with data:", stepData)

    // Special handling for file objects from data import step
    if (currentStep === 0 && stepData.fileObjects) {
      console.log("File objects found:", stepData.fileObjects.length)
      // Store file objects in the ref
      fileObjectsRef.current = stepData.fileObjects
    }

    // Save data from current step
    const updatedWorkflowData = {
      ...workflowData,
      [steps[currentStep].name.toLowerCase().replace(" ", "_")]: stepData,
    }

    // Update the workflow data state
    setWorkflowData(updatedWorkflowData)

    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep])
    }

    // Move to next step
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }

    console.log("Updated workflow data:", updatedWorkflowData)
  }

  // Update workflowData with file objects when needed for visualization step
  useEffect(() => {
    if (currentStep>0  && fileObjectsRef.current.length > 0) {
      // Only update if we have file objects and we're on the visualization step
      const dataImportStep = workflowData.data_import || {}

      // Temporarily add file objects to workflowData for the visualization step
      setWorkflowData((prevData: any) => ({
        ...prevData,
        data_import: {
          ...dataImportStep,
          fileObjects: fileObjectsRef.current,
        },
      }))
    }
  }, [fileObjectsRef.current])

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleStepClick = (stepIndex: number) => {
    // Only allow clicking on completed steps or the next available step
    if (
      completedSteps.includes(stepIndex) ||
      stepIndex === currentStep ||
      stepIndex === 0 ||
      completedSteps.includes(stepIndex - 1)
    ) {
      setCurrentStep(stepIndex)
    }
  }

  return (
    <div className="w-full overflow-x-hidden max-w-5xl ml-4">
      {/* Stepper navigation */}
      <nav aria-label="Progress" className="mb-8 mt-8">
        <ol role="list" className="flex flex-row items-center justify-start flex-nowrap space-x-2">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center">
              <div className="flex items-center cursor-pointer" onClick={() => handleStepClick(index)}>
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border transition-all duration-200",
                    completedSteps.includes(index)
                      ? "bg-primary "
                      : index === currentStep
                        ? "text-primary border-primary text-primary"
                        : "text-muted-foreground border-muted-foreground text-muted-foreground",
                  )}
                >
                  {completedSteps.includes(index) ? (
                    <Check className="h-5 w-5 text-primary-foreground" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "ml-3 text-sm font-medium hidden sm:inline-block",
                    completedSteps.includes(index) || index === currentStep
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.name}
                </span>
              </div>
              {index !== steps.length - 1 && (
                <div
                  className={cn(
                 
                    index < steps.length - 1 ? "left-4 sm:left-1/2" : "",
                  )}
                >
                  
                    <div
                      className={cn(
                        "h-0.5  bg-primary transition-all",
                        completedSteps.includes(index) ? "w-full" : "w-0",
                      )}
                    />
                  
                  <ChevronRight className="absolute right-0 top-[-8px] h-5 w-5 text-muted-foreground hidden sm:block" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Current step content */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{steps[currentStep].name}</h2>
        {/* Use JSX element syntax instead of component variable */}
        {currentStep === 0 && <DataImport data={workflowData} onComplete={handleNext} />}
        {currentStep === 1 && <DataVisualization data={workflowData} onComplete={handleNext} />}
        {currentStep === 2 && <DataPreprocessing data={workflowData} onComplete={handleNext} />}
        {currentStep === 3 && <FeatureExtraction data={workflowData} onComplete={handleNext} />}
        {currentStep === 4 && <FeatureEvaluation data={workflowData} onComplete={handleNext} />}
        {currentStep === 5 && <Classification data={workflowData} onComplete={handleNext} />}
        {currentStep === 6 && <Testing data={workflowData} onComplete={handleNext} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6 mb-2">
        <Button
          variant="outline"
          onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        <Button variant="outline" onClick={handleSkip} disabled={currentStep === steps.length - 1}>
          Skip this step
        </Button>
        {currentStep === steps.length - 1 ? (
          <Button onClick={() => console.log("Workflow completed:", workflowData)}>Finish</Button>
        ) : null}
      </div>
    </div>
  )
}
