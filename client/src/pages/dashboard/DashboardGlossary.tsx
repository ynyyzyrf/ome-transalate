import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import GlossaryManager from "@/pages/admin/GlossaryManager";

/**
 * Dashboard Glossary page wraps the existing GlossaryManager component
 * inside the independent dashboard layout.
 */
export default function DashboardGlossary() {
  return (
    <DashboardAdminLayout>
      <GlossaryManager />
    </DashboardAdminLayout>
  );
}
