import React, { useEffect, useRef, useMemo, useState } from "react";
import NavDropdownMenu from "./NavDropdownMenu";

const DEFAULT_LOGOUT_HREF = "/Local/BudgetIQ Login";

const HamburgerMenu = ({
  activePage,
  onNavigate = () => {},
  logoutHref = DEFAULT_LOGOUT_HREF,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const burgerRef = useRef(null);
  const menuRef = useRef(null);
  const dots = useMemo(() => Array.from({ length: 9 }), []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleClickOutside = (event) => {
      if (!menuOpen) return;
      if (burgerRef.current && burgerRef.current.contains(event.target)) return;
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  const handleNavigateLink = (target) => {
    setMenuOpen(false);
    onNavigate(target);
  };

  return (
    <div className="menu-container">
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)} />}
      <div
        className="hamburger"
        ref={burgerRef}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
      >
        {dots.map((_, index) => (
          <span key={index} className="hamburger-dot" aria-hidden="true" />
        ))}
      </div>
      <div
        className="dropdown-menu"
        ref={menuRef}
        style={{ display: menuOpen ? "block" : "none" }}
      >
        <NavDropdownMenu
          activePage={activePage}
          onNavigate={handleNavigateLink}
          closeMenu={() => setMenuOpen(false)}
          logoutHref={logoutHref}
          menuOpen={menuOpen}
        />
      </div>
    </div>
  );
};

export default HamburgerMenu;
