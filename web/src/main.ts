import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/cinzel-decorative/700.css';
// Handwriting for letters (v0.3): own letters in a quill script, the other side's in the
// German school hand.
import '@fontsource/dancing-script/400.css';
import '@fontsource/playwrite-de-grund/400.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerServiceWorker } from './lib/status.svelte.ts';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');
mount(App, { target });
void registerServiceWorker();
