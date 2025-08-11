import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ContactPage from './components/ContactPage'
import './index.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash.startsWith('#/contact')) {
    return <ContactPage goHome={() => { window.location.hash = '#/'; }} />;
  }
  return <App goContact={() => { window.location.hash = '#/contact'; }} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
