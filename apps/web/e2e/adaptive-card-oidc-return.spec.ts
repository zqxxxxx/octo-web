import { test, expect, type Page, type Route } from '@playwright/test'

const APP_ORIGIN = 'http://localhost:3000'
const IDP_ORIGIN = 'http://127.0.0.1:3000'
const TOKEN = 'tok-adaptive-card-oidc-e2e'

interface OidcHarnessOptions {
  authcode: string
  spaceId: string
}

async function installOidcHarness(page: Page, options: OidcHarnessOptions): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__adaptive_card_oidc_e2e_initialized') !== '1') {
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('__adaptive_card_oidc_e2e_initialized', '1')
    }
    // Keep the migration explanation from obscuring the actual SSO action.
    localStorage.setItem('octo-login-migration-notice-v1-ack', '1')
  })

  // Defaults first; Playwright gives later, more-specific routes precedence.
  await page.route('**/api/v1/common/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/v1/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )

  // App bootstrap expects collection endpoints to return arrays. Keeping these
  // shapes realistic prevents unrelated sidebar/contact render errors from
  // hiding an authentication or deep-link failure in the browser trace.
  for (const pattern of [
    '**/api/v1/friend/sync**',
    '**/api/v1/space/*/members**',
    '**/api/v1/spaces/*/categories**',
  ]) {
    await page.route(pattern, (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
  }

  await page.route('**/api/v1/common/appconfig**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dmloop_on: true,
        oidc_providers: [
          {
            id: 'test-oidc',
            name: 'Test Enterprise SSO',
            authorize_path: '/v1/auth/oidc/test-oidc/authorize',
          },
        ],
      }),
    }),
  )
  await page.route('**/api/v1/space/my**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ space_id: options.spaceId, name: 'Card E2E Space' }]),
    }),
  )
  await page.route('**/loop/api/**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/loop/api/workspaces', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '2224bce3-6c16-418f-9f89-4547c44bc033',
          slug: 'card-e2e-workspace',
          name: 'Card E2E Workspace',
        },
      ]),
    }),
  )
  await page.route('**/loop/api/issues/*', (route: Route) => {
    const issueId = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: issueId,
        workspace_id: '2224bce3-6c16-418f-9f89-4547c44bc033',
        number: 42,
        identifier: 'CARD-42',
        title: 'Adaptive Card E2E Loop',
        description: null,
        status: 'in_progress',
        priority: 'medium',
        assignee_type: null,
        assignee_id: null,
        creator_id: 'uid-card-oidc-e2e',
        project_id: null,
        position: 0,
        created_at: '2026-07-16T00:00:00Z',
        updated_at: '2026-07-16T00:00:00Z',
        labels: [],
        reactions: [],
        attachments: [],
      }),
    })
  })
  await page.route('**/v1/user/thirdlogin/authcode**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authcode: options.authcode }),
    }),
  )
  await page.route('**/v1/user/thirdlogin/authstatus**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 1,
        result: { uid: 'uid-card-oidc-e2e', token: TOKEN, name: 'OIDC E2E User' },
      }),
    }),
  )

  // The RP authorize endpoint sends the browser to a genuinely different
  // origin. That origin then returns to /login, matching the production IdP
  // round trip while preserving localhost's own sessionStorage bucket.
  await page.route('**/v1/auth/oidc/test-oidc/authorize**', async (route: Route) => {
    const requested = new URL(route.request().url())
    expect(requested.searchParams.get('authcode')).toBe(options.authcode)
    expect(requested.searchParams.get('return_to')).toBe(`${APP_ORIGIN}/login`)
    expect(requested.searchParams.get('flag')).toBe('1')
    await route.fulfill({
      status: 302,
      headers: { location: `${IDP_ORIGIN}/mock-idp/authorize?code=idp-code` },
      body: '',
    })
  })
}

async function completeEnterpriseLogin(page: Page): Promise<void> {
  const button = page.locator('.wk-login-content-sso-primary')
  await expect(button).toBeVisible()
  await button.click()
  await expect(page).toHaveURL((url) => url.origin === IDP_ORIGIN)
  // Model the IdP callback as a new document navigation back to the RP. Using
  // 127.0.0.1 for the IdP and localhost for Octo gives each side a real,
  // isolated Web Storage origin while keeping the fixture fully local.
  await page.goto(`${APP_ORIGIN}/login`)
  // Synchronize on the completed OIDC exchange and loginInfo.save(), without
  // racing an intermediate URL visible only during document navigation.
  await expect.poll(() => storedLoginToken(page)).toBe(TOKEN)
}

async function storedLoginToken(page: Page): Promise<string | undefined> {
  try {
    return await page.evaluate(() => {
      for (const store of [window.sessionStorage, window.localStorage]) {
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index)
          if (key?.startsWith('token') && store.getItem(key)) return store.getItem(key) ?? undefined
        }
      }
      return undefined
    })
  } catch {
    return undefined
  }
}

async function pendingAuthReturn(page: Page): Promise<string | null> {
  try {
    return await page.evaluate(() => sessionStorage.getItem('octo.web.authReturn'))
  } catch {
    return 'navigation-in-progress'
  }
}

test.describe('Adaptive Card deep links survive an external OIDC round trip', () => {
  test('Summary returns to the exact task and Space', async ({ page }) => {
    await installOidcHarness(page, { authcode: 'AC-SUMMARY', spaceId: 'space_9' })
    await page.goto('/s/42?sp=space_9')
    await expect.poll(() => pendingAuthReturn(page)).toBe('/s/42?sp=space_9')

    await completeEnterpriseLogin(page)

    await expect(page).toHaveURL((url) =>
      url.pathname === '/s/42' && url.searchParams.get('sp') === 'space_9',
    )
    await expect.poll(() => storedLoginToken(page)).toBe(TOKEN)
    await expect.poll(() => pendingAuthReturn(page)).toBeNull()
  })

  test('Loop returns to the exact issue, workspace and Space tuple', async ({ page }) => {
    const issue = '4fe20b76-7fd5-4ba2-b522-ded8d0f31f33'
    const workspace = '2224bce3-6c16-418f-9f89-4547c44bc033'
    const target = `/loop?issue=${issue}&workspace=${workspace}&sp=spc_loop_e2e`
    await installOidcHarness(page, { authcode: 'AC-LOOP', spaceId: 'spc_loop_e2e' })
    await page.goto(target)
    await expect.poll(() => pendingAuthReturn(page)).toBe(target)

    const issueRequestPromise = page.waitForRequest((request) =>
      new URL(request.url()).pathname === `/loop/api/issues/${issue}`,
    )
    await completeEnterpriseLogin(page)
    const issueRequest = await issueRequestPromise

    // RouteManager intentionally consumes the business tuple after the Loop
    // component captures it and normalizes the visible URL to /loop?sid=...
    // The target issue request plus both routing headers prove the tuple was
    // restored and applied, rather than merely left in the address bar.
    expect(issueRequest.headers()['token']).toBe(TOKEN)
    expect(issueRequest.headers()['x-space-id']).toBe('spc_loop_e2e')
    expect(issueRequest.headers()['x-workspace-slug']).toBe('card-e2e-workspace')
    await expect(page.getByText('Adaptive Card E2E Loop')).toBeVisible()
    await expect(page).toHaveURL((url) =>
      url.pathname === '/loop' && Boolean(url.searchParams.get('sid')),
    )
    await expect.poll(() => storedLoginToken(page)).toBe(TOKEN)
    await expect.poll(() => pendingAuthReturn(page)).toBeNull()
  })
})
