import { Suspense } from "react";
import { TasksWorkspace } from "@/cc/components/TasksWorkspace";

export default function Page() {
  return <Suspense><TasksWorkspace initialView="all" /></Suspense>;
}
