import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/cinzel-decorative/700.css';
// Handwriting for letters (v0.3): own letters in a quill script, the other side's in the
// German school hand.
import '@fontsource/dancing-script/400.css';
import '@fontsource/playwrite-de-va/400.css';
// v1.2: names on the map in the style of an old atlas – Latin scripts only (the map's names).
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-ext-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-ext-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-ext-600.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerServiceWorker } from './lib/status.svelte.ts';
import { applyLanguage } from './lib/i18n.svelte.ts';

applyLanguage();
const target = document.getElementById('app');
if (!target) throw new Error('#app missing');
mount(App, { target });
void registerServiceWorker();
