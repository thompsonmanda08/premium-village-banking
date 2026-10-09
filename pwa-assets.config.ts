import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Maskable and Apple icons are padded; white matches the emblem's own white disc, so the logo sits on one field.
const resizeOptions = { background: '#FFFFFF' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions },
    apple: { ...minimal2023Preset.apple, resizeOptions },
  },
  images: ['public/logo.png'],
});
