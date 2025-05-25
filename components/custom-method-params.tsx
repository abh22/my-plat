// CustomMethodParams component for method-specific parameters
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

interface CustomMethodParamsProps {
  methodName: string;
  filename: string;
  onParamsChange: (params: Record<string, any>) => void;
}

// Option for select parameters
interface ParamOption {
  value: string;
  label: string;
}

// Base config for any parameter
interface BaseParamConfig<T> {
  type: string;
  default: T;
  label?: string;
}

// Specific parameter config types
interface NumberParamConfig extends BaseParamConfig<number> {
  type: "number";
  min: number;
  max: number;
  step?: number;
}
interface TextParamConfig extends BaseParamConfig<string> {
  type: "text";
}
interface SelectParamConfig extends BaseParamConfig<string> {
  type: "select";
  options: ParamOption[];
}
interface BooleanParamConfig extends BaseParamConfig<boolean> {
  type: "boolean";
}
// Extend ParamConfig union to include multi-select
interface MultiSelectParamConfig extends BaseParamConfig<string[]> {
  type: "multiselect";
  options: ParamOption[];
}

type ParamConfig =
  | NumberParamConfig
  | TextParamConfig
  | SelectParamConfig
  | BooleanParamConfig
  | MultiSelectParamConfig;            // include multi-select

type MethodParameters = Record<string, Record<string, ParamConfig>>;

// Hardcoded parameter definitions for known methods
const methodParameters: MethodParameters = {
  "low-pass_filter": {
    cutoff_freq: { type: "number", default: 10.0, label: "Cutoff Frequency (Hz)", min: 0.1, max: 50 },
    sampling_rate: { type: "number", default: 100.0, label: "Sampling Rate (Hz)", min: 1, max: 1000 },
    filter_order: { type: "number", default: 4, label: "Filter Order", min: 1, max: 10 },
    filter_type: { 
      type: "select", 
      default: "butter", 
      label: "Filter Type",
      options: [
        { value: "butter", label: "Butterworth" },
        { value: "cheby1", label: "Chebyshev Type I" },
        { value: "cheby2", label: "Chebyshev Type II" },
        { value: "ellip", label: "Elliptic" }
      ]
    },
    add_suffix: { type: "boolean", default: true, label: "Add '_filtered' Suffix" }
  },
  "high-pass_filter": {
    cutoff_freq: { type: "number", default: 0.5, label: "Cutoff Frequency (Hz)", min: 0.1, max: 50 },
    sampling_rate: { type: "number", default: 100.0, label: "Sampling Rate (Hz)", min: 1, max: 1000 },
    filter_order: { type: "number", default: 4, label: "Filter Order", min: 1, max: 10 },
    filter_type: { 
      type: "select", 
      default: "butter", 
      label: "Filter Type",
      options: [
        { value: "butter", label: "Butterworth" },
        { value: "cheby1", label: "Chebyshev Type I" },
        { value: "cheby2", label: "Chebyshev Type II" },
        { value: "ellip", label: "Elliptic" }
      ]
    },
    add_suffix: { type: "boolean", default: true, label: "Add '_high_pass' Suffix" }
  },
  "band-pass_filter": {
    low_cutoff: { type: "number", default: 0.5, label: "Low Cutoff (Hz)", min: 0.1, max: 50 },
    high_cutoff: { type: "number", default: 10.0, label: "High Cutoff (Hz)", min: 0.1, max: 1000 },
    sampling_rate: { type: "number", default: 100.0, label: "Sampling Rate (Hz)", min: 1, max: 1000 },
    filter_order: { type: "number", default: 4, label: "Filter Order", min: 1, max: 10 },
    filter_type: { 
      type: "select", 
      default: "butter", 
      label: "Filter Type",
      options: [
        { value: "butter", label: "Butterworth" },
        { value: "cheby1", label: "Chebyshev Type I" },
        { value: "cheby2", label: "Chebyshev Type II" },
        { value: "ellip", label: "Elliptic" }
      ]
    },
    add_suffix: { type: "boolean", default: true, label: "Add '_band_pass' Suffix" }
  },
  "dominant_frequency": {
    sampling_rate: { type: "number", default: 1.0, label: "Sampling Rate (Hz)", min: 0.1, max: 1000 }
  }
};

export default function CustomMethodParams({ methodName, filename, onParamsChange }: CustomMethodParamsProps) {
  // Derive key for parameter definitions by stripping .py extension if present
  const paramKey = filename.endsWith('.py') ? filename.slice(0, -3) : filename;
  const baseDefinition: Record<string, ParamConfig> = methodParameters[paramKey] || {};
  
  const paramDefinition: Record<string, ParamConfig> = baseDefinition;

  // Initialize state with default values
  const [params, setParams] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    
    // Set default values for all parameters
    Object.entries(paramDefinition).forEach(([name, cfg]) => {
      initial[name] = cfg.default;
    });
    
    return initial;
  });
  // Track validation errors per parameter
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Update parent component when params change
  useEffect(() => {
    onParamsChange(params);
  }, [params]);

  // If no parameters are defined for this method, return null
  if (Object.keys(paramDefinition).length === 0) {
    return null;
  }
  
  // Handle parameter changes with validation
  const handleParamChange = (paramName: string, value: any) => {
    setParams(prev => ({
      ...prev,
      [paramName]: value
    }));
    // Validate number parameters against min/max
    const cfg = paramDefinition[paramName] as NumberParamConfig;
    if (cfg.type === 'number') {
      if (value < cfg.min || value > cfg.max) {
        setErrors(prev => ({ ...prev, [paramName]: `Value must be between ${cfg.min} and ${cfg.max}` }));
      } else {
        setErrors(prev => { const e = { ...prev }; delete e[paramName]; return e; });
      }
    }
  };
  
  return (
    <div className="mt-2 ml-6 space-y-3">
      <Card>
        <CardContent className="pt-4 pb-3">
          <h4 className="text-sm font-medium mb-3">Parameters for {methodName}</h4>
          <div className="space-y-3">
            {Object.entries(paramDefinition).map(([paramName, paramConfig]) => (
              <div key={paramName} className="space-y-1">
                <Label htmlFor={`param-${paramName}`} className="text-xs">
                  {paramConfig.label || paramName}
                </Label>

                {paramConfig.type === "number" && (
                  <>
                    <Input
                      id={`param-${paramName}`}
                      type="number"
                      value={params[paramName]}
                      min={paramConfig.min}
                      max={paramConfig.max}
                      step={paramConfig.step || 0.1}
                      onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value))}
                      className={`h-8 ${errors[paramName] ? 'border-red-500' : ''}`}
                    />
                    {errors[paramName] && (
                      <p className="text-red-500 text-xs mt-1">{errors[paramName]}</p>
                    )}
                  </>
                )}
                
                {paramConfig.type === "text" && (
                  <Input
                    id={`param-${paramName}`}
                    type="text"
                    value={params[paramName]}
                    onChange={(e) => handleParamChange(paramName, e.target.value)}
                    className="h-8"
                  />
                )}
                
                {paramConfig.type === "select" && (
                  <Select
                    value={params[paramName]}
                    onValueChange={(value) => handleParamChange(paramName, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paramConfig.options.map((option: any) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {paramConfig.type === "boolean" && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`param-${paramName}`}
                      checked={params[paramName]}
                      onCheckedChange={(checked) => handleParamChange(paramName, !!checked)}
                    />
                    <label
                      htmlFor={`param-${paramName}`}
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {paramConfig.label || paramName}
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}