import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [polygon, polygonAmoy],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});
