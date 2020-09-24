# HomeCam: NDNts Home Surveillance and Screencast

Production site: [https://homecam.ndn.today/](https://homecam.ndn.today/).

HomeCam is a web application built with [NDNts](https://yoursunny.com/p/NDNts/) and web technologies.
It allows a visitor to share their webcam or screen over the NDN testbed, and others can watch the stream using a link.
In this proof-of-concept implementation, the stream is 1 fps and has no sound, and there is no end-to-end encryption.

Build instructions:

1. Setup [NDNts-CA](https://github.com/yoursunny/NDNts-CA) with `nop` challenge, and save CA profile in `public/profile.data`.
2. `npm install` to install dependencies.
3. `npm run serve` to start development server.
4. `npm run build` to compile production site in `public/`.
