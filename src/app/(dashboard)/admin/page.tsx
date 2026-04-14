import { getServerSession } from "next-auth";
import { authOptions, ADMIN_EMAIL } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email !== ADMIN_EMAIL) redirect("/auth/unauthorized");
  return <UserManagement />;
}
