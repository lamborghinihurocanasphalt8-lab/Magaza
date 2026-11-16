function clean(h) {
  return (h || "")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function handler(req, res) {
  const token = process.env.PRINTIFY_TOKEN;
  const h = { Authorization: `Bearer ${token}` };
  try {
    let shop = process.env.PRINTIFY_SHOP_ID;
    if (!shop) {
      const s = await (await fetch("https://api.printify.com/v1/shops.json", { headers: h })).json();
      shop = s[0] && s[0].id;
    }
    const r = await fetch(
      `https://api.printify.com/v1/shops/${shop}/products.json?limit=50`,
      { headers: h }
    );
    const d = await r.json();
    const items = (d.data || [])
      .filter((p) => p.visible)
      .map((p) => {
        const vs = p.variants.filter((v) => v.is_enabled);
        const def = vs.find((v) => v.is_default) || vs[0];
        const used = new Set();
        vs.forEach((v) => (v.options || []).forEach((o) => used.add(o)));
        const options = (p.options || [])
          .map((o) => ({
            name: o.name,
            values: o.values
              .filter((x) => used.has(x.id))
              .map((x) => ({ id: x.id, title: x.title, color: (x.colors && x.colors[0]) || "" })),
          }))
          .filter((o) => o.values.length);
        const seen = {};
        const images = [];
        (p.images || []).forEach((i) => {
          if (!seen[i.src]) {
            seen[i.src] = 1;
            images.push({ src: i.src, v: i.variant_ids || [] });
          }
        });
        const main = (p.images || []).find((i) => i.is_default) || (p.images || [])[0] || {};
        return {
          id: p.id,
          title: p.title,
          desc: clean(p.description),
          image: main.src || "",
          d: def ? def.id : 0,
          options,
          images,
          variants: vs.map((v) => ({
            id: v.id,
            title: v.title,
            price: v.price / 100,
            o: v.options || [],
          })),
        };
      });
    res.setHeader("Cache-Control", "s-maxage=300");
    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: "Printify'dan ürünler alınamadı" });
  }
}
