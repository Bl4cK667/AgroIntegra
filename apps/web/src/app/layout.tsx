import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import { THEME_BOOT_SCRIPT } from '@/lib/themes';
import './globals.css';

// Fonte institucional: legível em tabelas e formulários, com números de largura fixa.
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AgroIntegra',
  description: 'Assistência técnica rural para secretarias municipais de agricultura',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // O script aplica o tema deste dispositivo antes da primeira pintura; por isso o <html>
    // pode diferir do HTML do servidor (data-palette/data-theme) e suprimimos o aviso.
    <html lang="pt-BR" className={plex.variable} data-palette="pure-light" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
