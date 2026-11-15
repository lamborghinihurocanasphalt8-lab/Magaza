export default async function handler(req, res) {
  const token = process.env.PRINTIFY_TOKEN;
  const shop = process.env.PRINTIFY_SHOP_ID;
  try {
    const r = await fetch(
      `https://api.printify.com/v1/shops/${shop}/products.json?limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d = await r.json();
    const items = (d.data || [])
      .filter((p) => p.visible)
      .map((p) => {
        const vs = p.variants.filter((v) => v.is_enabled);
        const def = vs.find((v) => v.is_default) || vs[0];
        const img = p.images.find((i) => i.is_default) || p.images[0] || {};
        return {
          id: p.id,
          title: p.title,
          desc: (p.description || "").replace(/<[^>]+>/g, "").slice(0, 90),
          price: def ? def.price / 100 : 0,
          image: img.src || "",
          variants: vs.map((v) => ({ id: v.id, title: v.title, price: v.price / 100 })),
        };
      });
    res.setHeader("Cache-Control", "s-maxage=300");
    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: "Printify'dan ürünler alınamadı" });
  }
}
