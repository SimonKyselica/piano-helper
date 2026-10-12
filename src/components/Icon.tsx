const PATHS = {
  back: <path d="M15 18l-6-6 6-6" />,
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H2.5v6H6l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  skip: <path d="M5 5l9 7-9 7zM18 5v14" />,
  retry: <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.5M3.5 3.5v5h5" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  flame: <path d="M12 2.5c.8 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.4 2.6-5.5.3 2 1.3 3.2 2.6 3.5-.9-3.3-.6-6.3.3-9z" />,
  star: <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />,
  notes: (
    <>
      <path d="M9 18V5.5l11-2v12.5" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  ear: (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6.5-6 10a3.5 3.5 0 0 1-7 0" />
      <path d="M15.5 8.5a3 3 0 0 0-6 0c0 1.5 1.2 2 2 2.5" />
    </>
  ),
  keys: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M8.8 20v-6M15.2 20v-6M7 4v10h3.6V4M13.4 4v10H17V4" />
    </>
  ),
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  staff: (
    <>
      <path d="M2 6h20M2 10h20M2 14h20M2 18h20" strokeWidth={1.4} />
      <ellipse cx="9" cy="16" rx="3" ry="2.2" fill="currentColor" stroke="none" transform="rotate(-20 9 16)" />
      <path d="M11.7 15.3V4" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
