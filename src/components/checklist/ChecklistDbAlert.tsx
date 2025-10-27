
import React from "react";
import { Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ChecklistDbAlertProps {
  dbStatus: 'unchecked' | 'connected' | 'error';
  onConfigureDb: () => void;
}

const ChecklistDbAlert: React.FC<ChecklistDbAlertProps> = ({ dbStatus, onConfigureDb }) => {
  if (dbStatus !== 'error') return null;
  
  return (
    <Alert variant="destructive" className="mx-4 mt-4">
      <Database className="h-4 w-4" />
      <AlertTitle>Problemas de conexão</AlertTitle>
      <AlertDescription className="flex justify-between items-center">
        <span>Não foi possível conectar ao banco de dados.</span>
        <Link to="/admin/login">
          <Button variant="outline" size="sm">
            Configurar Conexão
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
};

export default ChecklistDbAlert;
