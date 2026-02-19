
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignatureCanvasProps {
  onSignatureChange: (signature: string | null) => void;
  initialSignature?: string | null;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ 
  onSignatureChange,
  initialSignature = null
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configure canvas
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Restore initial signature if provided
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSigned(true);
        onSignatureChange(initialSignature);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setHasSigned(true);
    
    // Get the correct coordinates
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the correct coordinates
    let clientX, clientY;
    
    if ('touches' in e) {
      e.preventDefault(); // Prevent scrolling when drawing
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.closePath();
    
    // Save the signature
    const signature = canvas.toDataURL();
    onSignatureChange(signature);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasSigned(false);
    onSignatureChange(null);
  };

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-gray-500 mb-2">Assine abaixo para confirmar a inspeção</p>
      <div 
        className="border border-gray-300 rounded relative w-full"
        style={{ height: '200px' }}
      >
        <canvas
          ref={canvasRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            touchAction: 'none',
            cursor: 'crosshair'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSigned && (
          <div 
            className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none"
          >
            Toque aqui para assinar
          </div>
        )}
      </div>
      <Button 
        type="button"
        variant="outline" 
        className="mt-2" 
        onClick={clearCanvas}
      >
        Limpar assinatura
      </Button>
    </div>
  );
};

export default SignatureCanvas;
