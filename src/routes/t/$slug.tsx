import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/vault/$slug", params: { slug: params.slug } });
  },
});
