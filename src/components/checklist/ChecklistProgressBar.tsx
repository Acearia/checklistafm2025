
import React from "react";
import { cn } from "@/lib/utils";

interface ChecklistProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ChecklistProgressBar: React.FC<ChecklistProgressBarProps> = ({ 
  currentStep, 
  totalSteps 
}) => {
  const progress = Math.round((currentStep / totalSteps) * 100);
  
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
      <div 
        className="bg-red-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
        style={{ width: `${progress}%` }}
      ></div>
      <div className="flex justify-between mt-1 px-1 text-xs text-gray-500">
        <span>Etapa {currentStep} de {totalSteps}</span>
        <span>{progress}% concluído</span>
      </div>
    </div>
  );
};

export const ChecklistStepIndicator: React.FC<{
  steps: string[];
  currentStep: number;
}> = ({ steps, currentStep }) => {
  return (
    <div className="flex justify-between items-center w-full mb-6 px-2">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <div 
              className={cn(
                "flex-1 h-[2px]", 
                index <= currentStep - 1 ? "bg-red-600" : "bg-gray-300"
              )}
            />
          )}
          <div className="flex flex-col items-center gap-1">
            <div 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                index < currentStep ? "bg-red-600 text-white" : 
                index === currentStep ? "bg-red-100 text-red-600 border border-red-600" : 
                "bg-gray-100 text-gray-400 border border-gray-300"
              )}
            >
              {index + 1}
            </div>
            <span 
              className={cn(
                "text-xs", 
                index <= currentStep ? "text-gray-700 font-medium" : "text-gray-400"
              )}
            >
              {step}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default ChecklistProgressBar;
