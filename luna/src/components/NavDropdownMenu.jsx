import React, { useCallback, useEffect, useRef } from "react";
import NavMenuLinks from "./NavMenuLinks";

const SCROLL_STEP = 80;

const NavDropdownMenu = ({
  activePage,
  onNavigate = () => {},
  closeMenu = () => {},
  logoutHref = "/Local/BudgetIQ Login",
  logoutLabel = "Logout",
  logoutPage = "login",
}) => {
  const listRef = useRef(null);

  const scrollBy = useCallback(
    (direction) => {
      if (!listRef.current) return;
      listRef.current.scrollBy({ top: direction * SCROLL_STEP, behavior: "smooth" });
    },
    [listRef]
  );

  const handleLogout = (event) => {
    event.preventDefault();
    closeMenu();
    try {
      localStorage.removeItem("lunaLoggedIn");
      localStorage.removeItem("lunaStayLoggedIn");
      sessionStorage.removeItem("lunaLoggedIn");
      window.dispatchEvent(new Event("auth-updated"));
    } catch (e) {
      /* ignore */
    }
    if (logoutPage) {
      onNavigate(logoutPage);
      return;
    }
    window.location.replace(logoutHref);
  };

  return (
    <>
      <div className="menu-scroll" ref={listRef}>
        <NavMenuLinks activePage={activePage} onNavigate={onNavigate} closeMenu={closeMenu} />
        <a href={logoutHref} onClick={handleLogout}>
          {logoutLabel}
        </a>
      </div>
    </>
  );
};

export default NavDropdownMenu;
