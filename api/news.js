export default async function handler(req, res) {
  const key = process.env.CRYPTOPANIC_KEY;
  if (!key) {
    res.status(500).json({ error: 'API key not configured' });
    return;
  }
  try {
    const response = await fetch(
      `https://cryptopanic.com/api/free/v1/posts/?auth_token=${key}&currencies=BTC&kind=news`
    );
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
