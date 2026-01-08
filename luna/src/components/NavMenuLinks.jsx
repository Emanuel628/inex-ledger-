import React, { useMemo } from "react";
import { NAV_LINKS } from "../data/navLinks";
import { usePreferences } from "../contexts/PreferencesContext";

const NavMenuLinks = ({ activePage, onNavigate = () => {}, closeMenu = () => {} }) => {
  const { preferences } = usePreferences();
  const showBusinessTools = preferences.premiumAccess && preferences.businessFeatures;
  const links = useMemo(
    () =>
      NAV_LINKS.filter(
        (link) => link.page !== "business-tools" || showBusinessTools
      ),
    [showBusinessTools]
  );

  return (
    <>
      {links.map((link) => (
        <a
          key={link.page}
          href="#"
          onClick={(event) => {
            event.preventDefault();
            closeMenu();
            onNavigate(link.page);
          }}
          className={link.page === activePage ? "active" : ""}
        >
          {link.label}
        </a>
      ))}
    </>
  );
};

export default NavMenuLinks;
