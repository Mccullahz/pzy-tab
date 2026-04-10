import { WidgetCard } from "../components";

type Widget = {
  title: string;
  content: string;
  href: string;
};

const widgets: Widget[] = [
  { title: "Dashboard", content: "Roaster Control.", href: "/dash" },
  { title: "Profiles", content: "Load / Tweak Profiles.", href: "/profile" },
  { title: "Settings", content: "Cog Wheel.", href: "/settings" },
];

export function HomePage() {
  return (
    <main className="max-w-full mx-auto p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {widgets.map((widget) => (
          <WidgetCard
            key={widget.title}
            title={widget.title}
            content={widget.content}
            href={widget.href}
          />
        ))}
      </div>
    </main>
  );
}
