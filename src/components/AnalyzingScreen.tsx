import { useEffect, useState, useRef } from "react";
import { Shield, Loader2 } from "lucide-react";
import { getRepoStatus } from "@/lib/api";

interface AnalyzingScreenProps {
  repo: string;
  repoId: string;
  onComplete: () => void;
}

const fallbackSteps = [
  "Cloning repository…",
  "Scanning file structure…",
  "Mapping dependencies…",
  "Calculating complexity scores…",
  "Detecting coupling hotspots…",
  "Evaluating test coverage…",
  "Assessing business risk…",
  "Generating intelligence report…",
];

export function AnalyzingScreen({ repo, repoId, onComplete }: AnalyzingScreenProps) {
  const [statusMessage, setStatusMessage] = useState("Starting analysis...");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("queued");
  const [steps, setSteps] = useState<{ text: string; done: boolean }[]>(
    fallbackSteps.map((s) => ({ text: s, done: false }))
  );
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!repoId) {
      // Fallback: no repoId means backend isn't running, use fake progress
      let fakeProgress = 0;
      let fakeStep = 0;
      const interval = setInterval(() => {
        fakeProgress += 1.5;
        if (fakeProgress >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 600);
          return;
        }
        const newStep = Math.min(Math.floor(fakeProgress / 12.5), fallbackSteps.length - 1);
        if (newStep !== fakeStep) {
          fakeStep = newStep;
          setSteps((prev) =>
            prev.map((s, i) => ({ ...s, done: i < newStep }))
          );
        }
        setProgress(fakeProgress);
        setStatusMessage(fallbackSteps[fakeStep]);
      }, 40);
      return () => clearInterval(interval);
    }

    // Real polling
    pollRef.current = setInterval(async () => {
      try {
        const data = await getRepoStatus(repoId);
        setStatus(data.status);
        setStatusMessage(data.statusMessage);
        setProgress(data.progress);

        // Map status to step completion
        const statusOrder = ["queued", "cloning", "parsing", "analyzing", "building_graph", "scoring", "ready"];
        const currentIdx = statusOrder.indexOf(data.status);
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            done: i < currentIdx,
          }))
        );

        if (data.status === "ready") {
          clearInterval(pollRef.current);
          setTimeout(onComplete, 800);
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          setStatusMessage(`Error: ${data.statusMessage}`);
        }
      } catch {
        // Backend not reachable — continue with fake progress
      }
    }, 1000);

    return () => clearInterval(pollRef.current);
  }, [repoId, onComplete]);

  const currentStepIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative mb-8">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <Shield className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Analyzing Repository</h2>
      <p className="text-sm text-primary font-mono mb-8">{repo}</p>

      <div className="w-72 space-y-2 mb-8">
        {steps.map((step, i) => (
          <div
            key={step.text}
            className={`flex items-center gap-2 text-xs transition-all duration-300 ${
              step.done
                ? "text-risk-safe"
                : i === currentStepIdx
                ? "text-foreground"
                : "text-muted-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              step.done
                ? "bg-risk-safe"
                : i === currentStepIdx
                ? "bg-primary animate-pulse-glow"
                : "bg-muted-foreground/20"
            }`} />
            {step.text}
            {step.done && <span className="ml-auto">✓</span>}
          </div>
        ))}
      </div>

      <div className="w-72">
        <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-2 text-center">{statusMessage}</p>
      </div>
    </div>
  );
}
