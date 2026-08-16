import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: IconProps) => {
  const { size = 18, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
};

const paths: Record<string, React.ReactNode> = {
  cursor: (
    <>
      <path d="M5 3l14 8-6 1.5L11 19z" />
    </>
  ),
  rect: <rect x="4" y="4" width="16" height="16" rx="1" />,
  "rounded-rect": <rect x="4" y="4" width="16" height="16" rx="5" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6" />,
  diamond: <path d="M12 3l8 9-8 9-8-9z" />,
  line: <path d="M5 19L19 5" />,
  arrow: (
    <>
      <path d="M5 19L19 5" />
      <path d="M19 5h-7M19 5v7" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4L16 5l3 3L8 19z" />
      <path d="M13 6l4 4" />
    </>
  ),
  text: <path d="M5 5h14M12 5v14M8 19h8" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3 17l5-5 4 4 3-3 6 6" />
    </>
  ),
  eraser: (
    <>
      <path d="M4 16l8-8 8 8M4 16h12M4 16l2 3h7" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 9V6a1.5 1.5 0 0 1 3 0v9.5c0 3.5-2.5 5.5-5.5 5.5h-1C9 21 7 19.5 6 16.5L4.8 13a1.4 1.4 0 0 1 2.2-1.6L9 13" />
    </>
  ),
  undo: <path d="M9 6L4 11l5 5M4 11h11a5 5 0 0 1 0 10h-2" />,
  redo: <path d="M15 6l5 5-5 5M20 11H9a5 5 0 0 0 0 10h2" />,
  download: (
    <>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 19h16" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  grid: (
    <>
      <path d="M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16" />
    </>
  ),
  dots: (
    <>
      <circle cx="6" cy="6" r="1.3" />
      <circle cx="12" cy="6" r="1.3" />
      <circle cx="18" cy="6" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
      <circle cx="6" cy="18" r="1.3" />
      <circle cx="12" cy="18" r="1.3" />
      <circle cx="18" cy="18" r="1.3" />
    </>
  ),
  template: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 4.8L18 9.6l-4.2 1.8L12 16l-1.8-4.6L6 9.6l4.2-1.8z" />
      <path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  "fit-to-screen": (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bringToFront: (
    <>
      <rect x="8" y="8" width="10" height="10" rx="1.5" />
      <path d="M5 14V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  sendToBack: (
    <>
      <rect x="6" y="6" width="10" height="10" rx="1.5" />
      <path d="M19 10v8a2 2 0 0 1-2 2H9" />
    </>
  ),
  sendBackward: (
    <>
      <path d="M5 11h8v8" />
      <path d="M19 13H11V5" />
    </>
  ),
  bringForward: (
    <>
      <path d="M19 13h-8V5" />
      <path d="M5 11h8v8" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  spark: <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />,
  check: <path d="M5 13l4 4L19 7" />,
  rotate: <path d="M4 10a8 8 0 0 1 16 0M4 10V5M4 10h5M20 14a8 8 0 0 1-16 0M20 14v5M20 14h-5" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
};

export const Icon = ({ name, ...rest }: IconProps & { name: string }) => (
  <svg {...base({ ...rest, size: rest.size })} aria-hidden>
    {paths[name] ?? <circle cx="12" cy="12" r="8" />}
  </svg>
);

export const iconNames = Object.keys(paths);