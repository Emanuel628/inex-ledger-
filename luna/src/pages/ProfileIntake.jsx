import React, { useEffect, useState } from "react";
import "./ProfileIntake.css";
import TopRightControls from "../components/TopRightControls.jsx";

const STORAGE_KEY = "userIdentity";

const dispatchIdentityUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("identity-updated"));
};

const MONTH_OPTIONS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  return { value: day.toString().padStart(2, "0"), label: day.toString() };
});

const YEAR_OPTIONS = Array.from({ length: 120 }, (_, index) => {
  const year = new Date().getFullYear() - index;
  return year.toString();
});

const parseDob = (value = "") => {
  if (!value) return { year: "", month: "", day: "" };
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
};

const formatPhoneNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const ProfileIntake = ({ onNavigate = () => {} }) => {
  const [form, setForm] = useState({
    firstName: "",
    middleInitial: "",
    lastName: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    password: "",
    ssn: "",
    dob: "",
  });

  const [saveMessage, setSaveMessage] = useState("");

  const handleChange = (field) => (e) => {
    const rawValue = e.target.value;
    const nextValue = field === "phone" ? formatPhoneNumber(rawValue) : rawValue;
    const next = { ...form, [field]: nextValue };
    setForm(next);
    setSaveMessage("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    const next = { ...form, phone: formatted };
    setForm(next);
    setSaveMessage("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
  };

  const [dobParts, setDobParts] = useState(() => parseDob(form.dob));

  useEffect(() => {
    setDobParts(parseDob(form.dob));
  }, [form.dob]);

  const updateDobPart = (part) => (value) => {
    setDobParts((prev) => {
      const next = { ...prev, [part]: value };
      const composed = next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "";
      handleChange("dob")({ target: { value: composed } });
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
    setSaveMessage("Saved.");
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <TopRightControls
          className="top-controls"
          activePage="profile"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="header-text">
          <div className="title">Verification</div>
          <div className="subtitle">
            Securely provide details needed to check loan pre-qualification and eligibility.
          </div>
        </div>
      </header>

      <form className="profile-card" onSubmit={handleSubmit}>
        <h3 className="profile-section-title">Personal Information</h3>
        <div className="field name-grid">
          {[
          { key: "firstName", label: "First name", required: true },
          { key: "middleInitial", label: "Middle initial (optional)", maxLength: 1 },
          { key: "lastName", label: "Last name", required: true },
          ].map((item) => (
            <div key={item.key} className="name-field">
              <span className="name-label">{item.label}</span>
              <input
                id={item.key}
                type="text"
                value={form[item.key]}
                onChange={handleChange(item.key)}
                maxLength={item.maxLength}
                required={item.required}
              />
            </div>
          ))}
        </div>

        <div className="field address-grid">
          <label htmlFor="street">Street</label>
            <input
              id="street"
              type="text"
              value={form.street}
              onChange={handleChange("street")}
              required
            />
          <label htmlFor="city">City</label>
          <input
            id="city"
            type="text"
            value={form.city}
            onChange={handleChange("city")}
            required
          />
          <label htmlFor="state">State</label>
          <input
            id="state"
            type="text"
            value={form.state}
            onChange={handleChange("state")}
            required
          />
          <label htmlFor="zip">ZIP</label>
          <input
            id="zip"
            type="text"
            value={form.zip}
            onChange={handleChange("zip")}
            maxLength={10}
            required
          />
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={handlePhoneChange}
            onInput={handlePhoneChange}
            inputMode="tel"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ssn">SSN (last 4 or full when required)</label>
          <input
            id="ssn"
            type="text"
            value={form.ssn}
            onChange={handleChange("ssn")}
            maxLength={11}
            required
          />
        </div>

        <div className="field dob-field">
          <label>Date of birth</label>
          <div className="dob-picker">
            <select value={dobParts.month} onChange={(event) => updateDobPart("month")(event.target.value)}>
              <option value="">Month</option>
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select value={dobParts.day} onChange={(event) => updateDobPart("day")(event.target.value)}>
              <option value="">Day</option>
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select value={dobParts.year} onChange={(event) => updateDobPart("year")(event.target.value)}>
              <option value="">Year</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3 className="profile-section-title">Security &amp; Privacy</h3>
        <p className="profile-section-note">
          Your information is protected and handled securely. We never share or sell it without your consent.
          Credit checks only happen with your permission.
        </p>
        <div className="button-row">
        <button className="primary-btn purple-save-btn" type="submit">
            Save
          </button>
        </div>
        {saveMessage && <div className="hint">{saveMessage}</div>}
      </form>

    </div>
  );
};

export default ProfileIntake;


