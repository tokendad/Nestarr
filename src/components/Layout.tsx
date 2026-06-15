import React, { useState } from "react";
import { useIsMobile } from "../lib/useMobile";
import { APP_NAME } from "../lib/constants";

interface LayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  onLogout: () => void;
  userEmail?: string;
  userName?: string;
  onUserClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export { useIsMobile };

const Layout: React.FC<LayoutProps> = ({ 
  sidebar, 
  children, 
  onLogout, 
  userEmail, 
  userName, 
  onUserClick,
  searchQuery = "",
  onSearchChange,
}) => {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          {isMobile && (
            <button 
              className="mobile-menu-toggle" 
              onClick={handleMobileMenuToggle}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              <span className={`hamburger-icon ${mobileMenuOpen ? 'open' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          )}
          <img src="/logo.png" alt={APP_NAME} className="app-logo" />
          {onSearchChange && (
            <div className="header-search">
              <input
                type="search"
                aria-label="Search items"
                placeholder="🔍 Search items..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="app-header-right">
          {!isMobile && (userName || userEmail) && (
            <span
              className="user-email"
              onClick={onUserClick}
              onKeyDown={onUserClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUserClick(); } } : undefined}
              tabIndex={onUserClick ? 0 : undefined}
              role={onUserClick ? "button" : undefined}
              style={{ cursor: onUserClick ? "pointer" : "default" }}
              title="Click to edit profile"
            >
              {userName || userEmail}
            </span>
          )}
        </div>
      </header>
      <div className="app-body">
        {/* Mobile overlay */}
        {isMobile && mobileMenuOpen && (
          <div 
            className="mobile-menu-overlay" 
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}
        {/* Sidebar - always rendered but conditionally visible on mobile */}
        <aside
          className={`app-sidebar ${isMobile ? 'mobile' : ''} ${mobileMenuOpen ? 'open' : ''}`}
          aria-label="Primary navigation"
          onClick={(e) => {
            // Close menu when clicking a nav link on mobile
            const target = e.target;
            if (isMobile && target instanceof HTMLElement && target.closest('.nav-link')) {
              closeMobileMenu();
            }
          }}
        >
          {sidebar}
        </aside>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
