// Dashboard layout - now a pass-through since AppShell provides the sidebar
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
