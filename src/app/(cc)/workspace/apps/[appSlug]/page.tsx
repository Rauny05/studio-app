import { Suspense } from "react";
import { AppWorkspace } from "@/cc/components/AppWorkspace";

export default async function Page({ params }: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await params;
  return <Suspense><AppWorkspace slug={appSlug} /></Suspense>;
}
