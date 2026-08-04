// inline SVG icon set. kept local (rather than a CDN icon font) so the kiosk
// works fully offline and the icons inherit currentColor from their container.

type IconProps = { className?: string };

const base = {
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.8,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
};

export function PauseIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base} fill="currentColor" stroke="none">
			<rect x="6" y="5" width="4" height="14" rx="1" />
			<rect x="14" y="5" width="4" height="14" rx="1" />
		</svg>
	);
}

export function PlayIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base} fill="currentColor" stroke="none">
			<path d="M7 4.5v15l13-7.5-13-7.5z" />
		</svg>
	);
}

export function FolderIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
		</svg>
	);
}

export function BookmarkIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />
		</svg>
	);
}

export function InfoIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 11v5" />
			<path d="M12 7.5h.01" />
		</svg>
	);
}

export function CloseIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	);
}

export function TrashIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
		</svg>
	);
}

export function PlusIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M12 5v14M5 12h14" />
		</svg>
	);
}

export function ExpandIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
		</svg>
	);
}

export function CollapseIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
		</svg>
	);
}

export function CheckIcon({ className }: IconProps) {
	return (
		<svg className={className} {...base}>
			<path d="M5 13l4 4L19 7" />
		</svg>
	);
}
