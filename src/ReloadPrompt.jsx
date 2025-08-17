// src/ReloadPrompt.jsx
import React from 'react';
import { useRegisterSW } from 'vite-plugin-pwa/react';
import './ReloadPrompt.css'; // We'll create this file for styling

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.log('Service Worker registration error:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="ReloadPrompt-container">
      <div className="ReloadPrompt-toast">
        <div className="ReloadPrompt-message">
          {offlineReady ? (
            <span>App ready to work offline</span>
          ) : (
            <span>New version available, click on reload button to update.</span>
          )}
        </div>
        {needRefresh && (
          <button className="ReloadPrompt-button" onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
        )}
        <button className="ReloadPrompt-button" onClick={() => close()}>
          Close
        </button>
      </div>
    </div>
  );
}

export default ReloadPrompt;