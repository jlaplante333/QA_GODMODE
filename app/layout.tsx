import type { ReactNode } from 'react';
import './globals.css';
import '../lib/daytona';

export const metadata = {
  title: 'QA Agent Godmode',
  description: 'Hackathon-grade QA Agent with curated context and sandboxed execution.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


