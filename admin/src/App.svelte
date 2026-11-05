<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';

  let notice = $state(false);

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    notice = true;
  }
</script>

<header class="topbar">
  <span class="brand">{de.admin.title}</span>
</header>
<main id="main" class="page">
  <section class="card" aria-labelledby="admin-login">
    <h1 id="admin-login">{de.admin.loginHeading}</h1>
    <form onsubmit={submit} novalidate>
      <label for="admin-password">{de.admin.password}</label>
      <input id="admin-password" type="password" autocomplete="current-password" />
      <p class="actions"><button class="button" type="submit">{de.admin.login}</button></p>
      {#if notice}
        <p class="notice" role="status">
          <span aria-hidden="true">ℹ</span><span>{de.admin.notYet}</span>
        </p>
      {/if}
    </form>
  </section>
</main>

<style>
  .topbar {
    padding: 0.75rem 1rem;
    background: var(--wood-dark);
    color: var(--on-wood);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .page {
    max-width: 28rem;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  .actions {
    margin-top: 1rem;
  }
</style>
