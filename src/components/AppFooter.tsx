import { cn } from "@/lib/utils";

interface AppFooterProps {
  className?: string;
}

const AppFooter = ({ className }: AppFooterProps) => {
  return (
    <footer
      className={cn(
        "border-t border-slate-200/80 bg-white/92 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/96",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center md:flex-row md:text-left">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">
          Checklist AFM
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium">© 2025</span>
          <span className="mx-2 text-slate-300 dark:text-slate-700">•</span>
          <span>Desenvolvido por </span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">Jose Edmilton</span>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
