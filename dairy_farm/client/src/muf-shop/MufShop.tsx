import { useEffect, useMemo, useState } from 'react';
import './muf-shop.css';

type FarmKey = 'dairy' | 'agri' | 'flock';
type FeedStatus = 'loading' | 'ready' | 'error' | 'unconfigured';
type Product = { id:string; farmName:string; name:string; kind:string; unit:string; price:number; quantity:number; photoUrl:string };
type Feed = { status:FeedStatus; products:Product[]; message?:string };
type Category = { id:string; source:FarmKey; title:string; subtitle:string; symbol:string; kinds:string[] };

const SHOP_ENV = import.meta.env as unknown as Record<string,string|undefined>;
const API_ENV_KEYS:Record<FarmKey,string> = {
  dairy:'VITE_MUF_SHOP_DAIRY_API',
  agri:'VITE_MUF_SHOP_AGRI_API',
  flock:'VITE_MUF_SHOP_FLOCK_API',
};
const SOURCES:FarmKey[] = ['agri','dairy','flock'];
const CATEGORIES:Category[] = [
  {id:'crops',source:'agri',title:'Crops',subtitle:'Fresh from the fields',symbol:'🌾',kinds:['produce']},
  {id:'dairy',source:'dairy',title:'Dairy',subtitle:'Milk and farm animals',symbol:'🥛',kinds:['milk','animal']},
  {id:'poultry',source:'flock',title:'Poultry',subtitle:'Eggs and birds',symbol:'🐓',kinds:['egg','bird']},
];
const money = new Intl.NumberFormat('en-PK',{maximumFractionDigits:2});
const initialFeeds = ():Record<FarmKey,Feed> => ({
  dairy:{status:'loading',products:[]}, agri:{status:'loading',products:[]}, flock:{status:'loading',products:[]},
});

function publicEndpoint(source:FarmKey,currentFarm:FarmKey):string {
  const configured=String(SHOP_ENV[API_ENV_KEYS[source]]||'').trim();
  const base=(configured||(source===currentFarm?'/api':'')).replace(/\/+$/,'');
  if(!base)return '';
  if(/\/products\/public$/i.test(base))return base;
  if(/\/api$/i.test(base))return base+'/products/public';
  return base+'/api/products/public';
}

function normalizeProduct(value:unknown):Product|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const id=String(row.id??'').trim();
  const name=String(row.name??'').trim();
  const farmName=String(row.farmName??'MU Farms').trim()||'MU Farms';
  const kind=String(row.kind??'').trim().toLowerCase();
  const unit=String(row.unit??'').trim();
  const price=Number(row.price), quantity=Number(row.quantity);
  if(!id||!name||!kind||!unit||!Number.isFinite(price)||price<0||!Number.isFinite(quantity)||quantity<0)return null;
  let photoUrl='';
  try { const url=new URL(String(row.photoUrl??'')); if(url.protocol==='https:')photoUrl=url.href; } catch { /* Use the category illustration. */ }
  return {id,farmName,name,kind,unit,price,quantity,photoUrl};
}

function orderUrl(product:Product,phone:string):string {
  const message=[
    'Assalam-o-alaikum, I would like to order a product from MU Farms.',
    '',
    'Product: '+product.name,
    'Farm: '+product.farmName,
    'Type: '+product.kind,
    'Listed price: Rs '+money.format(product.price)+' / '+product.unit,
    'Listed availability: '+money.format(product.quantity)+' '+product.unit,
    '',
    'Please confirm the final price, availability and delivery/pickup details.',
  ].join('\n');
  return (phone?'https://wa.me/'+phone:'https://wa.me/')+'?text='+encodeURIComponent(message);
}

export default function MufShop({currentFarm}:{currentFarm:FarmKey}) {
  const [feeds,setFeeds]=useState<Record<FarmKey,Feed>>(initialFeeds);
  const [search,setSearch]=useState('');
  const phone=String(SHOP_ENV.VITE_MUF_SHOP_WHATSAPP_NUMBER||'').replace(/\D/g,'');

  useEffect(()=>{
    const controller=new AbortController();
    setFeeds(initialFeeds());
    const tasks=SOURCES.map(async source=>{
      const url=publicEndpoint(source,currentFarm);
      if(!url){
        setFeeds(previous=>({...previous,[source]:{status:'unconfigured',products:[],message:'Set '+API_ENV_KEYS[source]+' in the frontend build environment to connect this feed.'}}));
        return;
      }
      setFeeds(previous=>({...previous,[source]:{status:'loading',products:[]}}));
      try {
        const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('The public feed returned HTTP '+response.status+'.');
        const payload=await response.json() as {products?:unknown}|null;
        if(!payload||!Array.isArray(payload.products))throw new Error('The public feed returned an unexpected response.');
        const products=payload.products.map(normalizeProduct).filter((item):item is Product=>item!==null);
        if(!controller.signal.aborted)setFeeds(previous=>({...previous,[source]:{status:'ready',products}}));
      } catch(error) {
        if(controller.signal.aborted)return;
        setFeeds(previous=>({...previous,[source]:{status:'error',products:[],message:error instanceof Error?error.message:'Could not load this public feed.'}}));
      }
    });
    void Promise.all(tasks);
    return ()=>controller.abort();
  },[currentFarm]);

  const categories=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return CATEGORIES.map(category=>{
      const feed=feeds[category.source];
      const products=feed.products.filter(product=>category.kinds.includes(product.kind)).filter(product=>
        !q||product.name.toLocaleLowerCase().includes(q)||product.farmName.toLocaleLowerCase().includes(q)||product.kind.toLocaleLowerCase().includes(q));
      return {...category,feed,products};
    });
  },[feeds,search]);
  const unconfigured=SOURCES.filter(source=>feeds[source].status==='unconfigured');

  return <main className="muf-shop">
    <header className="muf-shop-topline">
      <div className="muf-shop-container muf-shop-nav">
        <a className="muf-shop-brand" href="/shop" aria-label="MU Farms Shop home">
          <span className="muf-shop-brand-mark" aria-hidden="true">M<span>U</span></span>
          <span className="muf-shop-brand-copy"><strong>MU Farms</strong><small>PUBLIC MARKETPLACE</small></span>
        </a>
        <nav className="muf-shop-nav-links" aria-label="Shop categories"><a href="#crops">Crops</a><a href="#dairy">Dairy</a><a href="#poultry">Poultry</a></nav>
        <a className="muf-shop-farm-link" href="/" rel="nofollow">Farm management ↗</a>
      </div>
    </header>
    <div className="muf-shop-container">
      <section className="muf-shop-hero" aria-labelledby="muf-shop-title">
        <div className="muf-shop-hero-copy">
          <span className="muf-shop-eyebrow"><span/> FIELD TO HOME</span>
          <h1 id="muf-shop-title">Good things grow <em>at the farm.</em></h1>
          <p>Browse published crops, dairy products and poultry listings from MU Farms. Contact the seller on WhatsApp to confirm your order.</p>
          <a className="muf-shop-primary-link" href="#shop-catalogue">Explore products <span aria-hidden="true">↓</span></a>
        </div>
        <div className="muf-shop-hero-art" aria-hidden="true">
          <div className="muf-shop-art-sun"/><span className="muf-shop-art-crop">🌾</span><span className="muf-shop-art-milk">🥛</span><span className="muf-shop-art-egg">🥚</span>
          <div className="muf-shop-art-caption"><strong>Grown with care</strong><span>From our farms to your table</span></div>
        </div>
        <div className="muf-shop-hero-foot"><span><i className="muf-shop-dot"/> Published listings only</span><span>No online payments · No customer account</span></div>
      </section>

      {unconfigured.length>0&&<aside className="muf-shop-setup-note" role="status">
        <strong>Marketplace feeds need connecting.</strong>
        <span>This shop can show its local farm feed now. To combine all projects, set the three <code>VITE_MUF_SHOP_*_API</code> build variables to each service's API root and include the shop origins in each backend's <code>FRONTEND_URL</code> CORS allowlist.</span>
      </aside>}

      <section className="muf-shop-catalogue" id="shop-catalogue" aria-label="Product catalogue">
        <div className="muf-shop-catalogue-heading">
          <div><span className="muf-shop-eyebrow">THE MARKETPLACE</span><h2>Find something good.</h2><p>Prices and availability can change. Confirm details with the seller before travelling or paying.</p></div>
          <label className="muf-shop-search"><span className="muf-shop-search-icon" aria-hidden="true">⌕</span>
            <input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search products or farms" aria-label="Search products or farms"/>
            {search&&<button type="button" onClick={()=>setSearch('')} aria-label="Clear search">×</button>}
          </label>
        </div>
        <div className="muf-shop-category-list">
          {categories.map(category=><section className="muf-shop-category" id={category.id} key={category.id} aria-labelledby={'muf-shop-'+category.id+'-title'}>
            <div className="muf-shop-category-heading">
              <div className="muf-shop-category-mark" aria-hidden="true">{category.symbol}</div>
              <div className="muf-shop-category-title"><span>{category.subtitle}</span><h3 id={'muf-shop-'+category.id+'-title'}>{category.title}</h3></div>
              <span className="muf-shop-count">{category.products.length} {category.products.length===1?'item':'items'}</span>
            </div>
            {category.feed.status==='error'&&<div className="muf-shop-feed-message muf-shop-feed-error" role="status"><strong>Could not connect to this feed.</strong><span>{category.feed.message}</span></div>}
            {category.feed.status==='unconfigured'&&<div className="muf-shop-feed-message" role="status"><strong>This section is not connected yet.</strong><span>{category.feed.message}</span></div>}
            {category.feed.status==='loading'&&<div className="muf-shop-empty" role="status">Loading published listings…</div>}
            {category.feed.status==='ready'&&category.products.length===0&&<div className="muf-shop-empty">{search?'No matching items. Try another search.':'No published items available right now.'}</div>}
            {category.products.length>0&&<div className="muf-shop-product-grid">
              {category.products.map(product=><article className="muf-shop-product-card" key={category.source+':'+product.id}>
                <div className="muf-shop-product-visual">
                  {product.photoUrl?<img src={product.photoUrl} alt={product.name} loading="lazy" referrerPolicy="no-referrer"/>:<span aria-hidden="true">{category.symbol}</span>}
                  <span className="muf-shop-product-type">{product.kind==='produce'?'Farm produce':product.kind==='milk'?'Dairy':product.kind==='animal'?'Animal':product.kind==='egg'?'Eggs':'Poultry'}</span>
                </div>
                <div className="muf-shop-product-info"><div className="muf-shop-product-origin">{product.farmName}</div><h4>{product.name}</h4>
                  <div className="muf-shop-product-price">Rs {money.format(product.price)} <span>/ {product.unit}</span></div>
                  <div className={'muf-shop-stock'+(product.quantity<=0?' is-out':'')}><span className="muf-shop-stock-dot"/>{product.quantity<=0?'Currently unavailable':'Listed: '+money.format(product.quantity)+' '+product.unit}</div>
                  <a className="muf-shop-order" href={orderUrl(product,phone)} target="_blank" rel="noopener noreferrer" aria-label={'Order '+product.name+' on WhatsApp'} aria-disabled={product.quantity<=0} onClick={event=>{if(product.quantity<=0)event.preventDefault();}}><span aria-hidden="true">◉</span> Order on WhatsApp</a>
                </div>
              </article>)}
            </div>}
          </section>)}
        </div>
      </section>
      <footer className="muf-shop-footer"><a className="muf-shop-footer-brand" href="/shop">MU Farms</a><span>Respect the farmer. Confirm details directly with the seller.</span><span>© {new Date().getFullYear()} MU Farms</span></footer>
    </div>
  </main>;
}
