# Publishing on the web (Cloudflare Pages)

BuildBlock is two static sites on Cloudflare Pages, on the `buildblock.dev` domain (its DNS is in Cloudflare):

| Address | What | Folder | Pages project |
|---|---|---|---|
| `https://buildblock.dev` | The website: one page with the logo, the look of the game, a "website in development" notice (the game itself is ready to play) and a **Play now** button | `site/` | `buildblock-site` |
| `https://play.buildblock.dev` | The game itself | `dist/` (the Vite build) | `buildblock-play` |

Nothing here needs a server: the game is a static build (the physics engine is compiled in as WebAssembly inside the JavaScript) and the page is plain HTML and CSS.

## The website (`site/`)

`site/index.html` + `site/styles.css` use the colours, the font (Orbitron, the same file the game ships), the raised yellow button and the sky-and-floor scene of the main menu, with the stacked logo. The button points to `https://play.buildblock.dev`. The colours are the ones of `src/constants/colors.ts`, copied by hand into the CSS variables of `styles.css` (keep them in sync if the theme changes).

- Preview it: `npm run site:dev`, then open <http://localhost:5196>.
- The logo, the favicons and the font in `site/` are copies of the ones in `public/` and `node_modules/`: run `npm run site:sync` after changing the logo (`packaging/make-logo.py`) or the icons.
- `site/_headers` and `public/_headers` are Cloudflare Pages header files (caching of the files that never change, `nosniff`, referrer policy).
- Not there yet: a share image (`og:image`), analytics and a sitemap.

## One-time setup

You need a Cloudflare account that owns `buildblock.dev`. The commands use [Wrangler](https://developers.cloudflare.com/workers/wrangler/) through `npx`, so nothing is installed in the project.

1. Log in: `npx wrangler login` (opens the browser).
2. Create the two projects (direct upload, `main` as the production branch):
   ```bash
   npx wrangler pages project create buildblock-site --production-branch main
   npx wrangler pages project create buildblock-play --production-branch main
   ```
3. Publish both once (see below) so each project has a deployment.
4. In the Cloudflare dashboard, **Workers & Pages**, open each project, then **Custom domains** and **Set up a custom domain**:
   - `buildblock-site`: `buildblock.dev` (and, if you want it to work too, `www.buildblock.dev`);
   - `buildblock-play`: `play.buildblock.dev`.

   Because the domain's DNS is on Cloudflare, it creates the DNS records and the HTTPS certificates itself; it takes a few minutes. (`.dev` domains only work over HTTPS, which Cloudflare provides.)

## If `wrangler login` fails

`OAuth error: request_forbidden ... No CSRF value available in the session cookie` is the login page refusing the browser session (cookies blocked or cleared, a private window, another browser or profile than the one logged in to Cloudflare, or a stale session). In order:

1. Log in to <https://dash.cloudflare.com> in your normal browser first, then run `npx wrangler login` again. If the link it prints opens somewhere else (another browser, a private window, an embedded browser), copy it and open it in the browser where you are logged in. Cookies must be allowed for `dash.cloudflare.com`; clearing them and logging in again also helps.
2. Use an **API token** instead of the login: in the dashboard go to **My Profile**, **API Tokens**, **Create Token**, and either use the *Edit Cloudflare Workers* template or a custom token with **Account / Cloudflare Pages / Edit**. Then, in the terminal:
   ```bash
   export CLOUDFLARE_API_TOKEN=<the token>
   export CLOUDFLARE_ACCOUNT_ID=<the account id, on the right of Workers & Pages>
   npx wrangler whoami    # should list your account
   ```
   and run the commands of this guide in the same terminal (the token stays in that session only: do not put it in a file of the project).
3. Skip Wrangler: in the dashboard, **Workers & Pages**, **Create**, **Pages**, **Upload assets**, and drag the `site/` folder (for the website) or the `dist/` folder after `npm run build` (for the game) into it. Name the projects `buildblock-site` and `buildblock-play`, then add the custom domains as above. To publish a new version, open the project and use **Create deployment** with the folder again.

## Publishing a new version

```bash
npm run deploy:site    # the website (site/)
npm run deploy:play    # type-checks and builds the game, then publishes dist/
```

Each command prints the URL of the deployment (`https://<id>.buildblock-play.pages.dev`), a good place to check it before the domain shows it. Every publish to the `main` branch becomes the live site; older deployments stay in the dashboard and can be restored from there.

## Good to know

- The game keeps its saves in the browser's `localStorage`, which belongs to one address: the saves made on `play.buildblock.dev` are separate from the ones on `localhost:5173`, and from any other domain. There is no way yet to move them (see the roadmap: the move to a backend with a database).
- The game's `index.html` already uses relative URLs (`base: './'` in `vite.config.ts`), so it works from any address or folder.
- To publish from a Git repository instead of by hand, connect the repository in the Cloudflare dashboard: build command `npm run build` and output folder `dist` for the game, and no build command with `site` as the output folder for the website.
