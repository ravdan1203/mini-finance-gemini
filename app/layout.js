import './globals.css';

export const metadata = {
  title: 'Миний Санхүү Gemini',
  description: 'Баримтын зураг уншиж санхүү бүртгэх app'
};

export default function RootLayout({ children }) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
