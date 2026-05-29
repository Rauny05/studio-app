import { ScriptsBoard } from "@/components/scripts/ScriptsBoard";

export const metadata = { title: "Scripts · RM Studio" };

export default function ScriptsPage() {
  return (
    <main className="page-container">
      <ScriptsBoard />
    </main>
  );
}
