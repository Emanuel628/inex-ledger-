import { useEffect, useState } from "react";

const isBrowser = typeof window !== "undefined";

export const usePrivacyShield = (isEnabled) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    if (!isEnabled || !isBrowser) {
      setIsBlurred(false);
      return undefined;
    }

    const onBlur = () => setIsBlurred(true);
    const onFocus = () => setIsBlurred(false);

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [isEnabled]);

  return isBlurred;
};
