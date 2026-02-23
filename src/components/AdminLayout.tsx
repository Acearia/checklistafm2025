
import React, { useEffect, useState } from "react";
import { useNavigate, Outlet, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { 
  BarChart3, 
  ClipboardList, 
  Home, 
  LogOut, 
  Settings, 
  Wrench, 
  User, 
  Menu, 
  X,
  ArrowLeft,
  Database,
  ShieldAlert,
  ClipboardCheck,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import logoUrl from "@/assets/afm-logo.png";

const AdminLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [session, setSession] = useState<{ username: string; role: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const data = sessionStorage.getItem("checklistafm-admin-session");
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to parse admin session:", error);
      sessionStorage.removeItem("checklistafm-admin-auth");
      sessionStorage.removeItem("checklistafm-admin-session");
      return null;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    // Close sidebar on mobile by default
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  const handleLogout = () => {
    sessionStorage.removeItem("checklistafm-admin-auth");
    sessionStorage.removeItem("checklistafm-admin-session");
    setSession(null);
    toast({
      title: "Logout realizado",
      description: "Você saiu do painel administrativo",
    });
    navigate("/admin/login");
  };

  const handleBackToChecklist = () => {
    navigate("/");
    toast({
      title: "Retornando ao Checklist",
      description: "Você foi redirecionado para a página de checklist",
    });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!sessionStorage.getItem("checklistafm-admin-auth") || !session) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100/70 flex flex-col backdrop-blur">
      {/* Top navbar */}
      <header className="bg-red-700 text-white shadow-md">
        <div className="flex justify-between items-center py-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSidebar} 
              className="mr-4 focus:outline-none"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <img src={logoUrl} alt="AFM" className="h-10 w-auto hidden sm:block" />
            <div className="leading-tight text-white">
              <h1 className="text-3xl font-extrabold tracking-wide">Checklist AFM Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBackToChecklist}
              className="bg-white text-red-700 hover:bg-red-50 border-white"
            >
              <ArrowLeft size={16} className="mr-1" />
              <span>Voltar ao Checklist</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-white hover:bg-red-800"
            >
              <LogOut size={16} className="mr-1" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`bg-white/85 backdrop-blur-md shadow-md transition-all duration-300 ${
            sidebarOpen ? "w-64" : "w-0"
          } overflow-hidden flex-shrink-0`}
        >
          <nav className="p-4 flex flex-col h-full">
            <div className="space-y-1 flex-1">
              <SidebarLink to="/admin" icon={<Home size={20} />} label="Dashboard" />
              <SidebarLink to="/admin/leaders/dashboard" icon={<User size={20} />} label="Dashboard Líderes" />
              <SidebarLink to="/admin/inspections" icon={<ClipboardList size={20} />} label="Inspeções" />
              <SidebarLink to="/admin/investigacoes" icon={<ShieldAlert size={20} />} label="Investigações" />
              <SidebarLink to="/admin/regras-ouro" icon={<ClipboardCheck size={20} />} label="Regras de Ouro" />
              <SidebarLink to="/admin/users" icon={<Users size={20} />} label="Usuários" />
              <SidebarLink to="/admin/equipment" icon={<Wrench size={20} />} label="Equipamentos" />
              <SidebarLink to="/admin/groups" icon={<ClipboardList size={20} />} label="Grupos" />
              <SidebarLink to="/admin/sectors" icon={<Database size={20} />} label="Setores" />
             <SidebarLink to="/admin/reports" icon={<BarChart3 size={20} />} label="Relatórios" />
              
              <SidebarLink to="/admin/settings" icon={<Settings size={20} />} label="Configurações" />
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 bg-white/80 backdrop-blur-md">
          <div className="container mx-auto space-y-4">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
};

// Helper component for sidebar links
const SidebarLink = ({ 
  to, 
  icon, 
  label 
}: { 
  to: string; 
  icon: React.ReactNode; 
  label: string;
}) => {
  return (
    <Link
      to={to}
      className="flex items-center p-2 text-gray-600 rounded-md hover:bg-gray-100"
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </Link>
  );
};

export default AdminLayout;

