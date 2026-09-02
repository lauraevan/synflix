import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import Title from "@/pages/Title";
import Watch from "@/pages/Watch";
import Search from "@/pages/Search";
import MyList from "@/pages/MyList";

function Shell() {
    const location = useLocation();
    const hideNav = false; // navbar shown everywhere; watch page has its own top offset
    return (
        <>
            {!hideNav && <Navbar />}
            <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/browse/:mediaType" element={<Browse />} />
                <Route path="/title/:mediaType/:id" element={<Title />} />
                <Route path="/watch/:mediaType/:id" element={<Watch />} />
                <Route path="/search" element={<Search />} />
                <Route path="/my-list" element={<MyList />} />
            </Routes>
            <footer className="border-t border-white/5 px-4 md:px-12 py-8 text-xs text-zinc-600">
                <p className="font-display text-2xl text-crimson mb-1">SYNFLIX</p>
                <p>Powered by the Synapse Player engine · Metadata by TMDB · Primary source VidUp.</p>
                <p className="mt-1">For educational/research use. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
            </footer>
        </>
    );
}

function App() {
    return (
        <div className="App min-h-screen bg-obsidian text-foreground">
            <BrowserRouter>
                <Shell />
            </BrowserRouter>
            <Toaster position="top-center" theme="dark" />
        </div>
    );
}

export default App;
