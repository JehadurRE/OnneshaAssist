import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$slug")({
  component: RedirectToVaultSlug,
});

function RedirectToVaultSlug() {
  const { slug } = Route.useParams();
  return <Navigate to="/vault/$slug" params={{ slug }} />;
}
