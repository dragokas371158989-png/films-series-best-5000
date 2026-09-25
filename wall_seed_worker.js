/* Parse the poster wall seed away from the UI thread. The worker is started only
   when a visitor opens the wall and is terminated after this request. */
self.onmessage = async ({data}) => {
  const {url, kind} = data || {};
  const types = {movies: 0, series: 1, anime: 2, cartoons: 3};
  try {
    const response = await fetch(url, {cache: "force-cache"});
    if (!response.ok) throw new Error(`Wall seed: ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid wall seed");
    const type = types[kind];
    const selected = kind === "all" ? rows : rows.filter(row =>
      Array.isArray(row) ? Number(row[4]) === type : true
    );
    self.postMessage({ok: true, rows: selected});
  } catch (error) {
    self.postMessage({ok: false, error: String(error)});
  }
};
