// api/airbnb-price.js
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const cache = new Map();

function getListingUrl(listing){
  const map={
    okanhomes2:'https://www.airbnb.com/h/okanhomes2',
    okanhomes3:'https://www.airbnb.com/h/okanhomes3',
  };
  return map[listing]||null;
}

function extractPrices(html){
  const text = html.replace(/\s+/g,' ');
  const priceRegex = /(?:TRY|TL|₺|EUR|€|USD|\$)\s?[\d., ]+/gi;
  const weekendHints = /(hafta sonu|weekend|fri|sat|cuma|cumartesi)/i;
  const prices = text.match(priceRegex) || [];
  function parsePrice(p){
    let currency='TRY';
    if(/EUR|€/.test(p)) currency='EUR';
    else if(/USD|\$/.test(p)) currency='USD';
    else if(/TRY|TL|₺/.test(p)) currency='TRY';
    let num=p.replace(/(TRY|TL|₺|EUR|€|USD|\$)/g,'').trim();
    num=num.replace(/ /g,' ').replace(/\s+/g,'');
    if(/,/.test(num)&&/\./.test(num)){num=num.replace(/\./g,'');num=num.replace(',','.');}
    else if(/,/.test(num)&&!/\./.test(num)){num=num.replace(/,/g,'');}
    else {num=num.replace(/,/g,'');}
    const amount=parseFloat(num);
    if(isNaN(amount)) return null;
    return {currency,amount};
  }
  function findContextualPrice(ctxRegex){
    const m = text.match(new RegExp(`(.{0,120})${ctxRegex.source}(.{0,120})`,'i'));
    if(!m) return null;
    const ctx=m[0];
    const candidates = ctx.match(priceRegex)||[];
    for(const p of candidates){const parsed=parsePrice(p); if(parsed && parsed.amount>0) return parsed;}
    return null;
  }
  const perNightRegex=/(gece(lik)?|per night|nightly|gece başı)/i;
  const baseFromContext = findContextualPrice(perNightRegex);
  const weekendContext = text.match(new RegExp(`(.{0,160})${weekendHints.source}(.{0,160})`,'i'));
  let weekendParsed=null;
  if(weekendContext){
    const candidates = weekendContext[0].match(priceRegex)||[];
    for(const p of candidates){const parsed=parsePrice(p); if(parsed && parsed.amount>0){weekendParsed=parsed; break;}}
  }
  let baseParsed=baseFromContext;
  if(!baseParsed && prices.length){
    for(const p of prices.slice(0,10)){const parsed=parsePrice(p); if(parsed && parsed.amount>0){baseParsed=parsed; break;}}
  }
  if(weekendParsed && baseParsed){ if(Math.abs(weekendParsed.amount-baseParsed.amount)<1e-6){ weekendParsed=null; }}
  return { currency:(baseParsed&&baseParsed.currency)||(weekendParsed&&weekendParsed.currency)||'TRY', basePrice: baseParsed?baseParsed.amount:null, weekendPrice: weekendParsed?weekendParsed.amount:null };
}

export default async function handler(req,res){
  try{
    const { listing } = req.query||{};
    if(!listing || !['okanhomes2','okanhomes3'].includes(listing)){
      return res.status(400).json({error:'Invalid listing. Use listing=okanhomes2|okanhomes3'});
    }
    const url = getListingUrl(listing);
    if(!url) return res.status(400).json({error:'Listing URL not found'});

    const now=Date.now();
    const cached=cache.get(listing);
    if(cached && now-cached.timestamp < CACHE_TTL_MS){
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=43200');
      return res.status(200).json(cached.data);
    }

    const resp = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0 (compatible; PriceFetcher/1.0)', 'Accept-Language':'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7' } });
    if(!resp.ok){ return res.status(502).json({ error:'Failed to fetch Airbnb page', status: resp.status }); }
    const html = await resp.text();
    const { currency, basePrice, weekendPrice } = extractPrices(html);
    const data = { listing, currency, basePrice, weekendPrice, lastUpdated: new Date().toISOString(), source:'airbnb' };
    if(!basePrice){ return res.status(200).json({ listing, currency, basePrice:null, weekendPrice:null, note:'Price not detected. Airbnb layout may have changed.' }); }
    cache.set(listing,{ timestamp: now, data });
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=43200');
    return res.status(200).json(data);
  }catch(err){ return res.status(500).json({ error:'Server error', detail:String(err) }); }
}
