import React, { useState } from 'react';

const NAV = [
  { id: 'overview',  label: 'Overview',    icon: '📊' },
  { id: 'sites',     label: 'Sites',       icon: '🌐' },
  { id: 'keys',      label: 'API Keys',    icon: '🔑' },
  { id: 'sources',   label: 'Sources',     icon: '📰' },
  { id: 'articles',  label: 'Articles',    icon: '📝' },
  { id: 'queue',     label: 'Queue',       icon: '⚙️' },
  { id: 'rapat',     label: 'Rapat',       icon: '📋' },
  { id: 'analytics', label: 'Analytics',   icon: '📈' },
  { id: 'settings',  label: 'Settings',    icon: '⚙' },
];

export default function Layout({ children, currentPage, navigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-gray-900 text-white flex flex-col transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'} flex-shrink-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-700">
          {!collapsed && (
            <span className="font-bold text-sm text-white truncate">📡 News AI Agent</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`ml-auto text-gray-400 hover:text-white text-lg leading-none ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Phase indicator */}
        {!collapsed && (
          <div className="p-3 border-t border-gray-700">
            <div className="bg-blue-900 rounded px-2 py-1 text-xs text-blue-300">
              Phase 8 — Quality & Humanizer Engine ✓
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <h1 className="text-base font-semibold text-gray-800 capitalize">
            {NAV.find(n => n.id === currentPage)?.label || 'Overview'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500">Asia/Jakarta</span>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">A</div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
