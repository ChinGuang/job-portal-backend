<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed.

### Configuration
1. Create a `.env` file in the root directory (Ref with .env.example)

### Running the Application

To build and start the container set in detached mode using the custom Compose file and environment configuration, run:

```Bash
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Demo harness

The API issues no tokens of its own — Supabase does. `demo/index.html` is a
single throwaway static page (not a product frontend) that signs in against
Supabase directly and prints the resulting access token so you can paste it
into Swagger's "Authorize" dialog at `/api`.

### Running the demo page

Serve the page over `http(s)`, not `file://` — Google's OAuth redirect will
not complete correctly from a `file://` origin:

```bash
pnpm demo
```

This serves `demo/` at `http://localhost:5500`. Open it, then fill in your
Supabase project's **URL** and **anon (public) key** (Project Settings → API
in the Supabase dashboard) — these are saved to the browser's local storage
so you only need to enter them once per browser.

- **Email/password**: enter credentials for an existing Supabase user and
  click "Sign in with email".
- **Google**: click "Sign in with Google". First add
  `http://localhost:5500/` (with the trailing slash — that's the exact URL
  the page redirects back to) to Supabase's Auth → URL Configuration →
  **Redirect URLs**, or the redirect back to the demo page will be rejected.

Either flow prints the access token in a copyable box once signed in.

### Supabase webhook via ngrok

The API mirrors Supabase users locally through a Database Webhook on
`auth.users` (see [`SupabaseUsersWebhookController`](src/modules/auth/webhooks/supabase-users-webhook.controller.ts)
at `POST /webhooks/supabase/users`). Lazy provisioning in the auth guard
means the webhook isn't required for the API to work, but wiring it up lets
you demo the mirror staying in sync (including deletions) without waiting
for the first authenticated request.

Because a public URL is needed for Supabase to reach your local API, and
ngrok's free tier issues a new URL on every restart, this is a manual,
per-session step:

1. Start the API (`pnpm start:dev`), then start ngrok pointed at it:
   ```bash
   ngrok http 3000
   ```
2. Copy the `https://<random>.ngrok-free.app` forwarding URL ngrok prints.
3. In the Supabase dashboard: **Database → Webhooks**, edit (or create) the
   webhook on `auth.users` for `INSERT`/`UPDATE`/`DELETE`, and set its URL to:
   ```
   https://<random>.ngrok-free.app/webhooks/supabase/users
   ```
4. Set the webhook's `x-webhook-secret` header to match `SUPABASE_WEBHOOK_SECRET`
   in your `.env` — requests without it are rejected with 401.
5. Repeat steps 1–3 whenever you restart ngrok, since the forwarding URL
   changes each time.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Cleanup

Stopping the Application
To stop and remove the container set:

```Bash
docker compose -f docker/docker-compose.yml down
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
