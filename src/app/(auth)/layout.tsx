import AuthShell from './_components/AuthShell';
import AuthRouteGuard from './_components/AuthRouteGuard';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthRouteGuard>
      <AuthShell>{children}</AuthShell>
    </AuthRouteGuard>
  );
}
