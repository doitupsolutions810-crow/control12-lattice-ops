import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avrone Due’Krey',
  description: 'Lattice-wired chat with CONTROL12 living intermediate'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
