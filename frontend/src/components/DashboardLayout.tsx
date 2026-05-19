type DashboardLayoutProps = {
	header: React.ReactNode;
	info: React.ReactNode;
	options: React.ReactNode;
	chart: React.ReactNode;
};

export default function DashboardLayout({
	header,
	info,
	options,
	chart,
}: DashboardLayoutProps) {
	return (
		<main
			className="min-h-screen bg-theme-background text-theme-foreground"
		>
			{/* outer shell */}
			<div
				className="mx-auto flex max-w-[1600px] flex-col gap-4"
			>
				{/* header */}
				<header>{header}</header>

				{/* top dashboard row */}
				<section
					className="grid grid-cols-12 gap-4 mb-4"
				>
					{/* left info */}
					<div className="col-span-5">
						{info}
					</div>

					{/* right options */}
					<div className="col-span-7">
						{options}
					</div>
				</section>

				{/* lower graph section */}
				<section>{chart}</section>
			</div>
		</main>
	);
}
