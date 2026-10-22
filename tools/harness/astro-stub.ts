// Local test harness stand-in for astro:transitions/client
export async function navigate(href: string) {
  (window as any).__navigatedTo = href;
  console.log("[harness] navigate", href);
}
