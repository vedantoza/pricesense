<script lang="ts">
  import DiscountOptimization from '$lib/DiscountOptimization.svelte';
</script>

<svelte:head>
  <title>DataCo | Discount Optimization</title>
  <meta
    name="description"
    content="Optimize discounts by region and department using fitted profit curves."
  />
</svelte:head>

<header class="topbar">
  <a class="brand" href="./" aria-label="DataCo Discount Optimization home">
    <span class="brand-mark" aria-hidden="true">↗</span>
    <span>DataCo</span>
  </a>

  <div class="model-display" aria-label="Current model">
    <span class="model-label">Model</span>
    <strong>Discount Optimization</strong>
  </div>


  <span class="status"><span aria-hidden="true"></span> Live model</span>
</header>

<main>
  <DiscountOptimization />
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    min-width: 320px;
    overflow-x: hidden;
    background: #f7f8fc;
    color: #191927;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  :global(body) {
    min-width: 320px;
    margin: 0;
    overflow-x: hidden;
  }

  :global(button) {
    font: inherit;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    min-height: 72px;
    align-items: center;
    gap: 24px;
    padding: 10px 5vw;
    background: #000080;
    color: #ffffff;
    box-shadow: 0 8px 28px rgba(0, 0, 80, 0.16);
  }

  .brand {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 10px;
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 10px;
    background: #ff8d21;
    font-size: 1.35rem;
  }

  .model-display {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .model-label {
    color: #dedeff;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .model-display strong {
    display: block;
    max-width: 290px;
    overflow: hidden;
    border: 2px solid #ff8d21;
    border-radius: 10px;
    background: #ffffff;
    color: #000080;
    padding: 11px 16px;
    font-size: 0.78rem;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-shadow: 0 0 0 4px rgba(255, 141, 33, 0.15);
  }



  .status {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    color: #e9e9ff;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .status > span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #45e39b;
    box-shadow: 0 0 0 5px rgba(69, 227, 155, 0.15);
  }

  main {
    width: min(1440px, 92vw);
    margin: 0 auto;
    padding: 34px 0 48px;
  }

  @media (max-width: 820px) {
    .topbar {
      flex-wrap: wrap;
      gap: 10px 14px;
      padding: 12px 4vw;
    }

    .model-display {
      order: 3;
      width: 100%;
      margin-left: 0;
    }

    .model-display strong {
      max-width: none;
      flex: 1;
    }


    main {
      width: 94vw;
      padding-top: 24px;
    }
  }

  @media (max-width: 480px) {
    .status {
      display: none;
    }

    .model-label {
      display: none;
    }
  }
</style>
