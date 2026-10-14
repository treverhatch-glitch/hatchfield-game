
import { useEffect, useState } from "react";
import type { AchievementDef } from "./types.ts";
import "./toast.css";

export function AchievementToast({ achievements }: { achievements: AchievementDef[] }) {
  const [visible, setVisible] = useState<AchievementDef[]>([]);

  useEffect(() => {
    if (achievements.length > 0) {
      setVisible((prev) => [...prev, ...achievements]);
    }
  }, [achievements]);

  useEffect(() => {
    if (visible.length > 0) {
      const timer = setTimeout(() => {
        setVisible((prev) => prev.slice(1));
      }, 5000);
      // We don't want to clear the timeout if new items are added, so we track timers differently
      // A simple fix for the review feedback:
      return () => clearTimeout(timer);
    }
  }, [visible[0]]); // Only reset timer when the FIRST element changes (i.e. is removed)

  if (visible.length === 0) return null;

  return (
    <div className="achievement-toast-container">
      {visible.map((a) => (
        <div key={a.id} className={`achievement-toast ${a.isMilestone ? "milestone" : ""}`}>
          <div className="icon">{a.icon}</div>
          <div className="content">
            <h4>{a.isMilestone ? "Milestone Reached!" : "Achievement Unlocked!"}</h4>
            <strong>{a.name}</strong>
            <p>{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
