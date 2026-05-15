
export default function Options() {
  return (
    <section className="grid h-full grid-cols-2 gap-4">
      
    {/* start stop action */}
      <div className=" col-span-2 flex min-h-[120px] items-center justify-center rounded-design-lg border border-theme-border bg-theme-accent p-6 shadow-xl shadow-black/10 transition-all duration-comfortable ease-quiet hover:scale-[1.01]">

        <button className="w-full font-serif text-4xl font-bold uppercase tracking-wide text-theme-accent-foreground">
          Stop Roast
        </button>
      </div>

      {/* load profile */}
      <div className="flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-design-lg border border-theme-border bg-theme-nav p-4 shadow-xl shadow-black/10 transition-all duration-comfortable ease-quiet hover:-translate-y-1 hover:border-theme-accent"
      >
        <div className="text-3xl text-theme-foreground">
          ⌂
        </div>

        <span className="text-xs uppercase tracking-[0.2em] text-theme-muted">
          Load Profile
        </span>
      </div>

      {/* save profile */}
      <div className="flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-design-lg border border-theme-border bg-theme-nav p-4 shadow-xl shadow-black/10 transition-all duration-comfortable ease-quiet hover:-translate-y-1 hover:border-theme-accent">
        
      <div className="text-3xl text-theme-foreground">
          ◉
        </div>

        <span className=" text-xs uppercase tracking-[0.2em] text-theme-muted">
          Save Profile
        </span>
      </div>


      {/* active profile */}
      <div className="col-span-2 flex min-h-[110px] flex-col justify-center rounded-design-lg border border-theme-border bg-theme-surface-subtle p-5 shadow-xl shadow-black/10">
        
      <span className=" text-xs uppercase tracking-[0.2em] text-theme-muted">
          Active Profile
        </span>

        <h2 className="mt-1 font-serif text-2xl text-theme-foreground">
          Colombia Huila
        </h2>

	{/* horizontal line divider */}
      	<hr className="border-t border-theme-border" />

        <p className="mt-1 text-sm text-theme-muted"
        >
          AG 70-75 • 2.5KG Target
        </p>
      </div>
    </section>
  );
}
