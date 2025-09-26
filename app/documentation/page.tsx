"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function DocumentationPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="p-8 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">BreathPlat Documentation</h1>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Overview</h2>
            <p>
              BreathPlat is a platform for respiratory signal analysis. You can upload custom
              Python methods for preprocessing, feature extraction, and visualization. The platform
              also provides built-in dashboards for data import, analysis, and more.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Getting Started</h2>
            <ol className="list-decimal list-inside">
              <li>Navigate to the <strong>Import Data</strong> page to upload your dataset.</li>
              <li>Go to <strong>Add Method</strong> to upload a custom Python file with a <code>process_data(df, params)</code> function.</li>
              <li>Run your method on the <strong>Analysis</strong> page to process the data.</li>
              <li>Inspect results on the <strong>Selected Features</strong> page.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">API Reference</h2>
            <h3 className="text-xl font-medium mt-4">process_data(df, params)</h3>
            <p>This function must be defined in your custom Python method file:</p>
            <ul className="list-disc list-inside">
              <li><code>df</code>: a pandas.DataFrame with input signals.</li>
              <li><code>params</code>: a dictionary of method-specific parameters.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Examples</h2>
            <p>Below is a simple example of a custom method template:</p>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
{`import pandas as pd

def process_data(df, params):
    # Example: add a column of all zeros
    df['new_feature'] = 0
    return df
`}
            </pre>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Visualization Types</h2>
            <p>BreathPlat provides multiple ways to visualize your data:</p>
            <ul className="list-disc list-inside">
              <li>Time Series Plot: View respiratory signal over time.</li>
              <li>Histogram: Distribution of extracted feature values.</li>
              <li>Scatter Plot: Relationship between two features.</li>
              <li>Correlation Heatmap: Visualize feature correlations.</li>
              <li>Box Plot: Compare feature distributions across groups.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">Workflow Steps</h2>
            <ol className="list-decimal list-inside">
              <li>Import data on the <strong>Import Data</strong> page.</li>
              <li>Upload or manage methods on the <strong>Add Method</strong> page.</li>
              <li>Execute analyses on the <strong>Analysis</strong> page.</li>
              <li>Inspect extracted features on the <strong>Selected Features</strong> page.</li>
            </ol>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
