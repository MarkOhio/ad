/**
 * ad.js — DeMARK Personal Ad System
 * Version: 1
 * Host this file on GitHub Pages or any static host.
 * Embed on any site: <script src="https://your-host/ad.js?v=1"></script>
 *
 * Required divs on the host page:
 *   <div data-ad="banner"></div>
 *   <div data-ad="half"></div>      (optional)
 *   <div data-ad="fullscreen"></div> (optional)
 *
 * Add this pixel to every page of every destination site (one line in base layout):
 *   <script>fetch("https://your-vercel-app.vercel.app/api/confirm?cid=" + new URLSearchParams(location.search).get("cid")).catch(()=>{});</script>
 */

(function () {
  "use strict";

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  // Replace these two values before deploying.
  const ADS_JSON_URL   = "https://dnxsinundjcplzbddmtx.supabase.co/storage/v1/object/public/ad-assets/ads.json";
  const CLICK_API_URL  = "https://de-mark-9fcsiixzv-markohios-projects.vercel.app/api/click";
  // ───────────────────────────────────────────────────────────────────────────

  // Detect site_id from the current page's hostname
  const SITE_ID = location.hostname || "unknown";

  // Mobile breakpoint (matches plan: < 768px = mobile)
  const isMobile = () => window.innerWidth < 768;

  // Determine asset type from URL extension
  function assetType(url) {
    if (!url) return null;
    const ext = url.split("?")[0].split(".").pop().toLowerCase();
    if (["mp4", "webm", "ogg"].includes(ext)) return "video";
    return "image"; // covers webp, png, jpg, gif
  }

  // Build the ad media element (image or video)
  function buildMedia(url) {
    const type = assetType(url);
    if (!type) return null;

    if (type === "video") {
      const v = document.createElement("video");
      v.src         = url;
      v.autoplay    = true;
      v.muted       = true;
      v.loop        = true;
      v.playsInline = true;
      v.setAttribute("playsinline", ""); // iOS Safari requires the attribute too
      v.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      return v;
    }

    const img = document.createElement("img");
    img.src   = url;
    img.alt   = "";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    return img;
  }

  // POST click to API, then redirect
  // Uses the popup-blocker-safe pattern: open window before async call
  async function handleClick(ad) {
    try {
      // Open blank window immediately inside the user gesture (click handler)
      // so browsers don't treat it as a popup
      const win = window.open("", "_blank");

      try {
        const res = await fetch(CLICK_API_URL, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            ad_id:           ad.id,
            site_id:         SITE_ID,
            destination_url: ad.click_url,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          win.location.href = data.redirect_url || ad.click_url;
        } else {
          // API responded but with an error — fall back to direct URL
          win.location.href = ad.click_url;
        }
      } catch {
        // Network error — fall back to direct URL
        // win is already open, just redirect it
        win.location.href = ad.click_url;
      }
    } catch {
      // window.open itself failed (rare) — last resort direct navigation
      try { window.open(ad.click_url, "_blank"); } catch { /* silent */ }
    }
  }

  // Wrap a media element in a clickable container
  function buildClickable(ad, mediaEl) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "cursor:pointer;width:100%;height:100%;";
    wrapper.setAttribute("role", "link");
    wrapper.setAttribute("tabindex", "0");
    wrapper.appendChild(mediaEl);

    wrapper.addEventListener("click", () => handleClick(ad));
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") handleClick(ad);
    });

    return wrapper;
  }

  // Pick a random ad from the array
  function randomAd(ads) {
    if (!ads || ads.length === 0) return null;
    return ads[Math.floor(Math.random() * ads.length)];
  }

  // Render banner slot
  function renderBanner(container, ads) {
    const ad = randomAd(ads);
    if (!ad) return;

    const url = isMobile() ? ad.banner_mobile : ad.banner_desktop;
    if (!url) return; // slot not populated for this ad

    const media = buildMedia(url);
    if (!media) return;

    container.style.cssText = "width:100%;overflow:hidden;";
    container.appendChild(buildClickable(ad, media));
  }

  // Render half screen slot
  function renderHalf(container, ads) {
    const ad = randomAd(ads);
    if (!ad) return;

    const url = isMobile() ? ad.half_mobile : ad.half_desktop;
    if (!url) return;

    const media = buildMedia(url);
    if (!media) return;

    container.style.cssText = "width:100%;overflow:hidden;";
    container.appendChild(buildClickable(ad, media));
  }

  // Render fullscreen overlay
  // Only shown once per browser session (sessionStorage guard)
  function renderFullscreen(container, ads) {
    const SESSION_KEY = "demark_fs_shown";

    // Already shown this session — skip silently
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const ad = randomAd(ads);
    if (!ad) return;

    const url = isMobile() ? ad.fullscreen_mobile : ad.fullscreen_desktop;
    if (!url) return;

    const media = buildMedia(url);
    if (!media) return;

    // Mark as shown immediately so even if something errors below,
    // it won't retry on the same session
    sessionStorage.setItem(SESSION_KEY, "1");

    // Build overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:100%",
      "height:100%",
      "background:rgba(0,0,0,0.85)",
      "z-index:9999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
    ].join(";");

    // Ad content area (clickable)
    const adBox = document.createElement("div");
    adBox.style.cssText = "position:relative;max-width:90vw;max-height:90vh;overflow:hidden;";
    adBox.appendChild(buildClickable(ad, media));

    // Close button — always visible, no delay
    const closeBtn = document.createElement("button");
    closeBtn.textContent  = "✕";
    closeBtn.setAttribute("aria-label", "Close ad");
    closeBtn.style.cssText = [
      "position:absolute",
      "top:8px",
      "right:8px",
      "background:rgba(0,0,0,0.6)",
      "color:#fff",
      "border:none",
      "border-radius:50%",
      "width:32px",
      "height:32px",
      "font-size:16px",
      "cursor:pointer",
      "z-index:10000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "line-height:1",
    ].join(";");

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.remove();
    });

    adBox.appendChild(closeBtn);
    overlay.appendChild(adBox);

    // Close on overlay background click (outside the ad)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // 1.5 second delay before showing so page content loads first
    setTimeout(() => {
      document.body.appendChild(overlay);
    }, 1500);
  }

  // ─── MAIN ──────────────────────────────────────────────────────────────────

  async function init() {
    try {
      // Fetch ads.json with timestamp cache buster
      // generated_at from the JSON itself is used so the buster
      // only changes when ads actually change, not on every page load
      let ads = [];

      try {
        // First fetch without buster to read generated_at
        const res = await fetch(ADS_JSON_URL);
        if (!res.ok) return; // ads.json unreachable — show nothing

        const json = await res.json();
        ads = json.ads || [];

        // If we got a generated_at timestamp, re-fetch with it as buster
        // to ensure we bypass any CDN cache of a stale file
        if (json.generated_at && ads.length === 0) {
          // Empty ads — nothing to render
          return;
        }

        if (json.generated_at) {
          const busted = ADS_JSON_URL + "?t=" + encodeURIComponent(json.generated_at);
          try {
            const res2  = await fetch(busted);
            const json2 = await res2.json();
            ads = json2.ads || [];
          } catch {
            // Use the first fetch result as fallback
          }
        }
      } catch {
        return; // Network failure — show nothing, host page unaffected
      }

      if (!ads || ads.length === 0) return;

      // Find all ad slots on the page
      const bannerEl     = document.querySelector("[data-ad='banner']");
      const halfEl       = document.querySelector("[data-ad='half']");
      const fullscreenEl = document.querySelector("[data-ad='fullscreen']");

      // Render each slot independently — one failing doesn't affect others
      if (bannerEl) {
        try { renderBanner(bannerEl, ads); } catch { /* silent */ }
      }

      if (halfEl) {
        try { renderHalf(halfEl, ads); } catch { /* silent */ }
      }

      if (fullscreenEl) {
        try { renderFullscreen(fullscreenEl, ads); } catch { /* silent */ }
      }

    } catch {
      // Top-level catch — ad.js must never throw an uncaught error
    }
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
