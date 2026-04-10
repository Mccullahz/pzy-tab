export type WidgetCardProps = {
  title: string;
  content: string;
  href: string;
};

export function WidgetCard({ title, content, href }: WidgetCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="block w-full bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all duration-150 rounded-3xl shadow-xl shadow-indigo-950 p-10 min-h-[220px] flex flex-col justify-center items-center text-center select-none"
    >
      <h2 className="text-3xl font-bold mb-3">{title}</h2>
      <p className="text-lg text-slate-400">{content}</p>
    </button>
  );
}
