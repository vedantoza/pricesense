# PriceSense — SvelteKit Regression Portal

A working SvelteKit + TypeScript frontend based on the supplied 100-SKU fashion supply-chain dataset.

## What it does

- Selects the catalog or a product category.
- Accepts a future list price, planned discount, and manufacturing cost.
- Predicts units sold using a simple linear regression equation.
- Calculates predicted revenue, contribution profit, and contribution margin.
- Displays model R² and a confidence warning.
- Draws an interactive price-to-demand curve without any chart library.
- Saves and compares scenarios in browser local storage.
- Includes a GitHub Pages deployment workflow.

## Regression equations

- Entire Catalog: `Units = 479.4808 - 0.1295 × Price`
- Haircare: `Units = 421.3495 + 0.8487 × Price`
- Skincare: `Units = 288.8711 + 3.8257 × Price`
- Cosmetics: `Units = 853.1840 - 7.8952 × Price`

## Run locally

```bash
npm install
npm run dev
```

Open the local URL displayed in Terminal, normally `http://localhost:5173`.

## Production check

```bash
npm run check
npm run build
npm run preview
```

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload this project to the repository root.
3. Open **Settings → Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push to the `main` branch.

The included workflow builds and publishes the static SvelteKit application.

## Modelling caution

The current dataset contains one observation per SKU. This model therefore shows price–sales association across products, not a causal demand response for the same SKU over time. Use the results as scenario planning evidence and validate pricing decisions through controlled tests.
