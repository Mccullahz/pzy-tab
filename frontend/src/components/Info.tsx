// info component. contains "gauge cluster" of the app

export default function Info() {
  return (
	  <section className="h-full rounded-design-lg border border-theme-border bg-theme-surface-subtle p-6">

	<div className="flex h-full flex-col">
        <h1 className="text-sm uppercase tracking-[0.2em] text-theme-muted justify-center">
          Drum Temperature
        </h1>

        <div className="flex flex-1 items-center justify-center">
          {/* placeholder gauge */}
          <div className="flex h-52 w-52 items-center justify-center rounded-full border border-theme-border">

            <span className="font-serif text-6xl text-theme-foreground">
              PH°C
            </span>

          </div>
        </div>
      </div>
    </section>
  );
}
