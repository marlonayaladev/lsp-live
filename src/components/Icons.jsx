export default function Icon({ name, size = 18, strokeWidth = 1.7, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: `icon ${className}`,
    "aria-hidden": "true",
  };

  switch (name) {
    case "camera":
      return (
        <svg {...common}>
          <path d="M3.5 8.8A2.3 2.3 0 0 1 5.8 6.5h1.5L8.6 4.6h6.8l1.3 1.9h1.5a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3Z" />
          <circle cx="12" cy="12.3" r="3.4" />
        </svg>
      );
    case "train":
      return (
        <svg {...common}>
          <path d="M12 3.6 2.8 8l9.2 4.4L21.2 8 12 3.6Z" />
          <path d="M6.2 10.2v5.1c0 1.6 2.6 2.9 5.8 2.9s5.8-1.3 5.8-2.9v-5.1" />
          <path d="M21.2 8v5.4" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M3.9 12a8.1 8.1 0 1 0 2.4-5.8" />
          <path d="M3.6 4.6v3.9h3.9" />
          <path d="M12 7.8V12l3 1.9" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 7h9" />
          <path d="M17 7h3" />
          <circle cx="15" cy="7" r="2.1" />
          <path d="M4 17h3" />
          <path d="M11 17h9" />
          <circle cx="9" cy="17" r="2.1" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 5.5 18.5 12 8 18.5Z" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4.5 7h15" />
          <path d="M9.5 7V5.2c0-.7.6-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7" />
          <path d="M6.5 7l.8 11.3c.1.9.8 1.7 1.8 1.7h5.8c.9 0 1.7-.8 1.8-1.7L17.5 7" />
          <path d="M10 11v5.5M14 11v5.5" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v10.5" />
          <path d="m7.8 10.6 4.2 4.2 4.2-4.2" />
          <path d="M5 18.5h14" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 15V4.5" />
          <path d="M7.8 8.7 12 4.5l4.2 4.2" />
          <path d="M5 18.5h14" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="10.5" height="10.5" rx="2.4" />
          <path d="M15 6.3A2.3 2.3 0 0 0 12.7 4H6.2A2.2 2.2 0 0 0 4 6.2v6.5A2.3 2.3 0 0 0 6.3 15" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.4 4.4L19 6.9" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M12 4.5 21 19.6H3Z" />
          <path d="M12 9.5v4.3" />
          <circle cx="12" cy="16.9" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "hand":
      return (
        <svg {...common}>
          <path d="M8.5 12.5V6.8a1.6 1.6 0 0 1 3.2 0v4.6" />
          <path d="M11.7 11.4V5.6a1.6 1.6 0 0 1 3.2 0v5.8" />
          <path d="M14.9 11.4V7.6a1.6 1.6 0 0 1 3.2 0v6.1c0 3.6-2.4 6.1-6 6.1-2.2 0-3.6-.8-4.7-2.4l-2.3-3.4a1.5 1.5 0 0 1 2.4-1.8l1.5 1.9" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13.4 3.5 5.7 13h5l-1.1 7.5 7.7-9.5h-5Z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.8v2M12 19.2v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.8 12h2M19.2 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3.5 13.9 9l5.6 1.9-5.6 2L12 18.5l-1.9-5.6L4.5 11 10.1 9Z" />
        </svg>
      );
    case "print":
      return (
        <svg {...common}>
          <path d="M7 9V4.5h10V9" />
          <rect x="4" y="9" width="16" height="7" rx="2" />
          <path d="M7 14h10v5.5H7z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M4.5 12h15M13.5 6l6 6-6 6" />
        </svg>
      );
    case "wave":
      return (
        <svg {...common}>
          <path d="M3 12h2.2l1.6-4.6L9 16.4l2-9.6 2 6.4 1.4-3.2H19" />
        </svg>
      );
    default:
      return null;
  }
}
