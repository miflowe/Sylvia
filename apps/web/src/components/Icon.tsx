// Line icons on a 24px grid, 1.75 stroke, round caps and joins, per the design system.
const paths = {
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  sprout: "M12 21V11M12 11c0-4 3-7 8-7 0 4-3 7-8 7zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z",
  bell: "M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6",
  leaf: "M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  wind: "M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3M3 12h7",
  flame: "M12 21c4 0 7-3 7-7 0-5-5-7-5-11-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 4-2 7 0 4 3 7 7 7zM12 21c-2 0-3-1.5-3-3.5S12 13 12 13s3 2.5 3 4.5-1 3.5-3 3.5z",
  thermometer: "M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0zM12 17.5v-6",
  sensor: "M12 13a1 1 0 100-2 1 1 0 000 2zM8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7M5.6 18.4a9 9 0 010-12.8M18.4 5.6a9 9 0 010 12.8",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  shieldCheck: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  play: "M8 5l11 7-11 7z",
  pin: "M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  locate: "M12 19a7 7 0 100-14 7 7 0 000 14zM12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z",
  building: "M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M3 21h18",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  store: "M4 10v10h16V10M3 10l2-6h14l2 6zM9 20v-5h6v5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.01",
  check: "M5 12l5 5 9-10",
  close: "M6 6l12 12M18 6L6 18",
  share: "M12 3v12M7 8l5-5 5 5M5 13v7h14v-7",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
