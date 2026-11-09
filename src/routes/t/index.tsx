import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/t/")({
  component: () => <Navigate to="/vault" />,
});
