import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root";
import { TerminalDemoPage } from "../components/terminal/TerminalDemoPage";

export const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terminal",
  component: TerminalDemoPage,
});