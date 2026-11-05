import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/cinzel-decorative/700.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerServiceWorker } from './lib/status.svelte.ts';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');
mount(App, { target });
void registerServiceWorker();
