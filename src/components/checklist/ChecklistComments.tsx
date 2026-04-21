
import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle } from "lucide-react";

interface ChecklistCommentsProps {
  comments: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const ChecklistComments: React.FC<ChecklistCommentsProps> = ({ comments, onChange }) => {
  return (
    <div className="mt-6 bg-white p-4 rounded-md shadow-sm border border-gray-200">
      <h3 className="mb-3 text-base font-medium flex items-center gap-1">
        <MessageCircle className="h-5 w-5 text-gray-600" />
        Comentários
      </h3>
      <Textarea
        placeholder="Adicione aqui observações ou detalhes adicionais sobre esta inspeção..."
        className="min-h-[120px]"
        value={comments}
        onChange={onChange}
      />
    </div>
  );
};

export default ChecklistComments;
