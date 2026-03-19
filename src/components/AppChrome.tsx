import { useLocation } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const AppChrome = () => {
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith("/admin");
  const isChecklistStep = location.pathname.startsWith("/checklist");

  return (
    <>
      <div
        className={cn(
          "fixed right-4 z-50",
          isAdminArea ? "top-20 md:top-24" : isChecklistStep ? "top-4 md:top-5" : "top-4 md:top-5",
        )}
      >
        <ThemeToggle />
      </div>
      <footer className="no-print pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className="rounded-full border border-border/70 bg-background/90 px-4 py-2 text-center text-xs font-medium text-muted-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          Desenvolvido por JOSE EDMILTON • 2025
        </div>
      </footer>
    </>
  );
};

export default AppChrome;
