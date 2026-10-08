import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Maskable and Apple icons are padded; fill the padding with the brand indigo instead of the default white rim.
const resizeOptions = { background: '#4F46E5' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions },
    apple: { ...minimal2023Preset.apple, resizeOptions },
  },
  images: ['public/favicon.svg'],
});
