import React, { useEffect, useState } from 'react';
import { auth } from './lib/api';
import Login from './pages/Login';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Sites from './pages/Sites';
import ApiKeys from './pages/ApiKeys';
import Sources from './pages/Sources';
import Articles from './pages/Articles';
import Queue from './pages/Queue';
import Rapat from './pages/Rapat';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function getPage() {
  const path = window.location.pathname;
  if (path === '/' || path === '/overview') return 'overview';
  if (path.startsWith('/sites'))    return 'sites';
  if (path.startsWith('/keys'))     return 'keys';
  if (path.startsWith('/sources'))  return 'sources';
  if (path.startsWith('/articles')) return 'articles';
  if (path.startsWith('/queue'))    return 'queue';
  if (path.startsWith('/rapat'))    return 'rapat';
  if (path.startsWith('/analytics'))return 'analytics';
  if (path.startsWith('/settings')) return 'settings';
  return 'overview';
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(null); // null = loading
  const [currentPage, setCurrentPage] = useState(getPage());

  useEffect(() => {
    auth.me()
      .then(res => setLoggedIn(res.data?.loggedIn))
      .catch(() => setLoggedIn(false));
  }, []);

  // Simple client-side navigation
  const navigate = (page) => {
    window.history.pushState({}, '', `/${page === 'overview' ? '' : page}`);
    setCurrentPage(page);
  };

  useEffect(() => {
    const handlePop = () => setCurrentPage(getPage());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  if (loggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  const pages = {
    overview:  <Overview navigate={navigate} />,
    sites:     <Sites />,
    keys:      <ApiKeys />,
    sources:   <Sources />,
    articles:  <Articles />,
    queue:     <Queue navigate={navigate} />,
    rapat:     <Rapat />,
    analytics: <Analytics />,
    settings:  <Settings onLogout={() => setLoggedIn(false)} />,
  };

  return (
    <Layout currentPage={currentPage} navigate={navigate}>
      {pages[currentPage] || pages.overview}
    </Layout>
  );
}
