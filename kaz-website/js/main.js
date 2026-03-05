// Highlights the current page button in the navbar
(function setActiveNav() {
  const path = location.pathname.replace(/\/+$/, "/"); // normalize
  document.querySelectorAll(".nav a").forEach(a => {
    const href = new URL(a.getAttribute("href"), location.origin).pathname.replace(/\/+$/, "/");
    if (href === path) a.classList.add("active");
  });
})();

// Optional: small click feedback (works on mobile)
document.addEventListener("click", (e) => {
  const el = e.target.closest("a,button");
  if (!el) return;
  el.style.transform = "scale(0.99)";
  setTimeout(() => (el.style.transform = ""), 120);
});