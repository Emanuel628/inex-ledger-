import React from "react";
import NotificationBell from "./NotificationBell.jsx";
import HamburgerMenu from "./HamburgerMenu";
import "./TopRightControls.css";

const TopRightControls = ({
  className = "",
  onNavigate = () => {},
  ...hamburgerProps
}) => {
  const containerClass = ["topRightControls", className].filter(Boolean).join(" ");
  return (
    <div className={containerClass}>
      <NotificationBell onNavigate={onNavigate} />
      <HamburgerMenu onNavigate={onNavigate} {...hamburgerProps} />
    </div>
  );
};

export default TopRightControls;
