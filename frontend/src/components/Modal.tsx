// reusable modal shell (backdrop + centered panel + title/close) built on
// Headless UI so focus trapping and escape-to-close come for free.

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

type ModalProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
};

export default function Modal({ open, onClose, title, children }: ModalProps) {
	return (
		<Dialog open={open} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="w-full max-w-lg rounded-design-lg border border-theme-border bg-theme-elevated p-6 shadow-2xl shadow-black/40">
					<div className="flex items-center justify-between gap-4">
						<DialogTitle className="font-serif text-2xl text-theme-foreground">{title}</DialogTitle>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="rounded-full p-1 text-theme-muted transition-colors hover:text-theme-foreground"
						>
							<CloseIcon className="h-6 w-6" />
						</button>
					</div>
					<div className="mt-5">{children}</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
}
