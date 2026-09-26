import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "../components/dashboard";
createRoot(document.getElementById("root")!).render(
  <Dashboard
    admin={new URLSearchParams(location.search).has("admin")}
    offline
  />,
);
