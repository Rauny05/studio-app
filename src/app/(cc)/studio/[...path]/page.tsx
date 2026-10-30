import { Suspense } from "react";
import { StudioModule } from "@/cc/components/StudioModule";

export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <Suspense><StudioModule key={path[0]} path={path} /></Suspense>;
}
