import AuthShell from './_components/AuthShell';

export default function Layout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <>
      <AuthShell>{children}</AuthShell>
      {modal}
    </>
  );
}
