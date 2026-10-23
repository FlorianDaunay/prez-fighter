import { useEffect, useRef } from "react";
import { onMenu, type MenuEvent } from "@/input/manager";

/** Subscribes the screen to menu navigation (keyboard, gamepads). The latest handler always runs. */
export function useMenu(handler: (e: MenuEvent) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    return onMenu((e) => ref.current(e));
  }, [active]);
}
