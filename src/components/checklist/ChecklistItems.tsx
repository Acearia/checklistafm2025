
import React from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ChecklistItem } from "@/lib/data";

interface ChecklistItemsProps {
  checklist: ChecklistItem[];
  onChecklistChange: (id: string, answer: "Sim" | "Não" | "N/A" | "Selecione") => void;
  highlightUnanswered?: boolean;
}

const ChecklistItems: React.FC<ChecklistItemsProps> = ({
  checklist,
  onChecklistChange,
  highlightUnanswered = false,
}) => {
  return (
    <div className="mt-6 space-y-4">
      {checklist.map((item, index) => {
        const isUnanswered = item.answer === null || item.answer === "Selecione";
        const cardClasses = [
          "p-3",
          "bg-white",
          "rounded-md",
          "shadow-sm",
          "border-2",
          isUnanswered && highlightUnanswered ? "border-red-300 bg-red-50" : "border-gray-200",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={item.id} className={cardClasses}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-medium flex-grow">
                <span className="font-semibold text-gray-900 mr-2">{index + 1} -</span>
                {item.question}
              </div>
              <div className="w-full sm:w-36">
                <Select
                  onValueChange={(value) =>
                    onChecklistChange(item.id, value as "Sim" | "Não" | "N/A" | "Selecione")
                  }
                  value={item.answer || "Selecione"}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Selecione">Selecione</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isUnanswered && highlightUnanswered && (
              <p className="mt-2 text-xs text-red-600">
                Esta pergunta precisa ser respondida antes de enviar.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChecklistItems;
