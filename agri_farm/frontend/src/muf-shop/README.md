# MU Farms public shop module

This folder contains the isolated public marketplace UI. Keep `MufShop.tsx`, `muf-shop.css` and this README byte-identical across all three frontends.

The shop route is `/shop`. Each frontend entry point lazy-loads the shop separately from the existing farm-management application.

## Public data sources

The shop reads only `GET /api/products/public`, sends no cookies or auth token, and explicitly maps the response to public product fields. It does not call admin routes or write endpoints.

Configure the public API roots in each frontend's build environment:

```dotenv
VITE_MUF_SHOP_DAIRY_API=https://your-dairy-host.example/api
VITE_MUF_SHOP_AGRI_API=https://your-agri-host.example/api
VITE_MUF_SHOP_FLOCK_API=https://your-flock-host.example/api
VITE_MUF_SHOP_WHATSAPP_NUMBER=923001234567
```

Replace the example hosts and number with real values. These are placeholders, not working production addresses. A variable may also point directly to `/products/public`. If a source variable is unset, the current app uses its local `/api` feed and the other sections display a setup message until configured.

`VITE_*` values are shipped to browsers, so use only public URLs and the shop contact, never secrets. For cross-origin feeds, include all shop frontend origins in each backend's `FRONTEND_URL` CORS allowlist or browser CORS checks will block the reads.

If the WhatsApp number is set, orders open that number with product, farm, type, listed price and availability prefilled. Otherwise, WhatsApp opens the recipient picker with the same message. The buyer confirms final price, availability and delivery/pickup details directly with the seller.

No customer accounts, online payments, private APIs or admin controls belong in this folder. Run `npm run check-shop` and `npm run check-sync` after edits.