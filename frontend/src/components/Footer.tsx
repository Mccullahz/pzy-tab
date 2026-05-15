import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-theme-border bg-theme-nav/95">
      <nav className="relative mx-auto max-w-container px-gutter py-6 xl:px-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link
              to="https://www.github.com/Mccullahz"
              className="font-sans text-xs font-medium text-theme-muted transition-colors hover:text-theme-accent"
            >
              © 2026, PZY Coffee · Powered by ZyGuy
            </Link>
          </div>
        </div>
      </nav>
    </footer>
  )
}
