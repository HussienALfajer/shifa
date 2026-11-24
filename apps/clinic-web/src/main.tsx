import { mountShellApp } from '@shifa/web-shell';
import './styles.css';

const element = document.getElementById('root');
if (!element) throw new Error('no #root element');

mountShellApp({
  app: 'clinic',
  element,
  version: import.meta.env.SHIFA_APP_VERSION,
  serviceWorker: import.meta.env.PROD,
});
