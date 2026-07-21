<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let { children } = $props();

  let checking = $state(true);
  let permitted = $state(false);

  function isLoginPage(): boolean {
    return page.url.pathname.replace(/\/+$/, '') === '/login';
  }

  onMount(() => {
    let active = true;

    async function checkSession(): Promise<void> {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        permitted = true;
        checking = false;

        if (isLoginPage()) {
          await goto('/');
        }

        return;
      }

      permitted = false;
      checking = false;

      if (!isLoginPage()) {
        await goto('/login/');
      }
    }

    void checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session) {
        permitted = true;
        checking = false;

        if (isLoginPage()) {
          void goto('/');
        }
      } else {
        permitted = false;
        checking = false;

        if (!isLoginPage()) {
          void goto('/login/');
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  });
</script>

{#if isLoginPage()}
  {@render children()}
{:else if checking}
  <main class="session-screen">
    <span class="spinner"></span>
    <strong>Verifying secure access…</strong>
  </main>
{:else if permitted}
  {@render children()}
{/if}

<style>
  .session-screen {
    min-height: 100vh;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 16px;
    background: #f7f8fc;
    color: #000080;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  .spinner {
    width: 38px;
    height: 38px;
    border: 4px solid #dedeea;
    border-top-color: #ff8d21;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
