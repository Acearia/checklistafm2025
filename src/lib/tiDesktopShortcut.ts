export const showTiDesktopShortcut = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ipadDesktopMode = /Macintosh|MacIntel/.test(`${ua} ${navigator.platform}`) && navigator.maxTouchPoints > 1;
  if (ipadDesktopMode || /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return false;
  return window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches;
};
