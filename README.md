# HomeCam: Home Surveillance and Screencast

Production site: [https://homecam.ndn.today/](https://homecam.ndn.today/).

HomeCam is a web application built with [NDNts](https://yoursunny.com/p/NDNts/) and web technologies.
It allows a visitor to share their webcam or screen over a NDN network, and others can watch the stream using a link.
There is no end-to-end encryption and no privacy in this proof-of-concept implementation.

Build instructions:

1. Setup [NDNts-CA](https://github.com/yoursunny/NDNts-CA) with `nop` challenge, and save CA profile in `public/profile.data`.
2. `corepack pnpm install` to install dependencies.
3. `corepack pnpm serve` to start development server.
4. `corepack pnpm build` to compile production site in `public/`.
