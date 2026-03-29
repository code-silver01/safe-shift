import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";

interface AnalyzingScreenProps {
  repo: string;
  onComplete: () => void;
}

const steps = [
  "Cloning repository…",
  "Scanning file structure…",
  "Mapping dependencies…",
  "Calculating complexity scores…",
  "Detecting coupling hotspots…",
  "Evaluating test coverage…",
  "Assessing business risk…",
  "Generating intelligence report…",
];

export function AnalyzingScreen({ repo, onComplete }: AnalyzingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= steps.length - 1) {
          clearInterval(stepInterval);
          setTimeout(onComplete, 800);
          return s;
        }
        return s + 1;
      });
    }, 500);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 1.5, 100));
    }, 40);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

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

      {/* Steps */}
      <div className="w-72 space-y-2 mb-8">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`flex items-center gap-2 text-xs transition-all duration-300 ${
              i < currentStep
                ? "text-risk-safe"
                : i === currentStep
                ? "text-foreground"
                : "text-muted-foreground/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              i < currentStep
                ? "bg-risk-safe"
                : i === currentStep
                ? "bg-primary animate-pulse-glow"
                : "bg-muted-foreground/20"
            }`} />
            {step}
            {i < currentStep && <span className="ml-auto">✓</span>}
          </div>
        ))}
      </div>

      <div className="w-72">
        <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
