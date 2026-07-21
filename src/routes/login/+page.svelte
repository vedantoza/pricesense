<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let email = '';
  let password = '';
  let errorMessage = '';
  let loading = false;
  let checkingSession = true;

  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      await goto('/');
      return;
    }

    checkingSession = false;
  });

  async function login(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    errorMessage = '';
    loading = true;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    loading = false;

    if (error) {
      errorMessage = error.message;
      return;
    }

    await goto('/');
  }
</script>

<svelte:head>
  <title>Sign in | PriceSens</title>
  <meta
    name="description"
    content="Secure access to the PriceSens forecasting portal"
  />
</svelte:head>

<main class="login-page">
  <section class="login-card">
    <div class="brand">
      <span class="brand-icon">↗</span>

      <div>
        <strong>PriceSens</strong>
        <small>Price intelligence portal</small>
      </div>
    </div>

    {#if checkingSession}
      <div class="loading-state">
        <span class="spinner"></span>
        <p>Checking your session…</p>
      </div>
    {:else}
      <div class="heading">
        <span>AUTHORIZED ACCESS</span>
        <h1>Welcome back</h1>
        <p>Sign in to access your price-elasticity forecasting portal.</p>
      </div>

      <form onsubmit={login}>
        <label>
          <span>Email address</span>
          <input
            type="email"
            bind:value={email}
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            bind:value={password}
            autocomplete="current-password"
            placeholder="Enter your password"
            required
          />
        </label>

        {#if errorMessage}
          <div class="error-message" role="alert">
            {errorMessage}
          </div>
        {/if}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in to PriceSens'}
        </button>
      </form>

      <p class="access-note">
        Accounts are created and approved by the portal administrator.
      </p>
    {/if}
  </section>

  <aside class="information-panel">
    <div>
      <span class="eyebrow">REGRESSION FORECASTING</span>
      <h2>Make pricing decisions with measurable evidence.</h2>
      <p>
        Compare planned discounts, forecast units sold, estimate revenue and
        evaluate contribution profit before approving a pricing decision.
      </p>
    </div>

    <div class="features">
      <article>
        <strong>01</strong>
        <span>Category-specific regression models</span>
      </article>

      <article>
        <strong>02</strong>
        <span>Live revenue and contribution forecasts</span>
      </article>

      <article>
        <strong>03</strong>
        <span>Saved pricing scenarios</span>
      </article>
    </div>
  </aside>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    background: #f7f8fc;
    color: #171725;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
  }

  :global(button),
  :global(input) {
    font: inherit;
  }

  .login-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(420px, 0.85fr) minmax(500px, 1.15fr);
  }

  .login-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: min(460px, 82%);
    margin: 0 auto;
    padding: 48px 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 60px;
  }

  .brand-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #ff8d21;
    color: #ffffff;
    font-size: 1.45rem;
    font-weight: 900;
  }

  .brand strong,
  .brand small {
    display: block;
  }

  .brand strong {
    color: #000080;
    font-size: 1.15rem;
  }

  .brand small {
    margin-top: 2px;
    color: #7a7889;
    font-size: 0.73rem;
  }

  .heading > span,
  .eyebrow {
    color: #e97800;
    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.14em;
  }

  h1 {
    margin: 9px 0;
    color: #000080;
    font-size: clamp(2.2rem, 5vw, 3.4rem);
    letter-spacing: -0.045em;
  }

  .heading p {
    margin: 0 0 34px;
    color: #696778;
    line-height: 1.6;
  }

  form {
    display: grid;
    gap: 20px;
  }

  label > span {
    display: block;
    margin-bottom: 8px;
    color: #4d4b5b;
    font-size: 0.78rem;
    font-weight: 750;
  }

  input {
    width: 100%;
    height: 52px;
    border: 1px solid #d9d9e4;
    border-radius: 12px;
    background: #ffffff;
    padding: 0 15px;
    color: #1f1d2b;
    outline: none;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  input:focus {
    border-color: #ff8d21;
    box-shadow: 0 0 0 4px rgba(255, 141, 33, 0.14);
  }

  button {
    height: 52px;
    margin-top: 4px;
    border: 0;
    border-radius: 12px;
    background: #000080;
    color: #ffffff;
    font-weight: 800;
    cursor: pointer;
    transition:
      background 0.2s,
      transform 0.2s;
  }

  button:hover:not(:disabled) {
    background: #1717a7;
    transform: translateY(-1px);
  }

  button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .error-message {
    padding: 12px 14px;
    border: 1px solid #f3c0ba;
    border-radius: 10px;
    background: #fff1ef;
    color: #a33226;
    font-size: 0.8rem;
  }

  .access-note {
    margin-top: 22px;
    color: #8a8795;
    text-align: center;
    font-size: 0.73rem;
  }

  .information-panel {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: clamp(50px, 7vw, 110px);
    background:
      radial-gradient(circle at 75% 20%, rgba(255, 141, 33, 0.28), transparent 30%),
      linear-gradient(145deg, #000080 0%, #08085e 70%, #030343 100%);
    color: #ffffff;
  }

  .information-panel h2 {
    max-width: 700px;
    margin: 14px 0;
    font-size: clamp(2.3rem, 5vw, 4.8rem);
    line-height: 1.03;
    letter-spacing: -0.05em;
  }

  .information-panel p {
    max-width: 680px;
    color: #ddddf5;
    line-height: 1.7;
  }

  .features {
    display: grid;
    gap: 13px;
    margin-top: 50px;
  }

  .features article {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 17px 19px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(10px);
  }

  .features strong {
    color: #ffb66e;
    font-size: 0.77rem;
  }

  .features span {
    color: #f0efff;
    font-size: 0.86rem;
    font-weight: 650;
  }

  .loading-state {
    display: grid;
    place-items: center;
    min-height: 300px;
    color: #696778;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 4px solid #e5e5ef;
    border-top-color: #ff8d21;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 900px) {
    .login-page {
      grid-template-columns: 1fr;
    }

    .information-panel {
      display: none;
    }

    .login-card {
      width: min(460px, 88%);
    }
  }
</style>
