import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgroIntegra',
  description: 'Assistência técnica rural para secretarias municipais de agricultura',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
