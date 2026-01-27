import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [polygon, polygonAmoy],
  connectors: [injected()],
  transports: {
    [polygon.id]: process.env.NEXT_PUBLIC_POLYGON_RPC_URL
      ? http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL)
      : http(),
    [polygonAmoy.id]: process.env.NEXT_PUBLIC_AMOY_RPC_URL
      ? http(process.env.NEXT_PUBLIC_AMOY_RPC_URL)
      : http(),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});
