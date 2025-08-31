import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DemoApp from "./DemoApp";

// Use DemoApp for web demo, App for production
const AppComponent = window.location.search.includes('demo') ? DemoApp : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppComponent />
  </React.StrictMode>,
);
