import type { Metadata } from 'next'
import { Inter, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  weight: ['400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Live Video Ask - Interactive Learning Platform',
  description: 'Real-time video transcription with AI-powered Q&A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className={`${inter.variable} ${notoSansDevanagari.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}