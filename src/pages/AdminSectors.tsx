
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import SectorManagement from "@/components/sectors/SectorManagement";

const AdminSectors = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Setores</h1>
          <p className="text-gray-600">
            Organize os setores da empresa e atribua líderes
          </p>
        </div>
        <Link to="/admin">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
      
      <SectorManagement />
    </div>
  );
};

export default AdminSectors;
