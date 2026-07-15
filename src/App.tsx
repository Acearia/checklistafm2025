import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

const Index = lazy(() => import("./pages/Index"));
const Checklist = lazy(() => import("./pages/Checklist"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminEquipment = lazy(() => import("./pages/AdminEquipment"));
const AdminInspections = lazy(() => import("./pages/AdminInspections"));
const AdminChecklistsOverview = lazy(() => import("./pages/AdminChecklistsOverview"));
const AdminLeaderDashboard = lazy(() => import("./pages/AdminLeaderDashboard"));
const AdminLeaders = lazy(() => import("./pages/AdminLeaders"));
const AdminSectors = lazy(() => import("./pages/AdminSectors"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminGroups = lazy(() => import("./pages/AdminGroups"));
const AdminInvestigacoes = lazy(() => import("./pages/AdminInvestigacoes"));
const AdminPlanosAcao = lazy(() => import("./pages/AdminPlanosAcao"));
const AdminRegrasOuro = lazy(() => import("./pages/AdminRegrasOuro"));
const AdminInspecoesAmbientais = lazy(() => import("./pages/AdminInspecoesAmbientais"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const InvestigacaoAcidente = lazy(() => import("./pages/InvestigacaoAcidente"));
const InvestigacaoAcidente2 = lazy(() => import("./pages/InvestigacaoAcidente2"));
const InspecaoAmbiental = lazy(() => import("./pages/InspecaoAmbiental"));
const PlanoAcaoAcidente = lazy(() => import("./pages/PlanoAcaoAcidente"));
const LeaderLogin = lazy(() => import("./pages/LeaderLogin"));
const LeaderDashboard = lazy(() => import("./pages/LeaderDashboard"));
const LeaderHomeRoute = lazy(() => import("./pages/LeaderHomeRoute"));
const LeaderRulesPlans = lazy(() => import("./pages/LeaderRulesPlans"));
const LeaderEnvironmentalInspections = lazy(() => import("./pages/LeaderEnvironmentalInspections"));
const ChecklistDetail = lazy(() => import("./pages/ChecklistDetail"));
const ChecklistOperator = lazy(() => import("./pages/checklist/ChecklistOperator"));
const ChecklistEquipment = lazy(() => import("./pages/checklist/ChecklistEquipment"));
const ChecklistItems = lazy(() => import("./pages/checklist/ChecklistItems"));
const ChecklistMedia = lazy(() => import("./pages/checklist/ChecklistMedia"));
const ChecklistSubmit = lazy(() => import("./pages/checklist/ChecklistSubmit"));

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
      Carregando...
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/checklist/:equipmentId" element={<Checklist />} />
          <Route path="/investigacao-acidente" element={<InvestigacaoAcidente />} />
          <Route path="/plano-acao-acidente" element={<PlanoAcaoAcidente />} />
          <Route path="/regras-de-ouro" element={<InvestigacaoAcidente2 />} />
          <Route path="/inspecao-ambiental" element={<InspecaoAmbiental />} />
          <Route path="/investigacao-acidente-2" element={<InvestigacaoAcidente2 />} />

          {/* Novas rotas para o checklist dividido em etapas */}
          <Route path="/checklist-steps/operator" element={<ChecklistOperator />} />
          <Route path="/checklist-steps/equipment" element={<ChecklistEquipment />} />
          <Route path="/checklist-steps/items" element={<ChecklistItems />} />
          <Route path="/checklist-steps/media" element={<ChecklistMedia />} />
          <Route path="/checklist-steps/submit" element={<ChecklistSubmit />} />

          <Route path="/leader/login" element={<LeaderLogin />} />
          <Route path="/leader" element={<LeaderHomeRoute />} />
          <Route path="/leader/dashboard" element={<LeaderDashboard />} />
          <Route path="/leader/registros" element={<LeaderRulesPlans />} />
          <Route path="/leader/ambiental" element={<LeaderEnvironmentalInspections />} />
          <Route path="/leader/checklists/:id" element={<ChecklistDetail />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/inspections" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="operators" element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="equipment" element={<AdminEquipment />} />
            <Route path="inspections" element={<AdminInspections />} />
            <Route path="investigacoes" element={<AdminInvestigacoes />} />
            <Route path="planos-acao" element={<AdminPlanosAcao />} />
            <Route path="regras-ouro" element={<AdminRegrasOuro />} />
            <Route path="inspecoes-ambientais" element={<AdminInspecoesAmbientais />} />
            <Route path="checklists" element={<AdminChecklistsOverview />} />
            <Route path="leaders/dashboard" element={<AdminLeaderDashboard />} />
            <Route path="leaders" element={<AdminLeaders />} />
            <Route path="sectors" element={<AdminSectors />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="investigadores" element={<Navigate to="/admin/users" replace />} />
            <Route path="checklists/:id" element={<ChecklistDetail />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
