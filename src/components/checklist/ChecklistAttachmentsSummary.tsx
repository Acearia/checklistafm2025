
import React from "react";

interface AttachmentsProps {
  photos: { id: string; data: string }[];
  comments?: string;
}

const ChecklistAttachmentsSummary: React.FC<AttachmentsProps> = ({ photos, comments }) => {
  return (
    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200 mb-6">
      <p className="font-medium mb-2">Anexos e comentários:</p>
      <p>
        <strong>Fotos anexadas:</strong> {photos?.length || 0} foto(s)
      </p>
      {comments && (
        <div className="mt-2">
          <p><strong>Comentários:</strong></p>
          <p className="text-sm bg-gray-50 p-2 rounded mt-1 max-h-20 overflow-auto">
            {comments}
          </p>
        </div>
      )}
    </div>
  );
};

export default ChecklistAttachmentsSummary;
