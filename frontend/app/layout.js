import './globals.css';

export const metadata = {
  title: 'Audio Dedup Demo',
  description: 'Minimal frontend for audio upload deduplication and similarity warnings'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
