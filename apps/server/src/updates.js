const REPO = process.env.GITHUB_RELEASES_REPO || "Lysacae/CodeFlow";

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function pickSetupAsset(assets = []) {
  const exe = assets.find((a) => /setup.*\.exe$/i.test(a.name) || /_x64-setup\.exe$/i.test(a.name));
  if (exe) return exe;
  return assets.find((a) => /\.exe$/i.test(a.name)) || assets[0] || null;
}

export async function getLatestFromGitHub() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "codeflow-server/1.0",
    },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub releases: ${res.status} ${text.slice(0, 200)}`);
  }

  const release = await res.json();
  const version = String(release.tag_name || "").replace(/^v/, "");
  const asset = pickSetupAsset(release.assets || []);
  if (!version || !asset) return null;

  return {
    version,
    notes: release.body || "",
    downloadUrl: asset.browser_download_url,
    filename: asset.name,
    createdAt: release.published_at || release.created_at,
  };
}

export { compareSemver, REPO };
