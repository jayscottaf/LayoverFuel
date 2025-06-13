import { Dashboard, DashboardData } from "../dashboard/Dashboard";

interface DashboardPageProps {
  demoData?: DashboardData;
}

export default function DashboardPage({ demoData }: DashboardPageProps) {
  return <Dashboard demoData={demoData} />;
}
