import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Akenna AI',
  description: 'Your intelligent, minimalist AI companion.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-[#050E10] text-white" suppressHydrationWarning>{children}</body>
    </html>
  );
}
