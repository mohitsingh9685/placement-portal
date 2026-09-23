// Reserve the tab during the click; waiting for a signed URL first can trigger popup blocking.
export async function openDocument(loadUrl) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Allow pop-ups for this site to open the document.");
  tab.opener = null;
  try {
    const url = new URL(await loadUrl());
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("The document link is unavailable.");
    if (!tab.closed) tab.location.replace(url.href);
  } catch (error) {
    tab.close();
    throw error;
  }
}
