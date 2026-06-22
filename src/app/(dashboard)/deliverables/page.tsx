import { Suspense } from "react";
import { DeliverablesView } from "@/components/deliverables/DeliverablesView";

export default function DeliverablesPage() {
  return (
    <Suspense>
      <DeliverablesView />
    </Suspense>
  );
}
