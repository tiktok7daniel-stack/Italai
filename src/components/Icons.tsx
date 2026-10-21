// Small stroke icon set (24px grid), drawn to match the glass UI.
type P = { size?: number };

const svg = (size: number, children: React.ReactNode, fill = false) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

export const IconMic = ({ size = 24 }: P) =>
  svg(size, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>);
export const IconStop = ({ size = 24 }: P) => svg(size, <rect x="6" y="6" width="12" height="12" rx="3" />, true);
export const IconPlay = ({ size = 24 }: P) =>
  svg(size, <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>);
export const IconSlow = ({ size = 24 }: P) =>
  svg(size, <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2h4" /></>);
export const IconExpand = ({ size = 24 }: P) =>
  svg(size, <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconBookmark = ({ size = 24, filled = false }: P & { filled?: boolean }) =>
  svg(size, <path d="M6 3h12v18l-6-4-6 4z" />, filled);
export const IconSend = ({ size = 24 }: P) => svg(size, <path d="M20 12 4 4l3 8-3 8zM7 12h13" />);
export const IconChat = ({ size = 24 }: P) =>
  svg(size, <path d="M4 5h16v11H9l-5 4z" />);
export const IconEar = ({ size = 24 }: P) =>
  svg(size, <><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0" /><path d="M10 9a2 2 0 0 1 4 0" /></>);
export const IconBook = ({ size = 24 }: P) =>
  svg(size, <><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-4a3 3 0 0 0-3 3" /><path d="M20 4v14h-5" /></>);
export const IconSpark = ({ size = 24 }: P) =>
  svg(size, <path d="M12 2c.6 5 2.4 7.4 8 8-5.6.6-7.4 3-8 10-.6-7-2.4-9.4-8-10 5.6-.6 7.4-3 8-8z" />, true);
export const IconClose = ({ size = 24 }: P) => svg(size, <path d="M6 6l12 12M18 6 6 18" />);
export const IconTrash = ({ size = 24 }: P) =>
  svg(size, <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
export const IconX = IconClose;
export const IconCheck = ({ size = 24 }: P) => svg(size, <path d="m5 12 5 5 9-10" />);
export const IconKeyboard = ({ size = 24 }: P) =>
  svg(size, <><rect x="2" y="6" width="20" height="12" rx="3" /><path d="M6 10h0M10 10h0M14 10h0M18 10h0M7 14h10" /></>);
export const IconWarn = ({ size = 24 }: P) =>
  svg(size, <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></>);
export const IconBulb = ({ size = 24 }: P) =>
  svg(size, <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>);
export const IconGear = ({ size = 24 }: P) =>
  svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconUsers = ({ size = 24 }: P) =>
  svg(size, <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>);
export const IconBow = ({ size = 24 }: P) =>
  svg(size, <><circle cx="12" cy="6" r="3" /><path d="M6 21v-4a6 6 0 0 1 12 0v4M9 21v-3M15 21v-3" /></>);
export const IconBolt = ({ size = 24 }: P) => svg(size, <path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
export const IconHeart = ({ size = 24 }: P) =>
  svg(size, <path d="M12 20s-7.5-4.6-9.2-9.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 9.2 4.2C19.5 15.4 12 20 12 20z" />);
export const IconHand = ({ size = 24 }: P) =>
  svg(size, <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 9.5v-6a1.5 1.5 0 0 1 3 0v6M13 9.5V5a1.5 1.5 0 0 1 3 0v6M16 10a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8h-.5a7 7 0 0 1-5.6-2.8L2.6 16a1.6 1.6 0 0 1 2.5-2L7 16" />);
export const IconBubbles = ({ size = 24 }: P) =>
  svg(size, <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h8A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3v-3.2A2.5 2.5 0 0 1 3 10.5z" /><path d="M19 8.5h.5A1.5 1.5 0 0 1 21 10v5a2.5 2.5 0 0 1-1 2v3l-3.5-2.5H12a2.5 2.5 0 0 1-2-1" /></>);
export const IconSwap = ({ size = 24 }: P) =>
  svg(size, <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />);
export const IconSearch = ({ size = 24 }: P) =>
  svg(size, <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>);
