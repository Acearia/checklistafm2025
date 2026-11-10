import {Navigate} from "react-router-dom";
import {canManageTiAnalysts} from "@/lib/adminSession";
import TiAnalystManagement from "@/components/ti/TiAnalystManagement";
export default function AdminTiAnalysts() {
  if (!canManageTiAnalysts()) return <Navigate to="/admin/users" replace />;
  return <TiAnalystManagement />;
}
