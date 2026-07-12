export interface TenzroConfig {
  endpoint: string;
  apiEndpoint?: string;
  chainId?: number;
  timeout?: number;
}

// Note: Mainnet is not yet live. This configuration is a placeholder.
// Use TESTNET_CONFIG to connect to the live Tenzro testnet (chainId: 1337).
export const MAINNET_CONFIG: TenzroConfig = {
  endpoint: "https://rpc.tenzro.xyz",
  apiEndpoint: "https://api.tenzro.xyz",
  chainId: 1,
  timeout: 30000,
};

export const TESTNET_CONFIG: TenzroConfig = {
  endpoint: "https://rpc.tenzro.xyz",
  apiEndpoint: "https://api.tenzro.xyz",
  chainId: 1337,
  timeout: 30000,
};

export const LOCAL_CONFIG: TenzroConfig = {
  endpoint: "http://localhost:8545",
  apiEndpoint: "http://localhost:8080",
  chainId: 1337,
  timeout: 10000,
};
