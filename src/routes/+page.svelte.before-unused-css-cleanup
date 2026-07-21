<script lang="ts">
    
  import StandardErrorComparison from '$lib/StandardErrorComparison.svelte';import LeastSquaresRegressionLab from '$lib/LeastSquaresRegressionLab.svelte';
  import DiscountOptimization from '$lib/DiscountOptimization.svelte';
  import LinearRegressionLab from '$lib/LinearRegressionLab.svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';
  import {
    confidenceLabel,
    models,
    predictUnits,
    productTypes,
    type ProductType
  } from '$lib/models';

  type Scenario = {
    id: number;
    name: string;
    productType: ProductType;
    listPrice: number;
    discount: number;
    unitCost: number;
  };

  let productType: ProductType = 'cosmetics';
  let listPrice = 0;
  let discount = 0;
  let unitCost = 0;
  let activeSection: 'forecast' | 'scenarios' = 'forecast';
  let selectedAnalysisModel = '';
  let scenarios: Scenario[] = [];
  let nextId = 1;

  $: selectedModel = models[productType];
  $: futurePrice = Math.max(0, listPrice * (1 - discount / 100));
  $: predictedUnits = predictUnits(productType, futurePrice);
  $: predictedRevenue = predictedUnits * futurePrice;
  $: predictedProfit = predictedUnits * (futurePrice - unitCost);
  $: contributionMargin = predictedRevenue === 0 ? 0 : predictedProfit / predictedRevenue;
  $: currentUnits = predictUnits(productType, listPrice);
  $: currentProfit = currentUnits * (listPrice - unitCost);
  $: profitDelta = predictedProfit - currentProfit;
  $: confidence = confidenceLabel(selectedModel.r2);
  $: pricePoints = Array.from({ length: 11 }, (_, index) => index * 10);
  $: unitPoints = pricePoints.map((price) => predictUnits(productType, price));
  $: maxUnits = Math.max(...unitPoints, 1);
  $: chartPoints = unitPoints
    .map((units, index) => {
      const x = 36 + (index / (unitPoints.length - 1)) * 520;
      const y = 210 - (units / maxUnits) * 170;
      return `${x},${y}`;
    })
    .join(' ');
  $: markerX = 36 + (Math.min(futurePrice, 100) / 100) * 520;
  $: markerY = 210 - (Math.min(predictedUnits, maxUnits) / maxUnits) * 170;

  onMount(() => {
    const stored = localStorage.getItem('dataco-pricing-scenarios-v2');
    if (stored) {
      try {
        scenarios = JSON.parse(stored) as Scenario[];
        nextId = Math.max(0, ...scenarios.map((scenario) => scenario.id)) + 1;
      } catch {
        localStorage.removeItem('dataco-pricing-scenarios-v2');
      }
    }
  });

  function money(value: number): string {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0
    }).format(value);
  }

  function number(value: number): string {
    return new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(value);
  }

  function saveScenarios(): void {
    if (browser) localStorage.setItem('dataco-pricing-scenarios-v2', JSON.stringify(scenarios));
  }

  function addScenario(): void {
    const scenario: Scenario = {
      id: nextId++,
      name: `${productType} ${discount}% discount`,
      productType,
      listPrice,
      discount,
      unitCost
    };
    scenarios = [scenario, ...scenarios];
    saveScenarios();
    activeSection = 'scenarios';
  }

  function removeScenario(id: number): void {
    scenarios = scenarios.filter((scenario) => scenario.id !== id);
    saveScenarios();
  }

  function loadScenario(scenario: Scenario): void {
    productType = scenario.productType;
    listPrice = scenario.listPrice;
    discount = scenario.discount;
    unitCost = scenario.unitCost;
    activeSection = 'forecast';
  }

  async function logout(): Promise<void> {
    await supabase.auth.signOut();
    await goto('/login/');
  }

  function scenarioMetrics(scenario: Scenario) {
    const price = Math.max(0, scenario.listPrice * (1 - scenario.discount / 100));
    const units = predictUnits(scenario.productType, price);
    const revenue = units * price;
    const profit = units * (price - scenario.unitCost);
    return { price, units, revenue, profit, margin: revenue === 0 ? 0 : profit / revenue };
  }
</script>

<svelte:head>
  <title>DataCo | Regression Forecasting</title>
</svelte:head>

<header class="topbar">
  <a class="brand" href="./" aria-label="DataCo home">
    <span class="brand-mark">↗</span>
    <span>DataCo</span>
  </a>
  <nav aria-label="Main navigation">
    <button class:active={activeSection === 'forecast'} onclick={() => (activeSection = 'forecast')}>Forecast</button>
    <button class:active={activeSection === 'scenarios'} onclick={() => (activeSection = 'scenarios')}>
      Scenarios <span class="count">{scenarios.length}</span>
    </button>
  </nav>
  <label class="analysis-model-selector">
    <span>Model</span>

    <select
      bind:value={selectedAnalysisModel}
      aria-label="Select analysis model"
    >
      <option value="" disabled>Select Model</option>
      <option value="linear-regression">
        Linear Regression
      </option>
      <option value="least-squares-regression">
        Least Squares Regression
      </option>
      <option value="standard-error-comparison">
        Comparing Standard Errors
      </option>
      <option value="discount-optimization">
        Discount Optimization
      </option>
    </select>
  </label>

<button class="logout-button" onclick={logout}>
    Sign out
  </button>
  <span class="status"><span></span> Live model</span>
</header>

<main>
  <section class="page-title">
    <h1>Pricing Forecast</h1>
    <p>Enter your pricing values below.</p>
  </section>
  {#if selectedAnalysisModel === 'linear-regression'}
    <LinearRegressionLab />
  {:else if selectedAnalysisModel === 'least-squares-regression'}
    <LeastSquaresRegressionLab />
  {:else if selectedAnalysisModel === 'standard-error-comparison'}
    <StandardErrorComparison />
  {:else if selectedAnalysisModel === 'discount-optimization'}
    <DiscountOptimization />
  {:else if activeSection === 'forecast'}
    <section class="workspace">
      <article class="panel controls-panel">
        <div class="panel-heading">
          <div>
            <span class="step">01</span>
            <h2>Future pricing inputs</h2>
          </div>
          <button class="ghost" onclick={addScenario}>Save scenario</button>
        </div>

        <div class="form-grid">
          <label>
            <span>Product category</span>
            <select bind:value={productType}>
              {#each productTypes as type}
                <option value={type}>{type}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Current/list price</span>
            <div class="input-wrap"><b>$</b><input type="number" min="0" step="0.01" bind:value={listPrice} /></div>
          </label>

          <label>
            <span>Planned discount</span>
            <div class="input-wrap"><input type="number" min="0" max="100" step="0.5" bind:value={discount} /><b>%</b></div>
            <input class="range" aria-label="Planned discount slider" type="range" min="0" max="30" step="1" bind:value={discount} />
          </label>

          <label>
            <span>Manufacturing cost per unit</span>
            <div class="input-wrap"><b>$</b><input type="number" min="0" step="0.01" bind:value={unitCost} /></div>
          </label>
        </div>

        <div class="formula-box">
          <div>
            <span>Selected equation</span>
            <strong>Units = {selectedModel.intercept.toFixed(2)} {selectedModel.slope >= 0 ? '+' : '−'} {Math.abs(selectedModel.slope).toFixed(2)} × Price</strong>
          </div>
          <span class:strong={confidence === 'Strong'} class:moderate={confidence === 'Moderate'} class:low={confidence === 'Low'} class="confidence">
            {confidence} confidence
          </span>
        </div>
      </article>

      <article class="panel result-panel">
        <div class="panel-heading">
          <div>
            <span class="step">02</span>
            <h2>Predicted outcome</h2>
          </div>
          <span class="future-price">Future price <b>{money(futurePrice)}</b></span>
        </div>

        <div class="kpi-grid">
          <div class="kpi">
            <span>Predicted units</span>
            <strong>{number(predictedUnits)}</strong>
            <small>model estimate</small>
          </div>
          <div class="kpi">
            <span>Revenue</span>
            <strong>{money(predictedRevenue)}</strong>
            <small>price × predicted units</small>
          </div>
          <div class="kpi">
            <span>Contribution profit</span>
            <strong class:negative={predictedProfit < 0}>{money(predictedProfit)}</strong>
            <small>before other operating costs</small>
          </div>
          <div class="kpi">
            <span>Contribution margin</span>
            <strong class:negative={contributionMargin < 0}>{(contributionMargin * 100).toFixed(1)}%</strong>
            <small>profit ÷ revenue</small>
          </div>
        </div>

        <div class:reject={profitDelta < 0} class:approve={profitDelta >= 0} class="decision">
          <span class="decision-icon">{profitDelta >= 0 ? '✓' : '!'}</span>
          <div>
            <strong>{profitDelta >= 0 ? 'Scenario improves estimated contribution' : 'Scenario reduces estimated contribution'}</strong>
            <p>
              Compared with the modelled current-price case, estimated contribution changes by
              <b>{money(profitDelta)}</b>. {selectedModel.r2 < 0.2 ? 'Because model fit is low, treat this as directional evidence only.' : 'Review this result alongside inventory and market conditions.'}
            </p>
          </div>
        </div>
      </article>
    </section>

    <section class="panel chart-panel">
      <div class="panel-heading">
        <div>
          <span class="step">03</span>
          <h2>Price-to-demand curve</h2>
        </div>
        <span class="chart-note">Selected: {productType}</span>
      </div>
      <div class="chart-layout">
        <svg viewBox="0 0 600 250" role="img" aria-label="Predicted units sold at prices from zero to one hundred dollars">
          <line x1="36" y1="210" x2="566" y2="210" class="axis" />
          <line x1="36" y1="30" x2="36" y2="210" class="axis" />
          {#each [0, 1, 2, 3, 4] as tick}
            <line x1="36" y1={210 - tick * 42.5} x2="566" y2={210 - tick * 42.5} class="gridline" />
            <text x="28" y={214 - tick * 42.5} text-anchor="end">{Math.round((maxUnits / 4) * tick)}</text>
          {/each}
          {#each [0, 20, 40, 60, 80, 100] as tick}
            <text x={36 + (tick / 100) * 520} y="232" text-anchor="middle">${tick}</text>
          {/each}
          <polyline points={chartPoints} class="line" />
          <line x1={markerX} y1={markerY} x2={markerX} y2="210" class="marker-line" />
          <circle cx={markerX} cy={markerY} r="7" class="marker" />
        </svg>
      </div>
    </section>
  {:else}
    <section class="panel full-panel">
      <div class="panel-heading">
        <div>
          <span class="step">SAVED CASES</span>
          <h2>Scenario comparison</h2>
        </div>
        <button class="primary" onclick={() => (activeSection = 'forecast')}>+ New forecast</button>
      </div>
      {#if scenarios.length === 0}
        <div class="empty-state">
          <span>◇</span>
          <h3>No saved scenarios yet</h3>
          <p>Create a forecast and select “Save scenario” to compare alternatives here.</p>
          <button class="primary" onclick={() => (activeSection = 'forecast')}>Create first scenario</button>
        </div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Scenario</th><th>Future price</th><th>Predicted units</th><th>Revenue</th><th>Contribution</th><th>Margin</th><th></th></tr>
            </thead>
            <tbody>
              {#each scenarios as scenario}
                {@const metrics = scenarioMetrics(scenario)}
                <tr>
                  <td><strong>{scenario.name}</strong><small>{scenario.productType}</small></td>
                  <td>{money(metrics.price)}</td>
                  <td>{number(metrics.units)}</td>
                  <td>{money(metrics.revenue)}</td>
                  <td class:negative={metrics.profit < 0}>{money(metrics.profit)}</td>
                  <td>{(metrics.margin * 100).toFixed(1)}%</td>
                  <td class="actions"><button onclick={() => loadScenario(scenario)}>Load</button><button class="danger" onclick={() => removeScenario(scenario.id)}>Delete</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7fb; color: #191927; }
  :global(body) { margin: 0; min-width: 320px; }
  :global(button), :global(input), :global(select) { font: inherit; }
  :global(button) { cursor: pointer; }

  .topbar { height: 72px; display: flex; align-items: center; gap: 34px; padding: 0 5vw; background: #000080; color: white; position: sticky; top: 0; z-index: 20; box-shadow: 0 8px 28px rgba(0,0,80,.16); }
  .brand { color: white; text-decoration: none; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 800; letter-spacing: -.02em; }
  .brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: #FF8D21; font-size: 1.35rem; }
  nav { display: flex; align-items: stretch; height: 100%; gap: 4px; }
  nav button { position: relative; border: 0; background: transparent; color: #dedeff; padding: 0 18px; font-weight: 650; }
  nav button:hover, nav button.active { color: white; background: rgba(255,255,255,.08); }
  nav button.active::after { content: ''; position: absolute; height: 3px; left: 18px; right: 18px; bottom: 0; background: #FF8D21; border-radius: 3px 3px 0 0; }
  .count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; margin-left: 4px; border-radius: 20px; background: rgba(255,255,255,.15); font-size: .72rem; }


  .analysis-model-selector > span {
    margin: 0;
    color: #dedeff;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .analysis-model-selector select {
    height: 38px;
    min-width: 165px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    padding: 0 30px 0 11px;
    outline: none;
    font-size: 0.76rem;
    font-weight: 750;
  }

  .analysis-model-selector select:focus {
    border-color: #ff8d21;
    box-shadow: 0 0 0 3px rgba(255, 141, 33, 0.2);
  }

  .analysis-model-selector option {
    background: #ffffff;
    color: #171725;
  }

  .logout-button {
    margin-left: 0;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    padding: 8px 13px;
    font-size: 0.78rem;
    font-weight: 750;
  }

  .logout-button:hover {
    background: #ff8d21;
    border-color: #ff8d21;
  }

  .status { margin-left: 0; font-size: .82rem; display: flex; align-items: center; gap: 8px; color: #e9e9ff; }
  .status span { width: 8px; height: 8px; border-radius: 50%; background: #45e39b; box-shadow: 0 0 0 5px rgba(69,227,155,.15); }

  main { width: min(1440px, 92vw); margin: 0 auto; padding: 34px 0 48px; }
  .page-title {
    margin-bottom: 24px;
  }

  .page-title h1 {
    margin: 0;
    color: #000080;
    font-size: clamp(2rem, 4vw, 3.2rem);
    letter-spacing: -0.04em;
  }

  .page-title p {
    margin: 8px 0 0;
    color: #696778;
  }

  .hero { display: grid; grid-template-columns: 1fr auto; gap: 36px; align-items: end; margin-bottom: 28px; }
  .eyebrow { color: #FF8D21; font-size: .72rem; font-weight: 850; letter-spacing: .14em; }
  h1 { margin: 8px 0 10px; max-width: 760px; font-size: clamp(2rem, 4vw, 3.65rem); line-height: 1.04; letter-spacing: -.045em; }
  .hero p { max-width: 850px; margin: 0; color: #666577; line-height: 1.65; font-size: 1rem; }
  .hero-stat { width: 245px; padding: 19px 21px; border-radius: 18px; background: linear-gradient(145deg, #000080, #FF8D21); color: white; box-shadow: 0 18px 45px rgba(0,0,80,.18); }
  .hero-stat span, .hero-stat small { display: block; color: #FFF0DD; }
  .hero-stat span { font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; }
  .hero-stat strong { display: block; margin: 8px 0 4px; font-size: 1.45rem; }
  .hero-stat small { font-size: .78rem; }

  .workspace { display: grid; grid-template-columns: .92fr 1.08fr; gap: 22px; }
  .panel { background: rgba(255,255,255,.94); border: 1px solid #e8e7ef; border-radius: 22px; box-shadow: 0 10px 35px rgba(37,31,61,.06); overflow: hidden; }
  .controls-panel, .result-panel, .full-panel { padding: 24px; }
  .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
  .panel-heading > div:first-child { display: flex; align-items: center; gap: 11px; }
  .panel-heading h2 { margin: 0; font-size: 1.16rem; letter-spacing: -.02em; }
  .step { display: inline-grid; place-items: center; min-width: 34px; height: 28px; padding: 0 8px; border-radius: 8px; background: #FFF0DD; color: #C65F00; font-size: .68rem; font-weight: 850; letter-spacing: .06em; }
  .ghost, .primary { border-radius: 10px; padding: 9px 14px; font-weight: 750; }
  .ghost { border: 1px solid #d9d7e4; background: white; color: #454257; }
  .ghost:hover { border-color: #FF8D21; color: #C65F00; }
  .primary { border: 0; background: #000080; color: white; }
  .primary:hover { background: #FF8D21; }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  label > span { display: block; margin-bottom: 8px; color: #555263; font-size: .78rem; font-weight: 750; }
  select, .input-wrap { width: 100%; min-height: 46px; border: 1px solid #dad8e5; border-radius: 11px; background: #fbfbfe; transition: border .2s, box-shadow .2s; }
  select { padding: 0 12px; color: #252333; }
  select:focus, .input-wrap:focus-within { outline: none; border-color: #FF8D21; box-shadow: 0 0 0 4px rgba(143,37,209,.1); }
  .input-wrap { display: flex; align-items: center; padding: 0 12px; }
  .input-wrap b { color: #7d798e; }
  .input-wrap input { width: 100%; border: 0; outline: 0; background: transparent; padding: 0 8px; color: #1d1b29; font-weight: 700; }
  .range { width: 100%; margin-top: 10px; accent-color: #FF8D21; }
  .formula-box { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 22px; padding: 15px; border-radius: 13px; background: #FFF8EF; border: 1px solid #FFD6A3; }
  .formula-box span:first-child { display: block; margin-bottom: 4px; color: #746e80; font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; }
  .formula-box strong { font-size: .88rem; }
  .confidence { display: inline-flex; align-items: center; white-space: nowrap; border-radius: 99px; padding: 6px 10px; font-size: .7rem; font-weight: 800; }
  .confidence.strong { color: #08633b; background: #dcfce7; }
  .confidence.moderate { color: #8a4f00; background: #fff2cf; }
  .confidence.low { color: #9a2b2b; background: #fee2e2; }
  .future-price { color: #716d7d; font-size: .8rem; }
  .future-price b { color: #000080; margin-left: 5px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 13px; }
  .kpi { position: relative; min-height: 123px; padding: 17px; border-radius: 15px; background: #f9f9fc; border: 1px solid #ecebf2; overflow: hidden; }
  .kpi::before { content: ''; position: absolute; width: 5px; top: 0; bottom: 0; left: 0; background: linear-gradient(#000080, #FF8D21); }
  .kpi span, .kpi small { display: block; color: #777386; }
  .kpi span { font-size: .74rem; font-weight: 700; }
  .kpi strong { display: block; margin: 9px 0 4px; color: #171522; font-size: 1.65rem; letter-spacing: -.035em; }
  .kpi small { font-size: .67rem; }
  .negative { color: #1b47ca !important; }
  .decision { display: flex; gap: 13px; align-items: flex-start; margin-top: 14px; padding: 15px; border-radius: 14px; }
  .decision.approve { background: #edfdf5; border: 1px solid #bcebd2; color: #145c3b; }
  .decision.reject { background: #fff3f1; border: 1px solid #f2c8c2; color: #8f2f25; }
  .decision-icon { display: grid; flex: 0 0 28px; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: white; font-weight: 900; }
  .decision strong { display: block; font-size: .88rem; }
  .decision p { margin: 4px 0 0; font-size: .76rem; line-height: 1.5; }

  .chart-panel { margin-top: 22px; padding: 24px; }
  .chart-note { color: #777386; font-size: .78rem; }
  .chart-layout { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: center; }
  svg { width: 100%; max-height: 280px; overflow: visible; }
  svg text { fill: #817d8c; font-size: 10px; }
  .axis { stroke: #c8c6d2; stroke-width: 1.2; }
  .gridline { stroke: #eceaf1; stroke-width: 1; }
  .line { fill: none; stroke: #000080; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .marker-line { stroke: #FF8D21; stroke-width: 1.5; stroke-dasharray: 4 4; }
  .marker { fill: #FF8D21; stroke: white; stroke-width: 4; }
  .chart-insight { padding: 20px; border-radius: 16px; background: #08085e; color: white; }
  .chart-insight span { color: #D6D6FF; font-size: .68rem; text-transform: uppercase; letter-spacing: .1em; }
  .chart-insight strong { display: block; margin: 9px 0; font-size: 1.15rem; }
  .chart-insight p { color: #F0F0FF; font-size: .79rem; line-height: 1.55; }
  .chart-insight small { display: block; margin-top: 18px; color: #C7C7E8; font-size: .68rem; }

  .full-panel { min-height: 500px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  th { padding: 13px; background: #f4f2f8; color: #656173; text-align: left; font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: 15px 13px; border-bottom: 1px solid #eceaf1; color: #4d495a; }
  td strong { color: #1f1c2a; }
  td small { display: block; margin-top: 4px; color: #8a8695; }
  tr:hover td { background: #fcfbff; }
  .r2 { font-weight: 850; color: #000080; }
  .method-note { margin-top: 20px; padding: 18px; border-left: 4px solid #FF8D21; background: #FFF8EF; border-radius: 4px 13px 13px 4px; }
  .method-note strong { color: #C65F00; }
  .method-note p { margin: 6px 0 0; color: #625c69; font-size: .82rem; line-height: 1.55; }
  .actions { white-space: nowrap; }
  .actions button { border: 0; padding: 6px 9px; border-radius: 7px; background: #EAF0FF; color: #000080; font-size: .72rem; font-weight: 700; }
  .actions .danger { margin-left: 6px; background: #fff0ee; color: #ad3024; }
  .empty-state { min-height: 360px; display: grid; place-items: center; align-content: center; text-align: center; color: #777386; }
  .empty-state > span { font-size: 2.5rem; color: #FF8D21; }
  .empty-state h3 { margin: 12px 0 5px; color: #262331; }
  .empty-state p { margin: 0 0 18px; }

  footer { width: min(1440px, 92vw); margin: 0 auto; padding: 22px 0 32px; display: flex; justify-content: space-between; color: #888493; font-size: .72rem; }

  @media (max-width: 980px) {
    .workspace, .chart-layout { grid-template-columns: 1fr; }
    .hero-stat { display: none; }
    .chart-insight { width: 100%; }
  }
  @media (max-width: 700px) {
    .analysis-model-selector {
      order: 4;
      width: 100%;
      margin-left: 0;
    }

    .analysis-model-selector select {
      flex: 1;
    }

    .topbar { height: auto; min-height: 66px; padding: 12px 4vw; flex-wrap: wrap; gap: 8px 18px; }
    nav { order: 3; width: 100%; height: 42px; overflow-x: auto; }
    nav button { flex: 1; padding: 0 10px; white-space: nowrap; }
    .logout-button {
    margin-left: auto;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    padding: 8px 13px;
    font-size: 0.78rem;
    font-weight: 750;
  }

  .logout-button:hover {
    background: #ff8d21;
    border-color: #ff8d21;
  }

  .status { margin-left: 0; }
    main { width: 94vw; padding-top: 24px; }
    .hero { grid-template-columns: 1fr; }
    .form-grid, .kpi-grid { grid-template-columns: 1fr; }
    .formula-box, .panel-heading { align-items: flex-start; }
    .formula-box { flex-direction: column; }
    .controls-panel, .result-panel, .chart-panel, .full-panel { padding: 18px; }
    footer { width: 94vw; flex-direction: column; gap: 6px; }
  }

  .analysis-model-selector {
    position: relative;
    z-index: 100;
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    flex: 0 0 auto;
    align-items: center;
    gap: 9px;
    margin-left: auto;
  }

  .analysis-model-selector > span {
    display: block;
    margin: 0;
    color: #ffffff;
    font-size: 0.72rem;
    font-weight: 750;
    white-space: nowrap;
  }

  .analysis-model-selector select {
    display: block !important;
    visibility: visible !important;
    width: 235px;
    min-width: 235px;
    height: 40px;
    border: 2px solid #ff8d21;
    border-radius: 9px;
    background: #ffffff;
    color: #000080;
    padding: 0 34px 0 12px;
    font: inherit;
    font-size: 0.76rem;
    font-weight: 800;
    cursor: pointer;
    outline: none;
  }

  .analysis-model-selector select:focus {
    border-color: #ff8d21;
    box-shadow: 0 0 0 4px rgba(255, 141, 33, 0.22);
  }

  .analysis-model-selector option {
    background: #ffffff;
    color: #171725;
  }

  @media (max-width: 850px) {
    .analysis-model-selector {
      order: 10;
      width: 100%;
      margin: 10px 0 0;
    }

    .analysis-model-selector select {
      flex: 1;
      width: auto;
      min-width: 0;
    }
  }

</style>
