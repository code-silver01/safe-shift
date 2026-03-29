import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DeveloperSandbox } from "@/components/DeveloperSandbox";
import { TeamHeatmap } from "@/components/TeamHeatmap";
import { ExecutiveCommand } from "@/components/ExecutiveCommand";

type View = "developer" | "heatmap" | "executive";

const Index = () => {
  const [activeView, setActiveView] = useState<View>("developer");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      {activeView === "developer" && <DeveloperSandbox />}
      {activeView === "heatmap" && <TeamHeatmap />}
      {activeView === "executive" && <ExecutiveCommand />}
    </div>
  );
};

export default Index;
