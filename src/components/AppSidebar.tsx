import { Code2, Users, BarChart3, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "developer" | "heatmap" | "executive";

interface AppSidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  repo?: string;
}

const navItems: { id: View; label: string; icon: React.ElementType; description: string }[] = [
  { id: "developer", label: "Developer Sandbox", icon: Code2, description: "Module analysis & simulation" },
  { id: "heatmap", label: "Team Heatmap", icon: Users, description: "Debt & risk hotspots" },
  { id: "executive", label: "Executive Command", icon: BarChart3, description: "Business risk & ROI" },
];

export function AppSidebar({ activeView, onViewChange, repo }: AppSidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">SafeShift</h1>
            <p className="text-[10px] text-muted-foreground">Strategic Engineering Intel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-150",
                active
                  ? "bg-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 mt-0.5 shrink-0", active && "text-primary")} />
              <div>
                <div className="text-sm font-medium leading-tight">{item.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-medium text-foreground">
            SS
          </div>
          <span className="text-xs text-muted-foreground">v2.4.1</span>
        </div>
      </div>
    </aside>
  );
}
