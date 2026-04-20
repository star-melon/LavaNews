import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'apple-black': '#000000',
        'apple-gray': '#f5f5f7',
        'apple-near-black': '#1d1d1f',
        'apple-blue': '#0071e3',
        'apple-link-blue': '#0066cc',
        'apple-bright-blue': '#2997ff',
        'apple-dark-surface': '#272729',
        'apple-text-secondary': 'rgba(0, 0, 0, 0.8)',
        'apple-text-tertiary': 'rgba(0, 0, 0, 0.48)',
        'apple-nav-bg': 'rgba(0, 0, 0, 0.8)',
        'apple-card-shadow': 'rgba(0, 0, 0, 0.22)',
      },
      fontFamily: {
        'apple-display': [
          'SF Pro Display',
          'SF Pro Icons',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        'apple-text': [
          'SF Pro Text',
          'SF Pro Icons',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      maxWidth: {
        'apple-content': '980px',
      },
      borderRadius: {
        'apple-pill': '980px',
      },
    },
  },
  plugins: [],
};

export default config;
