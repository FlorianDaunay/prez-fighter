import React from "react";
import ReactDOM from "react-dom/client";
import "@/themes/store";
import "./index.css";
import { loadKeyboardLayout } from "@/input/bindings";
import { startInput } from "@/input/manager";
import { App } from "@/ui/App";

startInput();
void loadKeyboardLayout();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
