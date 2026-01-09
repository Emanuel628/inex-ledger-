const bytesToBase64 = (buffer) => {
  if (!(buffer instanceof Uint8Array)) {
    buffer = new Uint8Array(buffer);
  }
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
};

export const generateVaultSalt = () => {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    return "";
  }
  const array = window.crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(array);
};
