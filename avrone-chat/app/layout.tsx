import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avrone Due’Krey · CONTROL12 Verified Lattice Console',
  description: 'Verified v72 package dashboard, bounded chat, and browser-local coding workspace'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
