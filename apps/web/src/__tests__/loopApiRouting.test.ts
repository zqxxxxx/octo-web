import * as fs from "fs";
import * as path from "path";

describe("Loop API routing contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");

  it("uses a Loop-owned browser prefix instead of the octo-fleet namespace", () => {
    const httpClient = read("packages/dmloop/src/api/http.ts");

    expect(httpClient).toMatch(
      /VITE_LOOP_API_BASE\s*\|\|\s*["']\/loop\/api["']/,
    );
    expect(httpClient).not.toMatch(
      /VITE_LOOP_API_BASE\s*\|\|\s*["']\/fleet\/api/,
    );
  });

  it("rewrites the development prefix to octo-multica's /api routes", () => {
    const viteConfig = read("apps/web/vite.config.ts");
    const loopProxy = viteConfig.match(
      /["']\/loop\/api["']\s*:\s*\{([\s\S]*?)\n\s*\},/,
    )?.[1];

    expect(loopProxy).toContain("VITE_LOOP_API_URL");
    expect(loopProxy).toMatch(
      /path\.replace\(\/\^\\\/loop\/,\s*["']["']\)/,
    );
    expect(loopProxy).not.toContain("VITE_FLEET_API_URL");
  });

  it("rewrites the production prefix to /api and wires the runtime target", () => {
    const nginxConfig = read("nginx.conf.template");
    const entrypoint = read("docker-entrypoint.sh");
    const locationStart = nginxConfig.indexOf("location /loop/api/");
    const locationEnd = nginxConfig.indexOf("# octo-matter API", locationStart);
    const loopLocation = nginxConfig.slice(locationStart, locationEnd);

    expect(locationStart).toBeGreaterThan(-1);
    expect(locationEnd).toBeGreaterThan(locationStart);
    expect(nginxConfig).toContain('set $loop_api_url "${LOOP_API_URL}";');
    expect(loopLocation).toMatch(
      /rewrite\s+\^\/loop\/api\/\(\.\*\)\$\s+\/api\/\$1\s+break;/,
    );
    expect(loopLocation).toContain("proxy_pass  $loop_api_url;");
    expect(loopLocation).not.toContain("fleet");
    expect(entrypoint).toContain("${LOOP_API_URL}");
    expect(entrypoint).toMatch(/envsubst\s+'[^']*\$\{LOOP_API_URL\}[^']*'/);
  });
});
