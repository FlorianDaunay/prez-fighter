import { useEffect } from "react";
import { useApp } from "./store";
import { ArcadeEnd, Fight, Results, StageSelect } from "./screens/Fight";
import { Boot, Credits, MainMenu, TitleScreen } from "./screens/Intro";
import { Online, joinCodeFromUrl } from "./screens/Online";
import { Roster } from "./screens/Roster";
import { CharSelect } from "./screens/Select";
import { Controls, Options } from "./screens/Settings";

export function App() {
  const screen = useApp((s) => s.screen);
  const link = useApp((s) => s.link);
  useEffect(() => {
    const leave = () => link?.leave();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [link]);
  // A shared join link skips the title once the disclaimer is accepted.
  useEffect(() => {
    if (screen === "title" && joinCodeFromUrl()) useApp.getState().go("online");
  }, [screen]);
  switch (screen) {
    case "boot":
      return <Boot />;
    case "title":
      return <TitleScreen />;
    case "menu":
      return <MainMenu />;
    case "select":
      return <CharSelect />;
    case "stage":
      return <StageSelect />;
    case "fight":
      return <Fight />;
    case "results":
      return <Results />;
    case "arcadeEnd":
      return <ArcadeEnd />;
    case "online":
      return <Online />;
    case "roster":
      return <Roster />;
    case "options":
      return <Options />;
    case "controls":
      return <Controls />;
    case "credits":
      return <Credits />;
  }
}
