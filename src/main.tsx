import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AjoProvider, useAjo } from "./app";
import GroupPage from "./GroupPage";
import Home from "./Home";
import NewGroup from "./NewGroup";

// Routes live after the # so the site works on GitHub Pages
type Route = { page: "home" } | { page: "new" } | { page: "group"; id: string };

function readRoute(): Route {
  const [first, second] = location.hash.replace(/^#\/?/, "").split("/");
  if (first === "new") return { page: "new" };
  if (first === "group" && second) return { page: "group", id: second };
  return { page: "home" };
}

function Shell() {
  const a = useAjo();
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (!a.ready) return <div className="loading">Opening Ajo…</div>;
  return (
    <>
      {a.error && (
        <div className="error" role="alert">
          {a.error}
          <button className="text-button" onClick={a.clearError}>
            OK
          </button>
        </div>
      )}
      <main className="main">
        {route.page === "home" && <Home />}
        {route.page === "new" && <NewGroup />}
        {route.page === "group" && <GroupPage key={route.id} id={route.id} />}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AjoProvider>
      <Shell />
    </AjoProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
