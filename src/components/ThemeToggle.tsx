import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-2 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Sun className={`h-4 w-4 ${isDark ? "text-muted-foreground" : "text-amber-500"}`} />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Alternar tema"
      />
      <Moon className={`h-4 w-4 ${isDark ? "text-sky-400" : "text-muted-foreground"}`} />
    </div>
  );
};

export default ThemeToggle;
