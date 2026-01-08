import React from "react";
import "./HeroGlue.css";

const HeroGlue = ({ role, why, reassurance }) => {
  if (!role && !why && !reassurance) return null;
  return (
    <div className="hero-glue">
      {role && <span className="hero-role">{role}</span>}
      {why && (
        <div className="hero-strip">
          <span className="hero-strip-label">Why this matters in your financial life</span>
          <p>{why}</p>
        </div>
      )}
      {reassurance && <p className="hero-reassurance">{reassurance}</p>}
    </div>
  );
};

export default HeroGlue;
