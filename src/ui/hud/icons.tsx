export function Icon({
  name,
  className = 'hf-ico',
}: {
  name: string
  className?: string
}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }
  switch (name) {
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'pavement':
      return (
        <svg {...common}>
          <rect x="3" y="9" width="18" height="6" rx="1" />
          <path d="M7 12h2M11 12h2M15 12h2" />
        </svg>
      )
    case 'stands':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v2M12 17v2M5 12h2M17 12h2" />
        </svg>
      )
    case 'terminal':
      return (
        <svg {...common}>
          <path d="M4 20V9l8-5 8 5v11" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case 'ops':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 21v-4M4.9 6.5l2.8 2.8M16.3 14.7l2.8 2.8M3 12h4M17 12h4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'landside':
      return (
        <svg {...common}>
          <path d="M3 18h18" />
          <path d="M6 18V8l6-3 6 3v10" />
        </svg>
      )
    case 'services':
      return (
        <svg {...common}>
          <path d="M14.5 6.5a4 4 0 0 0-5.7 5.7L4 17l3 3 4.8-4.8a4 4 0 0 0 5.7-5.7l-2.2 2.2-1.8-1.8z" />
        </svg>
      )
    case 'airlines':
      return (
        <svg {...common}>
          <path d="M3 13l18-5-4 8-5 1-2 4-2-4-5-4z" />
        </svg>
      )
    case 'planner':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      )
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      )
    case 'bulldoze':
      return (
        <svg {...common}>
          <path d="M5 8h11l3 4v5H5z" />
          <path d="M8 17v2M16 17v2M4 8l2-3h7" />
        </svg>
      )
    case 'pause':
      return (
        <svg {...common}>
          <path d="M8 5v14M16 5v14" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common}>
          <path d="M8 5l11 7-11 7z" />
        </svg>
      )
    case 'fast':
      return (
        <svg {...common}>
          <path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" />
        </svg>
      )
    case 'faster':
      return (
        <svg {...common}>
          <path d="M3 7l6 5-6 5zM11 7l6 5-6 5zM19 7v10" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      )
  }
}
