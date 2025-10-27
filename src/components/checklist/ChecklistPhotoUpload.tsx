
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, FileImage, X } from "lucide-react";

interface ChecklistPhotoUploadProps {
  photos: { id: string; data: string }[];
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
}

const ChecklistPhotoUpload: React.FC<ChecklistPhotoUploadProps> = ({ 
  photos, 
  onPhotoUpload, 
  onRemovePhoto 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-md shadow-sm border border-gray-200">
      <h3 className="mb-3 text-base font-medium flex items-center gap-1">
        <FileImage className="h-5 w-5 text-gray-600" />
        Anexar Fotos
      </h3>
      
      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPhotoUpload}
          className="hidden"
          ref={fileInputRef}
        />
        <Button 
          type="button"
          variant="outline"
          className="w-full py-8 border-dashed border-2 flex flex-col items-center gap-2"
          onClick={triggerFileInput}
        >
          <Camera size={28} className="text-gray-500" />
          <span>Clique para selecionar imagens</span>
          <span className="text-xs text-gray-500">ou arraste e solte aqui</span>
        </Button>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {photos.map(photo => (
            <div 
              key={photo.id} 
              className="relative border rounded-md overflow-hidden aspect-square group"
            >
              <img 
                src={photo.data} 
                alt="Imagem anexada" 
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(photo.id)}
                className="absolute top-1 right-1 bg-red-100 hover:bg-red-200 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remover imagem"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChecklistPhotoUpload;
