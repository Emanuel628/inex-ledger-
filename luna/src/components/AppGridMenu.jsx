import React, { useEffect, useMemo, useRef, useState } from "react";
import NavDropdownMenu from "./NavDropdownMenu";
import NotificationBell from "./NotificationBell.jsx";
import "./AppGridMenu.css";

const AppGridMenu = ({
  activePage = "dashboard",
  onNavigate = () => {},
  logoutHref,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const dots = useMemo(() => Array.from({ length: 9 }), []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleOutside = (event) => {
      if (!menuOpen) return;
      if (buttonRef.current && buttonRef.current.contains(event.target)) return;
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [menuOpen]);

  const handleNavigateLink = (target) => {
    setMenuOpen(false);
    onNavigate(target);
  };

  return (
    <div className="app-grid-controls">
      <div className="app-grid-menu">
        {menuOpen && (
          <div className="app-grid-menu__overlay" onClick={() => setMenuOpen(false)} />
        )}
        <button
          type="button"
          className="app-grid-button"
          ref={buttonRef}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          {dots.map((_, index) => (
            <span key={index} className="app-grid-dot" aria-hidden="true" />
          ))}
        </button>
        <div
          className="app-grid-menu__dropdown"
          ref={menuRef}
          style={{ display: menuOpen ? "block" : "none" }}
        >
          <NavDropdownMenu
            activePage={activePage}
            onNavigate={handleNavigateLink}
            closeMenu={() => setMenuOpen(false)}
            logoutHref={logoutHref}
          />
        </div>
      </div>
      <NotificationBell onNavigate={onNavigate} />
    </div>
  );
};

export default AppGridMenu;
