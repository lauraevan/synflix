import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, X, Clapperboard } from "lucide-react";

export const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const submit = (e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    };

    const links = [
        { to: "/", label: "Home" },
        { to: "/browse/movie", label: "Movies" },
        { to: "/browse/tv", label: "TV Shows" },
        { to: "/my-list", label: "My List" },
    ];
    const isActive = (to) =>
        to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

    return (
        <header
            data-testid="navbar"
            className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
                scrolled
                    ? "bg-obsidian/90 backdrop-blur-xl border-b border-white/5"
                    : "bg-gradient-to-b from-obsidian/90 to-transparent"
            }`}
        >
            <div className="flex items-center gap-4 md:gap-8 px-4 md:px-12 h-16">
                <Link to="/" data-testid="navbar-brand-synflix" className="flex items-center gap-2 group">
                    <Clapperboard className="w-7 h-7 text-crimson group-hover:rotate-12 transition-transform" />
                    <span className="font-display text-3xl text-crimson text-glow leading-none">
                        SYNFLIX
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-6 text-sm">
                    {links.map((l) => (
                        <Link
                            key={l.to}
                            to={l.to}
                            data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                            className={`transition-colors hover:text-white ${
                                isActive(l.to) ? "text-white font-semibold" : "text-zinc-400"
                            }`}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-3">
                    <form onSubmit={submit} className="flex items-center">
                        <div
                            className={`flex items-center overflow-hidden transition-all duration-300 rounded-full ${
                                open ? "w-44 md:w-64 bg-black/60 border border-white/15 px-3" : "w-9"
                            }`}
                        >
                            <button
                                type="button"
                                data-testid="navbar-search-toggle"
                                onClick={() => setOpen((v) => !v)}
                                className="text-zinc-200 hover:text-crimson transition-colors p-1.5"
                                aria-label="Search"
                            >
                                {open ? <X className="w-4 h-4" /> : <Search className="w-5 h-5" />}
                            </button>
                            {open && (
                                <input
                                    autoFocus
                                    data-testid="navbar-search-input"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search films, shows…"
                                    className="bg-transparent outline-none text-sm py-2 w-full text-white placeholder:text-zinc-500"
                                />
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </header>
    );
};
