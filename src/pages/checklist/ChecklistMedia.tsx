
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, FileImage, MessageCircle, X } from "lucide-react";
import ChecklistHeader from "@/components/checklist/ChecklistHeader";
import { ChecklistStepIndicator } from "@/components/checklist/ChecklistProgressBar";
import { getChecklistState, saveChecklistState } from "@/lib/checklistStore";

const ChecklistMedia = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<{ id: string, data: string }[]>([]);
  const [comments, setComments] = useState<string>('');
  const [currentState, setCurrentState] = useState(getChecklistState());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ["Operador", "Equipamento", "Checklist", "Mídia", "Enviar"];

  useEffect(() => {
    // Verificar se as etapas anteriores foram concluídas
    if (!currentState.operator || !currentState.equipment || currentState.checklist.length === 0) {
      navigate('/checklist-steps/operator');
      return;
    }

    // Carregar fotos e comentários salvos anteriormente
    if (currentState.photos && currentState.photos.length > 0) {
      setPhotos(currentState.photos);
    }
    
    if (currentState.comments) {
      setComments(currentState.comments);
    }
  }, [navigate, currentState.operator, currentState.equipment, currentState.checklist]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotos(prev => [...prev, { id: Date.now().toString(), data: result }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset the file input to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleBack = () => {
    // Salvar fotos e comentários antes de voltar
    saveChecklistState({ photos, comments });
    navigate('/checklist-steps/items');
  };

  const handleNext = () => {
    // Salvar fotos e comentários
    saveChecklistState({ photos, comments });
    
    // Navegar para a próxima etapa
    navigate('/checklist-steps/submit');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ChecklistHeader backUrl="/checklist-steps/items" />

      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <ChecklistStepIndicator steps={steps} currentStep={3} />
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Anexar fotos e comentários</h2>
          
          <div className="bg-blue-50 p-3 rounded-md mb-4">
            <p className="text-sm">
              <strong>Operador:</strong> {currentState.operator?.name || "Não selecionado"}
            </p>
            <p className="text-sm">
              <strong>Equipamento:</strong> {currentState.equipment?.name || "Não selecionado"} 
              (KP: {currentState.equipment?.kp || "-"})
            </p>
          </div>

          {/* Photo Upload Section */}
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
                onChange={handlePhotoUpload}
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
                      onClick={() => handleRemovePhoto(photo.id)}
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

          {/* Comments Section */}
          <div className="mt-6 bg-white p-4 rounded-md shadow-sm border border-gray-200">
            <h3 className="mb-3 text-base font-medium flex items-center gap-1">
              <MessageCircle className="h-5 w-5 text-gray-600" />
              Comentários
            </h3>
            <Textarea
              placeholder="Adicione aqui observações ou detalhes adicionais sobre esta inspeção..."
              className="min-h-[120px]"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <Button 
            onClick={handleBack}
            variant="outline"
            className="px-6 py-2"
          >
            Voltar
          </Button>
          
          <Button 
            onClick={handleNext}
            className="bg-red-700 hover:bg-red-800 text-white px-6 py-2"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistMedia;
