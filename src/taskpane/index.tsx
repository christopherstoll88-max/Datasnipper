import React from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { App } from "./App";
import "./styles.css";

Office.onReady(() => {
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  root.render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
});
