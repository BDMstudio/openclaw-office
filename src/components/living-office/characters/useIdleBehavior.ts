import { useCallback, useEffect, useRef, useState } from "react";
import type { PerceivedAgentState } from "@/perception/types";
import {
  IDLE_GAZE_INTERVAL_MAX,
  IDLE_GAZE_INTERVAL_MIN,
  IDLE_WANDER_DURATION,
  IDLE_WANDER_INTERVAL_MAX,
  IDLE_WANDER_INTERVAL_MIN,
  IDLE_WANDER_RADIUS,
  type Position2D,
} from "./constants";

export interface IdleBehavior {
  wanderOffset: Position2D;
  gazeDirection: number;
  isWandering: boolean;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function useIdleBehavior(
  state: PerceivedAgentState,
  _homePos?: Position2D,
): IdleBehavior {
  const [wanderOffset, setWanderOffset] = useState<Position2D>({ left: 0, top: 0 });
  const [gazeDirection, setGazeDirection] = useState<number>(0);
  const [isWandering, setIsWandering] = useState<boolean>(false);
  const wanderTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gazeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isIdle = state === "IDLE" || state === "DONE";

  const scheduleWander = useCallback(() => {
    wanderTimer.current = setTimeout(
      () => {
        if (!isIdle) return;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * IDLE_WANDER_RADIUS;
        setIsWandering(true);
        setWanderOffset({
          left: Math.cos(angle) * dist,
          top: Math.sin(angle) * dist,
        });
        setTimeout(() => {
          setIsWandering(false);
          // 30% chance to wander back to home
          if (Math.random() < 0.3) {
            setWanderOffset({ left: 0, top: 0 });
          }
          scheduleWander();
        }, IDLE_WANDER_DURATION);
      },
      randomBetween(IDLE_WANDER_INTERVAL_MIN, IDLE_WANDER_INTERVAL_MAX),
    );
  }, [isIdle]);

  const scheduleGaze = useCallback(() => {
    gazeTimer.current = setTimeout(
      () => {
        if (!isIdle) return;
        // -1 = look left, 0 = center, 1 = look right
        setGazeDirection(Math.floor(Math.random() * 3) - 1);
        scheduleGaze();
      },
      randomBetween(IDLE_GAZE_INTERVAL_MIN, IDLE_GAZE_INTERVAL_MAX),
    );
  }, [isIdle]);

  useEffect(() => {
    if (isIdle) {
      // Stagger start per agent to avoid synchronized movement
      const startDelay = Math.random() * 3000;
      const t = setTimeout(() => {
        scheduleWander();
        scheduleGaze();
      }, startDelay);
      return () => {
        clearTimeout(t);
        clearTimeout(wanderTimer.current);
        clearTimeout(gazeTimer.current);
      };
    }

    // Reset when not idle
    setWanderOffset({ left: 0, top: 0 });
    setGazeDirection(0);
    setIsWandering(false);
    clearTimeout(wanderTimer.current);
    clearTimeout(gazeTimer.current);
  }, [isIdle, scheduleWander, scheduleGaze]);

  return { wanderOffset, gazeDirection, isWandering };
}
