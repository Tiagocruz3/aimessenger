export default async function handler(req, res) {
  const { target } = req.query;

  if (!target) {
    res.status(400).json({ error: 'Missing target parameter' });
    return;
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(target);
  } catch (error) {
    res.status(400).json({ error: 'Invalid target parameter encoding' });
    return;
  }

  if (!/^https?:\/\//i.test(decodedUrl)) {
    res.status(400).json({ error: 'Target must be an absolute http(s) URL' });
    return;
  }

  try {
    const upstream = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AI Messenger Search Proxy/1.0',
      },
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await upstream.text();
      res.status(502).json({ error: 'Upstream returned non-JSON response', snippet: text.slice(0, 200) });
      return;
    }

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Search proxy request failed' });
  }
}

