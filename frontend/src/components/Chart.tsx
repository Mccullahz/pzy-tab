// Chart component. Using chart.js to render a line graph of the temperature data.


export default function Chart() {
	return (
		<section className="h-full rounded-design-lg border border-theme-border bg-theme-surface-subtle p-6">
			<div className="flex h-full flex-col">
				<h1 className="text-sm uppercase tracking-[0.2em] text-theme-muted justify-center">
					Temperature Graph
				</h1>

				<div className="flex flex-1 items-center justify-center">
					{/* placeholder graph */}
					<div className="flex h-52 w-full items-center justify-center rounded border border-theme-border">
						<span className="font-serif text-6xl text-theme-foreground">
							Graph
						</span>
					</div>
				</div>
			</div>
		</section>


	);
}
